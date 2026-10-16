import type { Rgba } from "./blp";

export const PREVIEW_ENTRY = "war3mapMap.blp";
export const PREVIEW_FILE = "SmashcraftByTompasPreview.tga";

const PALETTE = 156;
const PIXELS = PALETTE + 1024;


export function encodePreview(image: Rgba): Uint8Array {
  const pixels = image.width * image.height;
  const out = new Uint8Array(PIXELS + pixels), view = new DataView(out.buffer);
  out.set([66, 76, 80, 49]);
  view.setUint32(4, 1, true);
  view.setUint32(12, image.width, true);
  view.setUint32(16, image.height, true);
  view.setUint32(20, 5, true);
  view.setUint32(28, PIXELS, true);
  view.setUint32(92, pixels, true);
  const colors = new Map<number, number>();
  for (let i = 0; i < pixels; i++) {
    const rgb = ((image.data[i * 4] ?? 0) << 16) | ((image.data[i * 4 + 1] ?? 0) << 8) | (image.data[i * 4 + 2] ?? 0);
    let index = colors.get(rgb);
    if (index === undefined) {
      index = colors.size;
      if (index > 255) throw new Error("the map preview needs at most 256 colours; quantise its source");
      colors.set(rgb, index);
      out[PALETTE + index * 4] = rgb & 255;
      out[PALETTE + index * 4 + 1] = (rgb >> 8) & 255;
      out[PALETTE + index * 4 + 2] = rgb >> 16;
    }
    out[PIXELS + i] = index;
  }
  return out;
}
