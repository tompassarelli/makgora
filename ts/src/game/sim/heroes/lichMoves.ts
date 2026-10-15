import { downSmashHit } from "../downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../geometry/contactGeometry";
import { HERO_REFERENCE_HEIGHT, heroMove, heroRegion, type AuthoredThrow, type FighterMoves, type MoveRegion, type StrikeCapsule, tipperMove } from "../heroMoves";
import { LICH_GROUND } from "./groundNormals";
import type { HitEffect } from "../hitRegions";
import { type FighterHurtboxes, type HurtPart, type HurtPose, hurtPart, hurtPose } from "../hurtboxes";
import { type Strike, linkAt, multiHit } from "./multiHit";
import { type Angle, capsuleOf, makeHit } from "./authoring";



const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const XL = f32(HERO_REFERENCE_HEIGHT * f32(1.40));
const GRAB = f32(HERO_REFERENCE_HEIGHT * f32(0.70));



const facingHit = makeHit({
  LINK: { growth: 47.63932800292969, base: 12.0 },
  POKE: { growth: 64.96272277832031, base: 18.0 },
  LAUNCH: { growth: 90.94780731201172, base: 20.0 },
  EDGE: { growth: 95.27865600585938, base: 22.0 },
  KILL: { growth: 103.94035339355469, base: 26.0 },
  SPIKE: { growth: 86.61695861816406, base: 22.0 },

  JUGGLE: { growth: 60.63187026977539, base: 45.0 },
  CHASE: { growth: 34.646785736083984, base: 75.0 },
}, HitElement.ice);

export function hit(damage: number, kind: Parameters<typeof facingHit>[1], angle: Angle, backwards = false, element: HitElement = HitElement.ice): Readonly<HitEffect> {
  return facingHit(damage, kind, angle, backwards ? -1.0 : 1.0, element);
}

const capsule = capsuleOf(8.0);
const circle = (x: number, z: number, radius: number): StrikeCapsule => capsule(x, z, x, z, radius);
const frame = (active: number, strike: StrikeCapsule, effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>) => heroRegion(active, active, strike, effect, groundedEffect);

function palm(first: number, heights: readonly number[]): readonly MoveRegion[] {
  return heights.map((height, index) => frame(first + index, capsule(20.0, 45.0, f32(M - 8.0), height), hit(9.974315643310547, "POKE", 35)));
}



function halo(): readonly MoveRegion[] {
  const outer = f32(M - 10.0);
  const diagonal = f32(outer * f32(0.707106781));
  const strikes = [
    capsule(outer, 24.0, outer, 66.0, 10.0),
    capsule(diagonal, f32(45.0 + diagonal), 18.0, f32(45.0 + outer), 10.0),
    capsule(18.0, f32(45.0 + outer), -18.0, f32(45.0 + outer), 10.0),
    capsule(-18.0, f32(45.0 + outer), -diagonal, f32(45.0 + diagonal), 10.0),
    capsule(-outer, 66.0, -outer, 24.0, 10.0),
    capsule(-diagonal, f32(45.0 - diagonal), -18.0, f32(45.0 - outer), 10.0),
  ];
  const ring = [...strikes, ...strikes.map(strike => capsule(-strike.x1, f32(90.0 - strike.z1), -strike.x2, f32(90.0 - strike.z2), strike.radius))];

  const hold = (effect: Readonly<HitEffect>): readonly Strike[] => ring.map(strike => [strike, effect]);
  const burst: readonly Strike[] = ring.map(strike => [strike, hit(4.987157821655273, "POKE", 50, strike.x1 + strike.x2 < 0.0)]);
  return multiHit([
    { first: 9, last: 11, strikes: hold(linkAt(2.0, 18.0, 90, HitElement.ice)) },
    { first: 13, last: 15, strikes: hold(linkAt(2.0, 18.0, 90, HitElement.ice)) },
    { first: 17, last: 19, strikes: hold(linkAt(2.0, 18.0, 90, HitElement.ice)) },
    { first: 21, last: 22, strikes: burst },
  ]);
}

function fan(): readonly MoveRegion[] {
  const regions: MoveRegion[] = [];
  for (let active = 12; active <= 14; active++) {
    const shift = f32((active - 12) * 4.0);
    for (const height of [24.0, 45.0, 66.0]) {
      regions.push(frame(active, capsule(26.0, 45.0, f32(L - 8.0), f32(height - shift)), hit(13.71468448638916, "EDGE", 40)));
    }
  }
  return regions;
}

function throwMove(release: number, recovery: number, damage: number, kind: Parameters<typeof facingHit>[1], angle: Angle, backwards = false): AuthoredThrow {
  return { contactFrame: release, totalFrames: release + recovery, effect: hit(damage, kind, angle, backwards) };
}




const BODY_RADIUS = hurtCapsule(Character.lich).radius;
const BODY_TOP = hurtCapsule(Character.lich).z2;
const SHOULDER = f32(BODY_TOP - 14.0);
const TORSO = hurtPart(0.0, 4.0, 0.0, BODY_TOP, BODY_RADIUS);
const ARM_RADIUS = 9.0;
const arm = (handX: number, handZ: number, shoulderX = 8.0) => hurtPart(shoulderX, SHOULDER, handX, handZ, ARM_RADIUS);


export const lichCastBody = (first: number, last: number, handX: number, handZ: number): readonly HurtPose[] =>
  [hurtPose(first, last, [TORSO, arm(handX, handZ)])];

