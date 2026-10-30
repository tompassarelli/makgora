

import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type AuthoredMove, type FighterMoves, type StrikeCapsule, cleanLateMove } from "../../sim/heroMoves";
import { hurtPart } from "../../sim/hurtboxes";
import { groundHit } from "../../sim/heroes/groundNormals";

type Angle = 0 | 25 | 35 | 40 | 55 | 70 | 80 | 90;
export const murlocHit = (damage: number, angle: Angle, growth = 63.15253829956055, base = 18.0, behind = false, element: HitElement = HitElement.normal) =>
  groundHit(damage, angle, growth, base, element, behind);
const ordinary = (damage: number, angle: Angle, growth = 63.15253829956055, base = 18.0, behind = false) =>
  murlocHit(damage, angle, growth, base, behind);
const claw = (x1: number, z1: number, x2: number, z2: number, radius = 10.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const body = hurtCapsule(Character.murloc);
const torso = hurtPart(0.0, 4.0, 0.0, body.z2, body.radius);
const arm = (x: number, z: number) => hurtPart(8.0, 40.0, x, z, 8.0);
const reach = (first: number, last: number, x: number, z: number) => [heroHurtPose(first, last, [torso, arm(x, z)])];
const slapFrames = (count: number, first: number, step: number) => Array.from({ length: count }, (_, k) => first + k * step);
const RAPID_FIRST = 3;
const RAPID_STEP = 4;
const RAPID_SLAPS = 6;
const RAPID_FINISHER = RAPID_FIRST + RAPID_SLAPS * RAPID_STEP;
const rapidJab = (): AuthoredMove => ({
  ...heroMove(RAPID_FIRST, RAPID_FINISHER + 2 - RAPID_FIRST + 1, 14, 0, [
    ...slapFrames(RAPID_SLAPS, RAPID_FIRST, RAPID_STEP).map((first, k) => heroRegion(first, first + 1, claw(14.0, 40.0, 54.0, 38.0, 9.0), ordinary(1.0, 25, 0.0, 12.0), undefined, k + 1)),
    heroRegion(RAPID_FINISHER, RAPID_FINISHER + 2, claw(16.0, 40.0, 68.0, 42.0, 10.0), ordinary(3.0, 40, 70.0, 20.0), undefined, RAPID_SLAPS + 1),
  ]),
  release: { gates: slapFrames(RAPID_SLAPS - 1, RAPID_FIRST + RAPID_STEP - 2, RAPID_STEP), to: RAPID_FINISHER - 3 },
});
const DRILL_FIRST = 6;
const DRILL_STEP = 3;
const DRILL_HITS = 5;
const drillFall = (first: number) => heroRegion(first, first + 1, claw(-4.0, 6.0, -10.0, -20.0, 12.0), { ...ordinary(1.5, 90, 0.0, 14.0), launchZ: -1.0 }, ordinary(1.5, 0, 0.0, 14.0), (first - DRILL_FIRST) / DRILL_STEP + 1);
const drill = (): AuthoredMove => ({ ...heroMove(DRILL_FIRST, DRILL_STEP * DRILL_HITS + 3, 3, 3, [
  ...slapFrames(DRILL_HITS, DRILL_FIRST, DRILL_STEP).map((first) => drillFall(first)),
  heroRegion(DRILL_FIRST + DRILL_STEP * DRILL_HITS, DRILL_FIRST + DRILL_STEP * DRILL_HITS + 2, claw(-4.0, 6.0, -10.0, -22.0, 13.0), ordinary(3.0, 80, 70.0, 22.0), ordinary(3.0, 0, 0.0, 32.0), DRILL_HITS + 1),
]), landingHit: { firstFrame: DRILL_FIRST + DRILL_STEP * DRILL_HITS - 2, totalFrames: DRILL_FIRST + DRILL_STEP * DRILL_HITS + 5 }, fall: [{ firstFrame: DRILL_FIRST - 2, lastFrame: DRILL_FIRST + DRILL_STEP * DRILL_HITS + 1, speedZ: -4.0 }] });
const tilt = (z: number, angle: 25 | 35 | 55) => heroMove(6, 3, 19, 0, [heroRegion(6, 8, claw(20.0, 40.0, 66.0, z), ordinary(9.990917205810547, angle))]);

export const MURLOC_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [torso], crouch: [hurtPart(0.0, 4.0, 0.0, f32(body.z2 * f32(0.6)), body.radius)],
    attacks: {
      [AttackStyle.jab]: reach(2, 6, 40.0, 40.0), [AttackStyle.jab2]: reach(3, 7, 46.0, 40.0), [AttackStyle.jab3]: reach(2, RAPID_FINISHER + 2, 44.0, 40.0),
      [AttackStyle.forwardTilt]: reach(5, 10, 50.0, 40.0), [AttackStyle.forwardTiltUp]: reach(5, 10, 48.0, 66.0),
      [AttackStyle.forwardTiltDown]: reach(5, 10, 50.0, 16.0), [AttackStyle.upTilt]: reach(4, 10, 12.0, 90.0),
      [AttackStyle.downTilt]: reach(4, 9, 46.0, 12.0), [AttackStyle.dashAttack]: reach(4, 19, 46.0, 30.0),
      [AttackStyle.forwardSmash]: reach(12, 18, 58.0, 40.0), [AttackStyle.upSmash]: reach(9, 16, 10.0, 96.0),
      [AttackStyle.downSmash]: reach(10, 17, 52.0, 14.0), [AttackStyle.neutralAir]: reach(2, 9, 30.0, 44.0),
      [AttackStyle.forwardAir]: reach(5, 11, 50.0, 46.0), [AttackStyle.backAir]: reach(6, 12, -50.0, 40.0),
      [AttackStyle.upAir]: reach(5, 11, 10.0, 96.0), [AttackStyle.downAir]: reach(6, DRILL_FIRST + DRILL_STEP * DRILL_HITS + 2, 8.0, -12.0),
      [AttackStyle.grab]: reach(5, 10, 40.0, 38.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(3, 2, 11, 0, [heroRegion(3, 4, claw(16.0, 40.0, 62.0, 42.0, 8.0), ordinary(2.4977293014526367, 25, 45.10895538330078, 14.0))])),
    [AttackStyle.jab2]: jabStep(heroMove(4, 2, 12, 0, [heroRegion(4, 5, claw(18.0, 40.0, 66.0, 42.0), ordinary(2.0, 35, 40.0, 14.0))])),
    [AttackStyle.jab3]: rapidJab(),
    [AttackStyle.forwardTilt]: tilt(40.0, 35), [AttackStyle.forwardTiltUp]: tilt(64.0, 55), [AttackStyle.forwardTiltDown]: tilt(14.0, 25),
    [AttackStyle.upTilt]: heroMove(5, 4, 18, 0, [heroRegion(5, 8, claw(20.0, 60.0, -30.0, 88.0, 14.0), ordinary(8.742053031921387, 90, 81.19612121582031, 22.0))]),
    [AttackStyle.downTilt]: heroMove(5, 3, 16, 0, [heroRegion(5, 7, claw(18.0, 12.0, 66.0, 18.0, 12.0), ordinary(7.493188381195068, 80, 81.19612121582031, 22.0))]),
    [AttackStyle.dashAttack]: heroMove(6, 12, 20, 0, [heroRegion(6, 17, claw(16.0, 10.0, 108.0, -6.0, 16.0), ordinary(11.239782333374023, 55))]),
    [AttackStyle.forwardSmash]: heroMove(14, 3, 36, 0, [heroRegion(14, 16, claw(30.0, 44.0, 23.0, 70.0, 16.0), ordinary(17.167999267578125, 35, 107.0719985961914, 26.0))]),
    [AttackStyle.upSmash]: heroMove(11, 4, 34, 0, [heroRegion(11, 14, claw(0.0, 60.0, -30.0, 84.0, 16.0), ordinary(18.732969284057617, 90, 94.72880554199219, 26.0))]),
    [AttackStyle.downSmash]: heroMove(12, 4, 34, 0, [heroRegion(12, 15, claw(18.0, 10.0, 74.0, 10.0, 12.0), ordinary(16.235240936279297, 25, 94.72880554199219, 26.0))]),
    [AttackStyle.neutralAir]: cleanLateMove(heroMove(3, 6, 16, 8, [heroRegion(3, 8, claw(40.0, 48.0, 64.0, 10.0, 16.0), ordinary(5.0, 55, 50.0, 14.0))]), 2),
    [AttackStyle.forwardAir]: heroMove(7, 3, 24, 14, [heroRegion(7, 9, claw(18.0, 48.0, 56.0, 58.0), ordinary(12.488646507263184, 40, 81.19612121582031, 22.0))]),
    [AttackStyle.backAir]: heroMove(8, 3, 24, 14, [heroRegion(8, 10, claw(-18.0, 44.0, -54.0, 50.0, 12.0), ordinary(14.986376762390137, 35, 99.23970031738281, 26.0, true))]),
    [AttackStyle.upAir]: heroMove(6, 4, 20, 12, [heroRegion(6, 9, claw(-30.0, 84.0, 10.0, 90.0, 16.0), ordinary(11.239782333374023, 90, 81.19612121582031, 22.0))]),
    [AttackStyle.downAir]: drill(),
    [AttackStyle.grab]: heroMove(7, 2, 24, 0, [heroRegion(7, 8, claw(16.0, 38.0, 44.0, 38.0), murlocHit(0.0, 35, 0.0, 0.0))]),
    [AttackStyle.getupAttack]: heroMove(17, 3, 30, 0, [heroRegion(17, 19, claw(-56.0, 14.0, 56.0, 14.0, 14.0), ordinary(7.493188381195068, 35))]),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 21, 0, [heroRegion(17, 19, claw(16.0, 36.0, 70.0, 36.0), ordinary(7.493188381195068, 35))]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 1, totalFrames: 1, effect: ordinary(2.4977293014526367, 35, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 32, effect: ordinary(8.742053031921387, 40, 36.5, 61.0) },
    [GrabAction.throwBack]: { contactFrame: 14, totalFrames: 36, effect: ordinary(11.239782333374023, 40, 27.5, 70.0, true) },
    [GrabAction.throwUp]: { contactFrame: 12, totalFrames: 26, effect: ordinary(7.493188381195068, 90, 49.619850158691406, 50.0) },
    [GrabAction.throwDown]: { contactFrame: 16, totalFrames: 38, effect: { ...ordinary(6.244323253631592, 70, 0.0, 0.0), growth: 100.0, setKnockback: 90.0 } },
  },
};
