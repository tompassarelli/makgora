import { preloadModels, preloadSkies } from "../../game/presentation/stagePreload";
import { drawnScale, driftingPieces, pointLightPieces, STOCK_TERRAIN_LIGHT, STOCK_UNIT_LIGHT, placedPieces, shadowCastingLights, stageScenery, type SceneryPiece, type StageSkyLook } from "../../game/presentation/stageScenery";
import { driftPose, type DriftingPiece } from "../../game/presentation/driftingScenery";
import { hideEffect } from "../../game/render/effects";
import type { ShellState, StageDrifter } from "./state";
import { clockSeconds } from "./trace";
import { arenaFogOffset, arenaFogEnd, cameraZOverride } from "../../game/presentation/arenaCamera";

function updateStageFog(s: ShellState): void {
  if (s.stageFogHidden === true || s.stageFogOverride === true) return;
  const scenery = stageScenery(s.game.stageChoice);

  const fog = scenery.fog;
  if (fog === undefined) { ResetTerrainFog(); return; }
  const offset = arenaFogOffset(s.game.stageChoice);
  const end = arenaFogEnd(s.game.stageChoice);
  SetTerrainFogEx(0, fog.start + offset, end, 0.0, fog.red, fog.green, fog.blue);
  const height = scenery.heightFog;
  if (height === undefined) return;
  SetTerrainFogExV(3, height.start + offset, Math.max(height.end + offset, end), height.density,
    s.origin.z + height.heightStart, s.origin.z + height.heightEnd,
    fog.start + offset, end, fog.red, fog.green, fog.blue);
}

function drawStageFog(s: ShellState): void {
  s.stageFogOverride = undefined;
  BlzSetTerrainFogMaxLinearDensity(1.0);
  BlzSetTerrainFogDrawOverSky(false);
  updateStageFog(s);
  const height = stageScenery(s.game.stageChoice).heightFog;
  if (height === undefined) return;
  BlzSetTerrainFogMaxLinearDensity(height.maxDensity);
  BlzSetTerrainFogDrawOverSky(height.drawOverSky);
}


function addPiece(s: ShellState, piece: Readonly<SceneryPiece>, animation: animtype): effect {
  const x = s.origin.x + piece.x;
  const y = s.origin.y + piece.y;
  const effect = AddSpecialEffect(piece.model, x, y);
  BlzSetSpecialEffectPosition(effect, x, y, s.origin.z + piece.z);
  const drawn = drawnScale(piece);
  BlzSetSpecialEffectScale(effect, drawn.scale);
  if (piece.color !== undefined) BlzSetSpecialEffectColor(effect, piece.color[0], piece.color[1], piece.color[2]);
  BlzSetSpecialEffectYaw(effect, piece.yaw * (Math.PI / 180.0));
  if (drawn.matrixScale !== undefined) BlzSetSpecialEffectMatrixScale(effect, drawn.matrixScale[0], drawn.matrixScale[1], drawn.matrixScale[2]);
  BlzPlaySpecialEffect(effect, animation);
  if (piece.still === true) BlzSetSpecialEffectTimeScale(effect, 0.0);
  return effect;
}

function addDrifter(s: ShellState, piece: Readonly<DriftingPiece>): StageDrifter {
  const pose = driftPose(piece, clockSeconds(s.trace));
  const effect = addPiece(s, { ...piece, x: pose.x, z: pose.z, yaw: 0.0 }, ANIM_TYPE_WALK);
  BlzSetSpecialEffectYaw(effect, pose.yaw);
  return { effect, piece };
}

export function presentDrifters(s: ShellState): void {
  const seconds = clockSeconds(s.trace);
  for (const { effect, piece } of s.stageDrifters) {
    const pose = driftPose(piece, seconds);
    BlzSetSpecialEffectPosition(effect, s.origin.x + pose.x, s.origin.y + piece.y, s.origin.z + pose.z);
  }
}

function drawStageSkyLook(look: StageSkyLook | undefined): void {
  if (typeof WispSetSkyLook !== "function") return;
  if (look === undefined) { WispResetSkyLook(); return; }
  WispSetSkyLook(look.zenith[0], look.zenith[1], look.zenith[2], look.cover, look.sunAzimuth, look.sunElevation, look.sun[0], look.sun[1], look.sun[2], look.stars, look.glow);
}

