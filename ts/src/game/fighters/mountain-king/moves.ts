import { downSmashHit } from "../../sim/downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroHurtPose, heroMove, heroRegion, type FighterMoves, type StrikeCapsule, jabStep, travelThrough } from "../../sim/heroMoves";
import { type FighterHurtboxes, type HurtPart, hurtPart } from "../../sim/hurtboxes";
import { groundPoses, groundHit, swing, held, type GroundKit } from "../../sim/heroes/groundNormals";
import type { HitEffect } from "../../sim/hitRegions";
import { strongHit } from "../../sim/strongHits";

const MK = HitElement.normal;
const mkHook = (angle: Parameters<typeof groundHit>[1]) => groundHit(13.75, angle, f32(88.4), 25.0, MK);
export const MOUNTAIN_KING_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(5, 2, 16, 0, swing(5, [[10.0, 38.0, 53.0, 37.0], [18.0, 48.0, 6.0, 70.0]], 12.0, groundHit(5.524999618530273, 30, 60.77499771118164, 16.0, MK)))),
    [AttackStyle.jab2]: heroMove(6, 3, 18, 0, swing(6, [[18.0, 46.0, 74.0, 48.0], [18.0, 46.0, 76.0, 44.0], [18.0, 44.0, 70.0, 40.0]], 12.0, groundHit(6.62999963760376, 35, 104.9749984741211, 24.0, MK))),
    [AttackStyle.forwardTilt]: heroMove(10, 3, 22, 0, swing(10, [[36.0, 44.0, 96.0, 0.0], [36.0, 40.0, 94.0, -10.0], [31.0, 39.0, 98.0, 1.0]], 12.0, mkHook(30))),
    [AttackStyle.forwardTiltUp]: heroMove(10, 3, 22, 0, swing(10, [[22.0, 62.0, 100.0, 100.0], [22.0, 60.0, 108.0, 90.0], [22.0, 56.0, 95.0, 80.0]], 12.0, mkHook(45))),
    [AttackStyle.forwardTiltDown]: heroMove(10, 3, 22, 0, swing(10, [[22.0, 44.0, 108.0, 14.0], [22.0, 40.0, 113.0, 4.0], [22.0, 36.0, 100.0, -8.0]], 12.0, mkHook(20))),
    [AttackStyle.upTilt]: heroMove(8, 4, 22, 0, swing(8, [[14.0, 68.0, 54.0, 70.0], [29.0, 45.0, -3.0, 103.0], [28.0, 43.0, 0.0, 104.0], [27.0, 42.0, 3.0, 104.0]], 14.0,
      groundHit(11.049999237060547, 80, 104.9749984741211, 24.0, MK))),
    [AttackStyle.downTilt]: heroMove(8, 3, 21, 0, swing(8, [[20.0, 20.0, 40.0, 5.0], [20.0, 22.0, 44.0, 9.0], [20.0, 24.0, 46.0, 13.0]], 12.0,
      groundHit(11.049999237060547, 85, 77.3499984741211, 10.0, MK))),


    [AttackStyle.dashAttack]: travelThrough(heroMove(10, 10, 22, 0, [held(10, 13, [4.0, 12.0, 4.0, 65.0], 24.0, groundHit(13.75, 75, 104.9749984741211, 30.0, MK)),
      held(14, 19, [4.0, 12.0, 4.0, 65.0], 24.0, groundHit(9.0, 75, 90.0, 26.0, MK))], 151.0, true), 19),
  },
  reaches: {
    [AttackStyle.jab]: [40.0, 42.0], [AttackStyle.jab2]: [42.0, 46.0], [AttackStyle.forwardTilt]: [46.0, 52.0], [AttackStyle.forwardTiltUp]: [42.0, 72.0], [AttackStyle.forwardTiltDown]: [44.0, 34.0],
    [AttackStyle.upTilt]: [22.0, 92.0],
  },
};



export const SHORT = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
export const MEDIUM = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const LONG = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const GRAB = f32(HERO_REFERENCE_HEIGHT * 0.5);



