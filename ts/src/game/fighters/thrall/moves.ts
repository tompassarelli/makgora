import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { cosineTurns, sineTurns } from "../../sim/mathTables";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { type FighterMoves, type MoveRegion, type StrikeCapsule, heroMove, heroRegion, heroHurtPose, jabStep, cleanLateMove } from "../../sim/heroMoves";
import type { HitEffect } from "../../sim/hitRegions";
import { type FighterHurtboxes, type HurtPart, hurtPart } from "../../sim/hurtboxes";
import { groundHit } from "../../sim/heroes/groundNormals";

export const capsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });
export const thrallHit = (damage: number, angle: 20 | 25 | 35 | 40 | 45 | 50 | 55 | 70 | 75 | 85 | 90, growth: number, base: number, back = false, element: HitElement = HitElement.normal) => groundHit(damage, angle, growth, base, element, back);

export interface HammerPivot { readonly x: number; readonly z: number }
export const STANDING_SHOULDER: HammerPivot = { x: 0.0, z: 104.0 };
export const LOW_SHOULDER: HammerPivot = { x: 10.0, z: 56.0 };
export const HammerGrip = { tilt: 0, smash: 1 } as const;
export type HammerGrip = (typeof HammerGrip)[keyof typeof HammerGrip];
export const HAMMER_SLIDE: Readonly<Record<HammerGrip, number>> = { [HammerGrip.tilt]: 0.0, [HammerGrip.smash]: 26.0 };
const HEAD_FROM_HAND: Readonly<Record<HammerGrip, number>> = { [HammerGrip.tilt]: 48.0, [HammerGrip.smash]: 74.0 };

export interface HammerBeat { readonly frame: number; readonly angle: number }
export interface HammerSwing { readonly pivot: HammerPivot; readonly hand: number; readonly grip: HammerGrip; readonly radius: number; readonly beats: readonly HammerBeat[] }

const along = (pivot: HammerPivot, angle: number, distance: number): readonly [number, number] => {
  const turns = f32(angle / 360.0);
  return [f32(pivot.x + f32(distance * cosineTurns(turns))), f32(pivot.z + f32(distance * sineTurns(turns)))];
};
export const swingGrip = (swing: HammerSwing, angle: number) => along(swing.pivot, angle, swing.hand);
export const swingHead = (swing: HammerSwing, angle: number) => along(swing.pivot, angle, swing.hand + HEAD_FROM_HAND[swing.grip]);

export const wholeCapsule = (swing: HammerSwing, angle: number): StrikeCapsule => {
  const [x1, z1] = along(swing.pivot, angle, swing.hand + HEAD_FROM_HAND[swing.grip] * 0.5);
  const [x2, z2] = swingHead(swing, angle);
  return capsule(x1, z1, x2, z2, swing.radius);
};

const beats = (first: number, angles: readonly number[]): HammerBeat[] => angles.map((angle, index) => ({ frame: first + index, angle }));
export const tilt = (pivot: HammerPivot, hand: number, radius: number, first: number, angles: readonly number[]): HammerSwing => ({ pivot, hand, grip: HammerGrip.tilt, radius, beats: beats(first, angles) });
export const smash = (pivot: HammerPivot, hand: number, radius: number, first: number, angles: readonly number[]): HammerSwing => ({ pivot, hand, grip: HammerGrip.smash, radius, beats: beats(first, angles) });

export const THRALL_HAMMER_SWINGS = {
  jab: tilt(STANDING_SHOULDER, 20.0, 24.0, 4, [-16.0, -24.0]),
  jab2: tilt(STANDING_SHOULDER, 22.0, 24.0, 7, [10.0, -8.0, -26.0]),
  forwardTilt: tilt(STANDING_SHOULDER, 28.0, 26.0, 8, [14.0, -4.0, -22.0]),
  forwardTiltUp: tilt(STANDING_SHOULDER, 26.0, 26.0, 8, [24.0, 44.0, 64.0]),
  forwardTiltDown: tilt(STANDING_SHOULDER, 28.0, 26.0, 8, [-26.0, -38.0, -50.0]),
  upTilt: tilt(STANDING_SHOULDER, 20.0, 26.0, 8, [40.0, 64.0, 88.0, 108.0]),
  downTilt: tilt(LOW_SHOULDER, 22.0, 22.0, 6, [-12.0, -18.0, -24.0]),
  forwardSmash: smash(STANDING_SHOULDER, 22.0, 28.0, 20, [56.0, 14.0, -28.0]),
  upSmash: tilt(STANDING_SHOULDER, 22.0, 28.0, 17, [36.0, 62.0, 88.0, 110.0]),
  downSmash: tilt(LOW_SHOULDER, 22.0, 24.0, 14, [-10.0, -16.0, -22.0, 190.0, 196.0, 202.0]),
  neutralAir: tilt(STANDING_SHOULDER, 18.0, 26.0, 8, [70.0, 40.0, 10.0, -20.0, -50.0]),
  forwardAir: smash(STANDING_SHOULDER, 20.0, 28.0, 13, [64.0, 20.0, -24.0]),
  backAir: tilt(STANDING_SHOULDER, 22.0, 26.0, 17, [164.0, 180.0, 196.0]),
  upAir: tilt(STANDING_SHOULDER, 18.0, 26.0, 8, [36.0, 62.0, 88.0, 110.0]),
  downAir: smash(STANDING_SHOULDER, 40.0, 28.0, 14, [-76.0, -82.0, -86.0, -88.0]),
} as const satisfies Record<string, HammerSwing>;

