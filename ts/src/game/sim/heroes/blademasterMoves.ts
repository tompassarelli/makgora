import { downSmashHit } from "../downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../codes";
import { type AuthoredMove, type AuthoredThrow, type FighterMoves, type MoveRegion, HERO_REFERENCE_HEIGHT, heroHurtPose, heroMove, heroRegion } from "../heroMoves";
import { type FighterHurtboxes, type HurtPart, hurtPart } from "../hurtboxes";
import { BLADEMASTER_GROUND } from "./groundNormals";
import type { HitEffect } from "../hitRegions";
import { strongHit } from "../strongHits";
import { drillStrikes, linkAt, multiHit } from "./multiHit";
import { type Angle, capsuleOf, makeHit, path } from "./authoring";


export const H = HERO_REFERENCE_HEIGHT;
export const length = (heights: number) => f32(H * heights);
export const S = length(f32(0.55));
export const M = length(f32(0.80));
export const L = length(f32(1.10));
export const XL = length(f32(1.40));
const TIP_LENGTH = length(f32(0.20));
export const BLADE_RADIUS = 6.0;



export const hit = makeHit({
  LINK: { growth: 59.73616027832031, base: 12.0 },
  POKE: { growth: 81.45838928222656, base: 18.0 },
  LAUNCH: { growth: 103.18064880371094, base: 20.0 },
  EDGE: { growth: 108.61119079589844, base: 22.0 },
  KILL: { growth: 119.47232055664062, base: 26.0 },
  SPIKE: { growth: 108.61119079589844, base: 22.0 },

  JUGGLE: { growth: 59.73616027832031, base: 50.0 },
  CHASE: { growth: 43.44447708129883, base: 75.0 },
}, HitElement.slash);


export const capsule = capsuleOf(BLADE_RADIUS);




export function cut(firstFrame: number, tipHeights: readonly number[], reach: number, inner: Readonly<HitEffect>, tip?: Readonly<HitEffect>, facing = 1.0): readonly MoveRegion[] {
  const regions: MoveRegion[] = [];
  const endX = f32(reach - BLADE_RADIUS);
  const boundary = f32(reach - TIP_LENGTH);
  const startTipX = f32(boundary + BLADE_RADIUS);
  const endInnerX = tip === undefined ? endX : boundary;
  for (let index = 0; index < tipHeights.length; index++) {
    const tipHeight = tipHeights[index];
    if (tipHeight === undefined) continue;
    const frame = firstFrame + index;
    const rise = f32(tipHeight - 45.0);
    const heightAt = (x: number) => f32(45.0 + f32(rise * f32(x / endX)));
    if (tip !== undefined) regions.push(heroRegion(frame, frame,
      capsule(f32(startTipX * facing), heightAt(startTipX), f32(endX * facing), tipHeight), strongHit(tip)));
    regions.push(heroRegion(frame, frame,
      capsule(f32(18.0 * facing), heightAt(18.0), f32(endInnerX * facing), heightAt(endInnerX)), inner));
  }
  return regions;
}

function lowSweep(firstFrame: number, facing: number): readonly MoveRegion[] {
  return path(firstFrame, [
    capsule(f32(18.0 * facing), 14.0, f32(f32(L - BLADE_RADIUS) * facing), 14.0),
    capsule(f32(18.0 * facing), 8.0, f32(f32(L - BLADE_RADIUS) * facing), 8.0),
    capsule(f32(18.0 * facing), 2.0, f32(f32(L - BLADE_RADIUS) * facing), 2.0),
  ], downSmashHit(hit(12.968900680541992, "EDGE", 25, facing)));
}






const BLADE_WHEEL_INNER = 60.0;
const BLADESTORM_SPINS = [10, 13, 16, 19, 22] as const;
const BLADESTORM_PLUNGE = 25;
const BLADESTORM_LAST = 34;
const BLADESTORM_TOTAL = 46;
const BLADESTORM_REACH = f32(M - BLADE_RADIUS);
const BLADESTORM = drillStrikes(5.0, -55.0, 75.0,
  { centre: linkAt(2.0, 10.0, 90), front: linkAt(2.0, 10.0, 100), back: linkAt(2.0, 10.0, 80) },
  { centre: linkAt(2.0, 20.0, 270), front: linkAt(2.0, 20.0, 250), back: linkAt(2.0, 20.0, 290) });
