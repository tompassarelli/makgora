import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { HERO_REFERENCE_HEIGHT, heroHurtPose, heroMove, heroRegion, jabStep, tipperMove, type FighterMoves, type StrikeCapsule } from "../../sim/heroMoves";
import { hurtPart } from "../../sim/hurtboxes";
import { groundHit } from "../../sim/heroes/groundNormals";
import type { Angle } from "../../sim/heroes/authoring";

export const ladyVashjHit = (damage: number, angle: Angle, growth = 70.0, base = 20.0, behind = false, element: HitElement = HitElement.normal) =>
  groundHit(damage, angle, growth, base, element, behind);
const ordinary = (damage: number, angle: Angle, growth = 70.0, base = 20.0, behind = false) => ladyVashjHit(damage, angle, growth, base, behind, HitElement.normal);
export const ladyVashjStrike = (x1: number, z1: number, x2: number, z2: number, radius = 12.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const strike = ladyVashjStrike;
const body = hurtCapsule(Character.ladyVashj);
const torso = hurtPart(0.0, 4.0, 0.0, body.z2, body.radius);
const coil = hurtPart(-30.0, 10.0, 18.0, 10.0, 16.0);
const arm = (x: number, z: number) => hurtPart(10.0, f32(body.z2 - 14.0), x, z, 9.0);
const tail = (x: number, z: number) => hurtPart(-14.0, 14.0, x, z, 14.0);
export const ladyVashjReach = (x: number, z: number) => [torso, coil, arm(x, z)];
const reach = (first: number, last: number, x: number, z: number) => [heroHurtPose(first, last, ladyVashjReach(x, z))];
const lash = (first: number, last: number, x: number, z: number) => [heroHurtPose(first, last, [torso, tail(x, z)])];
const tilt = (z1: number, x2: number, z2: number, angle: 25 | 35 | 55) =>
  heroMove(10, 4, 11, 0, [heroRegion(10, 13, strike(-10.0, z1, x2, z2, 14.0), ordinary(10.0, angle, 72.0, 22.0))]);
const throwMove = (contactFrame: number, recovery: number, effect: ReturnType<typeof ordinary>) => ({ contactFrame, totalFrames: contactFrame + recovery, effect });
export const LADY_VASHJ_GRAB_REACH = f32(f32(HERO_REFERENCE_HEIGHT * f32(1.15)) * f32(0.65));

export const LADY_VASHJ_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [torso, coil], crouch: [hurtPart(0.0, 4.0, 0.0, f32(body.z2 * f32(0.55)), body.radius), coil],
    attacks: {
      [AttackStyle.jab]: reach(3, 8, 60.0, 80.0), [AttackStyle.jab2]: reach(4, 10, 64.0, 66.0),
      [AttackStyle.forwardTilt]: lash(8, 16, 120.0, 40.0), [AttackStyle.forwardTiltUp]: lash(8, 16, 104.0, 92.0),
      [AttackStyle.forwardTiltDown]: lash(8, 16, 118.0, 14.0), [AttackStyle.upTilt]: reach(6, 14, 14.0, 150.0),
      [AttackStyle.downTilt]: lash(6, 12, 116.0, 10.0), [AttackStyle.dashAttack]: lash(8, 20, 96.0, 16.0),
      [AttackStyle.forwardSmash]: reach(16, 26, 70.0, 84.0), [AttackStyle.upSmash]: reach(14, 26, 10.0, 156.0),
      [AttackStyle.downSmash]: lash(13, 24, 100.0, 10.0), [AttackStyle.neutralAir]: lash(7, 17, -70.0, 30.0),
      [AttackStyle.forwardAir]: reach(9, 16, 60.0, 84.0), [AttackStyle.backAir]: lash(8, 17, -112.0, 46.0),
      [AttackStyle.upAir]: reach(6, 14, 14.0, 150.0), [AttackStyle.downAir]: lash(13, 22, 8.0, -60.0),
      [AttackStyle.grab]: lash(5, 14, 96.0, 40.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(5, 2, 10, 0, [heroRegion(5, 6, strike(24.0, 86.0, 94.0, 82.0, 11.0), ordinary(4.0, 30, 48.0, 18.0))])),
    [AttackStyle.jab2]: heroMove(6, 3, 16, 0, [heroRegion(6, 8, strike(24.0, 70.0, 100.0, 64.0, 12.0), ordinary(5.0, 35))]),
    [AttackStyle.forwardTilt]: tilt(40.0, 132.0, 40.0, 35), [AttackStyle.forwardTiltUp]: tilt(46.0, 116.0, 100.0, 55), [AttackStyle.forwardTiltDown]: tilt(30.0, 128.0, 8.0, 25),
    [AttackStyle.upTilt]: heroMove(8, 4, 11, 0, [heroRegion(8, 11, strike(18.0, 120.0, 0.0, 176.0, 15.0), ordinary(8.0, 85, 84.0, 24.0))]),
    [AttackStyle.downTilt]: heroMove(8, 3, 10, 0, [heroRegion(8, 10, strike(10.0, 8.0, 126.0, 8.0, 12.0), ordinary(7.0, 80, 60.0, 30.0))]),
    [AttackStyle.dashAttack]: heroMove(12, 5, 12, 0, [heroRegion(12, 16, strike(10.0, 22.0, 104.0, 18.0, 16.0), ordinary(11.0, 45, 70.0, 24.0))], 60.0),
    [AttackStyle.forwardSmash]: tipperMove(heroMove(21, 3, 13, 0, [heroRegion(21, 23, strike(26.0, 86.0, 150.0, 90.0, 14.0), ordinary(18.0, 35, 104.0, 28.0))]), f32(0.3)),
    [AttackStyle.upSmash]: heroMove(19, 5, 11, 0, [
      heroRegion(19, 23, strike(-46.0, 150.0, -14.0, 214.0, 18.0), ladyVashjHit(16.0, 90, 98.0, 28.0, false, HitElement.electric)),
      heroRegion(19, 23, strike(46.0, 150.0, 14.0, 214.0, 18.0), ladyVashjHit(16.0, 90, 98.0, 28.0, false, HitElement.electric)),
    ]),
    [AttackStyle.downSmash]: heroMove(17, 5, 13, 0, [
      heroRegion(17, 18, strike(12.0, 10.0, 118.0, 10.0, 14.0), ordinary(14.0, 25, 98.0, 26.0)),
      heroRegion(19, 21, strike(-12.0, 10.0, -124.0, 10.0, 14.0), ordinary(14.0, 25, 98.0, 26.0, true)),
    ]),
    [AttackStyle.neutralAir]: heroMove(9, 6, 10, 14, [heroRegion(9, 14, strike(-74.0, 34.0, 60.0, 64.0, 24.0), ordinary(9.0, 45, 66.0, 20.0))]),
    [AttackStyle.forwardAir]: heroMove(12, 3, 12, 15, [heroRegion(12, 14, strike(28.0, 108.0, 100.0, 56.0, 13.0), ordinary(11.0, 40, 80.0, 22.0))]),
    [AttackStyle.backAir]: heroMove(11, 4, 12, 15, [heroRegion(11, 14, strike(-26.0, 40.0, -126.0, 48.0, 15.0), ordinary(13.0, 35, 100.0, 28.0, true))]),
    [AttackStyle.upAir]: heroMove(8, 4, 11, 13, [heroRegion(8, 11, strike(-50.0, 150.0, 50.0, 150.0, 22.0), ordinary(9.0, 90, 80.0, 22.0))]),
    [AttackStyle.downAir]: heroMove(16, 4, 11, 20, [
      heroRegion(16, 17, strike(6.0, 6.0, 10.0, -66.0, 14.0), { ...ordinary(12.0, 90, 80.0, 22.0), launchX: 0.0, launchZ: -1.0 }, ordinary(12.0, 70, 80.0, 22.0)),
      heroRegion(18, 19, strike(6.0, 6.0, 10.0, -66.0, 12.0), ordinary(9.0, 70, 70.0, 20.0)),
    ]),
    [AttackStyle.grab]: heroMove(8, 2, 22, 0, [heroRegion(8, 9, strike(18.0, 40.0, LADY_VASHJ_GRAB_REACH, 40.0, 12.0), ordinary(0.0, 35, 0.0, 0.0))]),
    [AttackStyle.getupAttack]: heroMove(17, 3, 30, 0, [heroRegion(17, 19, strike(-96.0, 12.0, 96.0, 12.0, 16.0), ordinary(7.0, 35))]),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 21, 0, [heroRegion(17, 19, strike(20.0, 20.0, 104.0, 14.0, 14.0), ordinary(7.0, 35))]),
  },
  throws: {
    [GrabAction.pummel]: throwMove(1, 0, ordinary(2.0, 35, 0.0, 0.0)),
    [GrabAction.throwForward]: throwMove(14, 22, ordinary(8.0, 35, 40.0, 60.0)),
    [GrabAction.throwBack]: throwMove(16, 24, ordinary(9.0, 40, 36.0, 66.0, true)),
    [GrabAction.throwUp]: throwMove(14, 18, ordinary(7.0, 90, 44.0, 52.0)),
    [GrabAction.throwDown]: throwMove(16, 22, { ...ordinary(6.0, 70, 0.0, 0.0), growth: 100.0, setKnockback: 80.0 }),
  },
};