export const swingRegions = (swing: HammerSwing, effect: (beat: HammerBeat) => Readonly<HitEffect>, grounded?: Readonly<HitEffect>, window = 1): MoveRegion[] =>
  swing.beats.map((beat) => heroRegion(beat.frame, beat.frame, wholeCapsule(swing, beat.angle), effect(beat), grounded, window));
const sameHit = (effect: Readonly<HitEffect>) => () => effect;

const DOWN_AIR = { damage: 13.0, growth: 103.52999877929688, base: 24.0, launchX: 0.0, launchZ: -1.0, electric: false, element: HitElement.normal };
const DOWN_SMASH = thrallHit(16.639999389648438, 25, 103.52999877929688, 28.0);
const DOWN_SMASH_BACK = thrallHit(16.639999389648438, 25, 103.52999877929688, 28.0, true);
const DASH_SHOULDER = capsule(16.0, 74.0, 40.0, 94.0, 26.0);
const BACK_KICK = capsule(-24.0, 64.0, -62.0, 58.0, 18.0);

const S = THRALL_HAMMER_SWINGS;
const body = hurtCapsule(Character.thrall);
const TORSO = hurtPart(body.x1, body.z1, body.x2, body.z2, body.radius);
const ARM_RADIUS = 12.0;
const reach = (pivot: HammerPivot, x: number, z: number): readonly HurtPart[] => [TORSO, hurtPart(pivot.x, pivot.z, x, z, ARM_RADIUS)];
export const swingReach = (swing: HammerSwing, first: number, last: number) => {
  const [x, z] = swingGrip(swing, swing.beats[idiv(swing.beats.length, 2)]?.angle ?? 0.0);
  return heroHurtPose(first, last, reach(swing.pivot, x, z));
};

const HURTBOXES: FighterHurtboxes = {
  stand: [TORSO],
  attacks: {
    [AttackStyle.jab]: [swingReach(S.jab, 3, 9)],
    [AttackStyle.jab2]: [swingReach(S.jab2, 5, 12)],
    [AttackStyle.forwardTilt]: [swingReach(S.forwardTilt, 6, 15)],
    [AttackStyle.forwardTiltUp]: [swingReach(S.forwardTiltUp, 6, 15)],
    [AttackStyle.forwardTiltDown]: [swingReach(S.forwardTiltDown, 6, 15)],
    [AttackStyle.upTilt]: [swingReach(S.upTilt, 6, 15)],
    [AttackStyle.downTilt]: [swingReach(S.downTilt, 4, 13)],
    [AttackStyle.dashAttack]: [heroHurtPose(7, 20, [TORSO, hurtPart(DASH_SHOULDER.x1, DASH_SHOULDER.z1, DASH_SHOULDER.x2, DASH_SHOULDER.z2, 20.0)])],
    [AttackStyle.forwardSmash]: [swingReach(S.forwardSmash, 16, 28)],
    [AttackStyle.upSmash]: [swingReach(S.upSmash, 14, 24)],
    [AttackStyle.downSmash]: [heroHurtPose(12, 16, reach(LOW_SHOULDER, 30.0, 44.0)), heroHurtPose(17, 23, reach(LOW_SHOULDER, -10.0, 44.0))],
    [AttackStyle.neutralAir]: [swingReach(S.neutralAir, 6, 15)],
    [AttackStyle.forwardAir]: [swingReach(S.forwardAir, 10, 20)],
    [AttackStyle.backAir]: [heroHurtPose(8, 12, [TORSO, hurtPart(BACK_KICK.x1, BACK_KICK.z1, BACK_KICK.x2, BACK_KICK.z2, 14.0)]), swingReach(S.backAir, 15, 22)],
    [AttackStyle.upAir]: [swingReach(S.upAir, 6, 14)],
    [AttackStyle.downAir]: [swingReach(S.downAir, 12, 20)],
    [AttackStyle.grab]: [heroHurtPose(6, 12, reach(STANDING_SHOULDER, 50.0, 66.0))],
  },
};

