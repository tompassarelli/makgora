import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type MoveRegion } from "../../sim/heroMoves";
import { hurtPart, hurtPose } from "../../sim/hurtboxes";
import { capsuleOf, makeHit, path } from "../../sim/heroes/authoring";
import { downSmashHit } from "../../sim/downMoveValues";
import { strongHit } from "../../sim/strongHits";

export const hit = makeHit({
  LINK: { growth: 46.0, base: 14.0 },
  POKE: { growth: 64.0, base: 20.0 },
  CHASE: { growth: 44.0, base: 40.0 },
  LAUNCH: { growth: 82.0, base: 22.0 },
  EDGE: { growth: 86.0, base: 24.0 },
  KILL: { growth: 94.0, base: 26.0 },
  SPIKE: { growth: 84.0, base: 22.0 },
  JUGGLE: { growth: 50.0, base: 50.0 },
  TOSS: { growth: 76.0, base: 56.0 },
}, HitElement.slash);
export const capsule = capsuleOf(18.0);

const body = hurtCapsule(Character.butcher);
const SHOULDER = f32(body.z2 + 24.0);
const torso = hurtPart(0.0, body.z1, 0.0, body.z2, body.radius);
const limb = (x: number, z: number, radius = 18.0) => hurtPart(20.0, SHOULDER, x, z, radius);
const reach = (first: number, last: number, x: number, z: number, radius?: number) => [heroHurtPose(first, last, [torso, limb(x, z, radius)])];
export const butcherReachBody = (first: number, last: number, x: number, z: number) => [hurtPose(first, last, [torso, limb(x, z)])];
const BELLY = (first: number, last: number) => [heroHurtPose(first, last, [hurtPart(18.0, body.z1, 30.0, body.z2, f32(body.radius + 6.0))])];

const GUT = HitElement.normal;
const tilt = (z1: number, x2: number, z2: number, angle: 20 | 35 | 50) =>
  heroMove(9, 3, 22, 0, [heroRegion(9, 11, capsule(50.0, z1, f32(x2 - 12.0), z2, 42.0), hit(12.0, "EDGE", angle))]);
const throwMove = (contactFrame: number, recovery: number, effect: ReturnType<typeof hit>) => ({ contactFrame, totalFrames: contactFrame + recovery, effect });

const FORWARD_SMASH: readonly MoveRegion[] = [
  heroRegion(20, 22, capsule(110.0, 104.0, 150.0, 48.0, 44.0), strongHit(hit(20.0, "KILL", 40))),
  heroRegion(20, 22, capsule(40.0, SHOULDER, 112.0, 100.0, 22.0), hit(13.0, "EDGE", 40, 1.0, GUT)),
];
const UP_SMASH = path(17, [capsule(40.0, 140.0, 56.0, 210.0, 51.0), capsule(30.0, 170.0, 26.0, 270.0, 51.0),
  capsule(10.0, 190.0, 0.0, 300.0, 51.0), capsule(-20.0, 180.0, -36.0, 280.0, 51.0), capsule(-40.0, 160.0, -56.0, 240.0, 51.0)], hit(16.0, "KILL", 90, 1.0, GUT));
const FORWARD_AIR = path(14, [capsule(40.0, 160.0, 92.0, 140.0, 52.0), capsule(40.0, 140.0, 112.0, 90.0, 52.0), capsule(40.0, 110.0, 92.0, 50.0, 52.0)], hit(13.0, "EDGE", 40));

