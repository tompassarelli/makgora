import { expect, test } from "bun:test";
import { readTga } from "../scripts/blp";
import { encodeMapPortrait, unfadeBust } from "../scripts/wisp/mapInputs";

const SIDE = 8;

const transparentEdgedTga = (): Uint8Array => {
  const bytes = new Uint8Array(18 + SIDE * SIDE * 4);
  bytes[2] = 2;
  new DataView(bytes.buffer).setUint16(12, SIDE, true);
  new DataView(bytes.buffer).setUint16(14, SIDE, true);
  bytes[16] = 32;
  bytes[17] = 8 | 32;
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      const fade = Math.min(Math.min(1, (1 - y / SIDE) / 0.3), Math.min(x / (SIDE * 0.1), (SIDE - x) / (SIDE * 0.1)));
      const at = 18 + (y * SIDE + x) * 4;
      bytes.set([40, 90, 160, x < SIDE / 2 ? Math.round(255 * fade) : 0], at);
    }
  }
  return bytes;
};

test("a fighter's portrait keeps its transparency in the map without fading out toward its bottom edge, so the match HUD bust stands opaque with no race-colour square behind it [k2 property]", () => {
  const tga = transparentEdgedTga();
  const unfaded = unfadeBust(readTga(tga));
  for (let y = 0; y < SIDE; y++) {
    expect(unfaded.data[((y * SIDE + 2) * 4) + 3]).toBe(255);
    expect(unfaded.data[((y * SIDE + 6) * 4) + 3]).toBe(0);
  }
  const blp = encodeMapPortrait(tga);
  expect(new DataView(blp.buffer, blp.byteOffset, blp.byteLength).getUint32(8, true)).toBe(8);
});
