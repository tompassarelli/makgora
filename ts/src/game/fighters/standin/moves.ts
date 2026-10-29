import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type StrikeCapsule } from "../../sim/heroMoves";
import { hurtPart, hurtPose, type HurtPose } from "../../sim/hurtboxes";
import { groundHit } from "../../sim/heroes/groundNormals";

export const standinHit = (damage: number, angle: 25 | 35 | 40 | 55 | 70 | 80 | 90, growth = 85.0, base = 24.0, behind = false) =>
  groundHit(damage, angle, growth, base, HitElement.normal, behind);
export const strike = (x1: number, z1: number, x2: number, z2: number, radius = 9.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const noHit = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false };
const tilt = (height: number, angle: 25 | 35 | 55) => heroMove(9, 3, 22, 0,
  [heroRegion(9, 11, strike(28.0, 54.0, 84.0, height, 34.0), standinHit(8.0, angle))]);

export function standinCastBody(character: number, first: number, last: number): readonly HurtPose[] {
  const body = hurtCapsule(character);
  return [hurtPose(first, last, [hurtPart(0.0, 4.0, 0.0, body.z2, body.radius), hurtPart(8.0, f32(body.z2 - 15.0), 36.0, 58.0, 9.0)])];
}

export function standinMoves(character: number): FighterMoves {
  const body = hurtCapsule(character);
  const torso = hurtPart(0.0, 4.0, 0.0, body.z2, body.radius);
  const reach = (first: number, last: number, x: number, z: number) =>
    [heroHurtPose(first, last, [torso, hurtPart(8.0, f32(body.z2 - 15.0), x, z, 9.0)])];
  return {
    dashAttack: AttackStyle.dashAttack,
    hurtboxes: {
      stand: [torso], crouch: [hurtPart(0.0, 4.0, 0.0, f32(body.z2 * f32(0.6)), body.radius)],
      attacks: {
        [AttackStyle.jab]: reach(3, 6, 50.0, 50.0), [AttackStyle.jab2]: reach(3, 6, 54.0, 50.0),
        [AttackStyle.forwardTilt]: reach(8, 11, 60.0, 54.0), [AttackStyle.forwardTiltUp]: reach(8, 11, 56.0, 80.0),
        [AttackStyle.forwardTiltDown]: reach(8, 11, 60.0, 28.0), [AttackStyle.upTilt]: reach(6, 12, 8.0, 110.0),
        [AttackStyle.downTilt]: reach(6, 9, 60.0, 20.0), [AttackStyle.dashAttack]: reach(6, 18, 60.0, 48.0),
        [AttackStyle.forwardSmash]: reach(16, 22, 70.0, 54.0), [AttackStyle.upSmash]: reach(15, 22, 8.0, 112.0),
        [AttackStyle.downSmash]: reach(14, 22, 50.0, 18.0), [AttackStyle.neutralAir]: reach(6, 14, 40.0, 50.0),
        [AttackStyle.forwardAir]: reach(10, 15, 50.0, 60.0), [AttackStyle.backAir]: reach(7, 12, -50.0, 55.0),
        [AttackStyle.upAir]: reach(8, 12, 8.0, 120.0), [AttackStyle.downAir]: reach(13, 19, 10.0, 0.0),
        [AttackStyle.grab]: reach(7, 12, 50.0, 48.0),
      },
    },
    normals: {
      [AttackStyle.jab]: jabStep(heroMove(5, 2, 14, 0, [heroRegion(5, 6, strike(20.0, 50.0, 36.0, 50.0, 34.0), standinHit(3.0, 70, 50.0, 18.0))])),
      [AttackStyle.jab2]: heroMove(5, 2, 18, 0, [heroRegion(5, 6, strike(22.0, 50.0, 40.0, 50.0, 34.0), standinHit(4.0, 35, 85.0, 22.0))]),
      [AttackStyle.forwardTilt]: tilt(54.0, 35), [AttackStyle.forwardTiltUp]: tilt(94.0, 55), [AttackStyle.forwardTiltDown]: tilt(12.0, 25),
      [AttackStyle.upTilt]: heroMove(8, 4, 22, 0, [heroRegion(8, 11, strike(-20.0, 110.0, 24.0, 118.0, 40.0), standinHit(7.0, 90, 75.0, 36.0))]),
      [AttackStyle.downTilt]: heroMove(7, 3, 19, 0, [heroRegion(7, 9, strike(30.0, 24.0, 74.0, 24.0, 35.0), standinHit(6.0, 80, 65.0, 35.0))]),
      [AttackStyle.dashAttack]: heroMove(8, 8, 26, 0, [heroRegion(8, 15, strike(30.0, 48.0, 76.0, 48.0, 39.0), standinHit(9.0, 55, 88.0, 28.0))]),
      [AttackStyle.forwardSmash]: heroMove(18, 3, 38, 0, [heroRegion(18, 20, strike(40.0, 55.0, 115.0, 55.0, 37.0), standinHit(16.0, 35, 110.0, 26.0))]),
      [AttackStyle.upSmash]: heroMove(17, 4, 35, 0, [heroRegion(17, 20, strike(0.0, 80.0, 0.0, 140.0, 45.0), standinHit(15.0, 90, 108.0, 24.0))]),
      [AttackStyle.downSmash]: heroMove(16, 6, 33, 0, [
        heroRegion(16, 18, strike(35.0, 30.0, 92.0, 30.0, 39.0), standinHit(13.0, 25, 100.0, 25.0)),
        heroRegion(19, 21, strike(-35.0, 30.0, -92.0, 30.0, 39.0), standinHit(13.0, 25, 100.0, 25.0, true)),
      ]),
      [AttackStyle.neutralAir]: heroMove(7, 6, 24, 16, [
        heroRegion(7, 12, strike(24.0, 40.0, 40.0, 60.0, 38.0), standinHit(8.0, 55, 80.0, 24.0)),
        heroRegion(7, 12, strike(-24.0, 40.0, -40.0, 60.0, 38.0), standinHit(8.0, 55, 80.0, 24.0, true)),
      ]),
      [AttackStyle.forwardAir]: heroMove(11, 3, 26, 18, [heroRegion(11, 13, strike(30.0, 80.0, 44.0, 44.0, 44.0), standinHit(11.0, 35, 100.0, 25.0))]),
      [AttackStyle.backAir]: heroMove(9, 3, 24, 16, [heroRegion(9, 11, strike(-20.0, 60.0, -36.0, 60.0, 41.0), standinHit(11.0, 35, 104.0, 23.0, true))]),
      [AttackStyle.upAir]: heroMove(9, 4, 24, 16, [heroRegion(9, 12, strike(-12.0, 128.0, 12.0, 128.0, 43.0), standinHit(10.0, 90, 104.0, 24.0))]),
      [AttackStyle.downAir]: heroMove(15, 3, 30, 22, [heroRegion(15, 17, strike(0.0, 30.0, 0.0, 10.0, 48.0),
        { ...standinHit(12.0, 90, 96.0, 24.0), launchZ: -1.0 }, standinHit(12.0, 55, 96.0, 24.0))]),
      [AttackStyle.grab]: heroMove(8, 2, 28, 0, [heroRegion(8, 9, strike(20.0, 48.0, 64.0, 48.0, 10.0), noHit)]),
    },
    throws: {
      [GrabAction.pummel]: { contactFrame: 6, totalFrames: 14, effect: { ...noHit, damage: 3.0, element: HitElement.normal } },
      [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 36, effect: standinHit(8.0, 35, 60.0, 62.0) },
      [GrabAction.throwBack]: { contactFrame: 17, totalFrames: 40, effect: standinHit(10.0, 40, 66.0, 60.0, true) },
      [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 26, effect: standinHit(7.0, 90, 70.0, 45.0) },
      [GrabAction.throwDown]: { contactFrame: 18, totalFrames: 42, effect: { ...standinHit(6.0, 70, 0.0, 0.0), growth: 100.0, setKnockback: 90.0 } },
    },
  };
}