const bladestorm: AuthoredMove = {
  ...heroMove(10, BLADESTORM_LAST - 10 + 1, BLADESTORM_TOTAL - BLADESTORM_LAST, 20, [
    ...multiHit([
      ...BLADESTORM_SPINS.map(first => ({ first, last: first + 1, strikes: BLADESTORM })),

      { first: BLADESTORM_PLUNGE, last: BLADESTORM_LAST, strikes: BLADESTORM },
    ]),
    heroRegion(BLADESTORM_TOTAL + 1, BLADESTORM_TOTAL + 2, capsule(-BLADESTORM_REACH, 30.0, BLADESTORM_REACH, 30.0, 30.0),
      linkAt(4.0, 90.0, 80), undefined, BLADESTORM_SPINS.length + 2),
  ]),

  fall: [
    { firstFrame: 9, lastFrame: BLADESTORM_PLUNGE - 2, speedZ: -1.5 },
    { firstFrame: BLADESTORM_PLUNGE - 1, lastFrame: BLADESTORM_LAST - 1, speedZ: -14.0 },
  ],
  landingHit: { firstFrame: BLADESTORM_TOTAL, totalFrames: BLADESTORM_TOTAL + 12 },
};

function authoredThrow(releaseFrame: number, recovery: number, damage: number, kind: Parameters<typeof hit>[1], angle: Angle, facing = 1.0): AuthoredThrow {
  return { contactFrame: releaseFrame, totalFrames: releaseFrame + recovery, effect: hit(damage, kind, angle, facing) };
}






const TORSO = hurtPart(0.0, 4.0, 0.0, f32(94.6), 24.0);
const ARM_RADIUS = 9.0;
const arm = (x1: number, z1: number, x2: number, z2: number): readonly HurtPart[] => [TORSO, hurtPart(x1, z1, x2, z2, ARM_RADIUS)];
const SHOULDER_X = 6.0;
const SHOULDER_Z = 90.0;

export const reach = (handX: number, handZ: number) => arm(SHOULDER_X, SHOULDER_Z, handX, handZ);

