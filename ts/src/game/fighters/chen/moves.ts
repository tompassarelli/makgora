import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type StrikeCapsule } from "../../sim/heroMoves";
import { hurtPart, type HurtPose } from "../../sim/hurtboxes";
import type { HitEffect } from "../../sim/hitRegions";

export const chenCapsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });
export const BALANCE_DAMAGE = f32(0.72);
export const BALANCE_GROWTH = f32(0.72);
export const DASH_ATTACK_DAMAGE = f32(0.92);
export const DASH_ATTACK_GROWTH = f32(0.92);
export const chenHit = (damage: number, growth: number, base: number, x: number, z: number, element: HitElement = HitElement.normal): Readonly<HitEffect> =>
  ({ damage: growth === 0.0 ? damage : f32(f32(damage * 1.25) * BALANCE_DAMAGE), growth: f32(growth * BALANCE_GROWTH), base, launchX: f32(x), launchZ: f32(z), electric: false, element });
const poke = (damage: number) => chenHit(damage, 83.63581085205078, 18.0, f32(0.819152), f32(0.573576));
const tap = (damage: number) => chenHit(damage, 48.25143051147461, 12.0, f32(0.819152), f32(0.573576));
const lift = (damage: number) => chenHit(damage, 88.99707794189453, 28.0, f32(0.173648), f32(0.984808));
const finish = (damage: number, back = false) => chenHit(damage, 115.80342864990234, 28.0, back ? -f32(0.766044) : f32(0.766044), f32(0.642788));
const region = (first: number, last: number, x1: number, z1: number, x2: number, z2: number, radius: number, effect: Readonly<HitEffect>) =>
  heroRegion(first, last, chenCapsule(x1, z1, x2, z2, radius), effect);
const torso = hurtCapsule(Character.chen);
const body = hurtPart(torso.x1, torso.z1, torso.x2, torso.z2, torso.radius);
const reach = (first: number, last: number, x: number, z: number): readonly HurtPose[] =>
  [heroHurtPose(first, last, [body, hurtPart(x < 0 ? -12.0 : 12.0, 60.0, x, z, 11.0)])];
const tilt = (height: number, length: number, tip: number) => heroMove(9, 3, 21, 0, [region(9, 11, 22.0, 58.0, 96.0, height, 12.0, poke(8.43317985534668)), region(9, 11, 96, height, length, tip, 12, poke(8.43317985534668))]);
const exactHit = (damage: number, growth: number, base: number, x: number, z: number, element: HitElement = HitElement.normal): Readonly<HitEffect> =>
  ({ damage: growth === 0.0 ? damage : f32(damage * BALANCE_DAMAGE), growth: f32(growth * BALANCE_GROWTH), base, launchX: f32(x), launchZ: f32(z), electric: element === HitElement.electric, element });
