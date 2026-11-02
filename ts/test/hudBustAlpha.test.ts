import { expect, test } from "bun:test";
import { encodeMapPortrait } from "../scripts/wisp/mapInputs";

const SIDE = 8;

const transparentEdgedTga = (): Uint8Array => {
  const bytes = new Uint8Array(18 + SIDE * SIDE * 4);
  bytes[2] = 2;
  new DataView(bytes.buffer).setUint16(12, SIDE, true);
  new DataView(bytes.buffer).setUint16(14, SIDE, true);
  bytes[16] = 32;
  bytes[17] = 8;
  for (let pixel = 0; pixel < SIDE * SIDE; pixel++) {
    const at = 18 + pixel * 4;
    bytes.set([40, 90, 160, pixel % SIDE < SIDE / 2 ? 255 : 0], at);
  }
  return bytes;
};

test("a fighter's portrait keeps its transparency in the map, so the match HUD bust stands free with no race-colour square behind it [k2 property]", () => {
  const blp = encodeMapPortrait(transparentEdgedTga());
  expect(new DataView(blp.buffer, blp.byteOffset, blp.byteLength).getUint32(8, true)).toBe(8);
});