const CLASS_HYPOTHESES = {
  LINK: { growth: 73.62062072753906, base: 12.0 },
  POKE: { growth: 90.60999298095703, base: 16.0 },
  LAUNCH: { growth: 107.59937286376953, base: 22.0 },
  EDGE: { growth: 113.26249694824219, base: 25.0 },
  KILL: { growth: 124.5887451171875, base: 30.0 },
  SPIKE: { growth: 113.26249694824219, base: 24.0 },

  JUGGLE: { growth: 62.29437255859375, base: 50.0 },
  CHASE: { growth: 45.304996490478516, base: 75.0 },
} as const;
type LaunchClass = keyof typeof CLASS_HYPOTHESES;

const DIRECTIONS = {
  25: { x: f32(0.9063077870366499), z: f32(0.42261826174069944) },
  35: { x: f32(0.8191520442889918), z: f32(0.573576436351046) },
  40: { x: f32(0.766044443118978), z: f32(0.6427876096865393) },
  45: { x: f32(0.7071067811865476), z: f32(0.7071067811865476) },
  50: { x: f32(0.6427876096865394), z: f32(0.766044443118978) },
  55: { x: f32(0.5735764363510462), z: f32(0.8191520442889918) },
  65: { x: f32(0.42261826174069944), z: f32(0.9063077870366499) },
  70: { x: f32(0.3420201433256688), z: f32(0.9396926207859083) },
  75: { x: f32(0.25881904510252074), z: f32(0.9659258262890683) },
  80: { x: f32(0.17364817766693041), z: f32(0.984807753012208) },
  85: { x: f32(0.08715574274765814), z: f32(0.9961946980917455) },
  90: { x: 0.0, z: 1.0 },
  270: { x: 0.0, z: -1.0 },
} as const;

export function hit(damage: number, launchClass: LaunchClass, angle: keyof typeof DIRECTIONS, backwards = false, element: HitElement = HitElement.normal): Readonly<HitEffect> {
  const direction = DIRECTIONS[angle];
  const strength = CLASS_HYPOTHESES[launchClass];
  return { damage, growth: strength.growth, base: strength.base, launchX: backwards ? -direction.x : direction.x, launchZ: direction.z, electric: false, element };
}

export const capsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const circle = (x: number, z: number, radius: number): StrikeCapsule => capsule(x, z, x, z, radius);
const frame = (active: number, strike: StrikeCapsule, effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>) => heroRegion(active, active, strike, effect, groundedEffect);

const JAB = hit(4.322759628295898, "POKE", 35);
const FORWARD_TILT = hit(10.806899070739746, "EDGE", 35, false, HitElement.slash);
const UP_TILT = hit(9.72620964050293, "LAUNCH", 90);
const DOWN_TILT = hit(7.5648298263549805, "LINK", 70);
const DASH = hit(12.968278884887695, "LAUNCH", 40);
const FORWARD_SMASH_GROWTH = f32(CLASS_HYPOTHESES.KILL.growth * f32(0.8));
const FORWARD_SMASH_HEAD = strongHit({ ...hit(22.694490432739258, "KILL", 40), growth: FORWARD_SMASH_GROWTH });
const FORWARD_SMASH_HANDLE = { ...hit(17.291038513183594, "KILL", 40), growth: FORWARD_SMASH_GROWTH };
const UP_SMASH = hit(18.37173080444336, "KILL", 85);
const DOWN_SMASH_FRONT = downSmashHit(hit(17.67999839782715, "EDGE", 25));
const DOWN_SMASH_BACK = downSmashHit(hit(17.67999839782715, "EDGE", 25, true));
const NEUTRAL_AIR_FRONT = hit(10.806899070739746, "POKE", 50);
const NEUTRAL_AIR_BACK = hit(10.806899070739746, "POKE", 50, true);
const FORWARD_AIR_HEAD = strongHit(hit(17.291038513183594, "SPIKE", 270));
const FORWARD_AIR_GROUNDED_HEAD = strongHit(hit(17.291038513183594, "LAUNCH", 55));
const FORWARD_AIR_HANDLE = hit(11.887589454650879, "LAUNCH", 45);
const BACK_AIR = hit(14.048970222473145, "KILL", 35, true, HitElement.slash);
const UP_AIR = hit(10.806899070739746, "LAUNCH", 85);
const DOWN_AIR = hit(14.048970222473145, "SPIKE", 270);
const DOWN_AIR_GROUNDED = hit(14.048970222473145, "LAUNCH", 55);
const GRAB_CONTACT = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;





