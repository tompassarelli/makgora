import { downSmashHit } from "../../sim/downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { cosineTurns, sineTurns } from "../../sim/mathTables";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, type FighterMoves, type MoveRegion, type StrikeCapsule, jabStep } from "../../sim/heroMoves";
import type { HitEffect } from "../../sim/hitRegions";
import { strongHit } from "../../sim/strongHits";
import { type FighterHurtboxes, type HurtPart, hurtPart } from "../../sim/hurtboxes";

const CLASSES = {
  LINK: { growth: 73.62062072753906, base: 12.0 },
  POKE: { growth: 90.60999298095703, base: 16.0 },
  LAUNCH: { growth: 107.59937286376953, base: 22.0 },
  EDGE: { growth: 113.26249694824219, base: 25.0 },
  KILL: { growth: 124.5887451171875, base: 30.0 },
  SPIKE: { growth: 113.26249694824219, base: 24.0 },
  JUGGLE: { growth: 62.29437255859375, base: 50.0 },
  CHASE: { growth: 45.304996490478516, base: 75.0 },
} as const;
type LaunchClass = keyof typeof CLASSES;

const DIRECTIONS = {
  25: { x: f32(0.9063077870366499), z: f32(0.42261826174069944) },
  35: { x: f32(0.8191520442889918), z: f32(0.573576436351046) },
  40: { x: f32(0.766044443118978), z: f32(0.6427876096865393) },
  45: { x: f32(0.7071067811865476), z: f32(0.7071067811865476) },
  50: { x: f32(0.6427876096865394), z: f32(0.766044443118978) },
  55: { x: f32(0.5735764363510462), z: f32(0.8191520442889918) },
  70: { x: f32(0.3420201433256688), z: f32(0.9396926207859083) },
  80: { x: f32(0.17364817766693041), z: f32(0.984807753012208) },
  85: { x: f32(0.08715574274765814), z: f32(0.9961946980917455) },
  90: { x: 0.0, z: 1.0 },
  270: { x: 0.0, z: -1.0 },
} as const;
export type UtherAngle = keyof typeof DIRECTIONS;

export function utherHit(damage: number, launchClass: LaunchClass, angle: UtherAngle, behind = false, element: HitElement = HitElement.normal): Readonly<HitEffect> {
  const direction = DIRECTIONS[angle];
  const strength = CLASSES[launchClass];
  return { damage, growth: strength.growth, base: strength.base, launchX: behind ? -direction.x : direction.x, launchZ: direction.z, electric: false, element };
}

export const capsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });

export interface HammerPivot { readonly x: number; readonly z: number }
export const STANDING_SHOULDER: HammerPivot = { x: 4.0, z: 96.0 };
export const LOW_SHOULDER: HammerPivot = { x: 14.0, z: 40.0 };
export const HammerGrip = { tilt: 0, smash: 1 } as const;
export type HammerGrip = (typeof HammerGrip)[keyof typeof HammerGrip];
export const HAMMER_SLIDE: Readonly<Record<HammerGrip, number>> = { [HammerGrip.tilt]: 0.5, [HammerGrip.smash]: 1.0 };
export const HEAD_FROM_HAND: Readonly<Record<HammerGrip, number>> = { [HammerGrip.tilt]: 73.0, [HammerGrip.smash]: 97.0 };
const HAFT_RADIUS = 8.0;

export interface HammerBeat { readonly frame: number; readonly angle: number }
export interface HammerSwing { readonly pivot: HammerPivot; readonly hand: number; readonly grip: HammerGrip; readonly radius: number; readonly beats: readonly HammerBeat[] }

const along = (pivot: HammerPivot, angle: number, distance: number): readonly [number, number] => {
  const turns = f32(angle / 360.0);
  return [f32(pivot.x + f32(distance * cosineTurns(turns))), f32(pivot.z + f32(distance * sineTurns(turns)))];
};
export const swingGrip = (swing: HammerSwing, angle: number) => along(swing.pivot, angle, swing.hand);
export const swingHead = (swing: HammerSwing, angle: number) => along(swing.pivot, angle, swing.hand + HEAD_FROM_HAND[swing.grip]);

