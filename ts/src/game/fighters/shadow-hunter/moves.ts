import { downSmashHit } from "../../sim/downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroHurtPose, heroMove, heroRegion, type AuthoredMove, type FighterMoves, type MoveRegion, jabStep, tipperMove, travelThrough } from "../../sim/heroMoves";
import { groundPoses, groundHit, swing, held, type GroundKit, type Segment } from "../../sim/heroes/groundNormals";
import type { HitEffect } from "../../sim/hitRegions";
import { type FighterHurtboxes, hurtPart } from "../../sim/hurtboxes";
import { drillStrikes, linkAt, multiHit } from "../../sim/heroes/multiHit";
import { type Angle, capsuleOf, limbOf, makeHit, path, reaching } from "../../sim/heroes/authoring";

const SH = HitElement.slash;
const thrust = (ends: readonly (readonly [number, number, number])[], angle: Angle) =>
  swing(9, ends.map(([z1, x, z]): Segment => [20.0, z1, x, z]), 7.0, groundHit(11.75, angle, 75.0, 18.0, SH));
const spin = (damage: number, angle: Angle, growth: number, base: number) => groundHit(damage, angle, growth, base, SH);
export const SHADOW_HUNTER_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 2, 12, 0, swing(4, [[16.0, 44.0, 85.0, 44.0], [18.0, 46.0, 85.0, 46.0]], 7.0, groundHit(2.9700000286102295, 35, 50.0, 16.0, HitElement.normal)))),
    [AttackStyle.jab2]: jabStep(heroMove(4, 2, 13, 0, swing(4, [[16.0, 48.0, 88.0, 48.0], [18.0, 48.0, 88.0, 44.0]], 7.0, groundHit(2.9700000286102295, 60, 30.0, 26.0, HitElement.normal)))),
    [AttackStyle.jab3]: heroMove(6, 3, 18, 0, swing(6, [[18.0, 40.0, 100.0, 52.0], [18.0, 46.0, 104.0, 46.0], [18.0, 40.0, 100.0, 40.0]], 7.0, groundHit(4.949999809265137, 40, 90.0, 22.0, SH))),
    [AttackStyle.forwardTilt]: tipperMove(heroMove(9, 2, 19, 0, thrust([[50.0, 151.0, 52.0], [50.0, 151.0, 48.0]], 35)), 0.30000001192092896),
    [AttackStyle.forwardTiltUp]: heroMove(9, 2, 21, 0, thrust([[56.0, 130.0, 120.0], [56.0, 138.0, 110.0]], 55)),
    [AttackStyle.forwardTiltDown]: heroMove(9, 2, 21, 0, thrust([[40.0, 145.0, -10.0], [38.0, 151.0, -20.0]], 15)),
    [AttackStyle.upTilt]: heroMove(7, 5, 19, 0, swing(7, [
      [-40.0, 120.0, 60.0, 135.0], [-55.0, 128.0, 55.0, 128.0], [-60.0, 135.0, 40.0, 120.0], [-55.0, 128.0, 55.0, 128.0], [-40.0, 120.0, 60.0, 135.0],
    ], 9.0, groundHit(6.929999828338623, 80, 95.0, 20.0, SH))),
    [AttackStyle.downTilt]: heroMove(7, 2, 16, 0, swing(7, [[18.0, 12.0, 145.0, -20.0], [18.0, 10.0, 145.0, -26.0]], 7.0, groundHit(8.5, 30, 70.0, 22.0, SH))),
    [AttackStyle.dashAttack]: travelThrough(heroMove(8, 9, 21, 0, [
      held(8, 10, [20.0, 30.0, 100.0, 60.0], 7.0, spin(2.9700000286102295, 0, 15.0, 25.0), 1),
      held(11, 13, [20.0, 60.0, 100.0, 30.0], 7.0, spin(2.9700000286102295, 0, 15.0, 25.0), 2),
      held(14, 16, [20.0, 30.0, 100.0, 60.0], 7.0, spin(4.949999809265137, 45, 100.0, 22.0), 3),
    ], 178.0, true), 16),
  },
  reaches: {
    [AttackStyle.jab]: [45.0, 52.0], [AttackStyle.jab2]: [46.0, 50.0], [AttackStyle.jab3]: [52.0, 48.0], [AttackStyle.forwardTilt]: [58.0, 55.0], [AttackStyle.forwardTiltUp]: [55.0, 80.0], [AttackStyle.forwardTiltDown]: [55.0, 35.0],
    [AttackStyle.upTilt]: [5.0, 140.0], [AttackStyle.downTilt]: [50.0, 15.0], [AttackStyle.dashAttack]: [58.0, 55.0],
  },
};



