import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type MoveRegion } from "../../sim/heroMoves";
import { hurtPart, hurtPose } from "../../sim/hurtboxes";
import { capsuleOf, makeHit, path } from "../../sim/heroes/authoring";
import { downSmashHit } from "../../sim/downMoveValues";
import { strongHit } from "../../sim/strongHits";

export const hit = makeHit({
  LINK: { growth: 48.0, base: 14.0 },
  POKE: { growth: 66.0, base: 20.0 },
  CHASE: { growth: 45.0, base: 42.0 },
  LAUNCH: { growth: 84.0, base: 22.0 },
  EDGE: { growth: 88.0, base: 24.0 },
  KILL: { growth: 96.0, base: 26.0 },
  SPIKE: { growth: 86.0, base: 22.0 },
  JUGGLE: { growth: 50.0, base: 52.0 },
  TOSS: { growth: 74.0, base: 56.0 },
}, HitElement.slash);
export const capsule = capsuleOf(16.0);

const body = hurtCapsule(Character.archimonde);
const SHOULDER = f32(body.z2 + 20.0);
const torso = hurtPart(0.0, body.z1, 0.0, body.z2, body.radius);
const limb = (x: number, z: number, radius = 16.0) => hurtPart(18.0, SHOULDER, x, z, radius);
const reach = (first: number, last: number, x: number, z: number, radius?: number) => [heroHurtPose(first, last, [torso, limb(x, z, radius)])];
export const archimondeCastBody = (first: number, last: number, x: number, z: number) => [hurtPose(first, last, [torso, limb(x, z)])];

const FEL = HitElement.fire;
const tilt = (z1: number, x2: number, z2: number, angle: 20 | 35 | 50) =>
  heroMove(9, 3, 22, 0, [heroRegion(9, 11, capsule(40.0, z1, f32(x2 - 27.0), z2, 47.0), hit(12.0, "EDGE", angle))]);
const throwMove = (contactFrame: number, recovery: number, effect: ReturnType<typeof hit>) => ({ contactFrame, totalFrames: contactFrame + recovery, effect });

const FORWARD_SMASH: readonly MoveRegion[] = [
  heroRegion(22, 24, capsule(110.0, 92.0, 165.0, 40.0, 49.0), strongHit(hit(21.0, "KILL", 40))),
  heroRegion(22, 24, capsule(30.0, SHOULDER, 118.0, 92.0, 20.0), hit(14.0, "EDGE", 40)),
];
const FORWARD_AIR = path(14, [capsule(40.0, 200.0, 115.0, 170.0, 59.0), capsule(40.0, 180.0, 135.0, 110.0, 59.0), capsule(40.0, 150.0, 115.0, 60.0, 59.0)], hit(13.0, "EDGE", 40));

