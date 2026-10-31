


import { stageScenery } from "./stageScenery";
import { f32 } from "wisp/src/sim/f32";
import { copyMatchCamera, createMatchCamera, limitCamera, MATCH_CAMERA_ASPECT, type MatchCamera } from "../sim/matchCamera";
import { arctangentDegrees } from "../sim/mathTables";
import { mainDeckLeft, mainDeckRight, mainDeckZAt } from "../sim/stage";
import { stageBounds } from "../sim/stageBounds";
import { NORDRASSIL_TOP_PLATFORM_Z, TOMB_OF_SARGERAS_STAGE, WIND_TEST_STAGE } from "../sim/stage";


export const FLOOR_HEIGHT = 1800.0;






export const WORLD_BOUNDS = { left: -4096.0, right: 4096.0, front: -4096.0, back: 8192.0 } as const;
export const HIDDEN_EFFECT_DEPTH = 8192.0;
export const PLAYABLE_BOUNDS = { left: -3328.0, right: 3328.0, front: -3584.0, back: 3072.0, centreY: -256.0 } as const;


export const ARENA_CAMERA = { rotation: 90.0, angleOfAttack: 350.0 } as const;


export const ARENA_FOG_FAR_MARGIN = 1000.0;

export function arenaDepthOffset(camera: Readonly<Pick<MatchCamera, "distance" | "z">>): number {
  return camera.distance + camera.z * 0.1736481785774231;
}

export function arenaFarZ(stage: number, camera: Readonly<Pick<MatchCamera, "distance" | "z">>): number {
  return Math.max(stageScenery(stage).farZ + arenaDepthOffset(camera), arenaFogEnd(stage) + ARENA_FOG_FAR_MARGIN);
}

const fogOffsets: Record<number, number | undefined> = {};

export function arenaFogOffset(stage: number): number {
  const cached = fogOffsets[stage];
  if (cached !== undefined) return cached;
  const bounds = stageBounds(stage);
  const camera = createMatchCamera();
  camera.distance = 100000.0;
  limitCamera(camera, bounds.camera, 0.00390625, bounds.blast.bottom);
  const offset = camera.distance + bounds.camera.top * 0.1736481785774231;
  fogOffsets[stage] = offset;
  return offset;
}

export function arenaFogEnd(stage: number): number {
  const scenery = stageScenery(stage);
  return Math.max(scenery.fog?.end ?? 0.0, scenery.farZ - ARENA_FOG_FAR_MARGIN) + arenaFogOffset(stage);
}

export function localCamera(target: MatchCamera, source: Readonly<MatchCamera>, stage: number, aspect: number): void {
  copyMatchCamera(target, source);
  const bounds = stageBounds(stage);
  limitCamera(target, bounds.camera, aspect, bounds.blast.bottom);
}

export function cameraFieldOfView(camera: Readonly<MatchCamera>, aspect: number): number {
  return f32(2.0 * arctangentDegrees(f32(camera.tangent * aspect)));
}

const CLOCK_CLEAR_ROW = f32(0.12);

function clearClock(camera: MatchCamera, platformZ: number): void {
  const reach = (0.5 - CLOCK_CLEAR_ROW) * 2.0 * camera.tangent;
  const below = reach * camera.distance / (0.9848077297210693 + reach * 0.1736481785774231);
  camera.z = Math.max(camera.z, platformZ - below);
}

export function finalCamera(camera: MatchCamera, stage: number): void {
  if (stage === TOMB_OF_SARGERAS_STAGE) camera.z = Math.max(camera.z, 80.0 - camera.distance * 0.1736481785774231);
  if (stage === WIND_TEST_STAGE) clearClock(camera, NORDRASSIL_TOP_PLATFORM_Z);
}


export type CameraExtreme = "near" | "far";


export const cameraZOverride: { z: number | undefined } = { z: undefined };

export function extremeCamera(target: MatchCamera, stage: number, aspect: number, extreme: CameraExtreme): void {
  const bounds = stageBounds(stage);
  target.x = 0.0;
  target.z = cameraZOverride.z ?? (extreme === "near" ? 100.0 : -100000.0);
  target.distance = extreme === "near" ? 1450.0 : 100000.0;
  target.tangent = extreme === "near" ? 0.2679491937160492 : 0.3443276286125183;
  limitCamera(target, bounds.camera, aspect, bounds.blast.bottom);
}


