import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../../sim/codes";
import type { HitEffect } from "../../sim/hitRegions";
import { cleanLate, heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type MoveRegion, type StrikeCapsule, tipper, travelThrough } from "../../sim/heroMoves";
import { hurtPart, type HurtPart, type HurtPose } from "../../sim/hurtboxes";
import { ANGLES } from "../../sim/heroes/authoring";
import { groundHit } from "../../sim/heroes/groundNormals";

export const peonHit = (damage: number, angle: 25 | 35 | 40 | 55 | 70 | 75 | 85 | 90, growth = 88.6500015258789, base = 22.0, behind = false) =>
  groundHit(damage, angle, growth, base, HitElement.normal, behind);

const blade = (x1: number, z1: number, x2: number, z2: number, radius = 8.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const swing = (first: number, points: readonly (readonly [number, number])[], damage: number, angle: 25 | 35 | 40 | 55 | 70 | 85 | 90, growth = 88.6500015258789, base = 22.0, behind = false): readonly MoveRegion[] =>
  points.map(([x, z], index) => heroRegion(first + index, first + index, blade(behind ? -16.0 : 16.0, 48.0, x, z), peonHit(damage, angle, growth, base, behind)));

type Cut = readonly [number, number, number, number, number];
const axe = (first: number, cuts: readonly Cut[], effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): readonly MoveRegion[] =>
  cuts.map(([x1, z1, x2, z2, radius], index) => heroRegion(first + index, first + index, blade(x1, z1, x2, z2, radius), effect, groundedEffect));
const sharedHit = (damage: number, base: number): Readonly<HitEffect> =>
  ({ damage, growth: 100.0, base, launchX: ANGLES[45].x, launchZ: ANGLES[45].z, electric: false });

const BODY = hurtPart(0.0, 4.0, 0.0, f32(f32(105.44) - f32(42.24)), f32(21.12));
const reaching = (first: number, last: number, x: number, z: number): readonly HurtPose[] => {
  const parts: readonly HurtPart[] = [BODY, hurtPart(12.0, 48.0, x, z, 10.0)];
  return [heroHurtPose(Math.max(1, first - 2), last + 2, parts)];
};
const arm = (first: number, last: number, shoulderX: number, shoulderZ: number, handX: number, handZ: number): HurtPose =>
  heroHurtPose(first, last, [BODY, hurtPart(shoulderX, shoulderZ, handX, handZ, 10.0)]);
const tilt = (z: number) => heroMove(8, 3, 19, 0, swing(8, [[92.0, f32(z + 16.0)], [92.0, z], [84.0, f32(z - 16.0)]], 10.239999771118164, 40));
const FORWARD_SMASH = peonHit(20.479999542236328, 40, 122.13999938964844, 28.0);
const DIVE_FIRST = 8, DIVE_CLEAN_LAST = 10, SLIDE_LAST = 15;
const DIVE = peonHit(12.800000190734863, 70);
const SLIDE = peonHit(8.199999809265137, 40, 88.6500015258789, 18.0);
const diveRegions = (first: number, last: number, effect: Readonly<HitEffect>, bodyX: number, bodyRadius: number, tipX: number, tipRadius: number): readonly MoveRegion[] => [
  heroRegion(first, last, blade(bodyX, 22.0, f32(bodyX + 56.0), 20.0, bodyRadius), effect),
  heroRegion(first, last, blade(f32(bodyX + 56.0), 18.0, tipX, 14.0, tipRadius), effect),
];
const DIVING = [hurtPart(-20.0, 36.0, 50.0, 44.0, 19.0), hurtPart(50.0, 44.0, 80.0, 36.0, 9.0)];
const PRONE = [hurtPart(-4.0, 16.0, 70.0, 18.0, 16.0), hurtPart(70.0, 18.0, 96.0, 16.0, 9.0)];
const PUSH_UP = [hurtPart(0.0, 18.0, 58.0, 36.0, 18.0)];
const KNEEL = [hurtPart(8.0, 8.0, 20.0, 44.0, 20.0)];

export const PEON_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [BODY],
    attacks: {
      [AttackStyle.jab]: reaching(4, 5, 42.0, 48.0),
      [AttackStyle.jab2]: reaching(6, 7, 44.0, 50.0),
      [AttackStyle.forwardTilt]: reaching(8, 10, 55.0, 48.0),
      [AttackStyle.forwardTiltUp]: reaching(8, 10, 55.0, 66.0),
      [AttackStyle.forwardTiltDown]: reaching(8, 10, 55.0, 28.0),
      [AttackStyle.upTilt]: reaching(7, 10, 12.0, 92.0),
      [AttackStyle.downTilt]: reaching(6, 8, 45.0, 18.0),
      [AttackStyle.dashAttack]: [heroHurtPose(4, DIVE_FIRST - 1, [...DIVING]), heroHurtPose(DIVE_FIRST, SLIDE_LAST + 3, [...PRONE]), heroHurtPose(SLIDE_LAST + 4, SLIDE_LAST + 11, [...PUSH_UP]), heroHurtPose(SLIDE_LAST + 12, SLIDE_LAST + 18, [...KNEEL])],
      [AttackStyle.forwardSmash]: [arm(20, 26, 18.0, 60.0, 6.0, 68.0)],
      [AttackStyle.upSmash]: [heroHurtPose(15, 22, [BODY,
        hurtPart(12.0, 64.0, 12.0, 84.0, 10.0), hurtPart(-12.0, 66.0, -22.0, 82.0, 10.0)])],
      [AttackStyle.downSmash]: [heroHurtPose(16, 20, [BODY,
        hurtPart(18.0, 60.0, 37.0, 43.0, 10.0), hurtPart(18.0, 60.0, 24.0, 70.0, 10.0),
        hurtPart(-14.0, 65.0, -38.0, 50.0, 10.0)]),
        arm(21, 25, -18.0, 60.0, -6.0, 64.0)],
      [AttackStyle.neutralAir]: [heroHurtPose(4, 13, [BODY, hurtPart(-44.0, 54.0, 35.0, 52.0, 10.0)])],
      [AttackStyle.forwardAir]: [arm(8, 10, 12.0, 65.0, 4.0, 84.0), arm(11, 15, 18.0, 64.0, 4.0, 68.0)],
      [AttackStyle.backAir]: [heroHurtPose(7, 13, [BODY,
        hurtPart(-18.0, 63.0, -46.0, 76.0, 10.0), hurtPart(8.0, 63.0, 25.0, 84.0, 10.0)])],
      [AttackStyle.upAir]: reaching(8, 10, 8.0, 92.0),
      [AttackStyle.downAir]: reaching(14, 17, 10.0, -20.0),
      [AttackStyle.grab]: reaching(8, 9, 48.0, 40.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 2, 12, 0, swing(4, [[50.0, 48.0], [50.0, 42.0]], 3.072000026702881, 70, 44.32500076293945, 14.0))),
    [AttackStyle.jab2]: heroMove(6, 2, 18, 0, axe(6, [[4.0, 53.0, 14.0, 9.0, 12.0], [3.0, 57.0, 4.0, 12.0, 12.0]], peonHit(6.144000053405762, 40, 78.80000305175781, 22.0))),
    [AttackStyle.forwardTilt]: tilt(48.0),
    [AttackStyle.forwardTiltUp]: heroMove(8, 3, 19, 0, axe(8, [[27.0, 61.0, 34.0, 90.0, 8.0], [21.0, 98.0, 25.0, 69.0, 8.0], [8.0, 105.0, 22.0, 76.0, 8.0]], peonHit(10.239999771118164, 40))),
    [AttackStyle.forwardTiltDown]: heroMove(8, 3, 19, 0, axe(8, [[22.0, 41.0, 57.0, 23.0, 8.0], [19.0, 41.0, 52.0, 19.0, 8.0], [18.0, 41.0, 48.0, 16.0, 8.0]],
      peonHit(10.239999771118164, 40))),
    [AttackStyle.upTilt]: heroMove(7, 4, 20, 0, axe(7, [[25.0, 75.0, 16.0, 119.0, 10.0], [25.0, 73.0, 20.0, 118.0, 10.0], [26.0, 72.0, 23.0, 117.0, 10.0], [26.0, 71.0, 26.0, 116.0, 10.0]], peonHit(8.192000389099121, 85, 68.94999694824219, 40.0))),
    [AttackStyle.downTilt]: heroMove(6, 3, 19, 0, swing(6, [[74.0, 8.0], [74.0, 16.0], [66.0, 28.0]], 7.168000221252441, 70, 72.0, 45.0)),
    [AttackStyle.dashAttack]: travelThrough(heroMove(DIVE_FIRST, SLIDE_LAST - DIVE_FIRST + 1, 20, 0, [
      ...diveRegions(DIVE_FIRST, DIVE_CLEAN_LAST, DIVE, 4.0, 25.0, 104.0, 17.0),
      ...diveRegions(DIVE_CLEAN_LAST + 1, SLIDE_LAST, SLIDE, 20.0, 20.0, 116.0, 13.0),
    ], 150.0, true), SLIDE_LAST),
    [AttackStyle.forwardSmash]: heroMove(22, 3, 35, 0, [
      ...tipper(axe(22, [[40.0, 52.0, 65.0, 68.0, 8.0], [34.0, 51.0, 61.0, 51.0, 8.0]], FORWARD_SMASH), 0.25),
      ...cleanLate(axe(24, [[26.0, 40.0, 51.0, 37.0, 8.0]], FORWARD_SMASH), 0),
    ]),
    [AttackStyle.upSmash]: heroMove(17, 4, 31, 0, axe(17, [[-5.0, 121.0, 21.0, 98.0, 8.0], [-17.0, 107.0, 12.0, 96.0, 8.0], [-26.0, 86.0, 0.0, 94.0, 8.0], [-33.0, 66.0, -10.0, 91.0, 8.0]], peonHit(16.384000778198242, 90, 118.19999694824219, 26.0))),
    [AttackStyle.downSmash]: heroMove(18, 5, 32, 0, [
      ...axe(18, [[11.0, 40.0, 26.0, 20.0, 8.0], [16.0, 41.0, 29.0, 19.0, 8.0], [20.0, 43.0, 30.0, 19.0, 8.0]], peonHit(14.336000442504883, 25, 108.3499984741211, 26.0)),
      ...axe(21, [[-26.0, 20.0, -11.0, 40.0, 8.0], [-29.0, 19.0, -18.0, 43.0, 8.0]], peonHit(14.336000442504883, 25, 108.3499984741211, 26.0, true)),
    ]),
    [AttackStyle.neutralAir]: heroMove(6, 5, 21, 12, [
      ...axe(6, [[33.0, 46.0, 71.0, 68.0, 8.0], [41.0, 49.0, 42.0, 86.0, 8.0], [21.0, 51.0, 12.0, 90.0, 8.0]], peonHit(9.215999603271484, 55)),
      ...axe(9, [[-12.0, 54.0, -28.0, 93.0, 8.0], [-37.0, 56.0, -63.0, 93.0, 8.0]], peonHit(9.215999603271484, 55, 88.6500015258789, 22.0, true)),
    ]),
    [AttackStyle.forwardAir]: heroMove(11, 3, 25, 16, axe(11, [[39.0, 55.0, 65.0, 67.0, 8.0], [31.0, 51.0, 58.0, 51.0, 8.0], [23.0, 43.0, 49.0, 35.0, 8.0]], peonHit(13.312000274658203, 40, 103.42500305175781, 24.0))),
    [AttackStyle.backAir]: heroMove(9, 3, 24, 14, axe(9, [[-57.0, 74.0, -35.0, 56.0, 8.0], [-61.0, 64.0, -34.0, 54.0, 8.0], [-57.0, 53.0, -32.0, 53.0, 8.0]], peonHit(11.263999938964844, 35, 103.42500305175781, 24.0, true))),
    [AttackStyle.upAir]: heroMove(8, 3, 23, 12, axe(8, [[10.0, 107.0, 25.0, 80.0, 8.0], [-18.0, 91.0, 11.0, 84.0, 8.0], [-32.0, 57.0, -9.0, 82.0, 8.0]], peonHit(9.215999603271484, 85, 98.5, 24.0))),
    [AttackStyle.downAir]: heroMove(14, 4, 28, 18, axe(14, [[16.0, 33.0, 24.0, 24.0, 8.0], [12.0, 32.0, 18.0, 22.0, 8.0], [9.0, 34.0, 15.0, 23.0, 8.0], [7.0, 35.0, 12.0, 24.0, 8.0]],
      { ...peonHit(13.312000274658203, 90, 98.5, 24.0), launchZ: -1.0 }, peonHit(13.312000274658203, 55, 98.5, 24.0))),
    [AttackStyle.getupAttack]: heroMove(17, 3, 30, 0, axe(17, [[39.0, 53.0, 39.0, 69.0, 8.0], [37.0, 50.0, 37.0, 72.0, 5.0], [1.0, 50.0, 1.0, 72.0, 5.0]], sharedHit(7.0, 75.0))),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 21, 0, axe(17, [[32.0, 60.0, 32.0, 85.0, 8.0], [33.0, 51.0, 33.0, 79.0, 7.0], [36.0, 46.0, 36.0, 74.0, 5.0]], sharedHit(7.0, 20.0))),
    [AttackStyle.grab]: heroMove(8, 2, 25, 0, [heroRegion(8, 9, blade(18.0, 40.0, 48.0, 40.0, 10.0), peonHit(0.0, 90, 0.0, 0.0))]),
  },
  carry: { hoistFrames: 12, walkScale: f32(0.6), jumpScale: f32(0.7), shoulderX: -8.0, shoulderZ: 70.0, overheadRise: 40.0, holdBaseFrames: 180, holdFramesPerPercent: 3, holdMaxFrames: 480 },
  throws: {
    [GrabAction.pummel]: { contactFrame: 60, totalFrames: 68, effect: peonHit(3.072000026702881, 90, 0.0, 0.0) },
    [GrabAction.throwBack]: { contactFrame: 16, totalFrames: 40, effect: peonHit(8.192000389099121, 40, 31.5, 66.0, true) },
    [GrabAction.throwUp]: { contactFrame: 12, totalFrames: 22, effect: peonHit(6.144000053405762, 85, 54.17499923706055, 50.0) },
    [GrabAction.throwDown]: { contactFrame: 17, totalFrames: 42, effect: { ...peonHit(5.119999885559082, 70, 0.0, 0.0), growth: 100.0, setKnockback: 90.0 } },
    [GrabAction.cargoThrowForward]: { inspiredBy: "Donkey Kong's Melee cargo forward throw", contactFrame: 13, totalFrames: 34, effect: peonHit(8.192000389099121, 55, 50.0, 80.0) },
    [GrabAction.cargoThrowBack]: { inspiredBy: "Donkey Kong's Melee cargo back throw", contactFrame: 16, totalFrames: 40, effect: peonHit(8.192000389099121, 55, 50.0, 80.0, true) },
    [GrabAction.cargoThrowUp]: { inspiredBy: "Donkey Kong's Melee cargo up throw", contactFrame: 12, totalFrames: 22, effect: peonHit(7.168000221252441, 90, 30.0, 90.0) },
    [GrabAction.cargoThrowDown]: { inspiredBy: "Donkey Kong's Melee cargo down throw", contactFrame: 17, totalFrames: 42, effect: peonHit(6.144000053405762, 40, 26.0, 65.0) },
  },
};
