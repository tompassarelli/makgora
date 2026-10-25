import { AttackStyle, GrabAction, HitElement } from "../codes";
import { heroMove, heroRegion, jabStep, type FighterMoves, type StrikeCapsule, tipperMove } from "../heroMoves";
import { heroHurtPose } from "../heroMoves";
import { hurtPart } from "../hurtboxes";
import { groundHit } from "./groundNormals";

export const anubarakHit = (damage: number, angle: 25 | 35 | 40 | 55 | 70 | 75 | 80 | 90, growth = 80.93789672851562, base = 26.0, behind = false) => groundHit(damage, angle, growth, base, HitElement.normal, behind);
const claw = (x1: number, z1: number, x2: number, z2: number, radius = 15.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const shell = hurtPart(-24.0, 32.0, 18.0, 88.0, 35.0);
const rear = hurtPart(-50.0, 45.0, -50.0, 75.0, 29.0);
const tilt = (z: number, angle: 25 | 40 | 55) => heroMove(10, 4, 24, 0, [heroRegion(10, 13, claw(32.0, 60.0, 124.0, z), anubarakHit(13.626359939575195, angle))]);

export const ANUBARAK_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [shell, hurtPart(20.0, 76.0, 52.0, 100.0, 20.0), rear],
    crouch: [hurtPart(-28.0, 24.0, 22.0, 55.0, 35.0)],
    attacks: {
      [AttackStyle.downAir]: [
        heroHurtPose(1, 8, [hurtPart(-21.0, 37.0, -21.0, 37.0, 44.0), hurtPart(-9.0, 102.0, -9.0, 102.0, 44.0), hurtPart(-33.0, 119.0, -33.0, 119.0, 41.0)]),
        heroHurtPose(9, 16, [hurtPart(-7.0, 55.0, -23.0, 91.0, 52.0)]),
        heroHurtPose(17, 24, [hurtPart(8.0, 42.0, -8.0, 99.0, 52.0)]),
        heroHurtPose(25, 32, [hurtPart(5.0, 27.0, -11.0, 35.0, 52.0), hurtPart(2.0, 108.0, -14.0, 116.0, 44.0)]),
        heroHurtPose(33, 40, [hurtPart(-2.0, 51.0, -18.0, 104.0, 52.0)]),
        heroHurtPose(41, 50, [hurtPart(-8.0, 58.0, -8.0, 99.0, 52.0)])
      ],
      [AttackStyle.downSmash]: [
        heroHurtPose(1, 8, [hurtPart(-20.0, 39.0, -20.0, 39.0, 44.0), hurtPart(-3.0, 104.0, -3.0, 104.0, 44.0), hurtPart(-33.0, 116.0, -33.0, 116.0, 44.0)]),
        heroHurtPose(9, 16, [hurtPart(-15.0, 40.0, 3.0, 113.0, 47.0)]),
        heroHurtPose(17, 24, [hurtPart(11.0, 30.0, 3.0, 22.0, 52.0), hurtPart(-17.0, 107.0, -9.0, 107.0, 44.0), hurtPart(11.0, 124.0, 3.0, 124.0, 36.0)]),
        heroHurtPose(25, 32, [hurtPart(-2.0, 42.0, -2.0, 116.0, 44.0)]),
        heroHurtPose(33, 40, [hurtPart(-5.0, 48.0, -5.0, 116.0, 44.0)]),
        heroHurtPose(41, 48, [hurtPart(-12.0, 39.0, -12.0, 39.0, 44.0), hurtPart(-8.0, 111.0, -8.0, 111.0, 44.0), hurtPart(-21.0, 124.0, -21.0, 124.0, 36.0)]),
        heroHurtPose(49, 53, [hurtPart(-18.0, 43.0, -18.0, 43.0, 44.0), hurtPart(-14.0, 116.0, -14.0, 116.0, 44.0)])
      ],
      [AttackStyle.forwardTiltDown]: [
        heroHurtPose(1, 8, [hurtPart(-13.0, 27.0, -29.0, 35.0, 44.0), hurtPart(-13.0, 116.0, -13.0, 116.0, 44.0), hurtPart(-37.0, 122.0, -29.0, 122.0, 38.0)]),
        heroHurtPose(9, 16, [hurtPart(18.0, 64.0, -6.0, 56.0, 60.0), hurtPart(3.0, 116.0, -5.0, 116.0, 44.0), hurtPart(-45.0, 144.0, -37.0, 144.0, 16.0)]),
        heroHurtPose(17, 24, [hurtPart(13.0, 59.0, -11.0, 43.0, 60.0), hurtPart(21.0, 113.0, 5.0, 113.0, 44.0), hurtPart(-25.0, 116.0, -17.0, 116.0, 44.0)]),
        heroHurtPose(25, 32, [hurtPart(-2.0, 49.0, -10.0, 41.0, 52.0), hurtPart(5.0, 101.0, -3.0, 109.0, 44.0), hurtPart(-32.0, 125.0, -24.0, 125.0, 35.0)]),
        heroHurtPose(33, 37, [hurtPart(-16.0, 40.0, -16.0, 40.0, 44.0), hurtPart(-6.0, 106.0, -6.0, 106.0, 44.0), hurtPart(-30.0, 123.0, -30.0, 123.0, 37.0)])
      ],
      [AttackStyle.grab]: [
        heroHurtPose(1, 8, [hurtPart(-17.0, 40.0, -17.0, 40.0, 44.0), hurtPart(-5.0, 106.0, -5.0, 106.0, 44.0), hurtPart(-32.0, 119.0, -32.0, 119.0, 41.0)]),
        heroHurtPose(9, 16, [hurtPart(-17.0, 40.0, -17.0, 40.0, 44.0), hurtPart(15.0, 110.0, 15.0, 110.0, 44.0), hurtPart(-12.0, 126.0, -12.0, 126.0, 34.0)]),
        heroHurtPose(17, 24, [hurtPart(-16.0, 40.0, -16.0, 40.0, 44.0), hurtPart(13.0, 110.0, 13.0, 110.0, 44.0), hurtPart(-18.0, 127.0, -18.0, 127.0, 33.0)]),
        heroHurtPose(25, 32, [hurtPart(-14.0, 40.0, -14.0, 40.0, 44.0), hurtPart(1.0, 108.0, 1.0, 108.0, 44.0), hurtPart(-27.0, 125.0, -27.0, 125.0, 35.0)]),
        heroHurtPose(33, 37, [hurtPart(-17.0, 40.0, -17.0, 40.0, 44.0), hurtPart(-6.0, 106.0, -6.0, 106.0, 44.0), hurtPart(-30.0, 124.0, -30.0, 124.0, 36.0)])
      ],
      [AttackStyle.backAir]: [
        heroHurtPose(1, 8, [hurtPart(-15.0, 40.0, -15.0, 40.0, 44.0), hurtPart(-15.0, 116.0, -15.0, 116.0, 44.0)]),
        heroHurtPose(9, 16, [hurtPart(-34.0, 41.0, -16.0, 41.0, 54.0), hurtPart(-34.0, 116.0, -10.0, 114.0, 44.0)]),
        heroHurtPose(17, 24, [hurtPart(-28.0, 40.0, -28.0, 40.0, 44.0), hurtPart(-12.0, 116.0, -12.0, 116.0, 44.0)]),
        heroHurtPose(25, 32, [hurtPart(-21.0, 36.0, -21.0, 36.0, 44.0), hurtPart(-10.0, 99.0, -10.0, 99.0, 44.0), hurtPart(-24.0, 116.0, -24.0, 116.0, 44.0)]),
        heroHurtPose(33, 41, [hurtPart(-18.0, 37.0, -18.0, 37.0, 44.0), hurtPart(-7.0, 102.0, -7.0, 102.0, 44.0), hurtPart(-31.0, 117.0, -31.0, 117.0, 43.0)])
      ],
      [AttackStyle.forwardAir]: [
        heroHurtPose(1, 8, [hurtPart(-19.0, 35.0, -19.0, 35.0, 44.0), hurtPart(-7.0, 101.0, -7.0, 101.0, 44.0), hurtPart(-32.0, 119.0, -32.0, 119.0, 41.0)]),
        heroHurtPose(9, 16, [hurtPart(-17.0, 29.0, -17.0, 29.0, 44.0), hurtPart(12.0, 101.0, 12.0, 101.0, 44.0), hurtPart(-20.0, 116.0, -20.0, 116.0, 44.0)]),
        heroHurtPose(17, 24, [hurtPart(-18.0, 29.0, -18.0, 29.0, 44.0), hurtPart(13.0, 101.0, 13.0, 101.0, 44.0), hurtPart(-16.0, 128.0, -16.0, 128.0, 32.0)]),
        heroHurtPose(25, 32, [hurtPart(-16.0, 32.0, -16.0, 32.0, 44.0), hurtPart(4.0, 102.0, 4.0, 102.0, 44.0), hurtPart(-24.0, 126.0, -24.0, 126.0, 34.0)]),
        heroHurtPose(33, 40, [hurtPart(-17.0, 33.0, -17.0, 33.0, 44.0), hurtPart(-4.0, 102.0, -4.0, 102.0, 44.0), hurtPart(-28.0, 124.0, -28.0, 124.0, 36.0)]),
        heroHurtPose(41, 43, [hurtPart(-19.0, 36.0, -19.0, 36.0, 44.0), hurtPart(-7.0, 102.0, -7.0, 102.0, 44.0), hurtPart(-30.0, 124.0, -30.0, 124.0, 36.0)])
      ],
      [AttackStyle.neutralAir]: [
        heroHurtPose(1, 8, [hurtPart(-10.0, 37.0, -10.0, 37.0, 44.0), hurtPart(-3.0, 103.0, -3.0, 103.0, 44.0), hurtPart(-32.0, 121.0, -32.0, 121.0, 39.0)]),
        heroHurtPose(9, 16, [hurtPart(-30.0, 44.0, -30.0, 44.0, 44.0), hurtPart(-2.0, 116.0, 1.0, 116.0, 44.0), hurtPart(42.0, 150.0, 42.0, 150.0, 10.0)]),
        heroHurtPose(17, 24, [hurtPart(-32.0, 41.0, -32.0, 41.0, 44.0), hurtPart(-7.0, 111.0, -7.0, 111.0, 44.0), hurtPart(37.0, 137.0, 37.0, 137.0, 23.0)]),
        heroHurtPose(25, 32, [hurtPart(-29.0, 36.0, -29.0, 36.0, 44.0), hurtPart(10.0, 99.0, 10.0, 99.0, 44.0), hurtPart(2.0, 116.0, 2.0, 116.0, 44.0)]),
        heroHurtPose(33, 40, [hurtPart(-14.0, 37.0, -14.0, 37.0, 44.0), hurtPart(6.0, 102.0, 6.0, 102.0, 44.0), hurtPart(-30.0, 116.0, -30.0, 116.0, 44.0)])
      ],
      [AttackStyle.upSmash]: [
        heroHurtPose(1, 8, [hurtPart(-16.0, 40.0, -16.0, 40.0, 44.0), hurtPart(-7.0, 107.0, -7.0, 107.0, 44.0), hurtPart(-30.0, 123.0, -30.0, 123.0, 37.0)]),
        heroHurtPose(9, 16, [hurtPart(-11.0, 43.0, -11.0, 43.0, 44.0), hurtPart(6.0, 116.0, 6.0, 116.0, 44.0)]),
        heroHurtPose(17, 24, [hurtPart(-34.0, 53.0, -34.0, 53.0, 44.0), hurtPart(-13.0, 116.0, -13.0, 116.0, 44.0), hurtPart(11.0, 130.0, 11.0, 130.0, 30.0)]),
        heroHurtPose(25, 32, [hurtPart(-35.0, 50.0, -35.0, 50.0, 44.0), hurtPart(-6.0, 116.0, -6.0, 116.0, 44.0), hurtPart(33.0, 120.0, 33.0, 120.0, 40.0)]),
        heroHurtPose(33, 40, [hurtPart(-35.0, 43.0, -35.0, 43.0, 44.0), hurtPart(4.0, 114.0, 4.0, 114.0, 44.0), hurtPart(29.0, 116.0, 29.0, 116.0, 44.0)]),
        heroHurtPose(41, 48, [hurtPart(-23.0, 39.0, -23.0, 39.0, 44.0), hurtPart(10.0, 103.0, 10.0, 103.0, 44.0), hurtPart(-10.0, 116.0, -10.0, 116.0, 44.0)]),
        heroHurtPose(49, 52, [hurtPart(-18.0, 39.0, -18.0, 39.0, 44.0), hurtPart(-2.0, 104.0, -2.0, 104.0, 44.0), hurtPart(-33.0, 119.0, -33.0, 119.0, 41.0)])
      ],
      [AttackStyle.jab3]: [
        heroHurtPose(1, 8, [hurtPart(8.0, 59.0, -24.0, 51.0, 60.0), hurtPart(1.0, 105.0, -23.0, 113.0, 44.0), hurtPart(25.0, 92.0, -7.0, 116.0, 44.0)]),
        heroHurtPose(9, 16, [hurtPart(26.0, 65.0, -14.0, 65.0, 60.0), hurtPart(-3.0, 102.0, -11.0, 110.0, 44.0), hurtPart(-33.0, 116.0, -25.0, 116.0, 44.0)]),
        heroHurtPose(17, 24, [hurtPart(11.0, 49.0, -27.0, 65.0, 60.0), hurtPart(15.0, 76.0, -25.0, 108.0, 52.0), hurtPart(-37.0, 116.0, -29.0, 116.0, 44.0)]),
        heroHurtPose(25, 28, [hurtPart(-19.0, 40.0, -19.0, 40.0, 44.0), hurtPart(-8.0, 105.0, -8.0, 105.0, 44.0), hurtPart(-31.0, 124.0, -31.0, 124.0, 36.0)])
      ],
      [AttackStyle.jab2]: [
        heroHurtPose(1, 8, [hurtPart(-16.0, 45.0, -16.0, 45.0, 44.0), hurtPart(-8.0, 116.0, -8.0, 116.0, 44.0), hurtPart(15.0, 116.0, 15.0, 116.0, 44.0)]),
        heroHurtPose(9, 16, [hurtPart(26.0, 57.0, -22.0, 73.0, 60.0), hurtPart(-2.0, 109.0, -10.0, 109.0, 44.0), hurtPart(-25.0, 129.0, -25.0, 129.0, 31.0)]),
        heroHurtPose(17, 24, [hurtPart(7.0, 57.0, -17.0, 49.0, 60.0), hurtPart(7.0, 92.0, -17.0, 108.0, 52.0), hurtPart(-28.0, 126.0, -28.0, 126.0, 34.0)]),
        heroHurtPose(25, 30, [hurtPart(-18.0, 44.0, -18.0, 44.0, 44.0), hurtPart(-15.0, 116.0, -15.0, 116.0, 44.0)])
      ],
      [AttackStyle.jab]: [
        heroHurtPose(1, 8, [hurtPart(8.0, 43.0, -24.0, 43.0, 52.0), hurtPart(-25.0, 115.0, -9.0, 115.0, 44.0), hurtPart(22.0, 84.0, -10.0, 116.0, 44.0)]),
        heroHurtPose(9, 16, [hurtPart(22.0, 57.0, -8.0, 54.0, 60.0), hurtPart(-2.0, 102.0, -10.0, 110.0, 44.0), hurtPart(-30.0, 112.0, -26.0, 116.0, 44.0)]),
        heroHurtPose(17, 25, [hurtPart(6.0, 57.0, -26.0, 65.0, 60.0), hurtPart(8.0, 91.0, -32.0, 107.0, 52.0), hurtPart(-30.0, 122.0, -30.0, 122.0, 38.0)])
      ],
      [AttackStyle.forwardTilt]: [
        heroHurtPose(1, 8, [hurtPart(-15.0, 45.0, -15.0, 45.0, 44.0), hurtPart(-3.0, 116.0, -3.0, 116.0, 44.0), hurtPart(24.0, 144.0, 24.0, 144.0, 16.0)]),
        heroHurtPose(9, 16, [hurtPart(-19.0, 41.0, -19.0, 41.0, 44.0), hurtPart(23.0, 110.0, 15.0, 110.0, 44.0), hurtPart(-2.0, 116.0, -2.0, 116.0, 44.0)]),
        heroHurtPose(17, 24, [hurtPart(-12.0, 41.0, -12.0, 41.0, 44.0), hurtPart(17.0, 109.0, 17.0, 109.0, 44.0), hurtPart(-12.0, 116.0, -12.0, 116.0, 44.0)]),
        heroHurtPose(25, 32, [hurtPart(-12.0, 41.0, -12.0, 41.0, 44.0), hurtPart(12.0, 99.0, 4.0, 107.0, 52.0), hurtPart(-38.0, 117.0, -30.0, 125.0, 35.0)]),
        heroHurtPose(33, 37, [hurtPart(-16.0, 40.0, -16.0, 40.0, 44.0), hurtPart(-6.0, 105.0, -6.0, 105.0, 44.0), hurtPart(-31.0, 124.0, -31.0, 124.0, 36.0)])
      ],
      [AttackStyle.forwardSmash]: [
        heroHurtPose(1, 8, [hurtPart(-19.0, 39.0, -19.0, 39.0, 44.0), hurtPart(-6.0, 104.0, -6.0, 104.0, 44.0), hurtPart(-33.0, 119.0, -33.0, 119.0, 41.0)]),
        heroHurtPose(9, 16, [hurtPart(-20.0, 39.0, -20.0, 39.0, 44.0), hurtPart(-6.0, 103.0, -6.0, 103.0, 44.0), hurtPart(-35.0, 116.0, -35.0, 116.0, 44.0)]),
        heroHurtPose(17, 24, [hurtPart(-10.0, 42.0, -10.0, 42.0, 44.0), hurtPart(16.0, 106.0, 8.0, 114.0, 44.0), hurtPart(-21.0, 116.0, -13.0, 116.0, 44.0)]),
        heroHurtPose(25, 32, [hurtPart(-12.0, 42.0, -12.0, 42.0, 44.0), hurtPart(16.0, 106.0, 8.0, 114.0, 44.0), hurtPart(-7.0, 131.0, -7.0, 131.0, 29.0)]),
        heroHurtPose(33, 40, [hurtPart(-4.0, 49.0, -12.0, 41.0, 52.0), hurtPart(11.0, 103.0, 3.0, 111.0, 44.0), hurtPart(-15.0, 129.0, -15.0, 129.0, 31.0)]),
        heroHurtPose(41, 48, [hurtPart(-14.0, 41.0, -14.0, 41.0, 44.0), hurtPart(-2.0, 109.0, -2.0, 109.0, 44.0), hurtPart(-22.0, 126.0, -22.0, 126.0, 34.0)]),
        heroHurtPose(49, 57, [hurtPart(-16.0, 40.0, -16.0, 40.0, 44.0), hurtPart(-5.0, 107.0, -5.0, 107.0, 44.0), hurtPart(-28.0, 122.0, -28.0, 122.0, 38.0)])
      ],
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(6, 3, 17, 0, [heroRegion(6, 8, claw(25.0, 60.0, 66.0, 60.0), anubarakHit(4.955040454864502, 35, 49.46205139160156, 18.0))])),
    [AttackStyle.jab2]: heroMove(8, 3, 20, 0, [heroRegion(8, 10, claw(28.0, 60.0, 80.0, 66.0), anubarakHit(7.432559967041016, 40, 67.44824981689453, 22.0))]),
    [AttackStyle.forwardTilt]: tilt(62.0, 40), [AttackStyle.forwardTiltUp]: tilt(95.0, 55), [AttackStyle.forwardTiltDown]: tilt(18.0, 25),
    [AttackStyle.upTilt]: heroMove(9, 5, 23, 0, [heroRegion(9, 13, claw(20.0, 85.0, 12.0, 155.0, 20.0), anubarakHit(12.38759994506836, 90, 64.75032043457031, 42.0))]),
    [AttackStyle.downTilt]: heroMove(8, 4, 20, 0, [heroRegion(8, 11, claw(30.0, 12.0, 120.0, 12.0), anubarakHit(9.910080909729004, 70, 58.45515060424805, 36.0))]),
    [AttackStyle.dashAttack]: heroMove(9, 12, 21, 0, [heroRegion(9, 20, claw(32.0, 44.0, 115.0, 50.0, 21.0), anubarakHit(14.865119934082031, 55))], 42.0, true),
    [AttackStyle.forwardSmash]: tipperMove(heroMove(20, 4, 34, 0, [heroRegion(20, 23, claw(32.0, 65.0, 153.0, 65.0, 18.0), anubarakHit(24.77519989013672, 40, 53.95859909057617, 36.0))]), 0.25),
    [AttackStyle.upSmash]: heroMove(17, 5, 49, 0, [heroRegion(17, 21, claw(-22.0, 104.0, 25.0, 172.0, 27.0), anubarakHit(22.297679901123047, 90, 98.92410278320312, 32.0))]),
    [AttackStyle.downSmash]: heroMove(16, 6, 32, 0, [
      heroRegion(16, 18, claw(28.0, 14.0, 134.0, 14.0, 18.0), anubarakHit(19.820161819458008, 25, 94.42755126953125, 32.0)),
      heroRegion(19, 21, claw(-28.0, 14.0, -134.0, 14.0, 18.0), anubarakHit(19.820161819458008, 25, 94.42755126953125, 32.0, true)),
    ]),
    [AttackStyle.neutralAir]: heroMove(10, 7, 24, 18, [heroRegion(10, 16, claw(-62.0, 64.0, 62.0, 64.0, 30.0), anubarakHit(12.38759994506836, 55))]),
    [AttackStyle.forwardAir]: heroMove(13, 4, 27, 20, [heroRegion(13, 16, claw(30.0, 66.0, 134.0, 60.0, 18.0), anubarakHit(16.103879928588867, 40, 89.93099975585938, 28.0))]),
    [AttackStyle.backAir]: heroMove(11, 4, 27, 20, [heroRegion(11, 14, claw(-30.0, 46.0, -128.0, 46.0, 20.0), anubarakHit(17.342639923095703, 35, 97.12548065185547, 32.0, true))]),
    [AttackStyle.upAir]: heroMove(9, 4, 23, 16, [heroRegion(9, 12, claw(-10.0, 112.0, 12.0, 160.0, 18.0), anubarakHit(12.38759994506836, 90, 76.44135284423828, 26.0))]),
    [AttackStyle.downAir]: heroMove(17, 4, 30, 24, [heroRegion(17, 20, claw(-36.0, 8.0, 28.0, 2.0, 22.0), { ...anubarakHit(18.58139991760254, 90, 89.93099975585938, 28.0), launchZ: -1.0 }, anubarakHit(18.58139991760254, 70, 89.93099975585938, 28.0))]),
    [AttackStyle.grab]: heroMove(10, 3, 25, 0, [heroRegion(10, 12, claw(28.0, 55.0, 80.0, 55.0), anubarakHit(0.0, 35, 0.0, 0.0))]),
    [AttackStyle.getupAttack]: heroMove(17, 5, 26, 0, [heroRegion(17, 21, claw(-95.0, 24.0, 95.0, 24.0, 20.0), anubarakHit(9.910080909729004, 35))]),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 24, 0, [heroRegion(17, 19, claw(24.0, 50.0, 112.0, 50.0), anubarakHit(9.910080909729004, 35))]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 1, totalFrames: 1, effect: anubarakHit(3.716279983520508, 35, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 16, totalFrames: 40, effect: anubarakHit(11.148839950561523, 40, 85.4344482421875, 30.0) },
    [GrabAction.throwBack]: { contactFrame: 19, totalFrames: 46, effect: anubarakHit(13.626359939575195, 40, 98.92410278320312, 34.0, true) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 36, effect: anubarakHit(9.910080909729004, 80, 98.92410278320312, 65.0, true) },
    [GrabAction.throwDown]: { contactFrame: 21, totalFrames: 48, effect: anubarakHit(8.671319961547852, 70, 35.9724006652832, 75.0) },
  },
};
