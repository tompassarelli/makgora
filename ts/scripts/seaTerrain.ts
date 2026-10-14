import { decodeTerrain } from "wisp/scripts/wisp/terrain";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { STAGE_SEA_LEVEL_Z } from "../src/game/assets/stageWater";

// war3map.w3e points: int16 height (0x2000 + 4 per unit), uint16 water (low 14 bits, same scale; top two bits are map-edge flags), ground tile with ramp/blight/water/boundary flags, variation, then cliff tile and layer nibbles.
const RAMP = 0x1, BLIGHT = 0x2, WATER = 0x4;

export function seaTerrain(bytes: Uint8Array): Uint8Array {
  const terrain = decodeTerrain(bytes);
  const size = terrain.version === 12 ? 8 : 7;
  const header = 37 + 4 * (terrain.groundTiles.length + terrain.cliffTiles.length);
  const output = bytes.slice(), view = new DataView(output.buffer);
  const centre = header + (Math.floor(terrain.rows / 2) * terrain.columns + Math.floor(terrain.columns / 2)) * size;
  const height = view.getInt16(centre, true), layer = (output[centre + size - 1] ?? 0) & 0x0f;
  const ground = (height - 0x2000) / 4 + (layer - 2) * 128;
  if (ground !== 0) throw new Error(`the base map's centre ground is z ${ground}, not the z 0 the arena origin stands on`);
  const level = Math.round(4 * (FLOOR_HEIGHT + STAGE_SEA_LEVEL_Z)) + 0x2000;
  if (level < 0 || level > 0x3fff) throw new Error(`sea level ${(level - 0x2000) / 4} does not fit war3map.w3e's water field`);
  const shift = terrain.version === 12 ? 6 : 4;
  const cleared = (WATER | RAMP | BLIGHT) << shift, water = WATER << shift;
  for (let index = 0; index < terrain.columns * terrain.rows; index++) {
    const at = header + index * size;
    view.setInt16(at, height, true);
    view.setUint16(at + 2, (view.getUint16(at + 2, true) & 0xc000) | level, true);
    if (terrain.version === 12) view.setUint16(at + 4, (view.getUint16(at + 4, true) & ~cleared) | water, true);
    else output[at + 4] = ((output[at + 4] ?? 0) & ~cleared) | water;
    output[at + size - 1] = ((output[at + size - 1] ?? 0) & 0xf0) | layer;
  }
  return output;
}