const headCapsule = (swing: HammerSwing, angle: number): StrikeCapsule => {
  const [x, z] = swingHead(swing, angle);
  return capsule(x, z, x, z, swing.radius);
};
const haftCapsule = (swing: HammerSwing, angle: number): StrikeCapsule => {
  const [x1, z1] = swingGrip(swing, angle);
  const [x2, z2] = along(swing.pivot, angle, swing.hand + HEAD_FROM_HAND[swing.grip] - swing.radius);
  return capsule(x1, z1, x2, z2, HAFT_RADIUS);
};
const wholeCapsule = (swing: HammerSwing, angle: number): StrikeCapsule => {
  const [x1, z1] = along(swing.pivot, angle, swing.hand + HEAD_FROM_HAND[swing.grip] * 0.5);
  const [x2, z2] = swingHead(swing, angle);
  return capsule(x1, z1, x2, z2, swing.radius);
};

const beats = (first: number, angles: readonly number[]): HammerBeat[] => angles.map((angle, index) => ({ frame: first + index, angle }));
export const tilt = (pivot: HammerPivot, hand: number, radius: number, first: number, angles: readonly number[]): HammerSwing => ({ pivot, hand, grip: HammerGrip.tilt, radius, beats: beats(first, angles) });
export const smash = (pivot: HammerPivot, hand: number, radius: number, first: number, angles: readonly number[]): HammerSwing => ({ pivot, hand, grip: HammerGrip.smash, radius, beats: beats(first, angles) });

export const UTHER_HAMMER_SWINGS = {
  jab: tilt(STANDING_SHOULDER, 24.0, 32.0, 4, [-8.0, -4.0]),
  forwardTilt: tilt(STANDING_SHOULDER, 28.0, 34.0, 8, [24.0, 2.0, -20.0]),
  forwardTiltUp: tilt(STANDING_SHOULDER, 28.0, 34.0, 8, [48.0, 30.0, 14.0]),
  forwardTiltDown: tilt(STANDING_SHOULDER, 28.0, 34.0, 8, [-4.0, -24.0, -42.0]),
  upTilt: tilt(STANDING_SHOULDER, 20.0, 38.0, 7, [60.0, 86.0, 112.0, 136.0, 156.0]),
  downTilt: tilt(LOW_SHOULDER, 24.0, 34.0, 7, [-8.0, -13.0, -18.0]),
  dashAttack: tilt(STANDING_SHOULDER, 26.0, 38.0, 10, [-6.0, -8.0, -10.0, -12.0, -14.0]),
  forwardSmash: smash(STANDING_SHOULDER, 22.0, 36.0, 18, [62.0, 14.0, -36.0]),
  upSmash: tilt(STANDING_SHOULDER, 18.0, 44.0, 15, [36.0, 64.0, 90.0, 116.0, 144.0]),
  downSmash: tilt(LOW_SHOULDER, 22.0, 38.0, 14, [-12.0, -17.0, 192.0, 197.0]),
  neutralAir: tilt(STANDING_SHOULDER, 18.0, 38.0, 7, [0.0, -60.0, -120.0, -180.0, -240.0, -300.0]),
  forwardAir: smash(STANDING_SHOULDER, 20.0, 42.0, 14, [70.0, 18.0, -40.0]),
  backAir: tilt(STANDING_SHOULDER, 22.0, 40.0, 9, [172.0, 180.0, 188.0]),
  upAir: tilt(STANDING_SHOULDER, 18.0, 42.0, 8, [30.0, 70.0, 110.0, 150.0]),
  downAir: smash(STANDING_SHOULDER, 16.0, 46.0, 16, [-90.0, -90.0, -90.0, -90.0]),
} as const satisfies Record<string, HammerSwing>;

export const swingRegions = (swing: HammerSwing, effect: (beat: HammerBeat, index: number) => Readonly<HitEffect>, part: (swing: HammerSwing, angle: number) => StrikeCapsule = wholeCapsule, grounded?: (beat: HammerBeat) => Readonly<HitEffect>): MoveRegion[] =>
  swing.beats.map((beat, index) => heroRegion(beat.frame, beat.frame, part(swing, beat.angle), effect(beat, index), grounded?.(beat)));
export const sameHit = (effect: Readonly<HitEffect>) => () => effect;