const LICH_BODY: FighterHurtboxes = {
  stand: [TORSO],
  crouch: [hurtPart(0.0, 40.0, 0.0, 145.0, 24.0)],
  attacks: {
    [AttackStyle.getupAttack]: [
      hurtPose(0, 2, [hurtPart(-21.0, 36.0, -21.0, 36.0, 60.0), hurtPart(-63.0, 76.0, -63.0, 140.0, 10.0)]),
      hurtPose(3, 5, [hurtPart(-17.0, 35.0, -17.0, 35.0, 60.0), hurtPart(-51.0, 83.0, -51.0, 131.0, 18.0)]),
      hurtPose(6, 8, [hurtPart(-28.0, 66.0, -28.0, 68.0, 56.0)]),
      hurtPose(9, 11, [hurtPart(-14.0, 62.0, -14.0, 62.0, 60.0)]),
      hurtPose(12, 14, [hurtPart(-29.0, 31.0, -29.0, 31.0, 60.0), hurtPart(12.0, 96.0, 12.0, 124.0, 32.0)]),
      hurtPose(15, 17, [hurtPart(-13.0, 29.0, -13.0, 115.0, 43.0)]),
      hurtPose(18, 20, [hurtPart(12.0, 60.0, 12.0, 88.0, 59.0)]),
      hurtPose(21, 23, [hurtPart(4.0, 55.0, 4.0, 89.0, 58.0)]),
      hurtPose(24, 26, [hurtPart(6.0, 33.0, 6.0, 33.0, 43.0), hurtPart(-31.0, 89.0, -31.0, 115.0, 27.0)]),
      hurtPose(27, 29, [hurtPart(-13.0, 22.0, -13.0, 120.0, 29.0)]),
      hurtPose(30, 32, [hurtPart(-11.0, 29.0, -11.0, 129.0, 32.0)]),
      hurtPose(33, 35, [hurtPart(-8.0, 31.0, -8.0, 128.0, 34.0)]),
      hurtPose(36, 38, [hurtPart(-2.0, 23.0, -2.0, 140.0, 28.0)]),
      hurtPose(39, 41, [hurtPart(1.0, 23.0, 1.0, 151.0, 24.0)]),
      hurtPose(42, 44, [hurtPart(-2.0, 25.0, -2.0, 149.0, 25.0)]),
      hurtPose(45, 48, [hurtPart(-11.0, 36.0, -11.0, 36.0, 48.0), hurtPart(6.0, 85.0, 6.0, 107.0, 21.0), hurtPart(11.0, 140.0, 11.0, 144.0, 16.0)]),
    ],
    [AttackStyle.downAir]: [
      hurtPose(0, 2, [hurtPart(-10.0, 42.0, 5.0, 53.0, 48.0), hurtPart(9.0, 99.0, 9.0, 121.0, 20.0), hurtPart(8.0, 152.0, 8.0, 157.0, 15.0)]),
      hurtPose(3, 5, [hurtPart(0.0, 38.0, 14.0, 52.0, 57.0), hurtPart(20.0, 111.0, 20.0, 111.0, 34.0), hurtPart(1.0, 154.0, 1.0, 161.0, 14.0)]),
      hurtPose(6, 8, [hurtPart(0.0, 48.0, 12.0, 129.0, 53.0)]),
      hurtPose(9, 11, [hurtPart(-15.0, 28.0, -2.0, 75.0, 39.0), hurtPart(18.0, 111.0, 22.0, 136.0, 38.0), hurtPart(49.0, 162.0, 61.0, 165.0, 13.0)]),
      hurtPose(12, 14, [hurtPart(-16.0, 57.0, -16.0, 57.0, 60.0), hurtPart(18.0, 129.0, 18.0, 169.0, 31.0)]),
      hurtPose(15, 17, [hurtPart(-34.0, 40.0, -34.0, 56.0, 51.0), hurtPart(-25.0, 104.0, -13.0, 103.0, 47.0), hurtPart(-90.0, 116.0, -98.0, 155.0, 20.0)]),
      hurtPose(18, 20, [hurtPart(-38.0, 53.0, -42.0, 71.0, 51.0), hurtPart(1.0, 102.0, -1.0, 100.0, 32.0), hurtPart(-83.0, 125.0, -91.0, 148.0, 22.0)]),
      hurtPose(21, 23, [hurtPart(-35.0, 61.0, -35.0, 107.0, 45.0)]),
      hurtPose(24, 26, [hurtPart(-26.0, 61.0, -26.0, 95.0, 49.0)]),
      hurtPose(27, 29, [hurtPart(-19.0, 50.0, -19.0, 109.0, 40.0)]),
      hurtPose(30, 32, [hurtPart(-25.0, 30.0, -25.0, 51.0, 22.0), hurtPart(-19.0, 95.0, -19.0, 95.0, 53.0), hurtPart(35.0, 129.0, 35.0, 146.0, 12.0)]),
      hurtPose(33, 35, [hurtPart(-23.0, 32.0, -23.0, 49.0, 25.0), hurtPart(-18.0, 97.0, -18.0, 97.0, 57.0), hurtPart(33.0, 131.0, 33.0, 151.0, 7.0)]),
      hurtPose(36, 38, [hurtPart(-41.0, 55.0, -26.0, 48.0, 48.0), hurtPart(11.0, 98.0, 11.0, 140.0, 22.0)]),
      hurtPose(39, 41, [hurtPart(-37.0, 52.0, -24.0, 42.0, 47.0), hurtPart(5.0, 87.0, 13.0, 114.0, 18.0), hurtPart(26.0, 146.0, 26.0, 146.0, 20.0)]),
      hurtPose(42, 44, [hurtPart(-31.0, 49.0, -16.0, 44.0, 48.0), hurtPart(10.0, 87.0, 10.0, 118.0, 16.0), hurtPart(22.0, 148.0, 22.0, 148.0, 19.0)]),
      hurtPose(45, 49, [hurtPart(-25.0, 45.0, -10.0, 46.0, 48.0), hurtPart(9.0, 91.0, 9.0, 121.0, 17.0), hurtPart(17.0, 152.0, 17.0, 152.0, 19.0)]),
    ],
    [AttackStyle.ledgeAttack]: [
      hurtPose(0, 2, [hurtPart(-32.0, -10.0, -34.0, 28.0, 46.0), hurtPart(-32.0, 28.0, 48.0, 82.0, 10.0)]),
      hurtPose(3, 5, [hurtPart(-15.0, -11.0, -17.0, 44.0, 44.0)]),
      hurtPose(6, 8, [hurtPart(-36.0, 1.0, -36.0, 1.0, 60.0), hurtPart(12.0, 58.0, 12.0, 98.0, 27.0)]),
      hurtPose(9, 11, [hurtPart(-22.0, 16.0, -22.0, 16.0, 53.0), hurtPart(5.0, 83.0, 5.0, 120.0, 31.0)]),
      hurtPose(12, 14, [hurtPart(-20.0, 29.0, -20.0, 104.0, 52.0)]),
      hurtPose(15, 17, [hurtPart(-14.0, 53.0, -14.0, 85.0, 58.0)]),
      hurtPose(18, 20, [hurtPart(5.0, 40.0, 5.0, 95.0, 45.0)]),
      hurtPose(21, 23, [hurtPart(9.0, 22.0, 9.0, 108.0, 31.0)]),
      hurtPose(24, 26, [hurtPart(10.0, 26.0, 10.0, 123.0, 32.0)]),
      hurtPose(27, 29, [hurtPart(7.0, 29.0, 7.0, 123.0, 34.0)]),
      hurtPose(30, 32, [hurtPart(2.0, 28.0, 2.0, 133.0, 35.0)]),
      hurtPose(33, 35, [hurtPart(0.0, 27.0, 0.0, 145.0, 28.0)]),
      hurtPose(36, 39, [hurtPart(-11.0, 41.0, -11.0, 41.0, 45.0), hurtPart(11.0, 93.0, 11.0, 147.0, 19.0)]),
    ],
    [AttackStyle.dashAttack]: [
      hurtPose(0, 2, [hurtPart(-28.0, 35.0, -16.0, 64.0, 37.0), hurtPart(7.0, 95.0, 7.0, 122.0, 18.0), hurtPart(11.0, 151.0, 11.0, 158.0, 14.0)]),
      hurtPose(3, 5, [hurtPart(-21.0, 45.0, -21.0, 57.0, 41.0), hurtPart(9.0, 94.0, 9.0, 120.0, 19.0), hurtPart(15.0, 149.0, 15.0, 159.0, 13.0)]),
      hurtPose(6, 8, [hurtPart(-2.0, 45.0, 13.0, 45.0, 60.0), hurtPart(40.0, 103.0, 40.0, 103.0, 39.0), hurtPart(33.0, 148.0, 33.0, 148.0, 17.0)]),
      hurtPose(9, 11, [hurtPart(-9.0, 44.0, 5.0, 44.0, 57.0), hurtPart(45.0, 100.0, 45.0, 100.0, 40.0), hurtPart(39.0, 134.0, 39.0, 153.0, 7.0)]),
      hurtPose(12, 14, [hurtPart(-7.0, 45.0, 8.0, 45.0, 58.0), hurtPart(40.0, 102.0, 40.0, 102.0, 35.0), hurtPart(37.0, 136.0, 37.0, 155.0, 7.0)]),
      hurtPose(15, 17, [hurtPart(-5.0, 46.0, 10.0, 46.0, 59.0), hurtPart(35.0, 103.0, 35.0, 104.0, 30.0), hurtPart(35.0, 137.0, 35.0, 159.0, 6.0)]),
      hurtPose(18, 20, [hurtPart(-4.0, 47.0, 11.0, 47.0, 56.0), hurtPart(29.0, 101.0, 29.0, 108.0, 27.0), hurtPart(32.0, 146.0, 32.0, 152.0, 14.0)]),
      hurtPose(21, 23, [hurtPart(-7.0, 45.0, 11.0, 47.0, 58.0), hurtPart(24.0, 98.0, 24.0, 112.0, 24.0), hurtPart(28.0, 150.0, 28.0, 150.0, 20.0)]),
      hurtPose(24, 26, [hurtPart(-12.0, 44.0, 8.0, 49.0, 54.0), hurtPart(20.0, 96.0, 20.0, 116.0, 21.0), hurtPart(26.0, 151.0, 26.0, 151.0, 19.0)]),
      hurtPose(27, 29, [hurtPart(-15.0, 46.0, 5.0, 52.0, 51.0), hurtPart(16.0, 94.0, 16.0, 119.0, 18.0), hurtPart(22.0, 151.0, 22.0, 151.0, 18.0)]),
      hurtPose(30, 32, [hurtPart(-22.0, 41.0, 1.0, 57.0, 46.0), hurtPart(12.0, 93.0, 12.0, 120.0, 17.0), hurtPart(18.0, 151.0, 18.0, 151.0, 17.0)]),
      hurtPose(33, 36, [hurtPart(-24.0, 38.0, -2.0, 64.0, 43.0), hurtPart(8.0, 93.0, 8.0, 123.0, 16.0), hurtPart(14.0, 153.0, 14.0, 153.0, 17.0)]),
    ],
    [AttackStyle.forwardTilt]: [
      hurtPose(0, 2, [hurtPart(-28.0, 33.0, -20.0, 64.0, 36.0), hurtPart(8.0, 95.0, 8.0, 120.0, 19.0), hurtPart(15.0, 153.0, 15.0, 153.0, 19.0)]),
      hurtPose(3, 5, [hurtPart(-28.0, 43.0, -24.0, 57.0, 40.0), hurtPart(12.0, 92.0, 12.0, 116.0, 19.0), hurtPart(23.0, 148.0, 23.0, 151.0, 16.0)]),
      hurtPose(6, 8, [hurtPart(-8.0, 47.0, 6.0, 47.0, 58.0), hurtPart(25.0, 107.0, 25.0, 108.0, 32.0), hurtPart(14.0, 150.0, 14.0, 160.0, 13.0)]),
      hurtPose(9, 11, [hurtPart(-9.0, 47.0, 6.0, 47.0, 55.0), hurtPart(23.0, 106.0, 23.0, 109.0, 31.0), hurtPart(12.0, 148.0, 12.0, 162.0, 11.0)]),
      hurtPose(12, 14, [hurtPart(-7.0, 48.0, 8.0, 48.0, 54.0), hurtPart(20.0, 103.0, 20.0, 113.0, 27.0), hurtPart(12.0, 148.0, 12.0, 160.0, 12.0)]),
      hurtPose(15, 17, [hurtPart(-10.0, 49.0, 8.0, 49.0, 57.0), hurtPart(16.0, 97.0, 16.0, 121.0, 20.0), hurtPart(12.0, 149.0, 12.0, 161.0, 12.0)]),
      hurtPose(18, 20, [hurtPart(-12.0, 43.0, 8.0, 51.0, 54.0), hurtPart(14.0, 95.0, 14.0, 123.0, 22.0), hurtPart(12.0, 149.0, 12.0, 161.0, 12.0)]),
      hurtPose(21, 23, [hurtPart(-16.0, 45.0, 6.0, 54.0, 51.0), hurtPart(11.0, 93.0, 11.0, 125.0, 16.0), hurtPart(12.0, 150.0, 12.0, 161.0, 12.0)]),
      hurtPose(24, 26, [hurtPart(-19.0, 42.0, 3.0, 59.0, 49.0), hurtPart(10.0, 94.0, 10.0, 125.0, 16.0), hurtPart(11.0, 150.0, 11.0, 161.0, 12.0)]),
      hurtPose(27, 29, [hurtPart(-22.0, 38.0, 1.0, 63.0, 45.0), hurtPart(8.0, 93.0, 8.0, 126.0, 15.0), hurtPart(11.0, 151.0, 11.0, 160.0, 13.0)]),
      hurtPose(30, 33, [hurtPart(-25.0, 36.0, -2.0, 66.0, 42.0), hurtPart(7.0, 93.0, 7.0, 126.0, 15.0), hurtPart(11.0, 151.0, 11.0, 160.0, 13.0)]),
    ],
    [AttackStyle.forwardTiltDown]: [
      hurtPose(0, 2, [hurtPart(-21.0, 35.0, -21.0, 62.0, 37.0), hurtPart(8.0, 95.0, 8.0, 121.0, 19.0), hurtPart(12.0, 152.0, 12.0, 157.0, 15.0)]),
      hurtPose(3, 5, [hurtPart(-26.0, 44.0, -26.0, 56.0, 42.0), hurtPart(14.0, 96.0, 14.0, 116.0, 22.0), hurtPart(24.0, 153.0, 24.0, 153.0, 22.0)]),
      hurtPose(6, 8, [hurtPart(-4.0, 43.0, 11.0, 43.0, 60.0), hurtPart(35.0, 100.0, 35.0, 100.0, 35.0), hurtPart(41.0, 133.0, 41.0, 154.0, 6.0)]),
      hurtPose(9, 11, [hurtPart(-6.0, 45.0, 9.0, 44.0, 60.0), hurtPart(34.0, 101.0, 34.0, 101.0, 33.0), hurtPart(39.0, 135.0, 39.0, 154.0, 7.0)]),
      hurtPose(12, 14, [hurtPart(-5.0, 45.0, 10.0, 45.0, 59.0), hurtPart(30.0, 100.0, 30.0, 103.0, 29.0), hurtPart(36.0, 136.0, 36.0, 156.0, 7.0)]),
      hurtPose(15, 17, [hurtPart(-12.0, 46.0, 10.0, 46.0, 55.0), hurtPart(26.0, 99.0, 26.0, 108.0, 26.0), hurtPart(33.0, 148.0, 33.0, 148.0, 22.0)]),
      hurtPose(18, 20, [hurtPart(-14.0, 47.0, 8.0, 47.0, 53.0), hurtPart(22.0, 97.0, 22.0, 113.0, 23.0), hurtPart(30.0, 150.0, 30.0, 150.0, 20.0)]),
      hurtPose(21, 23, [hurtPart(-13.0, 46.0, 7.0, 49.0, 53.0), hurtPart(19.0, 95.0, 19.0, 117.0, 20.0), hurtPart(26.0, 150.0, 26.0, 150.0, 19.0)]),
      hurtPose(24, 26, [hurtPart(-19.0, 43.0, 4.0, 54.0, 49.0), hurtPart(15.0, 93.0, 15.0, 119.0, 18.0), hurtPart(22.0, 151.0, 22.0, 151.0, 18.0)]),
      hurtPose(27, 29, [hurtPart(-22.0, 40.0, 0.0, 59.0, 46.0), hurtPart(12.0, 92.0, 12.0, 121.0, 16.0), hurtPart(19.0, 151.0, 19.0, 151.0, 17.0)]),
      hurtPose(30, 33, [hurtPart(-25.0, 37.0, -3.0, 66.0, 42.0), hurtPart(8.0, 95.0, 8.0, 123.0, 19.0), hurtPart(15.0, 154.0, 15.0, 155.0, 17.0)]),
    ],
    [AttackStyle.downTilt]: [
      hurtPose(0, 2, [hurtPart(-9.0, 46.0, -9.0, 46.0, 37.0), hurtPart(11.0, 95.0, 11.0, 117.0, 21.0), hurtPart(16.0, 153.0, 16.0, 153.0, 20.0)]),
      hurtPose(3, 5, [hurtPart(-23.0, 53.0, -3.0, 47.0, 49.0), hurtPart(22.0, 96.0, 22.0, 144.0, 20.0)]),
      hurtPose(6, 8, [hurtPart(9.0, 42.0, 9.0, 42.0, 60.0), hurtPart(37.0, 100.0, 37.0, 128.0, 28.0)]),
      hurtPose(9, 11, [hurtPart(8.0, 42.0, 8.0, 42.0, 60.0), hurtPart(40.0, 102.0, 40.0, 125.0, 30.0)]),
      hurtPose(12, 14, [hurtPart(6.0, 40.0, 6.0, 40.0, 60.0), hurtPart(32.0, 97.0, 32.0, 97.0, 32.0), hurtPart(45.0, 133.0, 45.0, 151.0, 8.0)]),
      hurtPose(15, 17, [hurtPart(-8.0, 50.0, 7.0, 42.0, 55.0), hurtPart(30.0, 95.0, 30.0, 105.0, 26.0), hurtPart(40.0, 145.0, 40.0, 145.0, 21.0)]),
      hurtPose(18, 20, [hurtPart(-14.0, 44.0, 7.0, 45.0, 54.0), hurtPart(25.0, 94.0, 25.0, 110.0, 23.0), hurtPart(35.0, 147.0, 35.0, 147.0, 21.0)]),
      hurtPose(21, 23, [hurtPart(-17.0, 42.0, -15.0, 50.0, 50.0), hurtPart(21.0, 93.0, 21.0, 113.0, 21.0), hurtPart(30.0, 148.0, 30.0, 148.0, 19.0)]),
      hurtPose(24, 26, [hurtPart(-18.0, 38.0, -18.0, 55.0, 46.0), hurtPart(16.0, 92.0, 16.0, 118.0, 18.0), hurtPart(24.0, 149.0, 24.0, 149.0, 18.0)]),
      hurtPose(27, 31, [hurtPart(-26.0, 36.0, -21.0, 61.0, 38.0), hurtPart(10.0, 94.0, 10.0, 121.0, 18.0), hurtPart(17.0, 153.0, 17.0, 153.0, 19.0)]),
    ],
    [AttackStyle.forwardAir]: [
      hurtPose(0, 2, [hurtPart(-18.0, 47.0, -6.0, 47.0, 48.0), hurtPart(9.0, 94.0, 9.0, 120.0, 19.0), hurtPart(13.0, 152.0, 13.0, 155.0, 16.0)]),
      hurtPose(3, 5, [hurtPart(-5.0, 43.0, -5.0, 43.0, 41.0), hurtPart(15.0, 92.0, 15.0, 117.0, 20.0), hurtPart(22.0, 148.0, 22.0, 156.0, 14.0)]),
      hurtPose(6, 8, [hurtPart(-16.0, 51.0, -4.0, 41.0, 55.0), hurtPart(22.0, 100.0, 22.0, 103.0, 35.0), hurtPart(32.0, 149.0, 32.0, 149.0, 16.0)]),
      hurtPose(9, 11, [hurtPart(15.0, 34.0, 15.0, 34.0, 60.0), hurtPart(15.0, 82.0, 15.0, 82.0, 60.0), hurtPart(23.0, 119.0, 23.0, 119.0, 49.0)]),
      hurtPose(12, 14, [hurtPart(7.0, 38.0, 7.0, 38.0, 60.0), hurtPart(29.0, 100.0, 29.0, 100.0, 47.0)]),
      hurtPose(15, 17, [hurtPart(9.0, 41.0, 9.0, 41.0, 60.0), hurtPart(36.0, 106.0, 36.0, 106.0, 42.0)]),
      hurtPose(18, 20, [hurtPart(8.0, 43.0, 8.0, 43.0, 60.0), hurtPart(34.0, 107.0, 34.0, 114.0, 36.0)]),
      hurtPose(21, 23, [hurtPart(6.0, 45.0, 6.0, 45.0, 56.0), hurtPart(33.0, 109.0, 33.0, 122.0, 34.0)]),
      hurtPose(24, 26, [hurtPart(-7.0, 45.0, 5.0, 43.0, 60.0), hurtPart(24.0, 100.0, 24.0, 100.0, 37.0), hurtPart(40.0, 136.0, 40.0, 151.0, 9.0)]),
      hurtPose(27, 29, [hurtPart(-12.0, 45.0, 3.0, 45.0, 56.0), hurtPart(22.0, 107.0, 22.0, 106.0, 27.0), hurtPart(37.0, 137.0, 37.0, 157.0, 7.0)]),
      hurtPose(30, 32, [hurtPart(-13.0, 46.0, 2.0, 46.0, 50.0), hurtPart(19.0, 96.0, 19.0, 112.0, 23.0), hurtPart(32.0, 149.0, 32.0, 149.0, 22.0)]),
      hurtPose(33, 35, [hurtPart(-22.0, 40.0, 1.0, 56.0, 46.0), hurtPart(16.0, 95.0, 16.0, 117.0, 20.0), hurtPart(26.0, 150.0, 26.0, 150.0, 20.0)]),
      hurtPose(36, 40, [hurtPart(-23.0, 37.0, -23.0, 63.0, 38.0), hurtPart(10.0, 95.0, 10.0, 121.0, 18.0), hurtPart(18.0, 153.0, 18.0, 153.0, 20.0)]),
    ],
    [AttackStyle.forwardTiltUp]: [
      hurtPose(0, 2, [hurtPart(-23.0, 40.0, -9.0, 54.0, 45.0), hurtPart(2.0, 98.0, 2.0, 120.0, 20.0), hurtPart(12.0, 153.0, 12.0, 155.0, 16.0)]),
      hurtPose(3, 5, [hurtPart(-18.0, 40.0, 4.0, 85.0, 43.0), hurtPart(17.0, 125.0, 13.0, 170.0, 26.0)]),
      hurtPose(6, 8, [hurtPart(-23.0, 36.0, -1.0, 83.0, 39.0), hurtPart(29.0, 128.0, 25.0, 147.0, 35.0)]),
      hurtPose(9, 11, [hurtPart(-14.0, 40.0, 2.0, 137.0, 47.0)]),
      hurtPose(12, 14, [hurtPart(-25.0, 36.0, -2.0, 68.0, 41.0), hurtPart(25.0, 110.0, 25.0, 110.0, 38.0), hurtPart(1.0, 150.0, 1.0, 161.0, 12.0)]),
      hurtPose(15, 17, [hurtPart(-13.0, 38.0, 2.0, 53.0, 50.0), hurtPart(23.0, 111.0, 23.0, 111.0, 39.0), hurtPart(2.0, 152.0, 2.0, 163.0, 12.0)]),
      hurtPose(18, 20, [hurtPart(-7.0, 39.0, 7.0, 52.0, 55.0), hurtPart(17.0, 110.0, 17.0, 111.0, 31.0), hurtPart(3.0, 151.0, 3.0, 162.0, 12.0)]),
      hurtPose(21, 23, [hurtPart(-7.0, 38.0, 8.0, 52.0, 54.0), hurtPart(13.0, 106.0, 13.0, 115.0, 27.0), hurtPart(5.0, 152.0, 5.0, 161.0, 13.0)]),
      hurtPose(24, 26, [hurtPart(-7.0, 37.0, 8.0, 52.0, 51.0), hurtPart(10.0, 97.0, 10.0, 124.0, 18.0), hurtPart(6.0, 152.0, 6.0, 161.0, 13.0)]),
      hurtPose(27, 29, [hurtPart(-18.0, 39.0, 4.0, 59.0, 48.0), hurtPart(8.0, 95.0, 8.0, 126.0, 16.0), hurtPart(8.0, 152.0, 8.0, 161.0, 13.0)]),
      hurtPose(30, 33, [hurtPart(-24.0, 39.0, -1.0, 66.0, 43.0), hurtPart(7.0, 94.0, 7.0, 126.0, 15.0), hurtPart(9.0, 152.0, 9.0, 159.0, 14.0)]),
    ],
    [AttackStyle.upTilt]: [
      hurtPose(0, 2, [hurtPart(-23.0, 40.0, -9.0, 54.0, 45.0), hurtPart(2.0, 98.0, 2.0, 120.0, 20.0), hurtPart(12.0, 153.0, 12.0, 155.0, 16.0)]),
      hurtPose(3, 5, [hurtPart(-7.0, 55.0, -7.0, 55.0, 46.0), hurtPart(4.0, 106.0, 4.0, 152.0, 20.0)]),
      hurtPose(6, 8, [hurtPart(-14.0, 41.0, 11.0, 147.0, 48.0)]),
      hurtPose(9, 11, [hurtPart(-17.0, 37.0, -1.0, 95.0, 36.0), hurtPart(9.0, 134.0, 1.0, 181.0, 21.0)]),
      hurtPose(12, 14, [hurtPart(-23.0, 37.0, -1.0, 95.0, 42.0), hurtPart(23.0, 126.0, 11.0, 181.0, 21.0)]),
      hurtPose(15, 17, [hurtPart(-24.0, 36.0, -1.0, 85.0, 42.0), hurtPart(19.0, 127.0, 19.0, 139.0, 33.0), hurtPart(26.0, 181.0, 26.0, 181.0, 21.0)]),
      hurtPose(18, 20, [hurtPart(-11.0, 43.0, 4.0, 63.0, 49.0), hurtPart(26.0, 124.0, 26.0, 124.0, 45.0), hurtPart(43.0, 175.0, 43.0, 177.0, 19.0)]),
      hurtPose(21, 23, [hurtPart(-1.0, 52.0, 7.0, 52.0, 57.0), hurtPart(31.0, 111.0, 31.0, 111.0, 44.0), hurtPart(28.0, 154.0, 28.0, 154.0, 33.0)]),
      hurtPose(24, 26, [hurtPart(-4.0, 44.0, 11.0, 52.0, 59.0), hurtPart(30.0, 111.0, 30.0, 111.0, 44.0), hurtPart(-1.0, 152.0, -1.0, 163.0, 12.0)]),
      hurtPose(27, 29, [hurtPart(0.0, 40.0, 15.0, 52.0, 58.0), hurtPart(19.0, 111.0, 19.0, 111.0, 32.0), hurtPart(3.0, 152.0, 3.0, 161.0, 13.0)]),
      hurtPose(30, 34, [hurtPart(-12.0, 40.0, 10.0, 52.0, 52.0), hurtPart(10.0, 98.0, 10.0, 123.0, 19.0), hurtPart(7.0, 154.0, 7.0, 159.0, 15.0)]),
    ],
    [AttackStyle.forwardSmash]: [
      hurtPose(0, 2, [hurtPart(-26.0, 37.0, -3.0, 68.0, 41.0), hurtPart(6.0, 95.0, 6.0, 125.0, 16.0), hurtPart(9.0, 152.0, 9.0, 159.0, 14.0)]),
      hurtPose(3, 5, [hurtPart(-26.0, 36.0, -2.0, 69.0, 41.0), hurtPart(4.0, 96.0, 4.0, 127.0, 16.0), hurtPart(5.0, 154.0, 5.0, 161.0, 14.0)]),
      hurtPose(6, 8, [hurtPart(-27.0, 37.0, -4.0, 68.0, 41.0), hurtPart(3.0, 96.0, 3.0, 125.0, 17.0), hurtPart(1.0, 152.0, 1.0, 161.0, 13.0)]),
      hurtPose(9, 11, [hurtPart(-26.0, 37.0, -4.0, 67.0, 42.0), hurtPart(2.0, 97.0, 2.0, 123.0, 18.0), hurtPart(-2.0, 150.0, -2.0, 161.0, 12.0)]),
      hurtPose(12, 14, [hurtPart(-9.0, 40.0, 6.0, 52.0, 50.0), hurtPart(16.0, 110.0, 16.0, 111.0, 31.0), hurtPart(9.0, 156.0, 9.0, 156.0, 21.0)]),
      hurtPose(15, 17, [hurtPart(-3.0, 41.0, 12.0, 49.0, 57.0), hurtPart(34.0, 102.0, 34.0, 102.0, 33.0), hurtPart(35.0, 138.0, 35.0, 150.0, 10.0)]),
      hurtPose(18, 20, [hurtPart(-4.0, 40.0, 11.0, 48.0, 56.0), hurtPart(33.0, 101.0, 33.0, 101.0, 33.0), hurtPart(35.0, 135.0, 35.0, 149.0, 9.0)]),
      hurtPose(21, 23, [hurtPart(-4.0, 41.0, 11.0, 49.0, 54.0), hurtPart(33.0, 102.0, 33.0, 102.0, 32.0), hurtPart(33.0, 136.0, 33.0, 152.0, 8.0)]),
      hurtPose(24, 26, [hurtPart(-4.0, 41.0, 11.0, 49.0, 53.0), hurtPart(32.0, 104.0, 32.0, 104.0, 32.0), hurtPart(32.0, 137.0, 32.0, 155.0, 7.0)]),
      hurtPose(27, 29, [hurtPart(-12.0, 40.0, 10.0, 50.0, 52.0), hurtPart(30.0, 105.0, 30.0, 105.0, 31.0), hurtPart(30.0, 137.0, 30.0, 158.0, 6.0)]),
      hurtPose(30, 32, [hurtPart(-14.0, 40.0, 9.0, 50.0, 51.0), hurtPart(27.0, 104.0, 27.0, 107.0, 28.0), hurtPart(29.0, 138.0, 29.0, 159.0, 6.0)]),
      hurtPose(33, 35, [hurtPart(-14.0, 38.0, 8.0, 50.0, 50.0), hurtPart(24.0, 102.0, 24.0, 112.0, 25.0), hurtPart(27.0, 140.0, 27.0, 161.0, 6.0)]),
      hurtPose(36, 38, [hurtPart(-14.0, 32.0, 6.0, 53.0, 47.0), hurtPart(21.0, 100.0, 21.0, 114.0, 23.0), hurtPart(26.0, 139.0, 26.0, 163.0, 5.0)]),
      hurtPose(39, 41, [hurtPart(-17.0, 38.0, 5.0, 57.0, 48.0), hurtPart(19.0, 98.0, 19.0, 117.0, 21.0), hurtPart(23.0, 152.0, 23.0, 152.0, 21.0)]),
      hurtPose(42, 44, [hurtPart(-19.0, 37.0, 3.0, 59.0, 46.0), hurtPart(17.0, 97.0, 17.0, 118.0, 20.0), hurtPart(21.0, 152.0, 21.0, 152.0, 19.0)]),
      hurtPose(45, 47, [hurtPart(-19.0, 34.0, 1.0, 60.0, 45.0), hurtPart(14.0, 96.0, 14.0, 119.0, 23.0), hurtPart(18.0, 152.0, 18.0, 152.0, 18.0)]),
      hurtPose(48, 50, [hurtPart(-22.0, 40.0, 1.0, 62.0, 45.0), hurtPart(12.0, 95.0, 12.0, 120.0, 18.0), hurtPart(16.0, 152.0, 16.0, 152.0, 17.0)]),
      hurtPose(51, 55, [hurtPart(-23.0, 39.0, -1.0, 64.0, 44.0), hurtPart(9.0, 95.0, 9.0, 123.0, 17.0), hurtPart(14.0, 154.0, 14.0, 154.0, 17.0)]),
    ],
    [AttackStyle.upSmash]: [
      hurtPose(0, 2, [hurtPart(-27.0, 38.0, -3.0, 63.0, 41.0), hurtPart(5.0, 96.0, 5.0, 122.0, 18.0), hurtPart(11.0, 152.0, 11.0, 156.0, 15.0)]),
      hurtPose(3, 5, [hurtPart(-10.0, 49.0, -10.0, 62.0, 32.0), hurtPart(7.0, 103.0, 7.0, 154.0, 17.0)]),
      hurtPose(6, 8, [hurtPart(-15.0, 55.0, -15.0, 55.0, 40.0), hurtPart(4.0, 105.0, 4.0, 149.0, 20.0)]),
      hurtPose(9, 11, [hurtPart(-15.0, 55.0, -15.0, 55.0, 43.0), hurtPart(2.0, 107.0, 2.0, 147.0, 22.0)]),
      hurtPose(12, 14, [hurtPart(-17.0, 33.0, 1.0, 162.0, 32.0)]),
      hurtPose(15, 17, [hurtPart(-18.0, 40.0, -18.0, 179.0, 23.0)]),
      hurtPose(18, 20, [hurtPart(-23.0, 38.0, -8.0, 166.0, 36.0)]),
      hurtPose(21, 23, [hurtPart(-23.0, 38.0, -4.0, 161.0, 41.0)]),
      hurtPose(24, 26, [hurtPart(-24.0, 37.0, -1.0, 93.0, 42.0), hurtPart(4.0, 126.0, 4.0, 179.0, 23.0)]),
      hurtPose(27, 29, [hurtPart(-24.0, 37.0, -1.0, 91.0, 42.0), hurtPart(13.0, 127.0, 13.0, 177.0, 25.0)]),
      hurtPose(30, 32, [hurtPart(-23.0, 37.0, -1.0, 87.0, 42.0), hurtPart(19.0, 125.0, 19.0, 170.0, 27.0)]),
      hurtPose(33, 35, [hurtPart(-23.0, 36.0, -2.0, 72.0, 39.0), hurtPart(10.0, 106.0, 10.0, 126.0, 23.0), hurtPart(41.0, 154.0, 41.0, 154.0, 41.0)]),
      hurtPose(36, 38, [hurtPart(-9.0, 36.0, 5.0, 132.0, 51.0)]),
      hurtPose(39, 41, [hurtPart(-10.0, 33.0, 4.0, 140.0, 48.0)]),
      hurtPose(42, 44, [hurtPart(-12.0, 39.0, 3.0, 61.0, 49.0), hurtPart(20.0, 123.0, 19.0, 137.0, 36.0)]),
      hurtPose(45, 47, [hurtPart(-4.0, 40.0, 8.0, 52.0, 57.0), hurtPart(23.0, 111.0, 23.0, 111.0, 36.0), hurtPart(0.0, 152.0, 0.0, 163.0, 12.0)]),
      hurtPose(48, 50, [hurtPart(-3.0, 40.0, 12.0, 52.0, 58.0), hurtPart(15.0, 110.0, 15.0, 113.0, 30.0), hurtPart(3.0, 152.0, 3.0, 163.0, 12.0)]),
      hurtPose(51, 53, [hurtPart(-11.0, 38.0, 10.0, 52.0, 52.0), hurtPart(12.0, 100.0, 12.0, 121.0, 21.0), hurtPart(5.0, 152.0, 5.0, 161.0, 13.0)]),
      hurtPose(54, 57, [hurtPart(-17.0, 40.0, 5.0, 58.0, 49.0), hurtPart(9.0, 97.0, 9.0, 123.0, 18.0), hurtPart(9.0, 152.0, 9.0, 159.0, 14.0)]),
    ],
    [AttackStyle.grab]: [
      hurtPose(0, 2, [hurtPart(-21.0, 43.0, 1.0, 60.0, 46.0), hurtPart(8.0, 97.0, 8.0, 123.0, 18.0), hurtPart(9.0, 151.0, 9.0, 158.0, 14.0)]),
      hurtPose(3, 5, [hurtPart(-7.0, 40.0, 8.0, 52.0, 51.0), hurtPart(10.0, 105.0, 10.0, 116.0, 26.0), hurtPart(5.0, 152.0, 5.0, 161.0, 13.0)]),
      hurtPose(6, 8, [hurtPart(-3.0, 44.0, 10.0, 52.0, 60.0), hurtPart(20.0, 111.0, 20.0, 111.0, 37.0), hurtPart(6.0, 157.0, 6.0, 158.0, 17.0)]),
      hurtPose(9, 11, [hurtPart(-23.0, 42.0, -8.0, 59.0, 40.0), hurtPart(25.0, 107.0, 25.0, 107.0, 38.0), hurtPart(17.0, 151.0, 17.0, 151.0, 17.0)]),
      hurtPose(12, 14, [hurtPart(-18.0, 43.0, -3.0, 51.0, 49.0), hurtPart(32.0, 108.0, 32.0, 108.0, 44.0), hurtPart(15.0, 152.0, 15.0, 152.0, 17.0)]),
      hurtPose(15, 17, [hurtPart(6.0, 55.0, 6.0, 55.0, 51.0), hurtPart(22.0, 118.0, 22.0, 136.0, 33.0)]),
      hurtPose(18, 20, [hurtPart(6.0, 50.0, 6.0, 50.0, 51.0), hurtPart(23.0, 107.0, 23.0, 107.0, 38.0), hurtPart(14.0, 150.0, 14.0, 152.0, 16.0)]),
      hurtPose(21, 23, [hurtPart(-3.0, 44.0, 9.0, 50.0, 60.0), hurtPart(20.0, 107.0, 20.0, 107.0, 35.0), hurtPart(13.0, 150.0, 13.0, 152.0, 16.0)]),
      hurtPose(24, 26, [hurtPart(-6.0, 43.0, 9.0, 51.0, 57.0), hurtPart(16.0, 108.0, 16.0, 108.0, 31.0), hurtPart(14.0, 151.0, 14.0, 155.0, 15.0)]),
      hurtPose(27, 29, [hurtPart(-7.0, 42.0, 8.0, 51.0, 51.0), hurtPart(14.0, 105.0, 14.0, 110.0, 28.0), hurtPart(12.0, 150.0, 12.0, 154.0, 15.0)]),
      hurtPose(30, 32, [hurtPart(-9.0, 39.0, 6.0, 52.0, 49.0), hurtPart(12.0, 101.0, 12.0, 117.0, 23.0), hurtPart(12.0, 151.0, 12.0, 157.0, 14.0)]),
      hurtPose(33, 35, [hurtPart(-17.0, 40.0, 3.0, 57.0, 49.0), hurtPart(9.0, 97.0, 9.0, 121.0, 23.0), hurtPart(11.0, 151.0, 11.0, 157.0, 14.0)]),
      hurtPose(36, 38, [hurtPart(-22.0, 34.0, 2.0, 64.0, 43.0), hurtPart(8.0, 97.0, 8.0, 123.0, 18.0), hurtPart(11.0, 152.0, 11.0, 159.0, 14.0)]),
    ],
    [AttackStyle.upAir]: [
      hurtPose(0, 2, [hurtPart(-9.0, 50.0, -9.0, 137.0, 34.0)]),
      hurtPose(3, 5, [hurtPart(-20.0, 49.0, -20.0, 168.0, 34.0)]),
      hurtPose(6, 8, [hurtPart(-17.0, 38.0, -7.0, 157.0, 45.0)]),
      hurtPose(9, 11, [hurtPart(-23.0, 30.0, -3.0, 90.0, 40.0), hurtPart(13.0, 135.0, 17.0, 167.0, 35.0)]),
      hurtPose(12, 14, [hurtPart(-25.0, 29.0, -3.0, 73.0, 39.0), hurtPart(11.0, 117.0, 11.0, 117.0, 37.0), hurtPart(33.0, 165.0, 33.0, 165.0, 29.0)]),
      hurtPose(15, 17, [hurtPart(-5.0, 46.0, 9.0, 126.0, 55.0)]),
      hurtPose(18, 20, [hurtPart(-6.0, 41.0, 9.0, 132.0, 50.0)]),
      hurtPose(21, 23, [hurtPart(-6.0, 40.0, 6.0, 52.0, 56.0), hurtPart(25.0, 110.0, 25.0, 110.0, 44.0), hurtPart(-8.0, 150.0, -8.0, 161.0, 12.0)]),
      hurtPose(24, 26, [hurtPart(-3.0, 38.0, 12.0, 52.0, 57.0), hurtPart(15.0, 111.0, 15.0, 111.0, 33.0), hurtPart(-3.0, 152.0, -3.0, 161.0, 13.0)]),
      hurtPose(27, 29, [hurtPart(-5.0, 40.0, 10.0, 52.0, 52.0), hurtPart(10.0, 101.0, 10.0, 120.0, 22.0), hurtPart(1.0, 153.0, 1.0, 160.0, 14.0)]),
      hurtPose(30, 33, [hurtPart(-16.0, 30.0, 4.0, 59.0, 45.0), hurtPart(8.0, 98.0, 8.0, 125.0, 18.0), hurtPart(8.0, 155.0, 8.0, 160.0, 15.0)]),
    ],
    [AttackStyle.neutralAir]: [
      hurtPose(0, 2, [hurtPart(-20.0, 56.0, -20.0, 56.0, 41.0), hurtPart(11.0, 110.0, 11.0, 149.0, 23.0)]),
      hurtPose(3, 5, [hurtPart(-9.0, 62.0, -9.0, 131.0, 42.0)]),
      hurtPose(6, 8, [hurtPart(-11.0, 58.0, -11.0, 135.0, 38.0)]),
      hurtPose(9, 11, [hurtPart(-11.0, 51.0, -11.0, 138.0, 35.0)]),
      hurtPose(12, 14, [hurtPart(-9.0, 44.0, -9.0, 145.0, 30.0)]),
      hurtPose(15, 17, [hurtPart(-7.0, 41.0, -7.0, 147.0, 28.0)]),
      hurtPose(18, 20, [hurtPart(-5.0, 40.0, -5.0, 147.0, 27.0)]),
      hurtPose(21, 23, [hurtPart(-5.0, 42.0, -5.0, 143.0, 29.0)]),
      hurtPose(24, 26, [hurtPart(-8.0, 46.0, -8.0, 46.0, 35.0), hurtPart(8.0, 103.0, 8.0, 106.0, 30.0), hurtPart(18.0, 150.0, 18.0, 150.0, 24.0)]),
      hurtPose(27, 29, [hurtPart(-27.0, 54.0, -27.0, 54.0, 60.0), hurtPart(9.0, 105.0, 9.0, 140.0, 22.0)]),
      hurtPose(30, 32, [hurtPart(-25.0, 55.0, -25.0, 55.0, 43.0), hurtPart(-8.0, 124.0, -8.0, 130.0, 39.0)]),
      hurtPose(33, 35, [hurtPart(-15.0, 64.0, -15.0, 123.0, 50.0)]),
      hurtPose(36, 38, [hurtPart(-6.0, 46.0, -6.0, 139.0, 32.0)]),
    ],
    [AttackStyle.jab]: [
      hurtPose(0, 2, [hurtPart(-13.0, 43.0, -13.0, 65.0, 35.0), hurtPart(-8.0, 121.0, -8.0, 163.0, 30.0)]),
      hurtPose(3, 5, [hurtPart(-37.0, 45.0, -37.0, 45.0, 56.0), hurtPart(-7.0, 130.0, -7.0, 146.0, 46.0)]),
      hurtPose(6, 8, [hurtPart(-3.0, 62.0, -3.0, 128.0, 45.0)]),
      hurtPose(9, 11, [hurtPart(-7.0, 52.0, -7.0, 52.0, 40.0), hurtPart(7.0, 95.0, 7.0, 127.0, 15.0), hurtPart(10.0, 151.0, 10.0, 160.0, 13.0)]),
      hurtPose(12, 14, [hurtPart(-8.0, 56.0, -8.0, 59.0, 37.0), hurtPart(8.0, 102.0, 8.0, 159.0, 14.0)]),
      hurtPose(15, 17, [hurtPart(-12.0, 59.0, -12.0, 59.0, 54.0), hurtPart(8.0, 104.0, 8.0, 161.0, 14.0)]),
      hurtPose(18, 21, [hurtPart(-18.0, 57.0, -18.0, 57.0, 53.0), hurtPart(9.0, 103.0, 9.0, 162.0, 14.0)]),
    ],
    [AttackStyle.jab2]: [
      hurtPose(0, 2, [hurtPart(-13.0, 43.0, -13.0, 65.0, 35.0), hurtPart(-8.0, 121.0, -8.0, 163.0, 30.0)]),
      hurtPose(3, 5, [hurtPart(-37.0, 45.0, -37.0, 45.0, 56.0), hurtPart(-7.0, 130.0, -7.0, 146.0, 46.0)]),
      hurtPose(6, 8, [hurtPart(-3.0, 62.0, -3.0, 128.0, 45.0)]),
      hurtPose(9, 11, [hurtPart(-27.0, 36.0, -5.0, 68.0, 39.0), hurtPart(7.0, 94.0, 7.0, 126.0, 15.0), hurtPart(11.0, 151.0, 11.0, 160.0, 13.0)]),
      hurtPose(12, 14, [hurtPart(-10.0, 53.0, -10.0, 53.0, 44.0), hurtPart(8.0, 95.0, 8.0, 127.0, 15.0), hurtPart(10.0, 152.0, 10.0, 160.0, 13.0)]),
      hurtPose(15, 17, [hurtPart(-11.0, 58.0, -11.0, 58.0, 53.0), hurtPart(8.0, 103.0, 8.0, 161.0, 14.0)]),
      hurtPose(18, 20, [hurtPart(-15.0, 59.0, -15.0, 59.0, 52.0), hurtPart(8.0, 104.0, 8.0, 162.0, 14.0)]),
      hurtPose(21, 24, [hurtPart(-18.0, 56.0, -18.0, 56.0, 52.0), hurtPart(8.0, 102.0, 8.0, 162.0, 14.0)]),
    ],
    [AttackStyle.jab3]: [
      hurtPose(0, 2, [hurtPart(-13.0, 43.0, -13.0, 65.0, 35.0), hurtPart(-8.0, 121.0, -8.0, 163.0, 30.0)]),
      hurtPose(3, 5, [hurtPart(-37.0, 45.0, -37.0, 45.0, 56.0), hurtPart(-7.0, 130.0, -7.0, 146.0, 46.0)]),
      hurtPose(6, 8, [hurtPart(-3.0, 62.0, -3.0, 128.0, 45.0)]),
      hurtPose(9, 11, [hurtPart(-27.0, 36.0, -5.0, 68.0, 39.0), hurtPart(7.0, 94.0, 7.0, 126.0, 15.0), hurtPart(11.0, 151.0, 11.0, 160.0, 13.0)]),
      hurtPose(12, 14, [hurtPart(-10.0, 53.0, -10.0, 53.0, 44.0), hurtPart(8.0, 95.0, 8.0, 127.0, 15.0), hurtPart(10.0, 152.0, 10.0, 160.0, 13.0)]),
      hurtPose(15, 17, [hurtPart(-11.0, 58.0, -11.0, 58.0, 53.0), hurtPart(8.0, 103.0, 8.0, 161.0, 14.0)]),
      hurtPose(18, 20, [hurtPart(-15.0, 59.0, -15.0, 59.0, 52.0), hurtPart(8.0, 104.0, 8.0, 162.0, 14.0)]),
      hurtPose(21, 23, [hurtPart(-17.0, 56.0, -17.0, 56.0, 51.0), hurtPart(9.0, 102.0, 9.0, 162.0, 14.0)]),
      hurtPose(24, 27, [hurtPart(-17.0, 54.0, -17.0, 54.0, 49.0), hurtPart(8.0, 100.0, 8.0, 163.0, 14.0)]),
    ],
    [AttackStyle.backAir]: [
      hurtPose(0, 2, [hurtPart(-26.0, 34.0, -26.0, 61.0, 35.0), hurtPart(2.0, 95.0, 2.0, 122.0, 19.0), hurtPart(4.0, 156.0, 4.0, 156.0, 19.0)]),
      hurtPose(3, 5, [hurtPart(-17.0, 14.0, -17.0, 151.0, 22.0)]),
      hurtPose(6, 8, [hurtPart(-19.0, 11.0, -19.0, 143.0, 29.0)]),
      hurtPose(9, 11, [hurtPart(-35.0, 7.0, -35.0, 177.0, 25.0)]),
      hurtPose(12, 14, [hurtPart(-37.0, 13.0, -37.0, 174.0, 27.0)]),
      hurtPose(15, 17, [hurtPart(-27.0, 18.0, -27.0, 175.0, 27.0)]),
      hurtPose(18, 20, [hurtPart(-16.0, 24.0, -16.0, 174.0, 28.0)]),
      hurtPose(21, 23, [hurtPart(-8.0, 29.0, -8.0, 166.0, 29.0)]),
      hurtPose(24, 26, [hurtPart(-16.0, 32.0, -16.0, 62.0, 26.0), hurtPart(6.0, 117.0, 6.0, 132.0, 38.0)]),
      hurtPose(27, 29, [hurtPart(-13.0, 34.0, -13.0, 61.0, 23.0), hurtPart(17.0, 108.0, 17.0, 108.0, 47.0), hurtPart(-12.0, 152.0, -12.0, 160.0, 14.0)]),
      hurtPose(30, 32, [hurtPart(6.0, 55.0, 6.0, 55.0, 48.0), hurtPart(5.0, 106.0, 5.0, 155.0, 19.0)]),
      hurtPose(33, 36, [hurtPart(-9.0, 40.0, 6.0, 52.0, 53.0), hurtPart(8.0, 106.0, 8.0, 117.0, 26.0), hurtPart(3.0, 157.0, 3.0, 158.0, 17.0)]),
    ],
    [AttackStyle.downSmash]: [
      hurtPose(0, 2, [hurtPart(-25.0, 36.0, -2.0, 68.0, 41.0), hurtPart(6.0, 95.0, 6.0, 126.0, 16.0), hurtPart(9.0, 154.0, 9.0, 159.0, 15.0)]),
      hurtPose(3, 5, [hurtPart(-25.0, 37.0, -2.0, 68.0, 42.0), hurtPart(4.0, 96.0, 4.0, 127.0, 16.0), hurtPart(3.0, 154.0, 3.0, 161.0, 14.0)]),
      hurtPose(6, 8, [hurtPart(-23.0, 40.0, 0.0, 64.0, 45.0), hurtPart(3.0, 94.0, 3.0, 127.0, 15.0), hurtPart(-3.0, 152.0, -3.0, 161.0, 13.0)]),
      hurtPose(9, 11, [hurtPart(-21.0, 42.0, 1.0, 61.0, 47.0), hurtPart(2.0, 93.0, 2.0, 125.0, 15.0), hurtPart(-7.0, 148.0, -7.0, 160.0, 11.0)]),
      hurtPose(12, 14, [hurtPart(-20.0, 42.0, 1.0, 62.0, 47.0), hurtPart(3.0, 97.0, 3.0, 123.0, 18.0), hurtPart(-1.0, 155.0, -1.0, 155.0, 18.0)]),
      hurtPose(15, 17, [hurtPart(2.0, 53.0, 2.0, 53.0, 47.0), hurtPart(19.0, 121.0, 19.0, 121.0, 42.0)]),
      hurtPose(18, 20, [hurtPart(-13.0, 37.0, 1.0, 45.0, 50.0), hurtPart(19.0, 93.0, 19.0, 93.0, 37.0), hurtPart(10.0, 130.0, 10.0, 130.0, 38.0)]),
      hurtPose(21, 23, [hurtPart(-13.0, 38.0, 2.0, 46.0, 46.0), hurtPart(18.0, 95.0, 18.0, 95.0, 39.0), hurtPart(23.0, 133.0, 23.0, 133.0, 39.0)]),
      hurtPose(24, 26, [hurtPart(-13.0, 39.0, 2.0, 47.0, 51.0), hurtPart(11.0, 99.0, 11.0, 99.0, 52.0), hurtPart(35.0, 137.0, 35.0, 140.0, 14.0)]),
      hurtPose(27, 29, [hurtPart(-1.0, 52.0, -1.0, 52.0, 48.0), hurtPart(20.0, 119.0, 20.0, 119.0, 40.0)]),
      hurtPose(30, 32, [hurtPart(-5.0, 53.0, -5.0, 53.0, 46.0), hurtPart(20.0, 114.0, 20.0, 131.0, 32.0)]),
      hurtPose(33, 35, [hurtPart(-4.0, 54.0, -4.0, 54.0, 39.0), hurtPart(20.0, 109.0, 20.0, 141.0, 25.0)]),
      hurtPose(36, 38, [hurtPart(-19.0, 38.0, -4.0, 50.0, 47.0), hurtPart(12.0, 101.0, 12.0, 113.0, 24.0), hurtPart(25.0, 150.0, 25.0, 150.0, 21.0)]),
      hurtPose(39, 41, [hurtPart(-18.0, 37.0, -3.0, 56.0, 43.0), hurtPart(11.0, 98.0, 11.0, 116.0, 21.0), hurtPart(22.0, 151.0, 22.0, 151.0, 20.0)]),
      hurtPose(42, 45, [hurtPart(-23.0, 33.0, -2.0, 63.0, 42.0), hurtPart(9.0, 97.0, 9.0, 120.0, 19.0), hurtPart(16.0, 153.0, 16.0, 153.0, 19.0)]),
    ],
  },
};

