import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type AuthoredMove, type FighterMoves, type MoveRegion } from "../../sim/heroMoves";
import { hurtPart, hurtPose, type HurtPart } from "../../sim/hurtboxes";
import { capsuleOf, makeHit } from "../../sim/heroes/authoring";
import { downSmashHit } from "../../sim/downMoveValues";
import { strongHit } from "../../sim/strongHits";

export const hit = makeHit({
  TAP: { growth: 40.0, base: 12.0 },
  LINK: { growth: 46.0, base: 18.0 },
  POKE: { growth: 70.0, base: 22.0 },
  CHASE: { growth: 48.0, base: 40.0 },
  LAUNCH: { growth: 86.0, base: 24.0 },
  EDGE: { growth: 92.0, base: 26.0 },
  KILL: { growth: 104.0, base: 28.0 },
  SPIKE: { growth: 88.0, base: 20.0 },
  JUGGLE: { growth: 54.0, base: 50.0 },
  TOSS: { growth: 76.0, base: 56.0 },
}, HitElement.normal);
export const capsule = capsuleOf(10.0);

const MOON = HitElement.arcane;
const body = hurtCapsule(Character.tyrande);
const SHOULDER = f32(body.z2 + 12.0);
const torso = hurtPart(0.0, body.z1, 0.0, body.z2, body.radius);
const limb = (x: number, z: number, radius = 11.0) => hurtPart(10.0, SHOULDER, x, z, radius);
const reach = (first: number, last: number, x: number, z: number, radius?: number) => [heroHurtPose(first, last, [torso, limb(x, z, radius)])];
export const TYRANDE_STAND: readonly HurtPart[] = [torso];
export const tyrandeCastBody = (first: number, last: number, x: number, z: number) => [hurtPose(first, last, [torso, limb(x, z)])];

const strike = (first: number, active: number, recovery: number, landing: number, regions: readonly MoveRegion[]): AuthoredMove => heroMove(first, active, recovery, landing, regions);
const tilt = (z2: number, angle: 20 | 35 | 50) =>
  strike(6, 3, 18, 0, [heroRegion(6, 8, capsule(20.0, 70.0, 77.0, z2, 33.0), hit(9.0, "POKE", angle, 1.0, MOON))]);
const throwMove = (contactFrame: number, recovery: number, effect: ReturnType<typeof hit>) => ({ contactFrame, totalFrames: contactFrame + recovery, effect });
const NOTHING = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

const FORWARD_AIR: readonly MoveRegion[] = [6, 9, 12, 15].map((first, index) =>
  heroRegion(first, first + 2, capsule(18.0, 64.0, 62.0, 54.0, 42.0), index === 3 ? hit(2.5, "POKE", 40, 1.0, MOON) : { ...hit(2.5, "TAP", 45, 1.0, MOON), growth: 0.0, setKnockback: 40.0 }, undefined, index + 1));

