import { createHash } from "node:crypto";
import { join } from "node:path";
import { Effect } from "effect";
import { AcceptFailure } from "wisp/scripts/wisp/accept";
import type { Frame } from "wisp/scripts/wisp/frameProbe";
import { type Texels, texels } from "wisp/scripts/wisp/screenBounds";
import { parseMDX } from "wisp/vendor/war3-model.mjs";
import { type Rgba } from "../blp";
import { headlessRender } from "./headlessRender";
import { texturePixels } from "./uiTexture";

export interface StockCursor {
  readonly atlas: Texels;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly u: number;
  readonly v: number;
  readonly uWidth: number;
  readonly vHeight: number;
  readonly modelSha256: string;
  readonly textureSha256: string;
}

export const loadStockCursor = (documents: string, directory: string, operation: string) => Effect.gen(function*() {
  const prefix = documents.split("/pfx/")[0];
  if (prefix === undefined || !prefix.includes("/wisp/lan/clients/")) return yield* new AcceptFailure({ operation, problem: "requires the selected offline pool install" });
  const renderer = headlessRender({ storage: join(prefix, "pfx/drive_c/Program Files (x86)/Warcraft III"), imports: [], cache: join(directory, "assets") });
  return yield* Effect.tryPromise({
    try: async (): Promise<StockCursor> => {
      const modelBytes = await renderer.readAsset("UI\\Cursor\\HumanCursor.mdx", "classic");
      const textureBytes = await renderer.readAsset("UI\\Cursor\\HumanCursor.blp", "classic");
      if (modelBytes === undefined || textureBytes === undefined) throw new Error("installed Classic HumanCursor model or texture is missing");
      const model = parseMDX(modelBytes.slice().buffer);
      const atlas = texels(textureBytes);
      const plane = model.Geosets[0];
      const uv = plane?.TVertices[0];
      const normal = model.Sequences.find(sequence => sequence.Name === "Normal");
      const translation = model.TextureAnims[0]?.Translation?.Keys.find(key => key.Frame === normal?.Interval[0])?.Vector;
      if (atlas === undefined || plane === undefined || uv === undefined || normal === undefined || translation === undefined) throw new Error("installed cursor has no Normal sprite geometry");
      const xs = Array.from(plane.Vertices).filter((_, index) => index % 3 === 0);
      const ys = Array.from(plane.Vertices).filter((_, index) => index % 3 === 1);
      const us = Array.from(uv).filter((_, index) => index % 2 === 0);
      const vs = Array.from(uv).filter((_, index) => index % 2 === 1);
      return { atlas, left: Math.min(...xs), top: Math.max(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), u: Math.min(...us) + (translation[0] ?? 0), v: Math.min(...vs) + (translation[1] ?? 0), uWidth: Math.max(...us) - Math.min(...us), vHeight: Math.max(...vs) - Math.min(...vs), modelSha256: createHash("sha256").update(modelBytes).digest("hex"), textureSha256: createHash("sha256").update(textureBytes).digest("hex") };
    },
    catch: cause => new AcceptFailure({ operation, problem: String(cause) }),
  });
});

const stockCursorTexture = (cursor: StockCursor, frame: Frame): Rgba => {
  const width = Math.round(cursor.width * frame.height / 0.6);
  const height = Math.round(cursor.height * frame.height / 0.6);
  const texture: Rgba = { width, height, data: new Uint8Array(width * height * 4), alpha: true };
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    const ax = (cursor.u + (px + 0.5) * cursor.uWidth / width) * cursor.atlas.width - 0.5;
    const ay = (cursor.v + (py + 0.5) * cursor.vHeight / height) * cursor.atlas.height - 0.5;
    const ix = Math.floor(ax), iy = Math.floor(ay), fx = ax - ix, fy = ay - iy;
    for (let channel = 0; channel < 4; channel++) texture.data[(py * width + px) * 4 + channel] = Math.round((cursor.atlas.data[(iy * cursor.atlas.width + ix) * 4 + channel] ?? 0) * (1 - fx) * (1 - fy) + (cursor.atlas.data[(iy * cursor.atlas.width + ix + 1) * 4 + channel] ?? 0) * fx * (1 - fy) + (cursor.atlas.data[((iy + 1) * cursor.atlas.width + ix) * 4 + channel] ?? 0) * (1 - fx) * fy + (cursor.atlas.data[((iy + 1) * cursor.atlas.width + ix + 1) * 4 + channel] ?? 0) * fx * fy);
  }
  return texture;
};

export const stockCursorAt = (cursor: StockCursor, frame: Frame, x: number, y: number) =>
  texturePixels(frame, stockCursorTexture(cursor, frame), x + cursor.left, y + cursor.top, cursor.width, cursor.height);

export const locateStockCursor = (cursor: StockCursor, frame: Frame) => {
  const texture = stockCursorTexture(cursor, frame);
  let best: { x: number; y: number; pixelX: number; pixelY: number; error: number; pixels: number; matchedPixels: number } | undefined;
  for (let py = 0; py < frame.height; py += 4) for (let px = 0; px < frame.width; px += 4) {
    const left = (px - (frame.width - frame.height * 4 / 3) / 2) * 0.6 / frame.height;
    const top = (frame.height - py) * 0.6 / frame.height;
    const match = texturePixels(frame, texture, left, top, cursor.width, cursor.height);
    if (match !== undefined && match.error <= 24 && match.matchedPixels >= match.pixels * 0.8 && (best === undefined || match.error < best.error)) best = { x: left - cursor.left, y: top - cursor.top, pixelX: Math.round(px - cursor.left * frame.height / 0.6), pixelY: Math.round(py + cursor.top * frame.height / 0.6), ...match };
  }
  return best;
};