export const LICH_FROST_NOVA_BODY: readonly HurtPose[] = [
    hurtPose(1, 3, [hurtPart(-22.0, 49.0, -22.0, 49.0, 41.0), hurtPart(1.0, 101.0, 1.0, 115.0, 24.0), hurtPart(20.0, 152.0, 20.0, 152.0, 26.0)]),
    hurtPose(4, 6, [hurtPart(-24.0, 50.0, -24.0, 50.0, 49.0), hurtPart(12.0, 107.0, 12.0, 142.0, 26.0)]),
    hurtPose(7, 9, [hurtPart(-27.0, 46.0, -27.0, 46.0, 59.0), hurtPart(13.0, 108.0, 13.0, 135.0, 30.0)]),
    hurtPose(10, 12, [hurtPart(-2.0, 41.0, -2.0, 123.0, 38.0)]),
    hurtPose(13, 15, [hurtPart(2.0, 35.0, 2.0, 120.0, 37.0)]),
    hurtPose(16, 18, [hurtPart(-14.0, 27.0, -14.0, 27.0, 59.0), hurtPart(27.0, 92.0, 27.0, 119.0, 32.0)]),
    hurtPose(19, 21, [hurtPart(-35.0, 7.0, -43.0, 1.0, 43.0), hurtPart(17.0, 60.0, 17.0, 114.0, 34.0)]),
    hurtPose(22, 24, [hurtPart(0.0, 64.0, -8.0, 103.0, 50.0)]),
    hurtPose(25, 27, [hurtPart(-14.0, 87.0, -14.0, 87.0, 57.0), hurtPart(-4.0, 147.0, -4.0, 175.0, 27.0)]),
    hurtPose(28, 30, [hurtPart(-15.0, 44.0, -15.0, 170.0, 32.0)]),
    hurtPose(31, 33, [hurtPart(-9.0, 8.0, -9.0, 170.0, 32.0)]),
    hurtPose(34, 38, [hurtPart(-11.0, 3.0, -11.0, 164.0, 28.0)]),
  ];

