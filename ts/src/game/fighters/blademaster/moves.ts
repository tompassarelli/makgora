import { downSmashHit } from "../../sim/downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../../sim/codes";
import { type AuthoredMove, type AuthoredThrow, type FighterMoves, type MoveRegion, HERO_REFERENCE_HEIGHT, heroHurtPose, heroMove, heroRegion, jabStep, travelThrough } from "../../sim/heroMoves";
import { type FighterHurtboxes, type HurtPart, hurtPart } from "../../sim/hurtboxes";
import { type Segment, groundHit, swing, tipped, type GroundKit } from "../../sim/heroes/groundNormals";
import type { HitEffect } from "../../sim/hitRegions";
import { strongHit } from "../../sim/strongHits";
import { linkAt } from "../../sim/heroes/multiHit";
import { squareRoot } from "../../sim/warcraftMath";
import { capsuleOf, makeHit, path } from "../../sim/heroes/authoring";

const BM = HitElement.slash;
const forwardTilt = (segments: readonly Segment[]): AuthoredMove => heroMove(7, 3, 23, 0, tipped(7, segments, 6.0, 26.0,
  groundHit(7.900000095367432, 30, 113.5999984741211, 24.0, BM), groundHit(6.0, 40, 79.80000305175781, 18.0, BM)));
export const BLADEMASTER_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(3, 2, 13, 0, swing(3, [[50.0, 74.0, 168.0, 58.0], [49.0, 69.0, 157.0, 19.0]], 6.0, groundHit(3.705400228500366, 50, 52.525001525878906, 22.0, BM)))),
    [AttackStyle.jab2]: heroMove(3, 2, 16, 0, swing(3, [[45.0, 79.0, 162.0, 91.0], [42.0, 105.0, 114.0, 198.0]], 6.0, groundHit(4.631750106811523, 40, 85.95000457763672, 22.0, BM))),
    [AttackStyle.forwardTilt]: forwardTilt([[53.0, 105.0, 157.0, 162.0], [57.0, 83.0, 175.0, 77.0], [55.0, 75.0, 169.0, 44.0]]),
    [AttackStyle.forwardTiltUp]: forwardTilt([[48.0, 100.0, 162.0, 135.0], [43.0, 123.0, 124.0, 209.0], [37.0, 132.0, 104.0, 229.0]]),
    [AttackStyle.forwardTiltDown]: forwardTilt([[54.0, 75.0, 172.0, 78.0], [48.0, 57.0, 147.0, -6.0], [42.0, 52.0, 127.0, -30.0]]),
    [AttackStyle.upTilt]: heroMove(6, 5, 18, 0, swing(6, [
      [41.0, 116.0, 160.0, 122.0], [26.0, 136.0, 98.0, 230.0], [-2.0, 150.0, -19.0, 268.0], [-34.0, 145.0, -133.0, 210.0], [-49.0, 122.0, -168.0, 121.0],
    ], 6.0, groundHit(6.484450340270996, 85, 66.85000610351562, 38.0, BM))),
    [AttackStyle.downTilt]: heroMove(6, 2, 13, 0, tipped(6, [[23.0, 62.0, 134.0, 73.0], [43.0, 58.0, 148.0, 2.0]], 6.0, 26.0,
      groundHit(5.949999809265137, 20, 71.5999984741211, 18.0, BM), groundHit(3.7200000286102295, 20, 57.30000305175781, 18.0, BM))),
    [AttackStyle.dashAttack]: travelThrough(heroMove(11, 4, 23, 0, tipped(11, [[63.0, 70.0, 175.0, 31.0], [60.0, 64.0, 167.0, 13.0], [57.0, 59.0, 157.0, -4.0], [56.0, 57.0, 145.0, -19.0]], 6.0, 26.0,
      groundHit(7.199999809265137, 30, 105.0, 24.0, BM), groundHit(5.75, 40, 89.5, 18.0, BM)), 179.0, true), 14),
  },
  reaches: {
    [AttackStyle.jab]: [40.0, 72.0], [AttackStyle.jab2]: [42.0, 70.0], [AttackStyle.forwardTilt]: [48.0, 66.0], [AttackStyle.forwardTiltUp]: [48.0, 66.0], [AttackStyle.forwardTiltDown]: [48.0, 66.0],
    [AttackStyle.upTilt]: [14.0, 136.0], [AttackStyle.downTilt]: [44.0, 30.0], [AttackStyle.dashAttack]: [46.0, 56.0],
  },
};


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
  COUNTER: { growth: 170.0, base: 30.0 },
  QUICKDRAW: { growth: 108.61119079589844, base: 40.0 },
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