const JAB = utherHit(3.0, "LINK", 35);
const JAB_2 = utherHit(5.0, "POKE", 40);
const FORWARD_TILT = utherHit(11.0, "EDGE", 35);
const FORWARD_TILT_UP = utherHit(11.0, "EDGE", 45);
const FORWARD_TILT_DOWN = utherHit(11.0, "EDGE", 25);
const UP_TILT = utherHit(8.0, "POKE", 85);
const DOWN_TILT = utherHit(9.0, "LINK", 70);
const DASH = utherHit(9.0, "LAUNCH", 45);
const FORWARD_SMASH_HEAD = strongHit(utherHit(18.0, "KILL", 40));
const FORWARD_SMASH_HAFT = utherHit(12.0, "KILL", 40);
const UP_SMASH = utherHit(16.0, "KILL", 90, false, HitElement.holy);
const DOWN_SMASH_FRONT = downSmashHit(utherHit(14.0, "EDGE", 25));
const DOWN_SMASH_BACK = downSmashHit(utherHit(14.0, "EDGE", 25, true));
const NEUTRAL_AIR_FRONT = utherHit(10.0, "POKE", 50);
const NEUTRAL_AIR_BACK = utherHit(10.0, "POKE", 50, true);
const FORWARD_AIR = utherHit(13.0, "KILL", 40);
const FORWARD_AIR_METEOR = utherHit(13.0, "SPIKE", 270);
const BACK_AIR = utherHit(12.0, "KILL", 35, true);
const UP_AIR = utherHit(10.0, "LAUNCH", 85);
const DOWN_AIR_CLEAN = utherHit(14.0, "SPIKE", 270);
const DOWN_AIR_LATE = utherHit(11.0, "LAUNCH", 70);
const DOWN_AIR_GROUNDED = utherHit(14.0, "LAUNCH", 55);
const GRAB_CONTACT = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

const S = UTHER_HAMMER_SWINGS;
const body = hurtCapsule(Character.uther);
const TORSO = hurtPart(body.x1, body.z1, body.x2, body.z2, body.radius);
const ARM_RADIUS = 11.0;
export const utherReach = (handX: number, handZ: number): readonly HurtPart[] => [TORSO, hurtPart(STANDING_SHOULDER.x, STANDING_SHOULDER.z, handX, handZ, ARM_RADIUS)];
const swingReach = (swing: HammerSwing, first: number, last: number) => {
  const [x, z] = swingGrip(swing, swing.beats[idiv(swing.beats.length, 2)]?.angle ?? 0.0);
  return heroHurtPose(first, last, [TORSO, hurtPart(swing.pivot.x, swing.pivot.z, x, z, ARM_RADIUS)]);
};
const GRAB_ARM = hurtPart(10.0, 70.0, 52.0, 58.0, 12.0);
const GAUNTLET = capsule(22.0, 78.0, 58.0, 74.0, 12.0);

const HURTBOXES: FighterHurtboxes = {
  stand: [TORSO],
  attacks: {
    [AttackStyle.jab]: [swingReach(S.jab, 2, 8)],
    [AttackStyle.jab2]: [heroHurtPose(4, 10, utherReach(48.0, 76.0))],
    [AttackStyle.forwardTilt]: [swingReach(S.forwardTilt, 5, 14)],
    [AttackStyle.forwardTiltUp]: [swingReach(S.forwardTiltUp, 5, 14)],
    [AttackStyle.forwardTiltDown]: [swingReach(S.forwardTiltDown, 5, 14)],
    [AttackStyle.upTilt]: [swingReach(S.upTilt, 5, 14)],
    [AttackStyle.downTilt]: [swingReach(S.downTilt, 5, 12)],
    [AttackStyle.dashAttack]: [swingReach(S.dashAttack, 7, 18)],
    [AttackStyle.forwardSmash]: [swingReach(S.forwardSmash, 14, 26)],
    [AttackStyle.upSmash]: [swingReach(S.upSmash, 12, 22)],
    [AttackStyle.downSmash]: [heroHurtPose(12, 15, utherReach(44.0, 30.0)), heroHurtPose(16, 20, utherReach(-44.0, 30.0))],
    [AttackStyle.neutralAir]: [swingReach(S.neutralAir, 5, 14)],
    [AttackStyle.forwardAir]: [swingReach(S.forwardAir, 10, 20)],
    [AttackStyle.backAir]: [swingReach(S.backAir, 6, 14)],
    [AttackStyle.upAir]: [swingReach(S.upAir, 6, 14)],
    [AttackStyle.downAir]: [swingReach(S.downAir, 12, 22)],
    [AttackStyle.grab]: [heroHurtPose(6, 14, [TORSO, GRAB_ARM])],
  },
};