export const BUTCHER_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  stacks: { cap: 5, weightPerStack: f32(0.03) },
  hurtboxes: {
    stand: [torso], crouch: [hurtPart(0.0, body.z1, 0.0, f32(body.z2 * f32(0.6)), body.radius)],
    attacks: {
      [AttackStyle.jab]: reach(3, 8, 100.0, 100.0), [AttackStyle.jab2]: BELLY(5, 11),
      [AttackStyle.forwardTilt]: reach(7, 13, 120.0, 100.0), [AttackStyle.forwardTiltUp]: reach(7, 13, 110.0, 160.0),
      [AttackStyle.forwardTiltDown]: reach(7, 13, 120.0, 50.0), [AttackStyle.upTilt]: reach(7, 14, 40.0, 210.0),
      [AttackStyle.downTilt]: reach(6, 12, 110.0, 24.0, 20.0), [AttackStyle.dashAttack]: BELLY(8, 18),
      [AttackStyle.forwardSmash]: reach(16, 24, 140.0, 70.0), [AttackStyle.upSmash]: reach(15, 23, 30.0, 220.0),
      [AttackStyle.downSmash]: reach(14, 22, 120.0, 30.0), [AttackStyle.neutralAir]: BELLY(7, 16),
      [AttackStyle.forwardAir]: reach(12, 18, 120.0, 90.0), [AttackStyle.backAir]: reach(8, 15, -110.0, 70.0, 30.0),
      [AttackStyle.upAir]: reach(7, 14, 20.0, 210.0), [AttackStyle.downAir]: reach(14, 21, 10.0, -10.0, 30.0),
      [AttackStyle.grab]: reach(7, 12, 160.0, 90.0, 14.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(5, 2, 16, 0, [heroRegion(5, 6, capsule(50.0, 108.0, 90.0, 98.0, 42.0), hit(4.0, "LINK", 20))])),
    [AttackStyle.jab2]: heroMove(7, 3, 20, 0, [heroRegion(7, 9, capsule(40.0, 70.0, 84.0, 70.0, 40.0), hit(7.0, "POKE", 35, 1.0, GUT))]),
    [AttackStyle.forwardTilt]: tilt(110.0, 150.0, 96.0, 35),
    [AttackStyle.forwardTiltUp]: tilt(130.0, 140.0, 170.0, 50),
    [AttackStyle.forwardTiltDown]: tilt(90.0, 150.0, 36.0, 20),
    [AttackStyle.upTilt]: heroMove(9, 4, 24, 0, path(9, [capsule(64.0, 110.0, 72.0, 174.0, 46.0), capsule(40.0, 150.0, 30.0, 210.0, 46.0),
      capsule(0.0, 160.0, -16.0, 214.0, 46.0), capsule(-30.0, 150.0, -60.0, 186.0, 46.0)], hit(10.0, "LAUNCH", 85, 1.0, HitElement.normal))),
    [AttackStyle.downTilt]: heroMove(8, 3, 22, 0, [heroRegion(8, 10, capsule(40.0, 28.0, 140.0, 26.0, 43.0), hit(9.0, "CHASE", 20, 1.0, HitElement.normal))]),
    [AttackStyle.dashAttack]: heroMove(12, 5, 32, 0, [heroRegion(12, 16, capsule(20.0, 40.0, 100.0, 40.0, 46.0), hit(12.0, "EDGE", 40, 1.0, GUT))], 110.0, true),
    [AttackStyle.forwardSmash]: heroMove(20, 3, 38, 0, FORWARD_SMASH),
    [AttackStyle.upSmash]: heroMove(17, 5, 34, 0, UP_SMASH),
    [AttackStyle.downSmash]: heroMove(16, 5, 34, 0, [
      heroRegion(16, 17, capsule(40.0, 30.0, 134.0, 28.0, 46.0), downSmashHit(hit(15.0, "EDGE", 25))),
      heroRegion(18, 20, capsule(-40.0, 30.0, -134.0, 28.0, 46.0), downSmashHit(hit(15.0, "EDGE", 25, -1.0))),
    ]),
    [AttackStyle.neutralAir]: heroMove(9, 6, 26, 16, [heroRegion(9, 14, capsule(-60.0, 70.0, 60.0, 70.0, 48.0), hit(10.0, "POKE", 50, 1.0, GUT))]),
    [AttackStyle.forwardAir]: heroMove(14, 3, 28, 22, FORWARD_AIR),
    [AttackStyle.backAir]: heroMove(10, 4, 24, 18, [heroRegion(10, 13, capsule(-30.0, 70.0, -100.0, 66.0, 50.0), hit(13.0, "EDGE", 35, -1.0, GUT))]),
    [AttackStyle.upAir]: heroMove(9, 4, 24, 16, path(9, [capsule(66.0, 140.0, 72.0, 180.0, 51.0), capsule(30.0, 180.0, 20.0, 216.0, 51.0),
      capsule(-20.0, 180.0, -36.0, 210.0, 51.0), capsule(-56.0, 150.0, -80.0, 176.0, 51.0)], hit(10.0, "LAUNCH", 85, 1.0, HitElement.normal))),
    [AttackStyle.downAir]: heroMove(16, 4, 32, 26, [
      heroRegion(16, 17, capsule(0.0, 36.0, 0.0, 2.0, 58.0), hit(14.0, "SPIKE", 270, 1.0, GUT), hit(14.0, "LAUNCH", 55, 1.0, GUT)),
      heroRegion(18, 19, capsule(0.0, 36.0, 0.0, 6.0, 52.0), hit(9.0, "POKE", 70, 1.0, GUT)),
    ]),
    [AttackStyle.grab]: heroMove(9, 2, 34, 0, [heroRegion(9, 10, capsule(40.0, 90.0, 176.0, 86.0, 14.0), { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false })]),
    [AttackStyle.getupAttack]: heroMove(17, 3, 30, 0, [heroRegion(17, 19, capsule(-120.0, 22.0, 120.0, 22.0, 22.0), hit(8.0, "POKE", 35))]),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 21, 0, [heroRegion(17, 19, capsule(30.0, 50.0, 150.0, 50.0, 22.0), hit(8.0, "POKE", 35))]),
  },
  throws: {
    [GrabAction.pummel]: throwMove(5, 7, { damage: 3.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false }),
    [GrabAction.throwForward]: throwMove(14, 22, { ...hit(9.0, "POKE", 35, 1.0, HitElement.normal), growth: 58.0, base: 64.0 }),
    [GrabAction.throwBack]: throwMove(20, 26, { ...hit(12.0, "TOSS", 40, -1.0, HitElement.normal), growth: 80.0 }),
    [GrabAction.throwUp]: throwMove(16, 18, hit(8.0, "JUGGLE", 90, 1.0, HitElement.normal)),
    [GrabAction.throwDown]: throwMove(20, 24, { ...hit(7.0, "CHASE", 70, 1.0, HitElement.normal), growth: 100.0, base: 0.0, setKnockback: 90.0 }),
  },
};
