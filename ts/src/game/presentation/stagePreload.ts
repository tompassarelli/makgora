
import { STAGE_DECK_MODEL, STAGE_DECK_MODELS, STAGE_MAIN_DECK_MODEL } from "../../generated/stages/stageAssetInfo";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { surfaceCount } from "../sim/stage";
import { hasCannon, hasTide } from "../sim/stageHazards";
import { hasLava } from "../sim/lava";
import { STAGE_LAVA_MODEL } from "../../generated/stages/terrainAssetInfo";
import { CANNON_MODEL, HYDRA_CREST_MODEL, HYDRA_RING_MODEL } from "./stageHazards";
import { placedPieces, stageScenery } from "./stageScenery";
import { platformParts } from "./stockPlatforms";
import { CARRIED_TEST_STAGE, SKY_STAGE, TOMB_OF_SARGERAS_STAGE, surfacePass } from "../sim/stage";
import { f32 } from "wisp/src/sim/f32";
import { stageEdgeLight, STAGE_EDGE_LIGHT_MODEL } from "./stageEdgeLights";


export function deckModel(stage: number, index: number): string {
  const [stock] = platformParts(stage, index);
  if (stock !== undefined) return stock.model;
  const themed = STAGE_DECK_MODELS[stage];
  if (index === 0) return themed === undefined ? STAGE_MAIN_DECK_MODEL : themed.main;
  if (themed?.alternate !== undefined && (stage === CARRIED_TEST_STAGE ? index === 1 : index === 2)) return themed.alternate;
  return themed === undefined ? STAGE_DECK_MODEL : themed.slab;
}






function passSlabDepth(stage: number): number {
  if (stage === TOMB_OF_SARGERAS_STAGE) return 2.0;
  if (stage === CARRIED_TEST_STAGE) return 1.0;
  return f32(0.45);
}

export function slabScale(stage: number, index: number, width: number): readonly [x: number, y: number, z: number] | undefined {
  if (index === 0) return undefined;
  const pass = surfacePass(stage, index);
  return [width / 100, pass ? f32(0.65) : 1.0, pass ? passSlabDepth(stage) : 1.0];
}


export function stageModels(stage: number): string[] {
  const models: string[] = [];
  for (let index = 0; index < surfaceCount(stage); index++) {
    models.push(deckModel(stage, index));
    for (const part of platformParts(stage, index).slice(1)) models.push(part.model);
  }
  if (hasCannon(stage)) models.push(CANNON_MODEL);
  if (hasLava(stage)) models.push(STAGE_LAVA_MODEL);
  if (hasTide(stage)) models.push(HYDRA_CREST_MODEL, HYDRA_RING_MODEL);
  for (const piece of placedPieces(stage)) models.push(piece.model);
  for (const piece of stageScenery(stage).drifters ?? []) models.push(piece.model);
  if (stageEdgeLight(stage, 0, 0) !== undefined) models.push(STAGE_EDGE_LIGHT_MODEL);
  return models;
}


/** Every stage a match can start on: the selectable ones and the Sky stage, which the tutorial and a developer quick match play on. */
export const PRELOAD_STAGES: readonly number[] = [SKY_STAGE, ...STAGE_CATALOG.map(({ id }) => id)];

export function preloadModels(): string[] {
  const models: string[] = [];
  for (const id of PRELOAD_STAGES) for (const model of stageModels(id)) if (!models.includes(model)) models.push(model);
  return models;
}

/** Each distinct sky of every selectable stage. */
export function preloadSkies(): string[] {
  const skies: string[] = [];
  for (const id of PRELOAD_STAGES) {
    const { sky } = stageScenery(id);
    if (!skies.includes(sky)) skies.push(sky);
  }
  return skies;
}