export const UTHER_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: HURTBOXES,
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 2, 14, 0, swingRegions(S.jab, sameHit(JAB)))),
    [AttackStyle.jab2]: heroMove(6, 2, 18, 0, [heroRegion(6, 7, GAUNTLET, JAB_2)]),
    [AttackStyle.forwardTilt]: heroMove(8, 3, 20, 0, swingRegions(S.forwardTilt, sameHit(FORWARD_TILT))),
    [AttackStyle.forwardTiltUp]: heroMove(8, 3, 20, 0, swingRegions(S.forwardTiltUp, sameHit(FORWARD_TILT_UP))),
    [AttackStyle.forwardTiltDown]: heroMove(8, 3, 20, 0, swingRegions(S.forwardTiltDown, sameHit(FORWARD_TILT_DOWN))),
    [AttackStyle.upTilt]: heroMove(7, 5, 20, 0, swingRegions(S.upTilt, sameHit(UP_TILT))),
    [AttackStyle.downTilt]: heroMove(7, 3, 18, 0, swingRegions(S.downTilt, sameHit(DOWN_TILT))),
    [AttackStyle.dashAttack]: heroMove(10, 5, 26, 0, [
      ...swingRegions(S.dashAttack, sameHit(DASH)),
      heroRegion(10, 12, capsule(10.0, 70.0, 34.0, 92.0, 18.0), DASH),
    ], 90.0, true),
    [AttackStyle.forwardSmash]: heroMove(18, 3, 36, 0, [
      ...swingRegions(S.forwardSmash, sameHit(FORWARD_SMASH_HEAD), headCapsule),
      ...swingRegions(S.forwardSmash, sameHit(FORWARD_SMASH_HAFT), haftCapsule),
    ]),
    [AttackStyle.upSmash]: heroMove(15, 5, 32, 0, swingRegions(S.upSmash, sameHit(UP_SMASH))),
    [AttackStyle.downSmash]: heroMove(14, 4, 32, 0, swingRegions(S.downSmash, (beat) => beat.angle > 90.0 ? DOWN_SMASH_BACK : DOWN_SMASH_FRONT)),
    [AttackStyle.neutralAir]: heroMove(7, 6, 22, 14, swingRegions(S.neutralAir, (beat) => cosineTurns(f32(beat.angle / 360.0)) < 0.0 ? NEUTRAL_AIR_BACK : NEUTRAL_AIR_FRONT)),
    [AttackStyle.forwardAir]: heroMove(14, 3, 26, 18, [
      ...swingRegions(S.forwardAir, (_, index) => index === 0 ? FORWARD_AIR : FORWARD_AIR_METEOR, headCapsule),
      ...swingRegions(S.forwardAir, sameHit(FORWARD_AIR), haftCapsule),
    ]),
    [AttackStyle.backAir]: heroMove(9, 3, 22, 14, swingRegions(S.backAir, sameHit(BACK_AIR))),
    [AttackStyle.upAir]: heroMove(8, 4, 22, 14, swingRegions(S.upAir, sameHit(UP_AIR))),
    [AttackStyle.downAir]: heroMove(16, 4, 30, 22, swingRegions(S.downAir, (_, index) => index < 2 ? DOWN_AIR_CLEAN : DOWN_AIR_LATE, wholeCapsule, () => DOWN_AIR_GROUNDED)),
    [AttackStyle.grab]: heroMove(8, 2, 25, 0, [heroRegion(8, 9, capsule(14.0, 58.0, 54.0, 52.0, 12.0), GRAB_CONTACT)]),
    [AttackStyle.getupAttack]: heroMove(17, 3, 30, 0, [heroRegion(17, 19, capsule(-80.0, 18.0, 80.0, 18.0, 16.0), utherHit(8.0, "POKE", 35))]),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 21, 0, [heroRegion(17, 19, capsule(20.0, 40.0, 100.0, 30.0, 16.0), utherHit(8.0, "POKE", 35))]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 14, effect: { damage: 2.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: { contactFrame: 13, totalFrames: 34, effect: { ...utherHit(8.0, "EDGE", 40, false, HitElement.holy), growth: 45.0, base: 62.0 } },
    [GrabAction.throwBack]: { contactFrame: 16, totalFrames: 42, effect: { ...utherHit(10.0, "KILL", 40, true), growth: 78.0, base: 60.0 } },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 32, effect: utherHit(7.0, "JUGGLE", 90, false, HitElement.holy) },
    [GrabAction.throwDown]: { contactFrame: 18, totalFrames: 40, effect: { ...utherHit(6.0, "CHASE", 70), growth: 100.0, base: 0.0, setKnockback: 80.0 } },
  },
};
