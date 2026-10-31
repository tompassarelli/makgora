import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type StrikeCapsule } from "../../sim/heroMoves";
import { hurtPart, hurtPose, type HurtPose } from "../../sim/hurtboxes";
import { groundHit } from "../../sim/heroes/groundNormals";
import type { Angle } from "../../sim/heroes/authoring";

const SHADOW = HitElement.dark;
const FIRE = HitElement.fire;
const PLAIN = HitElement.normal;

export const onyxiaHit = (damage: number, angle: Angle, growth: number, base: number, element: HitElement = SHADOW, behind = false) =>
  groundHit(damage, angle, growth, base, element, behind);
export const reachOf = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const noHit = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false };

export function onyxiaCastBody(character: number, first: number, last: number): readonly HurtPose[] {
  const body = hurtCapsule(character);
  return [hurtPose(first, last, [hurtPart(0.0, 4.0, 0.0, body.z2, body.radius)])];
}

function hurtboxes(character: number, scale: number): FighterMoves["hurtboxes"] {
  const body = hurtCapsule(character);
  const torso = hurtPart(0.0, 4.0, 0.0, body.z2, body.radius);
  const limb = (first: number, last: number, x: number, z: number) =>
    [heroHurtPose(first, last, [torso, hurtPart(f32(8.0 * scale), f32(body.z2 - 15.0), f32(x * scale), f32(z * scale), f32(9.0 * scale))])];
  return {
    stand: [torso], crouch: [hurtPart(0.0, 4.0, 0.0, f32(body.z2 * f32(0.6)), body.radius)],
    attacks: {
      [AttackStyle.jab]: limb(2, 6, 50.0, 50.0), [AttackStyle.jab2]: limb(3, 7, 54.0, 50.0),
      [AttackStyle.forwardTilt]: limb(5, 10, 62.0, 54.0), [AttackStyle.forwardTiltUp]: limb(5, 10, 56.0, 80.0),
      [AttackStyle.forwardTiltDown]: limb(5, 10, 62.0, 28.0), [AttackStyle.upTilt]: limb(4, 10, 8.0, 110.0),
      [AttackStyle.downTilt]: limb(4, 9, 62.0, 18.0), [AttackStyle.dashAttack]: limb(5, 14, 60.0, 48.0),
      [AttackStyle.forwardSmash]: limb(12, 18, 76.0, 54.0), [AttackStyle.upSmash]: limb(10, 17, 8.0, 116.0),
      [AttackStyle.downSmash]: limb(10, 16, 56.0, 18.0), [AttackStyle.neutralAir]: limb(3, 12, 40.0, 50.0),
      [AttackStyle.forwardAir]: limb(4, 10, 54.0, 60.0), [AttackStyle.backAir]: limb(5, 10, -54.0, 55.0),
      [AttackStyle.upAir]: limb(4, 9, 8.0, 120.0), [AttackStyle.downAir]: limb(7, 13, 10.0, 0.0),
      [AttackStyle.grab]: limb(6, 11, 50.0, 48.0),
    },
  };
}