const BODY: HurtPart = hurtCapsule(Character.mountainKing);
const ARM = 10.0;
const LEG = 12.0;
const limb = (first: number, last: number, ...parts: HurtPart[]) => heroHurtPose(first, last, [BODY, ...parts]);

const MOUNTAIN_KING_BODIES: FighterHurtboxes = {
  stand: [BODY],
  attacks: {
    ...groundPoses(MOUNTAIN_KING_GROUND, (x, z) => [BODY, hurtPart(8.0, 58.0, x, z, ARM)]),

    [AttackStyle.downTilt]: [limb(5, 7, hurtPart(6.0, 20.0, 40.0, 12.0, LEG)), limb(8, 12, hurtPart(6.0, 20.0, 64.0, 10.0, LEG)), limb(13, 15, hurtPart(6.0, 20.0, 40.0, 12.0, LEG))],
    [AttackStyle.forwardSmash]: [limb(14, 28, hurtPart(8.0, 60.0, 46.0, 62.0, ARM))],
    [AttackStyle.upSmash]: [limb(13, 26, hurtPart(6.0, 62.0, 14.0, 98.0, ARM))],
    [AttackStyle.downSmash]: [
      limb(13, 18, hurtPart(8.0, 40.0, 46.0, 18.0, ARM)),
      limb(19, 26, hurtPart(-8.0, 40.0, -46.0, 18.0, ARM)),
    ],
    [AttackStyle.forwardAir]: [limb(12, 24, hurtPart(8.0, 60.0, 44.0, 48.0, ARM))],
    [AttackStyle.backAir]: [limb(8, 17, hurtPart(-8.0, 58.0, -46.0, 50.0, ARM))],
    [AttackStyle.downAir]: [limb(10, 20, hurtPart(0.0, 20.0, 0.0, -f32(SHORT - 14.0), LEG))],
    [AttackStyle.grab]: [limb(6, 12, hurtPart(8.0, 50.0, f32(GRAB - 14.0), 24.0, ARM))],
  },
};