const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const BLADE_RADIUS = 7.0;



export const hit = makeHit({
  LINK: { growth: 60.201847076416016, base: 12.0 },
  POKE: { growth: 82.09342956542969, base: 18.0 },
  LAUNCH: { growth: 114.93079376220703, base: 20.0 },
  EDGE: { growth: 120.40369415283203, base: 22.0 },
  KILL: { growth: 131.3494873046875, base: 26.0 },
  SPIKE: { growth: 109.45790100097656, base: 22.0 },

  JUGGLE: { growth: 60.201847076416016, base: 50.0 },
  CHASE: { growth: 43.78316116333008, base: 75.0 },
}, HitElement.slash);


const capsule = capsuleOf(BLADE_RADIUS);


function chop(first: number, heights: readonly number[], reach: number, effect: Readonly<HitEffect>): readonly MoveRegion[] {
  return path(first, heights.map(z => capsule(20.0, 45.0, f32(reach - BLADE_RADIUS), z)), effect);
}





const GLAIVE_SPINS = [9, 12, 15, 18] as const;
const GLAIVE_THROW = 21;
const GLAIVE_REACH = 76.0;

const GLAIVE_FLING: Readonly<HitEffect> = { ...hit(3.502342700958252, "EDGE", 25), base: 65.0 };
const GLAIVE = drillStrikes(-4.0, -80.0, GLAIVE_REACH,
  { centre: linkAt(2.0, 25.0, 20), front: linkAt(2.0, 15.0, 20), back: linkAt(2.0, 35.0, 20) },
  { centre: linkAt(2.0, 25.0, 340), front: linkAt(2.0, 15.0, 340), back: linkAt(2.0, 35.0, 340) });
const GLAIVE_DRILL: AuthoredMove = {
  ...heroMove(9, GLAIVE_THROW + 1 - 9 + 1, 15, 14, multiHit([
    ...GLAIVE_SPINS.map(first => ({ first, last: first + 1, strikes: GLAIVE })),
    { first: GLAIVE_THROW, last: GLAIVE_THROW + 1, strikes: drillStrikes(-4.0, -80.0, GLAIVE_REACH,
      { centre: GLAIVE_FLING, front: GLAIVE_FLING, back: GLAIVE_FLING }) },
  ])),

  fall: [{ firstFrame: 8, lastFrame: GLAIVE_THROW, speedZ: -3.0 }],
};






const BODY_RADIUS = f32(24.0 * f32(0.92));
const BODY_TOP = f32(f32(4.0 + f32(HERO_REFERENCE_HEIGHT * f32(1.08))) - f32(2.0 * BODY_RADIUS));
const BODY = hurtPart(0.0, 4.0, 0.0, BODY_TOP, BODY_RADIUS);
const LIMB_RADIUS = 9.0;
const limb = limbOf(BODY, LIMB_RADIUS);

const FORWARD_ARM = limb(10.0, 62.0, 58.0, 55.0);
const RAISED_ARMS = limb(0.0, 95.0, 5.0, 140.0);
const HALF_HOOK = limb(-12.0, 40.0, -45.0, 41.0, 11.0);

const SHADOW_HUNTER_BODY: FighterHurtboxes = {
  stand: [BODY],
  attacks: {
    ...groundPoses(SHADOW_HUNTER_GROUND, (x, z) => limb(10.0, 62.0, x, z)),
    [AttackStyle.forwardSmash]: reaching(19, 3, limb(10.0, 80.0, 70.0, 90.0)),
    [AttackStyle.upSmash]: reaching(17, 4, RAISED_ARMS),
    [AttackStyle.neutralAir]: [
      heroHurtPose(5, 9, limb(10.0, 60.0, 50.0, 55.0)),
      heroHurtPose(10, 13, limb(-10.0, 60.0, -50.0, 55.0)),
    ],
    [AttackStyle.forwardAir]: reaching(10, 3, FORWARD_ARM),

    [AttackStyle.backAir]: [
      heroHurtPose(5, 7, HALF_HOOK),
      heroHurtPose(8, 12, limb(-12.0, 40.0, -f32(M - 24.0), 42.0, 11.0)),
      heroHurtPose(13, 15, HALF_HOOK),
    ],
    [AttackStyle.upAir]: reaching(7, 3, RAISED_ARMS),
    [AttackStyle.downAir]: reaching(9, 14, limb(2.0, 30.0, 2.0, -20.0)),
    [AttackStyle.grab]: reaching(8, 2, limb(10.0, 45.0, f32(S - 10.0), 42.0)),
  },
};