export const PRESTOR_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: hurtboxes(Character.onyxia, 1.0),
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(3, 2, 12, 0, [heroRegion(3, 4, reachOf(18.0, 54.0, 38.0, 54.0, 30.0), onyxiaHit(3.0, 70, 50.0, 18.0, PLAIN))])),
    [AttackStyle.jab2]: heroMove(4, 2, 14, 0, [heroRegion(4, 5, reachOf(20.0, 52.0, 46.0, 52.0, 32.0), onyxiaHit(4.0, 35, 70.0, 24.0))]),
    [AttackStyle.forwardTilt]: heroMove(6, 3, 16, 0, [heroRegion(6, 8, reachOf(26.0, 56.0, 80.0, 56.0, 30.0), onyxiaHit(8.0, 35, 75.0, 22.0))]),
    [AttackStyle.forwardTiltUp]: heroMove(6, 3, 16, 0, [heroRegion(6, 8, reachOf(24.0, 60.0, 72.0, 92.0, 30.0), onyxiaHit(8.0, 55, 75.0, 22.0))]),
    [AttackStyle.forwardTiltDown]: heroMove(6, 3, 16, 0, [heroRegion(6, 8, reachOf(26.0, 30.0, 80.0, 14.0, 30.0), onyxiaHit(8.0, 25, 75.0, 22.0))]),
    [AttackStyle.upTilt]: heroMove(5, 4, 14, 0, [heroRegion(5, 8, reachOf(-24.0, 104.0, 28.0, 112.0, 36.0), onyxiaHit(6.0, 90, 55.0, 40.0))]),
    [AttackStyle.downTilt]: heroMove(5, 3, 14, 0, [heroRegion(5, 7, reachOf(28.0, 18.0, 76.0, 14.0, 30.0), onyxiaHit(6.0, 80, 50.0, 40.0, PLAIN))]),
    [AttackStyle.dashAttack]: heroMove(6, 6, 20, 0, [heroRegion(6, 11, reachOf(28.0, 48.0, 72.0, 48.0, 34.0), onyxiaHit(8.0, 55, 70.0, 30.0))]),
    [AttackStyle.forwardSmash]: heroMove(14, 3, 32, 0, [heroRegion(14, 16, reachOf(36.0, 56.0, 112.0, 56.0, 34.0), onyxiaHit(14.0, 35, 92.0, 26.0))]),
    [AttackStyle.upSmash]: heroMove(12, 4, 30, 0, [heroRegion(12, 15, reachOf(0.0, 80.0, 0.0, 144.0, 42.0), onyxiaHit(13.0, 90, 90.0, 26.0))]),
    [AttackStyle.downSmash]: heroMove(11, 3, 30, 0, [
      heroRegion(11, 13, reachOf(32.0, 24.0, 92.0, 24.0, 35.0), onyxiaHit(12.0, 25, 88.0, 26.0)),
      heroRegion(11, 13, reachOf(-32.0, 24.0, -92.0, 24.0, 35.0), onyxiaHit(12.0, 25, 88.0, 26.0, SHADOW, true)),
    ]),
    [AttackStyle.neutralAir]: heroMove(4, 6, 16, 10, [
      heroRegion(4, 9, reachOf(22.0, 40.0, 40.0, 60.0, 34.0), onyxiaHit(8.0, 55, 70.0, 24.0)),
      heroRegion(4, 9, reachOf(-22.0, 40.0, -40.0, 60.0, 34.0), onyxiaHit(8.0, 55, 70.0, 24.0, SHADOW, true)),
    ]),
    [AttackStyle.forwardAir]: heroMove(5, 3, 18, 12, [heroRegion(5, 7, reachOf(28.0, 76.0, 52.0, 44.0, 40.0), onyxiaHit(8.0, 55, 72.0, 26.0))]),
    [AttackStyle.backAir]: heroMove(6, 3, 18, 12, [heroRegion(6, 8, reachOf(-20.0, 60.0, -48.0, 60.0, 38.0), onyxiaHit(10.0, 35, 88.0, 24.0, SHADOW, true))]),
    [AttackStyle.upAir]: heroMove(5, 3, 14, 10, [heroRegion(5, 7, reachOf(-14.0, 124.0, 14.0, 124.0, 38.0), onyxiaHit(7.0, 90, 60.0, 34.0))]),
    [AttackStyle.downAir]: heroMove(8, 3, 20, 14, [heroRegion(8, 10, reachOf(0.0, 30.0, 0.0, 6.0, 44.0), onyxiaHit(9.0, 80, 60.0, 34.0))]),
    [AttackStyle.grab]: heroMove(7, 2, 22, 0, [heroRegion(7, 8, reachOf(20.0, 48.0, 64.0, 48.0, 10.0), noHit)]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 6, totalFrames: 14, effect: { ...noHit, damage: 3.0, element: SHADOW } },
    [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 32, effect: onyxiaHit(6.0, 35, 60.0, 55.0) },
    [GrabAction.throwBack]: { contactFrame: 14, totalFrames: 34, effect: onyxiaHit(9.0, 40, 80.0, 55.0, SHADOW, true) },
    [GrabAction.throwUp]: { contactFrame: 12, totalFrames: 24, effect: onyxiaHit(4.0, 90, 40.0, 60.0) },
    [GrabAction.throwDown]: { contactFrame: 14, totalFrames: 34, effect: { ...onyxiaHit(5.0, 70, 0.0, 0.0), growth: 100.0, setKnockback: 70.0 } },
  },
};

export const DRAGON_SCALE = f32(1.6);
const big = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule =>
  reachOf(f32(x1 * DRAGON_SCALE), f32(z1 * DRAGON_SCALE), f32(x2 * DRAGON_SCALE), f32(z2 * DRAGON_SCALE), f32(radius * DRAGON_SCALE));