const blades = (segments: readonly Segment[], radius = BLADE_RADIUS) => segments.map(([x1, z1, x2, z2]) => capsule(x1, z1, x2, z2, radius));
const lowSweep = (firstFrame: number, segments: readonly Segment[], facing: number) => path(firstFrame, blades(segments), downSmashHit(hit(12.968900680541992, "EDGE", 25, facing)));
export interface DrawnBlade extends Blade { readonly frame: number }
const drawn = (frame: number, gripX: number, gripZ: number, tipX: number, tipZ: number): DrawnBlade => ({ frame, gripX, gripZ, tipX, tipZ });
const bladeRegion = (blade: DrawnBlade, effect: Readonly<HitEffect>, window: number) =>
  heroRegion(blade.frame, blade.frame, capsule(blade.gripX, blade.gripZ, blade.tipX, blade.tipZ), effect, undefined, window);

export const NEUTRAL_AIR_FIRST_SPIN = 5;
export const NEUTRAL_AIR_SPIN_FRAMES = 8;
export const NEUTRAL_AIR_SPINS = 2;
export const NEUTRAL_AIR_HITS = [{ first: 6, last: 7 }, { first: 14, last: 17 }] as const;
export const NEUTRAL_AIR_TOTAL = 36;
export const NEUTRAL_AIR_BLADES: readonly DrawnBlade[] = [
  drawn(6, 37.0, 75.0, 128.0, 113.0), drawn(7, 37.0, 45.0, 128.0, 7.0),
  drawn(14, 37.0, 75.0, 128.0, 113.0), drawn(15, 37.0, 45.0, 128.0, 7.0), drawn(16, 15.0, 23.0, 53.0, -68.0), drawn(17, -15.0, 23.0, -53.0, -68.0),
];
export const NEUTRAL_AIR_LINK = linkAt(3.7160000801086426, 30.0, 90);
export const NEUTRAL_AIR_LAUNCH: Readonly<HitEffect> = { ...hit(9.289999961853027, "LAUNCH", 45), growth: 86.23999786376953, base: 50.0 };
const neutralAir: AuthoredMove = {
  ...heroMove(NEUTRAL_AIR_HITS[0].first, NEUTRAL_AIR_HITS[1].last - NEUTRAL_AIR_HITS[0].first + 1, NEUTRAL_AIR_TOTAL - NEUTRAL_AIR_HITS[1].last, 7,
    NEUTRAL_AIR_BLADES.map(blade => blade.frame <= NEUTRAL_AIR_HITS[0].last ? bladeRegion(blade, NEUTRAL_AIR_LINK, 1) : bladeRegion(blade, NEUTRAL_AIR_LAUNCH, 2))),
  autoCancel: { before: 6, from: 24 },
};

export const DOWN_AIR_SWEEP: readonly DrawnBlade[] = [
  drawn(6, 34.0, 62.0, 104.0, -8.0), drawn(7, 3.0, 50.0, -6.0, -49.0), drawn(8, -22.0, 62.0, -92.0, -8.0), drawn(9, -33.0, 83.0, -131.0, 66.0),
];
export const DOWN_AIR_TOTAL = 44;
export const TIPPER_RADIUS = 8.0;
export const DOWN_AIR_TIPPER: Readonly<HitEffect> = strongHit({ ...hit(12.07699966430664, "SPIKE", 290), growth: 75.45999908447266, base: 40.0 });
export const DOWN_AIR_SOURSPOT: Readonly<HitEffect> = { ...hit(8.361000061035156, "POKE", 45), growth: 75.45999908447266, base: 20.0 };
export function tipperSplit(blade: Blade): { readonly x: number; readonly z: number } {
  const dx = f32(blade.tipX - blade.gripX);
  const dz = f32(blade.tipZ - blade.gripZ);
  const share = f32(TIP_LENGTH / squareRoot(f32(f32(dx * dx) + f32(dz * dz))));
  return { x: f32(blade.tipX - f32(dx * share)), z: f32(blade.tipZ - f32(dz * share)) };
}
const downAir: AuthoredMove = {
  ...heroMove(DOWN_AIR_SWEEP[0]?.frame ?? 6, DOWN_AIR_SWEEP.length, DOWN_AIR_TOTAL - (DOWN_AIR_SWEEP.at(-1)?.frame ?? 9), 16, DOWN_AIR_SWEEP.flatMap(blade => {
    const { x, z } = tipperSplit(blade);
    return [
      heroRegion(blade.frame, blade.frame, capsule(x, z, blade.tipX, blade.tipZ, TIPPER_RADIUS), DOWN_AIR_TIPPER),
      heroRegion(blade.frame, blade.frame, capsule(blade.gripX, blade.gripZ, x, z), DOWN_AIR_SOURSPOT),
    ];
  })),
  autoCancel: { before: 6, from: 38 },
};

function authoredThrow(releaseFrame: number, recovery: number, effect: Readonly<HitEffect>): AuthoredThrow {
  return { contactFrame: releaseFrame, totalFrames: releaseFrame + recovery, effect };
}






const TORSO = hurtPart(0.0, 4.0, 0.0, f32(94.6), 24.0);
const ARM_RADIUS = 9.0;
const arm = (x1: number, z1: number, x2: number, z2: number): readonly HurtPart[] => [TORSO, hurtPart(x1, z1, x2, z2, ARM_RADIUS)];
const SHOULDER_X = 6.0;
export const SHOULDER_Z = 90.0;