export const SHADOW_HUNTER_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: SHADOW_HUNTER_BODY,
  normals: {
    ...SHADOW_HUNTER_GROUND.normals,
    [AttackStyle.forwardSmash]: heroMove(19, 3, 34, 0, chop(19, [85.0, 45.0, 5.0], L, hit(15.760541915893555, "KILL", 40))),
    [AttackStyle.upSmash]: heroMove(17, 4, 31, 0, path(17, [
      capsule(10.0, 36.0, 18.0, f32(L - BLADE_RADIUS)),
      capsule(5.0, 36.0, 9.0, f32(L - BLADE_RADIUS)),
      capsule(0.0, 36.0, 0.0, f32(L - BLADE_RADIUS)),
      capsule(-5.0, 36.0, -9.0, f32(L - BLADE_RADIUS)),
    ], hit(13.133785247802734, "KILL", 90, 1.0, HitElement.normal))),
    [AttackStyle.downSmash]: heroMove(16, 5, 21, 0, [
      ...path(16, [
        capsule(20.0, 10.0, f32(M - 10.0), 22.0, 10.0),
        capsule(20.0, 10.0, f32(M - 10.0), 10.0, 10.0),
        capsule(20.0, 10.0, f32(M - 10.0), 0.0, 10.0),
      ], downSmashHit(hit(12.869999885559082, "EDGE", 25, 1.0, HitElement.normal))),
      ...path(19, [
        capsule(-20.0, 10.0, -f32(M - 10.0), 22.0, 10.0),
        capsule(-20.0, 10.0, -f32(M - 10.0), 0.0, 10.0),
      ], downSmashHit(hit(12.869999885559082, "EDGE", 25, -1.0, HitElement.normal))),
    ]),
    [AttackStyle.neutralAir]: heroMove(7, 5, 21, 13, [
      ...path(7, [
        capsule(18.0, 32.0, f32(M - BLADE_RADIUS), 32.0),
        capsule(12.0, 50.0, 60.0, 85.0),
        capsule(0.0, 52.0, 0.0, f32(M - BLADE_RADIUS)),
      ], hit(7.004685401916504, "POKE", 50)),
      ...path(10, [
        capsule(-12.0, 50.0, -60.0, 85.0),
        capsule(-18.0, 32.0, -f32(M - BLADE_RADIUS), 32.0),
      ], hit(7.004685401916504, "POKE", 50, -1.0)),
    ]),
    [AttackStyle.forwardAir]: heroMove(10, 3, 25, 15, chop(10, [55.0, 35.0, 15.0], 100.0, hit(9.63144302368164, "EDGE", 40))),

    [AttackStyle.backAir]: heroMove(8, 3, 23, 13, path(8, [
      capsule(-12.0, 24.0, -f32(M - 12.0), 30.0, 12.0),
      capsule(-12.0, 28.0, -f32(M - 12.0), 42.0, 12.0),
      capsule(-12.0, 30.0, -f32(M - 12.0), 54.0, 12.0),
    ], hit(8.755857467651367, "EDGE", 35, -1.0, HitElement.normal))),
    [AttackStyle.upAir]: heroMove(7, 3, 21, 12, path(7, [
      capsule(8.0, 50.0, 18.0, f32(M - BLADE_RADIUS)),
      capsule(0.0, 50.0, 0.0, f32(M - BLADE_RADIUS)),
      capsule(-8.0, 50.0, -18.0, f32(M - BLADE_RADIUS)),
    ], hit(7.004685401916504, "LAUNCH", 85))),
    [AttackStyle.downAir]: GLAIVE_DRILL,
    [AttackStyle.grab]: heroMove(8, 2, 24, 0, [heroRegion(8, 9,
      capsule(18.0, 42.0, f32(S - 10.0), 42.0, 10.0),
      { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false })]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 32, effect: { ...hit(6.1290998458862305, "EDGE", 35, 1.0, HitElement.normal), growth: 54.0, base: 61.0 } },
    [GrabAction.throwBack]: { contactFrame: 16, totalFrames: 40, effect: { ...hit(7.004685401916504, "EDGE", 40, -1.0, HitElement.normal), growth: 35.0, base: 66.0 } },
    [GrabAction.throwUp]: { contactFrame: 14, totalFrames: 22, effect: hit(5.253514289855957, "JUGGLE", 85, 1.0, HitElement.normal) },
    [GrabAction.throwDown]: { contactFrame: 17, totalFrames: 40, effect: { ...hit(4.377928733825684, "CHASE", 70, 1.0, HitElement.normal), growth: 100.0, base: 0.0, setKnockback: 90.0 } },
  },
};
