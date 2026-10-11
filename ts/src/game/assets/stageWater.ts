/**
 * #277: the sea under a water stage is the map's own terrain water, painted at
 * build time (smashcraft:ts/scripts/seaTerrain.ts) as one deep sheet across the
 * whole map. Terrain is static, so every water stage shares one surface height,
 * relative to the arena origin; each stage tints it with SetWaterBaseColor.
 */
export const STAGE_SEA_LEVEL_Z = -1300.0;

/** A water stage's terrain water: the Classic base colour SetWaterBaseColor multiplies the tileset's water by. */
export interface StageWater {
  readonly color: readonly [number, number, number];
}