export const THRALL_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: HURTBOXES,
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 2, 14, 0, swingRegions(S.jab, sameHit(thrallHit(5.119999885559082, 45, 54.22999954223633, 18.0))))),
    [AttackStyle.jab2]: heroMove(7, 3, 18, 0, swingRegions(S.jab2, sameHit(thrallHit(6.144000053405762, 40, 88.73999786376953, 24.0)))),
    [AttackStyle.forwardTilt]: heroMove(8, 3, 21, 0, swingRegions(S.forwardTilt, sameHit(thrallHit(13.25, 35, 108.45999908447266, 24.0)))),
    [AttackStyle.forwardTiltUp]: heroMove(8, 3, 21, 0, swingRegions(S.forwardTiltUp, sameHit(thrallHit(13.25, 55, 108.45999908447266, 24.0)))),
    [AttackStyle.forwardTiltDown]: heroMove(8, 3, 21, 0, swingRegions(S.forwardTiltDown, sameHit(thrallHit(13.25, 20, 108.45999908447266, 24.0)))),
    [AttackStyle.upTilt]: heroMove(8, 4, 20, 0, swingRegions(S.upTilt, sameHit(thrallHit(8.192000389099121, 85, 69.0199966430664, 36.0)))),
    [AttackStyle.downTilt]: heroMove(6, 3, 19, 0, swingRegions(S.downTilt, sameHit(thrallHit(9.75, 70, 64.08999633789062, 20.0)))),
    [AttackStyle.dashAttack]: heroMove(9, 10, 23, 0, [heroRegion(9, 18, DASH_SHOULDER, thrallHit(13.75, 55, 88.73999786376953, 28.0))], 65.0, true),
    [AttackStyle.forwardSmash]: cleanLateMove(heroMove(20, 3, 34, 0, swingRegions(S.forwardSmash, sameHit(thrallHit(18.43199920654297, 40, 108.45999908447266, 30.0)))), 1),
    [AttackStyle.upSmash]: heroMove(17, 4, 29, 0, swingRegions(S.upSmash, sameHit(thrallHit(15.359999656677246, 85, 106.48799896240234, 30.0)))),
    [AttackStyle.downSmash]: heroMove(14, 6, 30, 0, swingRegions(S.downSmash, (beat) => beat.angle > 90.0 ? DOWN_SMASH_BACK : DOWN_SMASH)),
    [AttackStyle.neutralAir]: heroMove(8, 5, 20, 14, swingRegions(S.neutralAir, sameHit(thrallHit(8.192000389099121, 50, 88.73999786376953, 24.0)))),
    [AttackStyle.forwardAir]: heroMove(13, 3, 25, 18, swingRegions(S.forwardAir, sameHit(thrallHit(12.288000106811523, 45, 96.62799835205078, 24.0)))),
    [AttackStyle.backAir]: heroMove(8, 12, 24, 17, [
      heroRegion(8, 10, BACK_KICK, thrallHit(6.144000053405762, 45, 0.0, 30.0, true)),
      ...swingRegions(S.backAir, sameHit(thrallHit(12.288000106811523, 35, 103.52999877929688, 28.0, true)), undefined, 2),
    ]),
    [AttackStyle.upAir]: heroMove(8, 4, 20, 13, swingRegions(S.upAir, sameHit(thrallHit(9.215999603271484, 85, 88.73999786376953, 28.0)))),
    [AttackStyle.downAir]: heroMove(14, 4, 28, 20, swingRegions(S.downAir, sameHit(DOWN_AIR), thrallHit(13.312000274658203, 55, 93.66999816894531, 26.0))),
    [AttackStyle.grab]: heroMove(8, 2, 24, 0, [heroRegion(8, 9, capsule(16.0, 70.0, 56.0, 64.0, 16.0), { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false })]),
    [AttackStyle.getupAttack]: heroMove(8, 4, 18, 0, [heroRegion(8, 11, capsule(-82.0, 22.0, 82.0, 22.0, 14.0), thrallHit(7.168000221252441, 40, 88.73999786376953, 24.0))]),
    [AttackStyle.ledgeAttack]: heroMove(8, 4, 18, 0, [heroRegion(8, 11, capsule(20.0, 35.0, 102.0, 35.0, 14.0), thrallHit(8.192000389099121, 40, 88.73999786376953, 24.0))]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: thrallHit(3.072000026702881, 90, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 34, effect: thrallHit(8.192000389099121, 35, 52.5, 67.0) },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 40, effect: thrallHit(10.239999771118164, 40, 30.0, 74.0, true) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 28, effect: thrallHit(7.168000221252441, 75, 83.80999755859375, 60.0, true) },
    [GrabAction.throwDown]: { contactFrame: 19, totalFrames: 42, effect: { ...thrallHit(6.144000053405762, 70, 0.0, 0.0), growth: 100.0, setKnockback: 90.0 } },
  },
};
