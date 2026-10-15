import type { Frame } from "wisp/scripts/wisp/frameProbe";
import type { Rgba } from "../blp";

export const pixelPoint = (frame: Frame, x: number, y: number) => ({
  x: Math.round((frame.width - frame.height * 4 / 3) / 2 + x * frame.height / 0.6),
  y: Math.round(frame.height - y * frame.height / 0.6),
});

export interface UiRect { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

export function texturePixels(frame: Frame, texture: Rgba, x: number, y: number, uiWidth: number, uiHeight: number, covered?: UiRect): { error: number; pixels: number; matchedPixels: number } | undefined {
  const origin = pixelPoint(frame, x, y);
  const width = Math.round(uiWidth * frame.height / 0.6);
  const height = Math.round(uiHeight * frame.height / 0.6);
  const cover = covered === undefined ? undefined : { ...pixelPoint(frame, covered.left, covered.top), width: Math.round(covered.width * frame.height / 0.6), height: Math.round(covered.height * frame.height / 0.6) };
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
      if (cover !== undefined && sx >= cover.x && sx < cover.x + cover.width && sy >= cover.y && sy < cover.y + cover.height) continue;
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