export const ARCHIMONDE_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [torso], crouch: [hurtPart(0.0, body.z1, 0.0, f32(body.z2 * f32(0.6)), body.radius)],
    attacks: {
      [AttackStyle.jab]: reach(3, 8, 100.0, 135.0), [AttackStyle.jab2]: reach(4, 9, 110.0, 128.0),
      [AttackStyle.forwardTilt]: reach(7, 13, 120.0, 128.0), [AttackStyle.forwardTiltUp]: reach(7, 13, 110.0, 190.0),
      [AttackStyle.forwardTiltDown]: reach(7, 13, 120.0, 60.0), [AttackStyle.upTilt]: reach(7, 14, 40.0, 230.0),
      [AttackStyle.downTilt]: reach(6, 12, 120.0, 24.0, 20.0), [AttackStyle.dashAttack]: reach(8, 18, 60.0, 120.0, 30.0),
      [AttackStyle.forwardSmash]: reach(18, 26, 140.0, 70.0), [AttackStyle.upSmash]: reach(16, 25, 20.0, 260.0),
      [AttackStyle.downSmash]: reach(15, 23, 120.0, 30.0), [AttackStyle.neutralAir]: reach(7, 15, 70.0, 110.0, 30.0),
      [AttackStyle.forwardAir]: reach(12, 18, 120.0, 100.0), [AttackStyle.backAir]: reach(10, 16, -140.0, 85.0, 20.0),
      [AttackStyle.upAir]: reach(7, 14, 20.0, 240.0), [AttackStyle.downAir]: reach(14, 20, 20.0, -10.0, 22.0),
      [AttackStyle.grab]: reach(7, 12, 130.0, 125.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(5, 2, 16, 0, [heroRegion(5, 6, capsule(40.0, 140.0, 98.0, 130.0, 45.0), hit(4.0, "LINK", 20))])),
    [AttackStyle.jab2]: heroMove(6, 2, 20, 0, [heroRegion(6, 7, capsule(40.0, 135.0, 110.0, 124.0, 45.0), hit(6.0, "POKE", 35, 1.0, HitElement.normal))]),
    [AttackStyle.forwardTilt]: tilt(140.0, 172.0, 120.0, 35),
    [AttackStyle.forwardTiltUp]: tilt(150.0, 152.0, 205.0, 50),
    [AttackStyle.forwardTiltDown]: tilt(120.0, 165.0, 40.0, 20),
    [AttackStyle.upTilt]: heroMove(9, 4, 24, 0, path(9, [capsule(80.0, 120.0, 90.0, 210.0, 52.0), capsule(50.0, 160.0, 40.0, 244.0, 52.0),
      capsule(10.0, 180.0, -20.0, 254.0, 52.0), capsule(-30.0, 170.0, -70.0, 230.0, 52.0)], hit(10.0, "LAUNCH", 85, 1.0, FEL))),
    [AttackStyle.downTilt]: heroMove(8, 3, 22, 0, [heroRegion(8, 10, capsule(30.0, 18.0, 148.0, 14.0, 48.0), hit(9.0, "CHASE", 20, 1.0, HitElement.normal))]),
    [AttackStyle.dashAttack]: heroMove(12, 5, 30, 0, [heroRegion(12, 16, capsule(20.0, 110.0, 69.0, 128.0, 52.0), hit(12.0, "EDGE", 40, 1.0, HitElement.normal))], 90.0, true),
    [AttackStyle.forwardSmash]: heroMove(22, 3, 40, 0, FORWARD_SMASH),
    [AttackStyle.upSmash]: heroMove(19, 5, 36, 0, [heroRegion(19, 23, capsule(0.0, 200.0, 0.0, 307.0, 57.0), hit(17.0, "KILL", 90, 1.0, FEL))]),
    [AttackStyle.downSmash]: heroMove(17, 5, 36, 0, [
      heroRegion(17, 18, capsule(40.0, 20.0, 143.0, 18.0, 52.0), downSmashHit(hit(15.0, "EDGE", 25))),
      heroRegion(19, 21, capsule(-40.0, 20.0, -143.0, 18.0, 52.0), downSmashHit(hit(15.0, "EDGE", 25, -1.0))),
    ]),
    [AttackStyle.neutralAir]: heroMove(9, 6, 26, 16, [heroRegion(9, 14, capsule(-90.0, 105.0, 90.0, 105.0, 52.0), hit(9.0, "POKE", 50, 1.0, HitElement.normal))]),
    [AttackStyle.forwardAir]: heroMove(14, 3, 28, 22, FORWARD_AIR),
    [AttackStyle.backAir]: heroMove(12, 3, 28, 20, [heroRegion(12, 14, capsule(-40.0, 92.0, -159.0, 80.0, 56.0), hit(15.0, "KILL", 35, -1.0, HitElement.normal))]),
    [AttackStyle.upAir]: heroMove(9, 4, 24, 16, [heroRegion(9, 12, capsule(-70.0, 215.0, 70.0, 215.0, 57.0), hit(11.0, "LAUNCH", 85, 1.0, HitElement.normal))]),
    [AttackStyle.downAir]: heroMove(16, 4, 30, 26, [
      heroRegion(16, 17, capsule(0.0, 45.0, 10.0, -1.0, 65.0), hit(14.0, "SPIKE", 270, 1.0, HitElement.normal), hit(14.0, "LAUNCH", 55, 1.0, HitElement.normal)),
      heroRegion(18, 19, capsule(0.0, 45.0, 10.0, 3.0, 55.0), hit(10.0, "POKE", 70, 1.0, HitElement.normal)),
    ]),
    [AttackStyle.grab]: heroMove(9, 2, 34, 0, [heroRegion(9, 10, capsule(30.0, 130.0, 150.0, 122.0, 15.0), { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false })]),
    [AttackStyle.getupAttack]: heroMove(17, 3, 30, 0, [heroRegion(17, 19, capsule(-120.0, 22.0, 120.0, 22.0, 22.0), hit(8.0, "POKE", 35))]),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 21, 0, [heroRegion(17, 19, capsule(30.0, 50.0, 150.0, 50.0, 20.0), hit(8.0, "POKE", 35))]),
  },
  throws: {
    [GrabAction.pummel]: throwMove(5, 7, { damage: 3.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false }),
    [GrabAction.throwForward]: throwMove(16, 24, { ...hit(9.0, "POKE", 35, 1.0, FEL), growth: 60.0, base: 60.0 }),
    [GrabAction.throwBack]: throwMove(20, 28, { ...hit(11.0, "TOSS", 40, -1.0, HitElement.normal), growth: 78.0 }),
    [GrabAction.throwUp]: throwMove(18, 16, hit(8.0, "JUGGLE", 90, 1.0, HitElement.normal)),
    [GrabAction.throwDown]: throwMove(22, 26, { ...hit(7.0, "CHASE", 70, 1.0, HitElement.normal), growth: 100.0, base: 0.0, setKnockback: 90.0 }),
  },
};
