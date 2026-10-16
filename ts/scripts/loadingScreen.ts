import { generateMDX } from "war3-model";
import type { Rgba } from "./blp";
import { parseModelMDX } from "./mdxCodec";

export const LOADING_SCREEN_MODEL = "war3mapImported\\SmashcraftLoading.mdx";
export const LOADING_SCREEN_STOCK_MODEL = "TutorialBackground.mdx";
export const LOADING_SCREEN_PICTURE = "SmashcraftByTompasLoading.tga";

const QUADRANTS = [
  { entry: "war3mapImported\\SmashcraftLoadingBotLeft.blp", x: 0, y: 512, width: 512, height: 256 },
  { entry: "war3mapImported\\SmashcraftLoadingBotRight.blp", x: 512, y: 512, width: 512, height: 256 },
  { entry: "war3mapImported\\SmashcraftLoadingTopRight.blp", x: 512, y: 0, width: 512, height: 512 },
  { entry: "war3mapImported\\SmashcraftLoadingTopLeft.blp", x: 0, y: 0, width: 512, height: 512 },
] as const;
export const LOADING_SCREEN_CLEAR = "war3mapImported\\SmashcraftLoadingClear.blp";

const TEXTURE_BYTES = 268;
const PATH_BYTES = 260;


export function loadingScreenTextures(picture: Rgba): { entry: string; image: Rgba }[] {
  if (picture.width !== 1024 || picture.height !== 768) throw new Error("the loading screen picture must be 1024x768");
  const quadrants = QUADRANTS.map(({ entry, x, y, width, height }) => {
    const data = new Uint8Array(width * height * 4);
    for (let row = 0; row < height; row++) data.set(picture.data.subarray(((y + row) * 1024 + x) * 4, ((y + row) * 1024 + x + width) * 4), row * width * 4);
    return { entry, image: { width, height, data, alpha: false } };
  });
  return [...quadrants, { entry: LOADING_SCREEN_CLEAR, image: { width: 8, height: 8, data: new Uint8Array(8 * 8 * 4), alpha: true } }];
}

// MDX TEXS chunk: each texture is a u32 replaceable id, a 260-byte path and u32 flags.
export function retargetLoadingModel(model: Uint8Array): Uint8Array {
  const out = model.slice(), view = new DataView(out.buffer);
  let at = 4;
  while (at + 8 <= out.length && String.fromCharCode(...out.subarray(at, at + 4)) !== "TEXS") at += 8 + view.getUint32(at + 4, true);
  if (at + 8 > out.length) throw new Error("the loading screen model has no textures");
  const count = view.getUint32(at + 4, true) / TEXTURE_BYTES;
  for (let index = 0; index < count; index++) {
    const path = new TextEncoder().encode(QUADRANTS[index]?.entry ?? LOADING_SCREEN_CLEAR);
    const start = at + 8 + index * TEXTURE_BYTES + 4;
    out.fill(0, start, start + PATH_BYTES);
    out.set(path, start);
  }
  return out;
}

export function classicModel(model: Uint8Array): Uint8Array {
  const parsed = parseModelMDX(model.slice().buffer);
  parsed.Version = 800;
  return new Uint8Array(generateMDX(parsed));
}