export function drawStageScenery(s: ShellState): void {
  for (const effect of [...(s.stageScenery ?? []), ...s.stageDrifters.map(drifter => drifter.effect)]) {

    hideEffect(effect, s.origin);
    DestroyEffect(effect);
  }
  const scenery = stageScenery(s.game.stageChoice);

  BlzShowTerrain(false);
  SetSkyModel(scenery.sky);
  drawStageSkyLook(scenery.skyLook);
  SetDayNightModels(STOCK_TERRAIN_LIGHT, STOCK_UNIT_LIGHT);
  s.stageFogHidden = false;
  drawStageFog(s);

  const shadows = shadowCastingLights(s.game.stageChoice);
  if (shadows > 0 || s.shadowLightsRaised) BlzSetMinShadowCastingPointLightCount(shadows);
  s.shadowLightsRaised = shadows > 0;
  s.stageScenery = placedPieces(s.game.stageChoice).map(piece => addPiece(s, piece, ANIM_TYPE_STAND));
  s.stageDrifters = driftingPieces(s.game.stageChoice).map(piece => addDrifter(s, piece));
}


export function preloadStageAssets(origin: Readonly<{ x: number; y: number; z: number }>): void {
  const { x, y } = origin;
  for (const model of preloadModels()) {
    const effect = AddSpecialEffect(model, x, y);
    hideEffect(effect, origin);
    DestroyEffect(effect);
  }
  for (const sky of preloadSkies()) SetSkyModel(sky);
}






export function showBackdrop(s: ShellState, visible: boolean): void {
  BlzShowSkyBox(visible);
  const alpha = visible ? 255 : 0;
  const pieces = placedPieces(s.game.stageChoice);
  for (const [index, effect] of (s.stageScenery ?? []).entries()) {
    const piece = pieces[index];
    if (!visible || piece === undefined) hideEffect(effect, s.origin);
    else {
      BlzSetSpecialEffectPosition(effect, s.origin.x + piece.x, s.origin.y + piece.y, s.origin.z + piece.z);
      const drawn = drawnScale(piece);
      BlzSetSpecialEffectScale(effect, drawn.scale);

      if (drawn.matrixScale !== undefined) {
        BlzResetSpecialEffectMatrix(effect);
        BlzSetSpecialEffectYaw(effect, piece.yaw * (Math.PI / 180.0));
        BlzSetSpecialEffectMatrixScale(effect, drawn.matrixScale[0], drawn.matrixScale[1], drawn.matrixScale[2]);
      }
    }
  }
  for (const { effect, piece } of s.stageDrifters) {
    if (visible) BlzSetSpecialEffectScale(effect, piece.scale);
    else hideEffect(effect, s.origin);
  }
  if (visible) presentDrifters(s);
  for (const deck of [...s.stageDecks, ...s.stageDeckParts]) BlzSetSpecialEffectAlpha(deck, alpha);
  showStageFog(s, visible);
}


export function showStageFog(s: ShellState, visible: boolean): void {
  s.stageFogHidden = !visible;
  if (visible) drawStageFog(s);
  else {
    BlzSetTerrainFogMaxLinearDensity(1.0);
    BlzSetTerrainFogDrawOverSky(false);
    SetTerrainFogEx(0, 100000.0, 200000.0, 0.0, 0.0, 0.0, 0.0);
  }
}

/** Same paused scene, the scenery's stock colours versus the stage's mood; the fighters' light never changes. */
export function showStageLighting(s: ShellState, authored: boolean): void {
  const pieces = placedPieces(s.game.stageChoice, authored);
  for (const [index, effect] of (s.stageScenery ?? []).entries()) {
    const color = pieces[index]?.color;
    if (color !== undefined) BlzSetSpecialEffectColor(effect, color[0], color[1], color[2]);
  }
}

export function leverCommand(s: ShellState, name: string, a: string, b: string): void {
  if (name === "fog") showStageFog(s, a === "on");
  else if (name === "density") BlzSetTerrainFogMaxLinearDensity(S2R(a));
  else if (name === "oversky") BlzSetTerrainFogDrawOverSky(a === "on");
  else if (name === "sky") BlzShowSkyBox(a === "on");
  else if (name === "camz") cameraZOverride.z = a === "off" ? undefined : S2R(a);
  else if (name === "shadows") BlzSetMinShadowCastingPointLightCount(S2I(a));
  else if (name === "light") {
    const lights = pointLightPieces(s.game.stageChoice);
    const effects = s.stageScenery ?? [];
    const index = S2I(a);
    const effect = effects[effects.length - lights.length + index];
    const piece = lights[index];
    if (effect === undefined || piece === undefined) return;
    if (b === "off") hideEffect(effect, s.origin);
    else {
      BlzSetSpecialEffectPosition(effect, s.origin.x + piece.x, s.origin.y + piece.y, s.origin.z + piece.z);
      BlzSetSpecialEffectScale(effect, piece.scale);
    }
  }
}