export const TYRANDE_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: TYRANDE_STAND, crouch: [hurtPart(0.0, body.z1, 0.0, f32(body.z2 * f32(0.6)), body.radius)],
    attacks: {
      [AttackStyle.jab]: reach(2, 6, 70.0, 74.0), [AttackStyle.jab2]: reach(3, 7, 78.0, 70.0),
      [AttackStyle.forwardTilt]: reach(5, 10, 90.0, 72.0), [AttackStyle.forwardTiltUp]: reach(5, 10, 84.0, 112.0),
      [AttackStyle.forwardTiltDown]: reach(5, 10, 90.0, 34.0), [AttackStyle.upTilt]: reach(4, 10, 20.0, 150.0),
      [AttackStyle.downTilt]: reach(5, 10, 92.0, 14.0, 14.0), [AttackStyle.dashAttack]: reach(6, 13, 62.0, 60.0, 16.0),
      [AttackStyle.forwardSmash]: reach(12, 18, 116.0, 70.0), [AttackStyle.upSmash]: reach(10, 17, 10.0, 170.0),
      [AttackStyle.downSmash]: reach(9, 16, 100.0, 14.0, 14.0), [AttackStyle.neutralAir]: reach(3, 12, 60.0, 50.0, 16.0),
      [AttackStyle.forwardAir]: reach(5, 18, 84.0, 58.0), [AttackStyle.backAir]: reach(4, 9, -88.0, 52.0, 16.0),
      [AttackStyle.upAir]: reach(5, 10, 10.0, 150.0), [AttackStyle.downAir]: reach(7, 12, 10.0, -36.0, 16.0),
      [AttackStyle.grab]: reach(5, 9, 66.0, 66.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(strike(3, 2, 12, 0, [heroRegion(3, 4, capsule(18.0, 72.0, 53.0, 74.0, 32.0), hit(3.0, "LINK", 35))])),
    [AttackStyle.jab2]: strike(4, 2, 14, 0, [heroRegion(4, 5, capsule(18.0, 70.0, 64.0, 66.0, 32.0), hit(4.0, "POKE", 40, 1.0, MOON))]),
    [AttackStyle.forwardTilt]: tilt(70.0, 35),
    [AttackStyle.forwardTiltUp]: tilt(112.0, 50),
    [AttackStyle.forwardTiltDown]: tilt(26.0, 20),
    [AttackStyle.upTilt]: strike(5, 4, 16, 0, [
      heroRegion(5, 6, capsule(40.0, 100.0, 24.0, 128.0, 39.0), hit(7.0, "JUGGLE", 85)),
      heroRegion(7, 8, capsule(4.0, 128.0, -20.0, 116.0, 39.0), hit(7.0, "JUGGLE", 95)),
    ]),
    [AttackStyle.downTilt]: strike(6, 3, 16, 0, [heroRegion(6, 8, capsule(16.0, 24.0, 76.0, 24.0, 34.0), hit(8.0, "CHASE", 75))]),
    [AttackStyle.dashAttack]: heroMove(7, 5, 22, 0, [
      heroRegion(7, 8, capsule(18.0, 56.0, 45.0, 62.0, 37.0), hit(9.0, "LAUNCH", 50)),
      heroRegion(9, 11, capsule(18.0, 56.0, 38.0, 58.0, 35.0), hit(6.0, "POKE", 60)),
    ], 70.0, true),
    [AttackStyle.forwardSmash]: strike(14, 3, 32, 0, [
      heroRegion(14, 16, capsule(70.0, 70.0, 104.0, 66.0, 35.0), strongHit(hit(16.0, "KILL", 40, 1.0, MOON))),
      heroRegion(14, 16, capsule(16.0, 74.0, 50.0, 70.0, 32.0), hit(12.0, "EDGE", 40, 1.0, MOON)),
    ]),
    [AttackStyle.upSmash]: strike(12, 4, 30, 0, [
      heroRegion(12, 13, capsule(40.0, 110.0, 16.0, 146.0, 43.0), hit(14.0, "KILL", 90, 1.0, MOON)),
      heroRegion(14, 15, capsule(4.0, 150.0, -34.0, 110.0, 43.0), hit(13.0, "KILL", 95, 1.0, MOON)),
    ]),
    [AttackStyle.downSmash]: strike(11, 4, 30, 0, [
      heroRegion(11, 12, capsule(14.0, 30.0, 77.0, 30.0, 38.0), downSmashHit(hit(13.0, "EDGE", 25))),
      heroRegion(13, 14, capsule(-14.0, 30.0, -77.0, 30.0, 38.0), downSmashHit(hit(13.0, "EDGE", 25, -1.0))),
    ]),
    [AttackStyle.neutralAir]: heroMove(4, 8, 18, 12, [
      heroRegion(4, 6, capsule(-40.0, 50.0, 40.0, 50.0, 36.0), hit(10.0, "LAUNCH", 45)),
      heroRegion(7, 11, capsule(-34.0, 50.0, 34.0, 50.0, 33.0), hit(6.0, "POKE", 45)),
    ]),
    [AttackStyle.forwardAir]: heroMove(6, 12, 22, 16, FORWARD_AIR),
    [AttackStyle.backAir]: heroMove(5, 4, 18, 14, [heroRegion(5, 8, capsule(-18.0, 52.0, -70.0, 48.0, 39.0), hit(13.0, "EDGE", 40, -1.0))]),
    [AttackStyle.upAir]: heroMove(6, 4, 18, 12, [heroRegion(6, 9, capsule(-24.0, 118.0, 24.0, 118.0, 41.0), hit(10.0, "LAUNCH", 85, 1.0, MOON))]),
    [AttackStyle.downAir]: heroMove(8, 4, 24, 20, [
      heroRegion(8, 9, capsule(4.0, 4.0, 8.0, -6.0, 46.0), hit(12.0, "SPIKE", 270), hit(12.0, "LAUNCH", 60)),
      heroRegion(10, 11, capsule(4.0, 4.0, 8.0, -6.0, 42.0), hit(9.0, "POKE", 70)),
    ]),
    [AttackStyle.grab]: heroMove(6, 2, 22, 0, [heroRegion(6, 7, capsule(16.0, 64.0, 66.0, 62.0, 13.0), NOTHING)]),
  },
  throws: {
    [GrabAction.pummel]: throwMove(5, 8, { ...NOTHING, damage: 2.0 }),
    [GrabAction.throwForward]: throwMove(10, 20, hit(6.0, "TOSS", 40)),
    [GrabAction.throwBack]: throwMove(14, 24, { ...hit(9.0, "TOSS", 40, -1.0), growth: 82.0 }),
    [GrabAction.throwUp]: throwMove(16, 18, hit(8.0, "JUGGLE", 90, 1.0, HitElement.fire)),
    [GrabAction.throwDown]: throwMove(16, 24, { ...hit(5.0, "CHASE", 70), growth: 100.0, base: 0.0, setKnockback: 85.0 }),
  },
};