export interface ScreenPoint {
  column: number;
  row: number;
}

export interface CameraRay {
  across: number;
  up: number;
}

export function cameraRay(camera: Readonly<MatchCamera>, x: number, y: number, z: number, into: CameraRay = { across: 0.0, up: 0.0 }): Readonly<CameraRay> {
  const dz = z - camera.z;
  const depth = camera.distance + y * 0.9848077297210693 - dz * 0.1736481785774231;
  into.across = (x - camera.x) / depth;
  into.up = (y * 0.1736481785774231 + dz * 0.9848077297210693) / depth;
  return into;
}

export function rayPoint(camera: Readonly<MatchCamera>, across: number, up: number, y: number, into: { x: number; z: number }): void {
  const dz = (up * (camera.distance + y * 0.9848077297210693) - y * 0.1736481785774231) / (0.9848077297210693 + up * 0.1736481785774231);
  into.x = camera.x + across * (camera.distance + y * 0.9848077297210693 - dz * 0.1736481785774231);
  into.z = camera.z + dz;
}

export function cameraPoint(camera: Readonly<MatchCamera>, aspect: number, x: number, z: number, into: ScreenPoint = { column: 0.0, row: 0.0 }): Readonly<ScreenPoint> {
  const dz = z - camera.z;
  const depth = camera.distance - dz * 0.1736481785774231;
  into.column = 0.5 + (x - camera.x) / (2.0 * depth * camera.tangent * aspect);
  into.row = 0.5 - dz * 0.9848077297210693 / (2.0 * depth * camera.tangent);
  return into;
}


export function arenaFraming(stage: number, left: number, right: number, bottom: number, top: number): { readonly x: number; readonly z: number; readonly distance: number; readonly fieldOfView: number } {
  const camera = createMatchCamera();
  camera.tangent = 0.3443276286125183;
  camera.x = f32(f32(left + right) / 2.0);
  camera.z = f32(f32(bottom + top) / 2.0);
  camera.distance = Math.max(1450.0, right - left, top - bottom);
  limitCamera(camera, stageBounds(stage).camera, MATCH_CAMERA_ASPECT);
  return { x: camera.x, z: camera.z, distance: camera.distance, fieldOfView: cameraFieldOfView(camera, MATCH_CAMERA_ASPECT) };
}

export const RESULTS_CAMERA_FRAMES = 30;
export const RESULT_MARGIN = 120.0;

export function resultFighterPlacement(stage: number, index: number, count: number): { readonly x: number; readonly z: number } {
  const centre = (mainDeckLeft(stage) + mainDeckRight(stage)) / 2.0;
  const spacing = Math.min(200.0, (mainDeckRight(stage) - mainDeckLeft(stage)) / (count + 1));
  const x = centre + (index - (count - 1) / 2.0) * spacing;
  return { x, z: mainDeckZAt(stage, x) };
}

export function resultCamera(camera: MatchCamera, stage: number, aspect: number, frame: number, count: number): void {
  const goal = createMatchCamera();
  goal.x = (mainDeckLeft(stage) + mainDeckRight(stage)) / 2.0;
  goal.z = mainDeckZAt(stage, goal.x) + 80.0;
  const reach = count > 1 ? resultFighterPlacement(stage, count - 1, count).x - goal.x + RESULT_MARGIN : 0.0;
  goal.distance = Math.max(750.0, reach / (0.2679491937160492 * aspect));
  goal.tangent = 0.2679491937160492;
  camera.distance = Math.min(camera.distance, 950.0);
  if (frame >= RESULTS_CAMERA_FRAMES - 1) {
    copyMatchCamera(camera, goal);
    return;
  }
  const before = frame / RESULTS_CAMERA_FRAMES;
  const after = (frame + 1) / RESULTS_CAMERA_FRAMES;
  const easedBefore = before * before * (3.0 - 2.0 * before);
  const easedAfter = after * after * (3.0 - 2.0 * after);
  const rate = (easedAfter - easedBefore) / (1.0 - easedBefore);
  camera.x += (goal.x - camera.x) * rate;
  camera.z += (goal.z - camera.z) * rate;
  camera.distance += (goal.distance - camera.distance) * rate;
  camera.tangent += (goal.tangent - camera.tangent) * rate;
}
