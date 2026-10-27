import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { heroHurtPose, heroMove, heroRegion, jabStep, strongRegion, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../../sim/heroMoves";
import type { HitEffect } from "../../sim/hitRegions";
import { hurtPart, type HurtPart } from "../../sim/hurtboxes";

const STRENGTH = {
  link: { growth: 66.65438842773438, base: 12.0 }, poke: { growth: 90.89234161376953, base: 18.0 },
  launch: { growth: 84.83285522460938, base: 42.0 }, edge: { growth: 115.13031005859375, base: 22.0 },
  kill: { growth: 121.1897964477539, base: 24.0 }, juggle: { growth: 62.88150405883789, base: 50.0 },
  chase: { growth: 48.475921630859375, base: 75.0 },
  stompFront: { growth: 100.0, base: 30.0 }, stompRear: { growth: 100.0, base: 20.0 },
  stompMeteor: { growth: 100.0, base: 40.0 }, stompLate: { growth: 80.0, base: 20.0 },
} as const;
const DIRECTIONS = {
  25: [f32(0.906307787), f32(0.422618262)], 35: [f32(0.819152044), f32(0.573576436)],
  40: [f32(0.766044443), f32(0.642787610)], 50: [f32(0.642787610), f32(0.766044443)],
  55: [f32(0.573576436), f32(0.819152044)], 70: [f32(0.342020143), f32(0.939692621)],
  80: [f32(0.173648178), f32(0.984807753)], 85: [f32(0.087155743), f32(0.996194698)],
  270: [0.0, -1.0],
} as const;
export function cairneHit(damage: number, strength: keyof typeof STRENGTH, angle: keyof typeof DIRECTIONS, direction = 1): Readonly<HitEffect> {
  const vector = DIRECTIONS[angle];
  return { damage, ...STRENGTH[strength], launchX: f32(vector[0] * direction), launchZ: vector[1], electric: false, element: HitElement.normal };
}
export const cairneCapsule = (x1: number, z1: number, x2: number, z2: number, radius = 14.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const c = cairneCapsule;
type AxePath = readonly (readonly [number, number, number, number])[];
const strike = (first: number, last: number, shape: StrikeCapsule, damage: number, strength: keyof typeof STRENGTH, angle: keyof typeof DIRECTIONS, direction = 1): MoveRegion =>
  heroRegion(first, last, shape, cairneHit(damage, strength, angle, direction));
const along = (first: number, path: AxePath, damage: number, strength: keyof typeof STRENGTH, angle: keyof typeof DIRECTIONS, direction = 1, radius = 14.0): MoveRegion[] =>
  path.map(([x1, z1, x2, z2], i) => strike(first + i, first + i, c(x1, z1, x2, z2, radius), damage, strength, angle, direction));
const BODY = hurtCapsule(Character.cairne);
const half = (part: HurtPart): HurtPart => ({ ...part, x2: f32(f32(part.x1 + part.x2) * 0.5), z2: f32(f32(part.z1 + part.z2) * 0.5) });
export const cairneHurtPose = (first: number, last: number, part: HurtPart) => [
  heroHurtPose(first - 3, first - 1, [BODY, half(part)]),
  heroHurtPose(first, last, [BODY, part]),
  heroHurtPose(last + 1, last + 3, [BODY, half(part)]),
];
const pose = cairneHurtPose;
const pairedPose = (first: number, turn: number, last: number, front: HurtPart, back: HurtPart) => [
  heroHurtPose(first - 3, first - 1, [BODY, half(front)]),
  heroHurtPose(first, turn - 1, [BODY, front]),
  heroHurtPose(turn, turn + 2, [BODY, half(front), half(back)]),
  heroHurtPose(turn + 3, last, [BODY, back]),
  heroHurtPose(last + 1, last + 3, [BODY, half(back)]),
];
const arm = (x: number, z: number) => hurtPart(20.0, 90.0, x, z, 18.0);
const forwardTilt = (path: AxePath) => heroMove(14, 4, 29, 0, along(14, path, 10.473372459411621, "edge", 40));
const FORWARD_SMASH: AxePath = [[162.0, 154.0, 232.0, 161.0], [178.0, 119.0, 246.0, 105.0], [182.0, 81.0, 242.0, 48.0], [181.0, 44.0, 235.0, 0.0]];
export const NO_LAUNCH = { growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

export const CAIRNE_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [BODY],
    attacks: {
      [AttackStyle.jab]: pose(5, 11, arm(80.0, 76.0)),
      [AttackStyle.jab2]: pose(7, 13, arm(86.0, 72.0)),
      [AttackStyle.forwardTilt]: pose(12, 19, arm(86.0, 95.0)),
      [AttackStyle.forwardTiltUp]: pose(12, 19, arm(86.0, 95.0)),
      [AttackStyle.forwardTiltDown]: pose(12, 19, arm(86.0, 95.0)),
      [AttackStyle.upTilt]: pose(11, 19, arm(25.0, 162.0)),
      [AttackStyle.downTilt]: pose(9, 15, arm(80.0, 28.0)),
      [AttackStyle.dashAttack]: pose(10, 19, hurtPart(15.0, 60.0, 95.0, 75.0, 34.0)),
      [AttackStyle.forwardSmash]: pose(28, 36, arm(95.0, 100.0)),
      [AttackStyle.upSmash]: pose(23, 32, arm(15.0, 178.0)),
      [AttackStyle.downSmash]: pairedPose(19, 26, 32, arm(85.0, 25.0), arm(-85.0, 25.0)),
      [AttackStyle.neutralAir]: pairedPose(10, 13, 21, arm(82.0, 100.0), arm(-82.0, 100.0)),
      [AttackStyle.forwardAir]: pose(18, 26, arm(90.0, 90.0)),
      [AttackStyle.backAir]: pose(13, 20, arm(-86.0, 80.0)),
      [AttackStyle.upAir]: pose(10, 18, hurtPart(0.0, 120.0, 0.0, 188.0, 22.0)),
      [AttackStyle.downAir]: pose(14, 20, arm(10.0, 15.0)),
      [AttackStyle.grab]: pose(8, 15, arm(96.0, 62.0)),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(7, 3, 18, 0, [strike(7, 9, c(102.0, 71.0, 150.0, 26.0), 4.028219699859619, "link", 35)])),
    [AttackStyle.jab2]: heroMove(9, 3, 23, 0, [strike(9, 11, c(117.0, 78.0, 186.0, 71.0), 6.445152282714844, "poke", 40)]),
    [AttackStyle.forwardTilt]: forwardTilt([[104.0, 153.0, 176.0, 152.0], [120.0, 116.0, 189.0, 97.0], [126.0, 76.0, 186.0, 41.0], [81.0, 3.0, 94.0, -66.0]]),
    [AttackStyle.forwardTiltUp]: forwardTilt([[103.0, 153.0, 175.0, 148.0], [117.0, 119.0, 186.0, 99.0], [124.0, 83.0, 184.0, 50.0], [80.0, 12.0, 94.0, -54.0]]),
    [AttackStyle.forwardTiltDown]: forwardTilt([[107.0, 150.0, 179.0, 149.0], [122.0, 114.0, 191.0, 97.0], [127.0, 76.0, 189.0, 44.0], [82.0, -3.0, 95.0, -71.0]]),
    [AttackStyle.upTilt]: heroMove(13, 5, 27, 0, along(13, [[88.0, 166.0, 159.0, 174.0], [54.0, 195.0, -81.0, 133.0], [15.0, 208.0, -84.0, 97.0], [-42.0, 198.0, -58.0, 50.0], [-78.0, 169.0, -12.0, 35.0]], 9.66772747039795, "launch", 85)),
    [AttackStyle.downTilt]: heroMove(11, 3, 25, 0, [strike(11, 13, c(107.0, 20.0, 174.0, 0.0), 8.056439399719238, "launch", 70)]),
    [AttackStyle.dashAttack]: heroMove(10, 10, 26, 0, along(10, [[-66.0, 67.0, 24.0, 17.0], [-42.0, 69.0, 36.0, 23.0], [-16.0, 69.0, -68.0, 46.0], [2.0, 67.0, -45.0, 42.0], [7.0, 67.0, -39.0, 42.0], [14.0, 66.0, -30.0, 41.0], [22.0, 66.0, -21.0, 40.0], [30.0, 66.0, -12.0, 39.0], [33.0, 66.0, -8.0, 39.0], [28.0, 65.0, -14.0, 36.0]], 11.25, "kill", 40, 1, 32.0), 32.0, true),
    [AttackStyle.forwardSmash]: heroMove(30, 4, 43, 0, [
      ...FORWARD_SMASH.map(([x1, z1, x2, z2], i) => strongRegion(strike(30 + i, 30 + i, c(f32((x1 + x2) * 0.5), f32((z1 + z2) * 0.5), x2, z2, 15.0), 20.14109992980957, "kill", 40))),
      ...along(30, FORWARD_SMASH.map(([x1, z1, x2, z2]) => [x1, z1, f32((x1 + x2) * 0.5), f32((z1 + z2) * 0.5)] as const), 15.307236671447754, "kill", 40),
    ]),
    [AttackStyle.upSmash]: heroMove(25, 5, 39, 0, along(25, [[-4.0, 226.0, -80.0, 98.0], [-4.0, 229.0, -82.0, 105.0], [-6.0, 230.0, -79.0, 110.0], [-11.0, 228.0, -75.0, 116.0], [-18.0, 225.0, -71.0, 121.0]], 18.52981185913086, "kill", 85, 1, 20.0)),
    [AttackStyle.downSmash]: heroMove(19, 14, 13, 0, [
      ...along(19, [[118.0, 36.0, 165.0, -14.0], [112.0, 28.0, 172.0, -7.0], [86.0, 19.0, 132.0, -31.0], [43.0, 14.0, 68.0, -50.0]], 18.0, "stompFront", 80, 1, 18.0),
      ...along(29, [[-111.0, 30.0, -177.0, 5.0], [-114.0, 26.0, -180.0, 2.0], [-116.0, 23.0, -183.0, -1.0], [-119.0, 20.0, -185.0, -3.0]], 16.0, "stompRear", 80, -1, 18.0),
    ]),
    [AttackStyle.neutralAir]: heroMove(12, 7, 29, 22, [
      ...along(12, [[75.0, 120.0, 75.0, 120.0], [75.0, 120.0, 52.0, 154.0], [52.0, 154.0, 15.0, 168.0], [15.0, 168.0, -20.0, 158.0], [-20.0, 158.0, -54.0, 131.0]], 10.473372459411621, "poke", 50, 1, 20.0),
      ...along(17, [[-54.0, 131.0, -67.0, 84.0], [-67.0, 84.0, -65.0, 87.0]], 10.473372459411621, "poke", 50, -1, 20.0),
    ]),
    [AttackStyle.forwardAir]: heroMove(20, 4, 36, 26, along(20, [[94.0, 155.0, 167.0, 153.0], [109.0, 105.0, 176.0, 80.0], [106.0, 51.0, 161.0, 9.0], [93.0, 16.0, 134.0, -39.0]], 15.307236671447754, "kill", 40)),
    [AttackStyle.backAir]: heroMove(15, 4, 30, 22, along(15, [[-119.0, 108.0, 10.0, 33.0], [-121.0, 90.0, 18.0, 37.0], [-121.0, 71.0, 24.0, 36.0], [-116.0, 52.0, 30.0, 41.0]], 12.890304565429688, "edge", 40, -1)),
    [AttackStyle.upAir]: heroMove(12, 4, 28, 20, [strike(12, 15, c(-89.0, 63.0, 48.0, 96.0, 20.0), 10.473372459411621, "launch", 85)]),
    [AttackStyle.downAir]: heroMove(14, 7, 39, 28, [
      ...([[25.0, -32.0, 36.0, -104.0], [29.0, -48.0, 31.0, -121.0], [33.0, -54.0, 34.0, -127.0]] as const).map(([x1, z1, x2, z2], i) =>
        heroRegion(14 + i, 14 + i, c(x1, z1, x2, z2, 20.0), cairneHit(18.0, "stompMeteor", 270), cairneHit(18.0, "stompMeteor", 55))),
      ...along(17, [[34.0, -57.0, 33.0, -130.0], [33.0, -57.0, 27.0, -131.0], [31.0, -54.0, 67.0, 90.0], [41.0, -13.0, 41.0, -13.0]], 12.0, "stompLate", 55, 1, 18.0),
    ]),
    [AttackStyle.grab]: heroMove(10, 3, 31, 0, [heroRegion(10, 12, c(30.0, 65.0, 98.0, 60.0), { damage: 0.0, ...NO_LAUNCH })]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 19, totalFrames: 45, effect: { ...cairneHit(8.86208438873291, "edge", 35), growth: 62.0, base: 61.0 } },
    [GrabAction.throwBack]: { contactFrame: 23, totalFrames: 54, effect: { ...cairneHit(10.473372459411621, "kill", 40, -1), growth: 97.5, base: 55.0 } },
    [GrabAction.throwUp]: { contactFrame: 21, totalFrames: 32, effect: cairneHit(8.756999015808105, "juggle", 85) },
    [GrabAction.throwDown]: { contactFrame: 24, totalFrames: 51, effect: { ...cairneHit(7.250796318054199, "chase", 80), growth: 100.0, base: 0.0, setKnockback: 90.0 } },
  },
};