export const reach = (handX: number, handZ: number) => arm(SHOULDER_X, SHOULDER_Z, handX, handZ);
export const HEAD = hurtPart(0.0, 95.0, 0.0, 95.0, 25.0);

export const SWORD_LENGTH = length(f32(0.75));

export interface Blade { readonly gripX: number; readonly gripZ: number; readonly tipX: number; readonly tipZ: number }
export const UP_AIR_FIRST = 5;
export const UP_AIR_RADIUS = 14.0;
export const UP_AIR_SWEEP: readonly DrawnBlade[] = [
  drawn(5, -4.199999809265137, 88.5999984741211, 163.39999389648438, 92.69999694824219), drawn(6, 8.399999618530273, 84.80000305175781, 104.4000015258789, 222.8000030517578), drawn(7, 12.699999809265137, 91.5, -28.200000762939453, 256.0), drawn(8, 9.600000381469727, 96.9000015258789, -146.60000610351562, 161.10000610351562),
];

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
      heroHurtPose(25, 36, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
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
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), HEAD]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), HEAD]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), HEAD]),
      heroHurtPose(25, 27, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), HEAD]),
    ],
    [AttackStyle.downAir]: [
      heroHurtPose(1, 8, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(9, 16, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(17, 24, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(25, 32, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(33, 40, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
      heroHurtPose(41, 44, [hurtPart(0.0, 24.0, -16.0, 125.0, 35.0), hurtPart(0.0, 95.0, 0.0, 95.0, 25.0)]),
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
    [AttackStyle.forwardSmash]: heroMove(17, 3, 35, 0, tipped(17, [[40.0, 132.0, 150.0, 131.0], [56.0, 116.0, 158.0, 58.0], [62.0, 102.0, 147.0, 18.0]], BLADE_RADIUS, TIP_LENGTH, { ...hit(17.0, "KILL", 40), base: 30.0 }, { ...hit(13.0, "KILL", 40), base: 30.0 })),
    [AttackStyle.upSmash]: heroMove(15, 4, 30, 0, path(15, blades([[8.0, 151.0, 8.0, 269.0], [1.0, 153.0, -15.0, 271.0], [-6.0, 154.0, -38.0, 269.0], [-8.0, 156.0, -59.0, 264.0]]), hit(12.392340660095215, "KILL", 90))),
    [AttackStyle.downSmash]: heroMove(14, 6, 19, 0, [
      ...lowSweep(14, [[44.0, 59.0, 145.0, -5.0], [20.0, 61.0, 87.0, 3.0]], 1.0),
      ...lowSweep(16, [[-16.0, 60.0, -44.0, 2.0], [-36.0, 54.0, -140.0, 7.0], [-37.0, 53.0, -141.0, 5.0], [-34.0, 53.0, -134.0, 4.0]], -1.0),
    ]),



    [AttackStyle.neutralAir]: neutralAir,
    [AttackStyle.forwardAir]: heroMove(10, 3, 22, 14, tipped(10, [[52.0, 65.0, 163.0, 72.0], [53.0, 63.0, 163.0, 51.0], [52.0, 61.0, 159.0, 30.0]], BLADE_RADIUS, TIP_LENGTH, hit(10.843297958374023, "EDGE", 40), hit(8.519732475280762, "EDGE", 40))),
    [AttackStyle.backAir]: heroMove(8, 3, 23, 13, swing(8, [[-2.0, 98.0, -129.0, 124.0], [-20.0, 95.0, -148.0, 115.0], [-30.0, 94.0, -158.0, 112.0]], BLADE_RADIUS, hit(9.294255256652832, "KILL", 35, -1.0))),
    [AttackStyle.upAir]: heroMove(UP_AIR_FIRST, UP_AIR_SWEEP.length, 19, 11, path(UP_AIR_FIRST, UP_AIR_SWEEP.map(blade => capsule(blade.gripX, blade.gripZ, blade.tipX, blade.tipZ, UP_AIR_RADIUS)), hit(6.196170330047607, "LAUNCH", 85))),
    [AttackStyle.downAir]: downAir,
    [AttackStyle.grab]: heroMove(7, 2, 22, 0, path(7, [
      capsule(18.0, 45.0, f32(S - 10.0), 45.0, 10.0),
      capsule(18.0, 47.0, f32(S - 10.0), 47.0, 10.0),
    ], hit(0.0, "POKE", 35))),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 2.865000009536743, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: authoredThrow(12, 18, { ...hit(5.589328765869141, "EDGE", 35), growth: 49.0, base: 61.0 }),
    [GrabAction.throwBack]: authoredThrow(15, 22, { ...hit(6.196170330047607, "EDGE", 35, -1.0), growth: 31.5, base: 66.0 }),
    [GrabAction.throwUp]: authoredThrow(13, 10, hit(4.647127628326416, "JUGGLE", 85)),
    [GrabAction.throwDown]: authoredThrow(16, 20, { ...hit(3.992377519607544, "CHASE", 70), growth: 100.0, base: 0.0, setKnockback: 90.0 }),
  },
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: BODY,
};