export const DRAGON_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: hurtboxes(Character.onyxiaDragon, DRAGON_SCALE),
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(6, 3, 16, 0, [heroRegion(6, 8, big(18.0, 50.0, 38.0, 50.0, 26.0), onyxiaHit(5.0, 70, 55.0, 20.0, PLAIN))])),
    [AttackStyle.jab2]: heroMove(7, 3, 18, 0, [heroRegion(7, 9, big(20.0, 50.0, 46.0, 50.0, 28.0), onyxiaHit(6.0, 35, 90.0, 26.0, FIRE))]),
    [AttackStyle.forwardTilt]: heroMove(9, 4, 22, 0, [heroRegion(9, 12, big(26.0, 50.0, 78.0, 50.0, 26.0), onyxiaHit(12.0, 35, 100.0, 26.0, PLAIN))]),
    [AttackStyle.forwardTiltUp]: heroMove(9, 4, 22, 0, [heroRegion(9, 12, big(24.0, 56.0, 70.0, 88.0, 26.0), onyxiaHit(12.0, 55, 100.0, 26.0, PLAIN))]),
    [AttackStyle.forwardTiltDown]: heroMove(9, 4, 22, 0, [heroRegion(9, 12, big(26.0, 28.0, 78.0, 12.0, 26.0), onyxiaHit(12.0, 25, 100.0, 26.0, PLAIN))]),
    [AttackStyle.upTilt]: heroMove(9, 5, 22, 0, [heroRegion(9, 13, big(-24.0, 100.0, 28.0, 108.0, 32.0), onyxiaHit(11.0, 90, 95.0, 28.0, PLAIN))]),
    [AttackStyle.downTilt]: heroMove(8, 4, 20, 0, [heroRegion(8, 11, big(28.0, 16.0, 76.0, 12.0, 22.0), onyxiaHit(10.0, 25, 95.0, 26.0, PLAIN))]),
    [AttackStyle.dashAttack]: heroMove(10, 8, 28, 0, [heroRegion(10, 17, big(28.0, 46.0, 72.0, 46.0, 30.0), onyxiaHit(12.0, 40, 100.0, 28.0, PLAIN))]),
    [AttackStyle.forwardSmash]: heroMove(20, 4, 42, 0, [heroRegion(20, 23, big(36.0, 50.0, 110.0, 50.0, 30.0), onyxiaHit(20.0, 35, 118.0, 30.0, PLAIN))]),
    [AttackStyle.upSmash]: heroMove(18, 5, 38, 0, [heroRegion(18, 22, big(0.0, 76.0, 0.0, 138.0, 36.0), onyxiaHit(18.0, 90, 115.0, 30.0, FIRE))]),
    [AttackStyle.downSmash]: heroMove(17, 6, 38, 0, [
      heroRegion(17, 19, big(32.0, 22.0, 92.0, 22.0, 28.0), onyxiaHit(16.0, 25, 112.0, 28.0, PLAIN)),
      heroRegion(20, 22, big(-32.0, 22.0, -92.0, 22.0, 28.0), onyxiaHit(16.0, 25, 112.0, 28.0, PLAIN, true)),
    ]),
    [AttackStyle.neutralAir]: heroMove(8, 8, 26, 18, [
      heroRegion(8, 15, big(22.0, 40.0, 40.0, 60.0, 30.0), onyxiaHit(11.0, 40, 95.0, 26.0, PLAIN)),
      heroRegion(8, 15, big(-22.0, 40.0, -40.0, 60.0, 30.0), onyxiaHit(11.0, 40, 95.0, 26.0, PLAIN, true)),
    ]),
    [AttackStyle.forwardAir]: heroMove(10, 4, 26, 18, [heroRegion(10, 13, big(28.0, 70.0, 52.0, 44.0, 32.0), onyxiaHit(14.0, 40, 110.0, 28.0, PLAIN))]),
    [AttackStyle.backAir]: heroMove(10, 3, 26, 18, [heroRegion(10, 12, big(-20.0, 56.0, -50.0, 56.0, 32.0), onyxiaHit(16.0, 35, 116.0, 28.0, PLAIN, true))]),
    [AttackStyle.upAir]: heroMove(9, 4, 24, 16, [heroRegion(9, 12, big(-14.0, 118.0, 14.0, 118.0, 34.0), onyxiaHit(13.0, 90, 110.0, 28.0, FIRE))]),
    [AttackStyle.downAir]: heroMove(16, 4, 32, 24, [heroRegion(16, 19, big(0.0, 28.0, 0.0, 6.0, 36.0),
      { ...onyxiaHit(15.0, 90, 100.0, 26.0, PLAIN), launchZ: -1.0 }, onyxiaHit(15.0, 55, 100.0, 26.0, PLAIN))]),
    [AttackStyle.grab]: heroMove(10, 2, 30, 0, [heroRegion(10, 11, big(20.0, 46.0, 64.0, 46.0, 10.0), noHit)]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 7, totalFrames: 16, effect: { ...noHit, damage: 3.0, element: FIRE } },
    [GrabAction.throwForward]: { contactFrame: 16, totalFrames: 38, effect: onyxiaHit(10.0, 35, 95.0, 50.0, FIRE) },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 42, effect: onyxiaHit(13.0, 40, 110.0, 50.0, PLAIN, true) },
    [GrabAction.throwUp]: { contactFrame: 16, totalFrames: 30, effect: onyxiaHit(9.0, 90, 90.0, 50.0, FIRE) },
    [GrabAction.throwDown]: { contactFrame: 18, totalFrames: 40, effect: { ...onyxiaHit(8.0, 70, 0.0, 0.0, PLAIN), growth: 100.0, setKnockback: 80.0 } },
  },
};
