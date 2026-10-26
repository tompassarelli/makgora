import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../geometry/contactGeometry";
import { type MoveRegion, heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type StrikeCapsule, tipperMove } from "../heroMoves";
import { hurtPart, hurtPose } from "../hurtboxes";
import { groundHit } from "./groundNormals";

type Angle = Parameters<typeof groundHit>[1];
type Effect = ReturnType<typeof groundHit>;

export const kaelHit = (damage: number, angle: Angle, growth = 76.04872131347656, base = 20.0, behind = false) =>
  groundHit(damage, angle, growth, base, HitElement.fire, behind);
const arcane = (damage: number, angle: Angle, growth = 76.04872131347656, base = 20.0, behind = false) =>
  groundHit(damage, angle, growth, base, HitElement.arcane, behind);
const capsule = (x1: number, z1: number, x2: number, z2: number, radius = 12.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const body = hurtCapsule(Character.kaelthas);
const torso = hurtPart(0.0, 4.0, 0.0, body.z2, body.radius);
const arm = (x: number, z: number) => hurtPart(8.0, f32(body.z2 - 12.0), x, z, 9.0);
export const kaelCastBody = (first: number, last: number, x: number, z: number) => [hurtPose(first, last, [torso, arm(x, z)])];
const reach = (first: number, last: number, x: number, z: number) => [heroHurtPose(first, last, [torso, arm(x, z)])];
const tilt = (height: number, angle: Angle) => heroMove(9, 3, 20, 0, [heroRegion(9, 11, capsule(56.0, 60.0, 126.0, height, 13.0), arcane(8.5, angle))]);
const ORBIT: readonly (readonly [number, number])[] = [[44.0, 58.0], [22.0, 96.0], [-22.0, 96.0], [-44.0, 58.0], [-22.0, 20.0], [22.0, 20.0]];
const orbitPoint = (index: number): readonly [number, number] => ORBIT[imod(index, ORBIT.length)] ?? [0.0, 58.0];

function orbit(first: number, framesPerStep: number, steps: number, effect: Effect): MoveRegion[] {
  const regions: MoveRegion[] = [];
  for (let step = 0; step < steps; step++) {
    for (let sphere = 0; sphere < 3; sphere++) {
      const [x1, z1] = orbitPoint(step + sphere * 2);
      const [x2, z2] = orbitPoint(step + sphere * 2 + 1);
      const start = first + step * framesPerStep;
      regions.push(heroRegion(start, start + framesPerStep - 1, capsule(x1, z1, x2, z2, 16.0), effect));
    }
  }
  return regions;
}

const SIPHON_MANA = heroRegion(14, 16, capsule(24.0, 54.0, 150.0, 54.0, 10.0), kaelHit(0.0, 35, 0.0, 0.0));

const throwMove = (contactFrame: number, recovery: number, effect: Effect) => ({ contactFrame, totalFrames: contactFrame + recovery, effect });

export const KAELTHAS_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  grabRegion: SIPHON_MANA.hit,
  hurtboxes: {
    stand: [torso], crouch: [hurtPart(0.0, 4.0, 0.0, f32(body.z2 * f32(0.6)), body.radius)],
    attacks: {
      [AttackStyle.jab]: reach(2, 7, 34.0, 58.0), [AttackStyle.jab2]: reach(3, 9, 40.0, 56.0),
      [AttackStyle.forwardTilt]: reach(7, 13, 38.0, 60.0), [AttackStyle.forwardTiltUp]: reach(7, 13, 38.0, 88.0),
      [AttackStyle.forwardTiltDown]: reach(7, 13, 38.0, 30.0), [AttackStyle.upTilt]: reach(5, 13, 18.0, 110.0),
      [AttackStyle.downTilt]: reach(8, 14, 40.0, 18.0), [AttackStyle.dashAttack]: reach(5, 20, 42.0, 48.0),
      [AttackStyle.forwardSmash]: reach(11, 20, 46.0, 62.0), [AttackStyle.upSmash]: reach(14, 22, 14.0, 118.0),
      [AttackStyle.downSmash]: reach(17, 26, 42.0, 20.0), [AttackStyle.neutralAir]: reach(3, 14, 22.0, 64.0),
      [AttackStyle.forwardAir]: reach(7, 14, 40.0, 72.0), [AttackStyle.backAir]: [heroHurtPose(9, 22, [torso, hurtPart(8, 94, -52, 66, 16)])],
      [AttackStyle.upAir]: reach(6, 13, 12.0, 118.0), [AttackStyle.downAir]: reach(12, 18, 12.0, -10.0),
      [AttackStyle.grab]: reach(10, 22, 60.0, 54.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 2, 14, 0, [heroRegion(4, 5, capsule(30.0, 58.0, 64.0, 58.0, 11.0), arcane(3.0, 25, 52.28349685668945, 16.0))])),
    [AttackStyle.jab2]: heroMove(5, 3, 17, 0, [heroRegion(5, 7, capsule(32.0, 56.0, 70.0, 56.0), arcane(4.0, 35))]),
    [AttackStyle.forwardTilt]: tilt(60.0, 35), [AttackStyle.forwardTiltUp]: tilt(96.0, 55), [AttackStyle.forwardTiltDown]: tilt(24.0, 25),
    [AttackStyle.upTilt]: heroMove(7, 5, 20, 0, [
      heroRegion(7, 8, capsule(48.0, 86.0, 18.0, 132.0, 16.0), arcane(7.5, 85, 84.0, 30.0)),
      heroRegion(9, 11, capsule(18.0, 132.0, -40.0, 100.0, 16.0), arcane(7.5, 85, 84.0, 30.0)),
    ]),
    [AttackStyle.downTilt]: heroMove(10, 3, 15, 0, [heroRegion(10, 12, capsule(30.0, 9.0, 128.0, 9.0, 11.0), arcane(7.0, 30, 70.0, 30.0))]),
    [AttackStyle.dashAttack]: heroMove(7, 12, 20, 0, [heroRegion(7, 18, capsule(26.0, 46.0, 94.0, 46.0, 14.0), arcane(9.0, 55))]),
    [AttackStyle.forwardSmash]: tipperMove(heroMove(14, 3, 33, 0, [heroRegion(14, 16, capsule(30.0, 62.0, 124.0, 62.0, 14.0), arcane(16.0, 35, 106.0, 30.0))]), 0.25),
    [AttackStyle.upSmash]: heroMove(16, 5, 33, 0, [
      heroRegion(16, 17, capsule(-20.0, 92.0, 20.0, 92.0, 22.0), arcane(16.0, 90, 104.5669937133789, 30.0)),
      heroRegion(18, 20, capsule(-30.0, 132.0, 30.0, 132.0, 24.0), arcane(16.0, 90, 104.5669937133789, 30.0)),
    ]),
    [AttackStyle.downSmash]: heroMove(20, 4, 32, 0, [
      heroRegion(20, 23, capsule(28.0, 12.0, 116.0, 12.0, 14.0), arcane(14.5, 25, 104.5669937133789, 30.0)),
      heroRegion(20, 23, capsule(-28.0, 12.0, -116.0, 12.0, 14.0), arcane(14.5, 25, 104.5669937133789, 30.0, true)),
    ]),
    [AttackStyle.neutralAir]: heroMove(5, 9, 21, 14, orbit(5, 3, 3, arcane(8.5, 45, 80.0, 30.0))),
    [AttackStyle.forwardAir]: heroMove(9, 4, 22, 14, [
      heroRegion(9, 10, capsule(52.0, 116.0, 104.0, 82.0, 13.0), arcane(10.0, 40, 90.30785369873047, 24.0)),
      heroRegion(11, 12, capsule(104.0, 82.0, 60.0, 22.0, 13.0), arcane(10.0, 40, 90.30785369873047, 24.0)),
    ]),
    [AttackStyle.backAir]: heroMove(11, 3, 24, 16, [heroRegion(11, 13, capsule(-28.0, 72.0, -100.0, 82.0, 14.0), arcane(14.0, 35, 100.0, 30.0, true))]),
    [AttackStyle.upAir]: heroMove(8, 4, 22, 14, [heroRegion(8, 11, capsule(-28.0, 130.0, 28.0, 130.0, 18.0), arcane(8.5, 85, 80.0, 28.0))]),
    [AttackStyle.downAir]: heroMove(14, 3, 29, 18, [heroRegion(14, 16, capsule(6.0, 12.0, 8.0, -26.0, 18.0), arcane(11.0, 80, 70.0, 34.0))]),
    [AttackStyle.grab]: heroMove(14, 3, 42, 0, [SIPHON_MANA]),
    [AttackStyle.getupAttack]: heroMove(17, 3, 30, 0, [heroRegion(17, 19, capsule(-65.0, 20.0, 65.0, 20.0, 18.0), arcane(7.59276008605957, 35))]),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 21, 0, [heroRegion(17, 19, capsule(20.0, 50.0, 90.0, 50.0), arcane(7.59276008605957, 35))]),
  },
  throws: {
    [GrabAction.pummel]: throwMove(1, 0, arcane(3.254040002822876, 35, 0.0, 0.0)),
    [GrabAction.throwForward]: throwMove(14, 22, arcane(7.59276008605957, 35, 34.0, 59.0)),
    [GrabAction.throwBack]: throwMove(17, 25, arcane(11.0, 35, 72.0, 60.0, true)),
    [GrabAction.throwUp]: throwMove(16, 15, arcane(7.59276008605957, 90, 52.28349685668945, 50.0)),
    [GrabAction.throwDown]: throwMove(18, 24, arcane(6.0, 80, 30.0, 95.0)),
  },
};
