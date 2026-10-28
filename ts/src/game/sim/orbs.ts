import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod, idiv } from "wisp/src/sim/intMath";
import type { Fighter } from "./fighter";
import { hurtCapsule } from "./geometry/contactGeometry";
import { METER } from "./meter";
import { type MatchOrbs, OrbKind } from "./orbState";
import { STAGE_AT_REST, mainDeckZAt, surfaceCount, surfaceLeft, surfaceMoves, surfacePass, surfaceRight, surfaceZ } from "./stage";
import { melee } from "./tuning";

const FRAMES_PER_SECOND = 60;

export const ORB_INTERVAL_FRAMES = 15 * FRAMES_PER_SECOND;

export const ORBS_PER_MINUTE = 4;

export const ORB_WARNING_FRAMES = 3 * FRAMES_PER_SECOND;

export const ORB_HEIGHT = melee(10.0);

export const ORB_REACH = melee(10.0);

export const ULTIMATE_ORB_GAIN = idiv(METER.ultimateFrames, 2);

export interface OrbPoint {
  readonly x: number;
  readonly z: number;
}

export interface OrbClock {
  readonly orbs: Readonly<MatchOrbs>;
  readonly matchFrame: number;
  readonly startHold: number;
  readonly training: boolean;
  readonly run: { readonly active: boolean };
}

const POINT_BY_STAGE: Record<number, OrbPoint | undefined> = {};

export function orbPoint(stage: number): OrbPoint {
  const cached = POINT_BY_STAGE[stage];
  if (cached !== undefined) return cached;
  let point: OrbPoint = { x: 0.0, z: mainDeckZAt(stage, 0.0) };
  let gap = -1.0;
  for (let index = 0; index < surfaceCount(stage); index++) {
    if (surfaceMoves(stage, index) || surfacePass(stage, index)) continue;
    const left = surfaceLeft(stage, index, STAGE_AT_REST);
    const right = surfaceRight(stage, index, STAGE_AT_REST);
    const x = left > 0.0 ? left : right < 0.0 ? right : 0.0;
    const away = Math.abs(x);
    if (gap >= 0.0 && away >= gap) continue;
    gap = away;
    point = { x, z: index === 0 ? mainDeckZAt(stage, x) : surfaceZ(stage, index, STAGE_AT_REST) };
  }
  POINT_BY_STAGE[stage] = point;
  return point;
}

export const orbsActive = (clock: Readonly<OrbClock>): boolean => clock.orbs.on && !clock.training && !clock.run.active;

export const playedFrames = (clock: Readonly<OrbClock>): number => clock.matchFrame - clock.startHold;

export function scheduledOrb(spawnIndex: number): OrbKind {
  return floorMod(spawnIndex, ORBS_PER_MINUTE) === 0 ? OrbKind.ultimate : OrbKind.ex;
}

export function nextOrbIndex(played: number): number {
  return floorDiv(played, ORB_INTERVAL_FRAMES) + 1;
}

export function orbWarningFrames(clock: Readonly<OrbClock>): number | undefined {
  if (!orbsActive(clock)) return undefined;
  const played = playedFrames(clock);
  if (played < 0) return undefined;
  const left = nextOrbIndex(played) * ORB_INTERVAL_FRAMES - played;
  return left <= ORB_WARNING_FRAMES ? left : undefined;
}

export function warnedOrb(clock: Readonly<OrbClock>): OrbKind {
  if (clock.orbs.held !== OrbKind.none) return clock.orbs.held;
  return orbWarningFrames(clock) === undefined ? OrbKind.none : scheduledOrb(nextOrbIndex(playedFrames(clock)));
}

export function respawning(f: Readonly<Fighter>): boolean {
  return (f.status.out && f.status.stocks > 0) || (!f.status.out && f.status.invincible > 0);
}

export function touchesOrb(f: Readonly<Fighter>, point: OrbPoint): boolean {
  const body = hurtCapsule(f.character);
  const centreZ = f32(point.z + ORB_HEIGHT);
  const reach = f32(ORB_REACH + body.radius);
  const dx = f32(f.motion.x - point.x);
  if (dx > reach || dx < -reach) return false;
  const low = f32(f.motion.z + body.z1);
  const high = f32(f.motion.z + body.z2);
  const nearestZ = centreZ < low ? low : centreZ > high ? high : centreZ;
  const dz = f32(centreZ - nearestZ);
  return f32(f32(dx * dx) + f32(dz * dz)) <= f32(reach * reach);
}
