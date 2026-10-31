import { expect, test } from "bun:test";
import { placedPieces } from "../src/game/presentation/stageScenery";
import { FROZEN_THRONE_STAGE } from "../src/game/sim/stage";
import { drawStageScenery } from "../src/host/loop/stageScenery";

const FLOE = "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx";

test("every ice floe of the Frozen Throne spire and stair is placed still [k2 property]", () => {
  const floes = placedPieces(FROZEN_THRONE_STAGE).filter(piece => piece.model === FLOE);
  expect(floes.length).toBeGreaterThanOrEqual(15);
  expect(floes.every(piece => piece.still === true)).toBe(true);
});

test("the shell stops the animation of each still Frozen Throne piece the moment it places it and no other piece [k1 scenario]", () => {
  const models = new Map<number, string>();
  const stopped = new Set<number>();
  const noop = () => undefined;
  Object.assign(globalThis, {
    ANIM_TYPE_STAND: 0, ANIM_TYPE_WALK: 1,
    BlzShowTerrain: noop, SetSkyModel: noop, SetDayNightModels: noop, ResetTerrainFog: noop, SetTerrainFogEx: noop, SetTerrainFogExV: noop,
    BlzSetTerrainFogMaxLinearDensity: noop, BlzSetTerrainFogDrawOverSky: noop, BlzSetMinShadowCastingPointLightCount: noop,
    BlzSetSpecialEffectPosition: noop, BlzSetSpecialEffectScale: noop, BlzSetSpecialEffectColor: noop, BlzSetSpecialEffectYaw: noop,
    BlzSetSpecialEffectMatrixScale: noop, BlzPlaySpecialEffect: noop,
    AddSpecialEffect: (model: string) => { models.set(models.size, model); return models.size - 1; },
    BlzSetSpecialEffectTimeScale: (effect: number, scale: number) => { if (scale === 0) stopped.add(effect); },
  });
  const shell = { game: { stageChoice: FROZEN_THRONE_STAGE }, origin: { x: 0, y: 0, z: 0 }, stageDrifters: [], stageScenery: undefined, shadowLightsRaised: false };
  drawStageScenery(shell as never);

  const placed = placedPieces(FROZEN_THRONE_STAGE);
  const stills = placed.flatMap((piece, index) => (piece.still === true ? [index] : []));
  expect(stills.length).toBeGreaterThanOrEqual(15);
  expect([...stopped].sort((a, b) => a - b)).toEqual(stills);
});
