import { f32 } from "wisp/src/sim/f32";
import { floorDiv, idiv } from "wisp/src/sim/intMath";
import { AttackStyle, DownState, LedgeState, SpecialAction } from "./codes";
import { isTumbling } from "./conditions";
import type { Fighter } from "./fighter";
import { type Capsule, attackCapsule, capsulesIntersect, emptyCapsule, hurtCapsule, placeCapsule } from "./geometry/contactGeometry";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { ULTIMATE_METER_FRAMES } from "./meter";
import type { MatchOrbs } from "./orbState";
import { STAGE_AT_REST, mainDeckZAt, surfaceCount, surfaceLeft, surfaceMoves, surfacePass, surfaceRight, surfaceZ } from "./stage";
import { melee } from "./tuning";

const FRAMES_PER_SECOND = 60;

export const ORB_INTERVAL_FRAMES = 30 * FRAMES_PER_SECOND;

export const ORB_WARNING_FRAMES = 3 * FRAMES_PER_SECOND;

export const ORB_HEIGHT = melee(10.0);

export const ORB_REACH = melee(10.0);

export const ORB_GAIN = idiv(ULTIMATE_METER_FRAMES, 2);

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

export const orbWarned = (clock: Readonly<OrbClock>): boolean => clock.orbs.held || orbWarningFrames(clock) !== undefined;

export function respawning(f: Readonly<Fighter>): boolean {
  return (f.status.out && f.status.stocks > 0) || (!f.status.out && f.status.invincible > 0);
}

export function collectsOrb(f: Readonly<Fighter>): boolean {
  const rolling = (f.dodge.groundFrame > 0 && f.dodge.groundDirection !== 0) || f.down.state === DownState.roll || f.down.state === DownState.techRoll || f.ledge.state === LedgeState.roll;
  const dodging = f.dodge.airDodging || (f.landing.wavedash && f.landing.lag > 0);
  return !f.status.out && f.special.action === SpecialAction.none && !dodging && !rolling && !isTumbling(f) && f.launch.hitlag <= 0 && f.launch.hitstun <= 0;
}

const orbCapsule = emptyCapsule();
const reachCapsule = emptyCapsule();
const strikeRegion = emptyHitRegion();

function placeOrb(point: OrbPoint): Readonly<Capsule> {
  const centreZ = f32(point.z + ORB_HEIGHT);
  orbCapsule.x1 = point.x;
  orbCapsule.z1 = centreZ;
  orbCapsule.x2 = point.x;
  orbCapsule.z2 = centreZ;
  orbCapsule.radius = ORB_REACH;
  return orbCapsule;
}

function strikeTouchesOrb(f: Readonly<Fighter>, orb: Readonly<Capsule>): boolean {
  const { style } = f.attack;
  if (style === undefined || style === AttackStyle.grab || style === AttackStyle.shot) return false;
  for (let index = 0; index < authoredHitRegionCount(style, f.tuning.moves); index++) {
    authoredHitRegion(strikeRegion, f.character, style, f.attack.frame, f.attack.smashChargeFrames, index, f.tuning.moves);
    if (strikeRegion.window <= 0) continue;
    attackCapsule(reachCapsule, style, strikeRegion);
    placeCapsule(reachCapsule, reachCapsule, f.motion.x, f.motion.z, f.facing);
    if (capsulesIntersect(reachCapsule, orb)) return true;
  }
  return false;
}

export function touchesOrb(f: Readonly<Fighter>, point: OrbPoint): boolean {
  const orb = placeOrb(point);
  placeCapsule(reachCapsule, hurtCapsule(f.character), f.motion.x, f.motion.z, f.facing);
  return capsulesIntersect(reachCapsule, orb) || strikeTouchesOrb(f, orb);
}