export const NEUTRAL_AIR_SPIN = { first: 7, last: 9 } as const;
export const NEUTRAL_AIR_SWEEP = { first: 15, last: 18 } as const;
export const NEUTRAL_AIR_LINK: Readonly<HitEffect> = { ...exactHit(4.0, 0.0, 30.0, 0.0, 1.0), carry: true };
export const NEUTRAL_AIR_LAUNCH = exactHit(9.0, 92.0, 32.0, f32(0.766044), f32(0.642788));
export const FORWARD_AIR_CLEAN = { first: 14, last: 15 } as const;
export const FORWARD_AIR_LAST = 30;
export const FORWARD_AIR_SWEETSPOT: Readonly<HitEffect> = { ...exactHit(20.0, 100.0, 26.0, f32(0.819152), f32(0.573576), HitElement.electric), strong: true };
export const FORWARD_AIR_SOURSPOT = exactHit(6.0, 80.0, 18.0, f32(0.707107), f32(0.707107));
export const UP_TILT_FIRST = 6;
export const UP_TILT_SCOOP = exactHit(8.0, 55.0, 90.0, f32(0.087156), f32(0.996195));
export const UP_TILT_STAFF: readonly (readonly [number, number, number, number])[] = [
  [47, 66, 124, 48], [58, 74, 135, 90], [55, 111, 115, 160], [-2, 154, 49, 201], [-33, 142, -69, 188], [-78, 118, -125, 110],
];
export const UP_AIR_FIRST = 6;
export const UP_AIR_CLEAN_LAST = 7;
export const UP_AIR_CLEAN = exactHit(12.0, 70.0, 80.0, 0.0, 1.0);
export const UP_AIR_LATE = exactHit(9.0, 70.0, 75.0, 0.0, 1.0);
const UP_AIR_STAFF: readonly (readonly [number, number, number, number])[] = [
  [32, 66, 111, 38], [33, 83, 114, 105], [26, 96, 85, 155], [13, 103, 35, 184], [1, 104, -13, 186], [-20, 86, -99, 114], [-20, 86, -99, 114], [-22, 76, -106, 76],
];
export const DOWN_AIR_CLEAN = { first: 14, last: 16 } as const;
export const DOWN_AIR_LAST = 18;
export const DOWN_AIR_SPIKE: Readonly<HitEffect> = { ...exactHit(15.0, 82.0, 30.0, 0.0, -1.0), strong: true };
export const DOWN_AIR_SOURSPOT = exactHit(9.0, 70.0, 18.0, f32(0.342020), -f32(0.939693));
export const DOWN_AIR_GROUNDED_SPIKE = exactHit(15.0, 30.0, 100.0, f32(0.087156), f32(0.996195));
export const DOWN_AIR_GROUNDED_SOURSPOT = exactHit(9.0, 40.0, 30.0, f32(0.258819), f32(0.965926));
const KEG_BOTTOM = chenCapsule(10.0, -4.0, 12.0, -30.0, 13.0);
const KEG_RIM = chenCapsule(-30.0, 14.0, 52.0, 14.0, 14.0);