export const LICH_DECAY_BODY: readonly HurtPose[] = [
    hurtPose(1, 3, [hurtPart(-24.0, 42.0, -24.0, 42.0, 52.0), hurtPart(13.0, 110.0, 13.0, 136.0, 34.0)]),
    hurtPose(4, 6, [hurtPart(-35.0, -1.0, -35.0, -1.0, 28.0), hurtPart(6.0, 57.0, 6.0, 65.0, 52.0), hurtPart(27.0, 123.0, 27.0, 123.0, 28.0)]),
    hurtPose(7, 9, [hurtPart(-17.0, 76.0, -5.0, 99.0, 52.0)]),
    hurtPose(10, 12, [hurtPart(-7.0, 83.0, -7.0, 83.0, 60.0), hurtPart(-2.0, 138.0, -2.0, 161.0, 27.0)]),
    hurtPose(13, 15, [hurtPart(-7.0, 104.0, -7.0, 156.0, 46.0)]),
    hurtPose(16, 18, [hurtPart(-9.0, 76.0, -9.0, 172.0, 30.0)]),
    hurtPose(19, 21, [hurtPart(-13.0, 58.0, -13.0, 171.0, 31.0)]),
    hurtPose(22, 24, [hurtPart(-12.0, 44.0, -12.0, 172.0, 30.0)]),
    hurtPose(25, 27, [hurtPart(-13.0, 29.0, -13.0, 172.0, 30.0)]),
    hurtPose(28, 30, [hurtPart(-10.0, 8.0, -10.0, 171.0, 30.0)]),
    hurtPose(31, 33, [hurtPart(-8.0, 5.0, -8.0, 171.0, 29.0)]),
    hurtPose(34, 36, [hurtPart(-7.0, 3.0, -7.0, 169.0, 28.0)]),
    hurtPose(37, 39, [hurtPart(-7.0, -3.0, -7.0, 171.0, 25.0)]),
    hurtPose(40, 42, [hurtPart(-6.0, -4.0, -6.0, 167.0, 26.0)]),
    hurtPose(43, 45, [hurtPart(-8.0, -7.0, -8.0, 165.0, 22.0)]),
    hurtPose(46, 49, [hurtPart(-35.0, 33.0, -15.0, 46.0, 34.0), hurtPart(6.0, 91.0, 6.0, 158.0, 26.0)]),
  ];