export const MOUNTAIN_KING_MOVES: FighterMoves = {
  hurtboxes: MOUNTAIN_KING_BODIES,
  dashAttack: AttackStyle.dashAttack,
  normals: {
    ...MOUNTAIN_KING_GROUND.normals,
    [AttackStyle.forwardSmash]: heroMove(20, 3, 36, 0, [
      frame(20, circle(108.0, 92.0, 18.0), FORWARD_SMASH_HEAD),
      frame(21, circle(f32(LONG - 18.0), 56.0, 18.0), FORWARD_SMASH_HEAD),
      frame(22, circle(115.0, 18.0, 18.0), FORWARD_SMASH_HEAD),
      frame(20, capsule(18.0, 50.0, 100.0, 86.0, 8.0), FORWARD_SMASH_HANDLE),
      frame(21, capsule(18.0, 50.0, 115.0, 55.0, 8.0), FORWARD_SMASH_HANDLE),
      frame(22, capsule(18.0, 50.0, 105.0, 24.0, 8.0), FORWARD_SMASH_HANDLE),
    ]),
    [AttackStyle.upSmash]: heroMove(17, 5, 32, 0, [
      frame(17, capsule(20.0, 50.0, 46.0, 78.0, 16.0), UP_SMASH),
      frame(18, capsule(20.0, 49.0, 48.0, 75.0, 16.0), UP_SMASH),
      frame(19, capsule(17.0, 50.0, 49.0, 72.0, 16.0), UP_SMASH),
      frame(20, capsule(17.0, 49.0, 51.0, 69.0, 16.0), UP_SMASH),
      frame(21, capsule(17.0, 47.0, 52.0, 65.0, 16.0), UP_SMASH),
    ]),
    [AttackStyle.downSmash]: heroMove(16, 6, 22, 0, [
      frame(16, capsule(40.0, 16.0, 66.0, 0.0, 14.0), DOWN_SMASH_FRONT),
      frame(17, capsule(38.0, 10.0, 61.0, -7.0, 14.0), DOWN_SMASH_FRONT),
      frame(18, capsule(36.0, 8.0, 58.0, -12.0, 14.0), DOWN_SMASH_FRONT),
      frame(19, capsule(-25.0, 49.0, 24.0, 88.0, 14.0), DOWN_SMASH_BACK),
      frame(20, capsule(-25.0, 50.0, 25.0, 88.0, 14.0), DOWN_SMASH_BACK),
      frame(21, capsule(-25.0, 50.0, 25.0, 88.0, 14.0), DOWN_SMASH_BACK),
    ]),
    [AttackStyle.neutralAir]: heroMove(8, 6, 22, 15, [
      heroRegion(8, 10, capsule(0.0, 18.0, 0.0, 62.0, 24.0), NEUTRAL_AIR_FRONT),
      heroRegion(11, 13, capsule(0.0, 18.0, 0.0, 62.0, 24.0), NEUTRAL_AIR_BACK),
    ]),
    [AttackStyle.forwardAir]: heroMove(16, 3, 30, 21, [
      frame(16, circle(46.0, 46.0, 20.0), FORWARD_AIR_HEAD, FORWARD_AIR_GROUNDED_HEAD),
      frame(17, circle(46.0, 46.0, 20.0), FORWARD_AIR_HEAD, FORWARD_AIR_GROUNDED_HEAD),
      frame(18, circle(46.0, 46.0, 20.0), FORWARD_AIR_HEAD, FORWARD_AIR_GROUNDED_HEAD),
      frame(16, capsule(16.0, 47.0, 40.0, 55.0, 8.0), FORWARD_AIR_HANDLE),
      frame(17, capsule(16.0, 47.0, 40.0, 55.0, 8.0), FORWARD_AIR_HANDLE),
      frame(18, capsule(16.0, 47.0, 40.0, 55.0, 8.0), FORWARD_AIR_HANDLE),
    ]),
    [AttackStyle.backAir]: heroMove(10, 3, 25, 15, [
      frame(10, capsule(-10.0, 73.0, -64.0, 85.0, 12.0), BACK_AIR),
      frame(11, capsule(-10.0, 74.0, -60.0, 90.0, 12.0), BACK_AIR),
      frame(12, capsule(-10.0, 76.0, -56.0, 95.0, 12.0), BACK_AIR),
    ]),
    [AttackStyle.upAir]: heroMove(7, 4, 22, 13, [
      heroRegion(7, 10, capsule(0.0, 52.0, 0.0, f32(SHORT - 12.0), 12.0), UP_AIR),
    ]),
    [AttackStyle.downAir]: heroMove(12, 5, 29, 20, [
      heroRegion(12, 16, capsule(0.0, 22.0, 0.0, -2.0, 14.0), DOWN_AIR, DOWN_AIR_GROUNDED),
    ]),
    [AttackStyle.grab]: heroMove(8, 2, 25, 0, [
      heroRegion(8, 9, capsule(14.0, 14.0, f32(GRAB - 14.0), 24.0, 14.0), GRAB_CONTACT),
    ]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.31499981880188, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 36, effect: { ...hit(9.72620964050293, "EDGE", 35), growth: 51.0, base: 64.0 } },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 45, effect: { ...hit(10.806899070739746, "KILL", 40, true), growth: 108.0, base: 52.0 } },
    [GrabAction.throwUp]: { contactFrame: 16, totalFrames: 29, effect: { ...hit(8.645519256591797, "JUGGLE", 90), base: 55.0 } },
    [GrabAction.throwDown]: { contactFrame: 20, totalFrames: 46, effect: { ...hit(7.5648298263549805, "CHASE", 70), growth: 100.0, base: 0.0, setKnockback: 90.0 } },
  },
};