export const CHEN_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [body], attacks: {
      [AttackStyle.jab]: reach(3, 8, 48.0, 64.0), [AttackStyle.jab2]: reach(4, 9, 50.0, 58.0), [AttackStyle.jab3]: reach(6, 12, 44.0, 52.0),
      [AttackStyle.forwardTilt]: reach(7, 14, 49.0, 58.0), [AttackStyle.forwardTiltUp]: reach(7, 14, 49.0, 80.0), [AttackStyle.forwardTiltDown]: reach(7, 14, 49.0, 34.0),
      [AttackStyle.upTilt]: [heroHurtPose(UP_TILT_FIRST, UP_TILT_FIRST + UP_TILT_STAFF.length - 1, [body])], [AttackStyle.downTilt]: reach(5, 12, 70.0, 20.0),
      [AttackStyle.dashAttack]: reach(6, 22, 54.0, 50.0), [AttackStyle.forwardSmash]: reach(16, 26, 58.0, 60.0),
      [AttackStyle.upSmash]: reach(12, 22, 14.0, 116.0), [AttackStyle.downSmash]: [...reach(12, 17, 46.0, 24.0), ...reach(18, 24, -46.0, 24.0)],
      [AttackStyle.neutralAir]: [heroHurtPose(NEUTRAL_AIR_SPIN.first, NEUTRAL_AIR_SWEEP.last, [body])],
      [AttackStyle.forwardAir]: [heroHurtPose(FORWARD_AIR_CLEAN.first - 2, FORWARD_AIR_LAST, [body, hurtPart(12.0, 52.0, 84.0, 46.0, 11.0)])], [AttackStyle.backAir]: reach(6, 14, -76.0, 44.0),
      [AttackStyle.upAir]: [heroHurtPose(UP_AIR_FIRST, UP_AIR_FIRST + UP_AIR_STAFF.length - 1, [body])],
      [AttackStyle.downAir]: [heroHurtPose(DOWN_AIR_CLEAN.first - 4, DOWN_AIR_LAST, [body, hurtPart(10.0, 20.0, 12.0, -6.0, 13.0)])],
      [AttackStyle.grab]: reach(5, 12, 52.0, 48.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 2, 11, 0, [region(4, 5, 18.0, 62.0, 48.0, 64.0, 12.0, tap(2.8110599517822266)), region(4, 5, 48, 64, 109, 106, 12, tap(2.8110599517822266))])),
    [AttackStyle.jab2]: jabStep(heroMove(5, 2, 13, 0, [region(5, 6, 18.0, 56.0, 62.0, 58.0, 11.0, tap(2.8110599517822266)), region(5, 5, 62, 58, 132, 69, 11, tap(2.8110599517822266)), region(6, 6, 62, 58, 133, 76, 11, tap(2.8110599517822266))])),
    [AttackStyle.jab3]: heroMove(7, 3, 18, 0, [region(7, 9, 20.0, 50.0, 54.0, 54.0, 14.0, poke(4.685100078582764)), region(7, 9, 54, 54, 112, 91, 14, poke(4.685100078582764))]),
    [AttackStyle.forwardTilt]: tilt(58.0, 144, 75), [AttackStyle.forwardTiltUp]: tilt(88.0, 145, 104), [AttackStyle.forwardTiltDown]: tilt(26.0, 146, 54),
    [AttackStyle.upTilt]: heroMove(UP_TILT_FIRST, UP_TILT_STAFF.length, 15, 0, UP_TILT_STAFF.map(([x1, z1, x2, z2], index) =>
      region(UP_TILT_FIRST + index, UP_TILT_FIRST + index, x1, z1, x2, z2, 13.0, UP_TILT_SCOOP))),
    [AttackStyle.downTilt]: heroMove(7, 3, 20, 0, [region(7, 9, 14.0, 22.0, 70.0, 16.0, 13.0, lift(5.622119903564453))]),
    [AttackStyle.dashAttack]: heroMove(8, 12, 19, 0, [region(8, 19, 16.0, 42.0, 52.0, 68.0, 24.0, chenHit(f32(9.370200157165527 * DASH_ATTACK_DAMAGE), f32(83.63581085205078 * DASH_ATTACK_GROWTH), 18.0, f32(0.573576), f32(0.819152))), region(8, 19, 52, 68, 109, 106, 24, chenHit(f32(9.370200157165527 * DASH_ATTACK_DAMAGE), f32(83.63581085205078 * DASH_ATTACK_GROWTH), 18.0, f32(0.573576), f32(0.819152)))]),
    [AttackStyle.forwardSmash]: heroMove(19, 4, 34, 0, [region(19, 22, 24.0, 66.0, 104.0, 48.0, 14.0, finish(16.86635971069336))]),
    [AttackStyle.upSmash]: heroMove(15, 4, 31, 0, [region(15, 18, 12.0, 62.0, 8.0, 122.0, 24.0, chenHit(13.5, 115.80342864990234, 30.0, 0.0, 1.0))]),
    [AttackStyle.downSmash]: heroMove(15, 6, 32, 0, [region(15, 15, 36, 63, 115, 48, 13.0, finish(13.118280410766602)), region(16, 16, 11, 41, 70, -9, 13.0, finish(13.118280410766602)), region(17, 17, -33, 44, -28, -31, 13.0, finish(13.118280410766602)), region(18, 20, -55, 78, -111, 21, 13.0, finish(13.118280410766602, true))]),
    [AttackStyle.neutralAir]: { ...heroMove(NEUTRAL_AIR_SPIN.first, NEUTRAL_AIR_SWEEP.last - NEUTRAL_AIR_SPIN.first + 1, 22, 8, [
      heroRegion(NEUTRAL_AIR_SPIN.first, NEUTRAL_AIR_SPIN.last, chenCapsule(-64.0, 54.0, 68.0, 58.0, 15.0), NEUTRAL_AIR_LINK, undefined, 1),
      heroRegion(NEUTRAL_AIR_SWEEP.first, NEUTRAL_AIR_SWEEP.last, chenCapsule(-62.0, 74.0, 70.0, 34.0, 16.0), NEUTRAL_AIR_LAUNCH, undefined, 2)]), autoCancel: { before: 4, from: 34 } },
    [AttackStyle.forwardAir]: { ...heroMove(FORWARD_AIR_CLEAN.first, FORWARD_AIR_LAST - FORWARD_AIR_CLEAN.first + 1, 8, 10, [
      region(FORWARD_AIR_CLEAN.first, FORWARD_AIR_CLEAN.last, 84.0, 46.0, 92.0, 46.0, 7.0, FORWARD_AIR_SWEETSPOT),
      region(FORWARD_AIR_CLEAN.first, FORWARD_AIR_LAST, 22.0, 52.0, 90.0, 46.0, 12.0, FORWARD_AIR_SOURSPOT)]), autoCancel: { before: 7, from: 33 } },
    [AttackStyle.backAir]: heroMove(8, 3, 23, 14, [region(8, 10, -18.0, 42.0, -76.0, 45.0, 13.0, finish(10.307220458984375, true))]),
    [AttackStyle.upAir]: { ...heroMove(UP_AIR_FIRST, UP_AIR_STAFF.length, 20, 4, UP_AIR_STAFF.map(([x1, z1, x2, z2], index) =>
      region(UP_AIR_FIRST + index, UP_AIR_FIRST + index, x1, z1, x2, z2, 13.0, UP_AIR_FIRST + index <= UP_AIR_CLEAN_LAST ? UP_AIR_CLEAN : UP_AIR_LATE))), autoCancel: { before: 1, from: 21 } },
    [AttackStyle.downAir]: { ...heroMove(DOWN_AIR_CLEAN.first, DOWN_AIR_LAST - DOWN_AIR_CLEAN.first + 1, 26, 13, [
      heroRegion(DOWN_AIR_CLEAN.first, DOWN_AIR_CLEAN.last, KEG_BOTTOM, DOWN_AIR_SPIKE, DOWN_AIR_GROUNDED_SPIKE),
      heroRegion(DOWN_AIR_CLEAN.last + 1, DOWN_AIR_LAST, KEG_BOTTOM, DOWN_AIR_SOURSPOT, DOWN_AIR_GROUNDED_SOURSPOT),
      heroRegion(DOWN_AIR_CLEAN.first, DOWN_AIR_LAST, KEG_RIM, DOWN_AIR_SOURSPOT, DOWN_AIR_GROUNDED_SOURSPOT)]), autoCancel: { before: 4, from: 35 } },
    [AttackStyle.grab]: heroMove(7, 2, 24, 0, [region(7, 8, 18.0, 50.0, 52.0, 48.0, 12.0, chenHit(0.0, 0.0, 0.0, 0.0, 0.0))]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: chenHit(2.8110599517822266, 0.0, 0.0, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 33, effect: { ...finish(7.49616003036499), growth: 52.0, base: 67.0 } },
    [GrabAction.throwBack]: { contactFrame: 16, totalFrames: 39, effect: { ...finish(8.43317985534668, true), growth: 33.5, base: 72.0 } },
    [GrabAction.throwUp]: { contactFrame: 14, totalFrames: 25, effect: chenHit(6.559140205383301, 42.890159606933594, 50.0, 0.0, 1.0) },
    [GrabAction.throwDown]: { contactFrame: 18, totalFrames: 42, effect: { ...chenHit(5.622119903564453, 0.0, 0.0, f32(0.342020), f32(0.939693)), growth: 100.0, setKnockback: 90.0 } },
  },
};