const BODY: FighterHurtboxes = {
  stand: [TORSO, hurtPart(-16.0, 110.0, 16.0, 110.0, 8.0)],
  crouch: [TORSO],
  attacks: {
    [AttackStyle.jab]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 17, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.jab2]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 20, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.jab3]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 28, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.forwardTilt]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 29, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.forwardTiltUp]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 29, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.forwardTiltDown]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 29, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.upTilt]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 28, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.downTilt]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 17, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.dashAttack]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, 16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 34, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.forwardSmash]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(-32.0, 40.0, -32.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 32, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(33, 40, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(41, 48, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(49, 51, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.upSmash]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 32, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(33, 40, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(41, 48, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.downSmash]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 32, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(33, 38, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.neutralAir]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 32, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.forwardAir]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 34, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.backAir]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -32.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(-32.0, 40.0, -32.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(-16.0, 24.0, -32.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 33, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.upAir]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 27, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.downAir]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 32, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(33, 40, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(16.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(41, 46, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.grab]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 30, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.getupAttack]: [
      heroHurtPose(1, 3, [hurtPart(-20.0, 20.0, -20.0, 70.0, 35.0), hurtPart(-45.0, 70.0, 36.0, 84.0, 30.0)]),
      heroHurtPose(4, 8, [hurtPart(-36.0, 36.0, -44.0, 92.0, 47.0), hurtPart(-45.0, 70.0, 20.0, 100.0, 30.0), hurtPart(4.0, 142.0, 4.0, 142.0, 18.0)]),
      heroHurtPose(9, 11, [hurtPart(-32.0, 24.0, -48.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(12, 16, [hurtPart(-16.0, 30.0, 2.0, 115.0, 45.0), hurtPart(-25.0, 90.0, 25.0, 115.0, 30.0)]),
      heroHurtPose(17, 19, [hurtPart(-20.0, 25.0, -20.0, 115.0, 40.0), hurtPart(28.0, 82.0, -4.0, 125.0, 35.0)]),
      heroHurtPose(20, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 32, [hurtPart(-16.0, 40.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(33, 40, [hurtPart(-16.0, 24.0, -32.0, 109.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(41, 49, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
    [AttackStyle.ledgeAttack]: [
      heroHurtPose(1, 3, [hurtPart(-16.0, 24.0, 32.0, 109.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(4, 8, [hurtPart(-20.0, 20.0, -20.0, 70.0, 35.0), hurtPart(-58.0, 72.0, 20.0, 104.0, 30.0)]),
      heroHurtPose(9, 11, [hurtPart(-20.0, 20.0, -20.0, 70.0, 35.0), hurtPart(-57.0, 70.0, 0.0, 100.0, 30.0)]),
      heroHurtPose(12, 16, [hurtPart(16.0, 24.0, 0.0, 109.0, 43.0), hurtPart(24.0, 95.0, 0.0, 95.0, 41.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, 16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 32, [hurtPart(0.0, 24.0, 16.0, 109.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(33, 40, [hurtPart(0.0, 24.0, 0.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
    ],
  },
};


export const BLADEMASTER_MOVES: FighterMoves = {
  normals: {
    ...BLADEMASTER_GROUND.normals,
    [AttackStyle.forwardSmash]: heroMove(17, 3, 35, 0, cut(17, [58.0, 45.0, 32.0], XL, { ...hit(13.0, "KILL", 40), base: 30.0 }, { ...hit(17.0, "KILL", 40), base: 30.0 })),
    [AttackStyle.upSmash]: heroMove(15, 4, 30, 0, path(15, [
      capsule(16.0, 38.0, 24.0, f32(L - BLADE_RADIUS)),
      capsule(8.0, 38.0, 12.0, f32(L - BLADE_RADIUS)),
      capsule(0.0, 38.0, 0.0, f32(L - BLADE_RADIUS)),
      capsule(-8.0, 38.0, -12.0, f32(L - BLADE_RADIUS)),
    ], hit(12.392340660095215, "KILL", 90))),
    [AttackStyle.downSmash]: heroMove(14, 6, 19, 0, [...lowSweep(14, 1.0), ...lowSweep(17, -1.0)]),



    [AttackStyle.neutralAir]: heroMove(7, 9, 17, 12, multiHit([
      { first: 7, last: 9, strikes: [
        [capsule(20.0, 35.0, f32(M - BLADE_RADIUS), 50.0), linkAt(3.0, 30.0, 100)],
        [capsule(0.0, 55.0, 0.0, f32(M - BLADE_RADIUS)), linkAt(3.0, 30.0, 90)],
        [capsule(-20.0, 35.0, -f32(M - BLADE_RADIUS), 50.0), linkAt(3.0, 30.0, 80)],
      ] },
      { first: 13, last: 15, strikes: [
        [capsule(20.0, 45.0, BLADE_WHEEL_INNER, 45.0, 10.0), hit(4.647127628326416, "POKE", 50)],
        [capsule(0.0, 55.0, 0.0, f32(BLADE_WHEEL_INNER + 45.0), 10.0), hit(4.647127628326416, "POKE", 50)],
        [capsule(-20.0, 45.0, -BLADE_WHEEL_INNER, 45.0, 10.0), hit(4.647127628326416, "POKE", 50, -1.0)],
      ] },
    ])),
    [AttackStyle.forwardAir]: heroMove(10, 3, 22, 14, cut(10, [60.0, 45.0, 30.0], L, hit(8.519732475280762, "EDGE", 40), hit(10.843297958374023, "EDGE", 40))),
    [AttackStyle.backAir]: heroMove(8, 3, 23, 13, cut(8, [34.0, 45.0, 56.0], L, hit(9.294255256652832, "KILL", 35, -1.0), undefined, -1.0)),
    [AttackStyle.upAir]: heroMove(6, 3, 19, 11, path(6, [
      capsule(0.0, 45.0, 0.0, f32(M - BLADE_RADIUS)),
      capsule(3.0, 45.0, 3.0, f32(M - BLADE_RADIUS)),
      capsule(6.0, 45.0, 6.0, f32(M - BLADE_RADIUS)),
    ], hit(6.196170330047607, "LAUNCH", 85))),
    [AttackStyle.downAir]: bladestorm,
    [AttackStyle.grab]: heroMove(7, 2, 22, 0, path(7, [
      capsule(18.0, 45.0, f32(S - 10.0), 45.0, 10.0),
      capsule(18.0, 47.0, f32(S - 10.0), 47.0, 10.0),
    ], hit(0.0, "POKE", 35))),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 2.865000009536743, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: authoredThrow(12, 18, 5.589328765869141, "EDGE", 35),
    [GrabAction.throwBack]: authoredThrow(15, 22, 6.196170330047607, "EDGE", 40, -1.0),
    [GrabAction.throwUp]: authoredThrow(13, 10, 4.647127628326416, "JUGGLE", 85),
    [GrabAction.throwDown]: authoredThrow(16, 20, 3.992377519607544, "CHASE", 25),
  },
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  hurtboxes: BODY,
};
