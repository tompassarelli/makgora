import type { Frame } from "wisp/scripts/wisp/frameProbe";
import type { Rgba } from "../blp";

export const pixelPoint = (frame: Frame, x: number, y: number) => ({
  x: Math.round((frame.width - frame.height * 4 / 3) / 2 + x * frame.height / 0.6),
  y: Math.round(frame.height - y * frame.height / 0.6),
});

export interface UiRect { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

const reduced = new WeakMap<Rgba, Map<string, Rgba>>();

// The engine filters a texture drawn smaller than its source, so a box average of each target pixel's source texels stands in for it; nearest sampling would alias fine art.
function boxReduced(texture: Rgba, width: number, height: number): Rgba {
  if (texture.width <= width && texture.height <= height) return texture;
  const sizes = reduced.get(texture) ?? new Map<string, Rgba>();
  reduced.set(texture, sizes);
  const key = `${width}x${height}`;
  const cached = sizes.get(key);
  if (cached !== undefined) return cached;
  const data = new Uint8Array(width * height * 4);
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    const x0 = Math.floor(px * texture.width / width);
    const x1 = Math.max(x0 + 1, Math.ceil((px + 1) * texture.width / width));
    const y0 = Math.floor(py * texture.height / height);
    const y1 = Math.max(y0 + 1, Math.ceil((py + 1) * texture.height / height));
    const sum = [0, 0, 0, 0];
    let count = 0;
    for (let sy = y0; sy < Math.min(y1, texture.height); sy++) for (let sx = x0; sx < Math.min(x1, texture.width); sx++) {
      const at = (sy * texture.width + sx) * 4;
      const weight = (texture.data[at + 3] ?? 0) / 255;
      for (let channel = 0; channel < 3; channel++) sum[channel]! += (texture.data[at + channel] ?? 0) * weight;
      sum[3]! += weight;
      count++;
    }
    const out = (py * width + px) * 4;
    for (let channel = 0; channel < 3; channel++) data[out + channel] = sum[3]! > 0 ? Math.round(sum[channel]! / sum[3]!) : 0;
    data[out + 3] = Math.round(255 * sum[3]! / count);
  }
  const result = { width, height, data, alpha: texture.alpha };
  sizes.set(key, result);
  return result;
}

export function texturePixels(frame: Frame, full: Rgba, x: number, y: number, uiWidth: number, uiHeight: number, covered?: UiRect | readonly UiRect[]): { error: number; pixels: number; matchedPixels: number } | undefined {
  const origin = pixelPoint(frame, x, y);
  const width = Math.round(uiWidth * frame.height / 0.6);
  const height = Math.round(uiHeight * frame.height / 0.6);
  const texture = boxReduced(full, width, height);
  const covers = (covered === undefined ? [] : "left" in covered ? [covered] : covered).map(rect => ({ ...pixelPoint(frame, rect.left, rect.top), width: Math.round(rect.width * frame.height / 0.6), height: Math.round(rect.height * frame.height / 0.6) }));
  let best = Infinity;
  let bestPixels = 0;
  let bestMatchedPixels = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    let error = 0;
    let pixels = 0;
    let matchedPixels = 0;
    for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
      const source = (Math.min(texture.height - 1, Math.floor(py * texture.height / height)) * texture.width + Math.min(texture.width - 1, Math.floor(px * texture.width / width))) * 4;
      if ((texture.data[source + 3] ?? 0) < 240) continue;
      const sx = origin.x + px + dx;
      const sy = origin.y + py + dy;
      if (sx < 0 || sy < 0 || sx >= frame.width || sy >= frame.height) continue;
      if (covers.some(cover => sx >= cover.x && sx < cover.x + cover.width && sy >= cover.y && sy < cover.y + cover.height)) continue;
      const target = (sy * frame.width + sx) * 3;
      let pixelError = 0;
      for (let channel = 0; channel < 3; channel++) pixelError += Math.abs((frame.rgb[target + channel] ?? 0) - (texture.data[source + channel] ?? 0));
      error += pixelError;
      if (pixelError / 3 <= 24) matchedPixels++;
      pixels++;
    }
    if (pixels >= 32 && error / (pixels * 3) < best) {
      best = error / (pixels * 3);
      bestPixels = pixels;
      bestMatchedPixels = matchedPixels;
    }
  }
  return Number.isFinite(best) ? { error: best, pixels: bestPixels, matchedPixels: bestMatchedPixels } : undefined;
}

// A hand that runs off the left of the 4:3 area is whole on screen only when the window has that much margin beside the area; in a 4:3 window the screen clips it.
export const edgeRoom = (frame: Frame, left: number): boolean => (frame.width - frame.height * 4 / 3) / 2 >= -left * frame.height / 0.6 + 3;