const GRAB_EFFECT ={ damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;
export const LICH_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  hurtboxes: LICH_BODY,
  normals: {
    ...LICH_GROUND.normals,
    [AttackStyle.forwardSmash]: tipperMove(heroMove(18, 3, 36, 0, [
      heroRegion(18, 20, capsule(20.0, 45.0, f32(XL - 7.0), 45.0, 7.0), hit(19.20599937438965, "KILL", 35)),
    ]), 0.25),
    [AttackStyle.upSmash]: heroMove(20, 5, 34, 0, [
      heroRegion(20, 24, capsule(0.0, 8.0, 16.0, f32(XL + 10.0), 12.0), hit(21.19542121887207, "KILL", 90)),
    ]),
    [AttackStyle.downSmash]: heroMove(19, 5, 23, 0, [
      heroRegion(19, 23, capsule(24.0, 8.0, f32(L - 10.0), 8.0, 10.0), downSmashHit(hit(14.0, "EDGE", 25))),
      heroRegion(19, 23, capsule(-24.0, 8.0, -f32(L - 10.0), 8.0, 10.0), downSmashHit(hit(14.0, "EDGE", 25, true))),
    ]),
    [AttackStyle.neutralAir]: heroMove(9, 14, 17, 16, halo()),
    [AttackStyle.forwardAir]: heroMove(12, 3, 27, 17, fan()),
    [AttackStyle.backAir]: heroMove(10, 3, 25, 15, [
      frame(10, capsule(-20.0, 49.0, -f32(M - 8.0), 49.0), hit(14.96147346496582, "KILL", 35, true)),
      frame(11, capsule(-20.0, 45.0, -f32(M - 8.0), 45.0), hit(14.96147346496582, "KILL", 35, true)),
      frame(12, capsule(-20.0, 41.0, -f32(M - 8.0), 41.0), hit(14.96147346496582, "KILL", 35, true)),
    ]),
    [AttackStyle.upAir]: heroMove(8, 4, 23, 14, [
      heroRegion(8, 11, capsule(0.0, f32(M - 12.0), 30.0, XL, 12.0), hit(11.221104621887207, "LAUNCH", 85)),
    ]),
    [AttackStyle.downAir]: heroMove(16, 4, 31, 22, [
      heroRegion(16, 19, capsule(0.0, -12.0, 0.0, -f32(M - 10.0), 10.0), hit(14.96147346496582, "SPIKE", 270), hit(14.96147346496582, "SPIKE", 55)),
    ]),
    [AttackStyle.grab]: heroMove(10, 2, 28, 0, [
      heroRegion(10, 11, capsule(18.0, 45.0, f32(GRAB - 10.0), 45.0, 10.0), GRAB_EFFECT),
    ]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false, element: HitElement.ice } },
    [GrabAction.throwForward]: throwMove(14, 23, 8.727526664733887, "EDGE", 35),
    [GrabAction.throwBack]: throwMove(18, 26, 9.974315643310547, "EDGE", 40, true),
    [GrabAction.throwUp]: throwMove(17, 13, 8.727526664733887, "JUGGLE", 90),
    [GrabAction.throwDown]: throwMove(19, 26, 7.48073673248291, "CHASE", 70),
  },
};
