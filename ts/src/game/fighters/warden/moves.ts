import { downSmashHit } from "../../sim/downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { AttackStyle, GrabAction, HitElement, LAST_ATTACK_STYLE } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroMove, heroRegion, type AuthoredMove, type FighterMoves, type MoveRegion, type StrikeCapsule, jabStep, travelThrough } from "../../sim/heroMoves";
import { groundHit, swing, splitsMove, tipped, type GroundKit } from "../../sim/heroes/groundNormals";
import type { HitEffect } from "../../sim/hitRegions";
import { strongHit } from "../../sim/strongHits";
import { type FighterHurtboxes, type HurtPart, type HurtPose, hurtPart, hurtPose } from "../../sim/hurtboxes";
import { type Strike, linkAt, multiHit } from "../../sim/heroes/multiHit";
import { ANGLES, type Angle, capsuleOf, makeHit, path } from "../../sim/heroes/authoring";

const WD = HitElement.slash;
const wardenThrust = (angle: Angle) => groundHit(8.0, angle, 75.0, 18.0, WD);
export const WARDEN_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(2, 2, 11, 0, swing(2, [[18.0, 78.0, 103.0, 93.0], [18.0, 75.0, 118.0, 91.0]], 6.0, groundHit(3.0, 70, 40.0, 30.0, WD)))),
    [AttackStyle.jab2]: jabStep(heroMove(2, 2, 12, 0, swing(2, [[18.0, 88.0, 90.0, 129.0], [18.0, 83.0, 107.0, 130.0]], 6.0, groundHit(3.0, 70, 30.0, 26.0, WD)))),
    [AttackStyle.jab3]: heroMove(4, 3, 16, 0, swing(4, [[18.0, 74.0, 124.0, 94.0], [18.0, 73.0, 139.0, 90.0], [18.0, 73.0, 136.0, 89.0]], 6.0, groundHit(4.0, 40, 90.0, 22.0, WD))),
    [AttackStyle.forwardTilt]: heroMove(5, 3, 17, 0, swing(5, [[18.0, 72.0, 126.0, 95.0], [18.0, 71.0, 138.0, 91.0], [18.0, 70.0, 142.0, 87.0]], 6.0, wardenThrust(35))),
    [AttackStyle.forwardTiltUp]: heroMove(5, 3, 17, 0, swing(5, [[18.0, 98.0, 48.0, 187.0], [18.0, 94.0, 59.0, 191.0], [18.0, 93.0, 62.0, 193.0]], 6.0, wardenThrust(55))),
    [AttackStyle.forwardTiltDown]: heroMove(5, 3, 17, 0, swing(5, [[18.0, 40.0, 110.0, 10.0], [18.0, 38.0, 119.0, 4.0], [18.0, 36.0, 105.0, 0.0]], 6.0, wardenThrust(20))),
    [AttackStyle.upTilt]: heroMove(4, 4, 16, 0, swing(4, [[3.0, 126.0, -4.0, 185.0], [13.0, 129.0, 5.0, 187.0], [16.0, 130.0, -7.0, 183.0], [13.0, 129.0, -11.0, 182.0]], 12.0,
      groundHit(6.0, 90, 60.0, 32.0, WD))),
    [AttackStyle.downTilt]: heroMove(3, 2, 9, 0, swing(3, [[24.0, 22.0, 93.0, 10.0], [36.0, 17.0, 93.0, 9.0]], 12.0, groundHit(3.0, 0, 20.0, 32.0, WD))),
    [AttackStyle.dashAttack]: travelThrough(heroMove(5, 10, 21, 0, [...swing(5, [[7.0, 88.0, 65.0, 69.0], [18.0, 74.0, 101.0, 58.0], [18.0, 71.0, 127.0, 55.0]], 6.0,
      groundHit(7.0, 50, 70.0, 24.0, WD)), ...swing(8, [[18.0, 70.0, 133.0, 52.0], [18.0, 69.0, 136.0, 50.0], [18.0, 69.0, 136.0, 49.0], [18.0, 70.0, 133.0, 51.0], [18.0, 71.0, 129.0, 67.0], [18.0, 72.0, 124.0, 82.0], [18.0, 74.0, 116.0, 97.0]], 6.0,
      groundHit(5.0, 50, 60.0, 20.0, WD))], 179.0, true), 14),
  },
  reaches: {},
};


const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const GRAB = f32(HERO_REFERENCE_HEIGHT * f32(0.48));
const BLADE_RADIUS = 6.0;



export const wardenHit = makeHit({
  SLIDE: { growth: 8.0, base: 37.0 },
  LINK: { growth: 68.2369613647461, base: 12.0 },
  POKE: { growth: 93.05039978027344, base: 18.0 },
  LAUNCH: { growth: 117.86384582519531, base: 20.0 },
  EDGE: { growth: 124.06719970703125, base: 22.0 },
  KILL: { growth: 136.4739227294922, base: 26.0 },
  SPIKE: { growth: 124.06719970703125, base: 22.0 },

  JUGGLE: { growth: 68.2369613647461, base: 45.0 },
  CHASE: { growth: 49.62688064575195, base: 75.0 },
}, HitElement.slash);


const blade = capsuleOf(BLADE_RADIUS);


function throwMove(release: number, recovery: number, effect: Readonly<HitEffect>) {
  return { contactFrame: release, totalFrames: release + recovery, effect };
}

const FORWARD_AIR = wardenHit(7.6326799392700195, "EDGE", 40);
const BACK_AIR: HitEffect = { damage: 13.0, growth: 100.0, base: 10.0, launchX: f32(-0.9399999976158142), launchZ: f32(0.3400000035762787), electric: false, element: HitElement.normal };
const NEUTRAL_AIR_EFFECT = wardenHit(6.106143951416016, "SLIDE", 0);
const NEUTRAL_AIR: readonly MoveRegion[] = [
  ...swing(5, [[18.0, 72.0, 83.0, 44.0], [-4.0, 94.0, 38.0, 136.0], [-33.0, 67.0, -60.0, 120.0], [-18.0, 31.0, -77.0, 22.0], [18.0, 43.0, 15.0, -24.0]], BLADE_RADIUS, NEUTRAL_AIR_EFFECT),
  ...swing(5, [[93.0, 52.0, 83.0, 44.0], [83.0, 44.0, 38.0, 136.0], [38.0, 136.0, -60.0, 120.0], [-60.0, 120.0, -77.0, 22.0], [-77.0, 22.0, 15.0, -24.0]], BLADE_RADIUS, NEUTRAL_AIR_EFFECT),
];

const FORWARD_AIR_SLASH: readonly MoveRegion[] = [
  ...swing(8, [[2.0, 91.0, 30.0, 146.0], [18.0, 79.0, 75.0, 102.0], [4.0, 50.0, 18.0, -6.0]], BLADE_RADIUS, FORWARD_AIR),
  ...swing(8, [[19.0, 156.0, 30.0, 146.0], [30.0, 146.0, 75.0, 102.0], [75.0, 102.0, 18.0, -6.0]], BLADE_RADIUS, FORWARD_AIR),
];

const SKY_LIFT: readonly Strike[] = [
  [blade(0.0, 48.0, -8.0, 172.0, 10.0), linkAt(2.0, 8.0, 90, HitElement.normal)],
  [blade(16.0, 40.0, 0.0, 150.0, 10.0), linkAt(2.0, 8.0, 95, HitElement.normal)],
  [blade(-16.0, 40.0, -18.0, 150.0, 10.0), linkAt(2.0, 8.0, 85, HitElement.normal)],
];

const SKY_FINISH_EFFECT: HitEffect = { damage: 13.0, growth: 116.0, base: 40.0, launchX: ANGLES[85].x, launchZ: ANGLES[85].z, electric: false, element: HitElement.normal };
const SKY_FINISH: readonly Strike[] = SKY_LIFT.map(([strike]) => [strike, SKY_FINISH_EFFECT]);





const BODY_RADIUS = f32(24.0 * f32(0.90));
export const WARDEN_BODY: HurtPart = hurtPart(0.0, 4.0, 0.0, f32(f32(4.0 + 132.0) - f32(2.0 * BODY_RADIUS)), BODY_RADIUS);

const DRILL_PIVOT_Z = f32(f32(WARDEN_BODY.z1 + WARDEN_BODY.z2) * 0.5);
const DRILL_AXIS = { x: ANGLES[60].x, z: -ANGLES[60].z } as const;
const DRILL_FOOT = f32(f32(f32(WARDEN_BODY.z2 - WARDEN_BODY.z1) * 0.5) + BODY_RADIUS);
const DRILL_SPAN = 14.0;
const DRILL_RADIUS = 24.0;

function drillAlongAxis(air: { readonly centre: Readonly<HitEffect>; readonly front: Readonly<HitEffect>; readonly back: Readonly<HitEffect> }, ground: typeof air): readonly Strike[] {
  const at = (from: number, to: number): StrikeCapsule => ({
    x1: f32(DRILL_AXIS.x * from), z1: f32(DRILL_PIVOT_Z + f32(DRILL_AXIS.z * from)),
    x2: f32(DRILL_AXIS.x * to), z2: f32(DRILL_PIVOT_Z + f32(DRILL_AXIS.z * to)),
    radius: DRILL_RADIUS,
  });
  return [
    [at(f32(DRILL_FOOT - DRILL_SPAN), f32(DRILL_FOOT + DRILL_SPAN)), air.centre, ground.centre],
    [at(DRILL_FOOT, f32(DRILL_FOOT + f32(2.0 * DRILL_SPAN))), air.front, ground.front],
    [at(f32(DRILL_FOOT - f32(2.0 * DRILL_SPAN)), DRILL_FOOT), air.back, ground.back],
  ];
}

const knifeLinks = (damage: number, base: number) => ({ centre: linkAt(damage, base, 270), front: linkAt(damage, base, 250), back: linkAt(damage, base, 290) });
const fallingKnives = (damage: number, base: number) => drillAlongAxis(knifeLinks(damage, base), knifeLinks(damage, base));
const KNIFE_SPIKE = wardenHit(2.289803981781006, "SPIKE", 270);
const SPIKING_KNIVES = drillAlongAxis({ centre: KNIFE_SPIKE, front: KNIFE_SPIKE, back: KNIFE_SPIKE }, knifeLinks(2.289803981781006, 40.0));
const FALLING_KNIVES: AuthoredMove = {
  ...heroMove(7, 7, 14, 10, multiHit([
    { first: 7, last: 7, strikes: fallingKnives(1.526535987854004, 25.0) },
    { first: 9, last: 9, strikes: fallingKnives(1.526535987854004, 25.0) },
    { first: 11, last: 11, strikes: fallingKnives(1.526535987854004, 25.0) },
    { first: 13, last: 13, strikes: SPIKING_KNIVES },
  ])),
  fall: [{ firstFrame: 6, lastFrame: 12, speedZ: -9.0 }],
  autoCancel: { before: 5, from: 33 },
};
export interface DrawnGlaive { readonly frame: number; readonly elbowX: number; readonly elbowZ: number; readonly gripX: number; readonly gripZ: number; readonly ringX1: number; readonly ringZ1: number; readonly ringX2: number; readonly ringZ2: number }
const glaive = (frame: number, elbowX: number, elbowZ: number, gripX: number, gripZ: number, ringX1: number, ringZ1: number, ringX2: number, ringZ2: number): DrawnGlaive =>
  ({ frame, elbowX, elbowZ, gripX, gripZ, ringX1, ringZ1, ringX2, ringZ2 });

export const UP_SMASH_GLAIVE: readonly DrawnGlaive[] = [
  glaive(7, 18.0, 60.0, 35.0, 56.0, 42.0, 68.0, 63.0, 43.0), glaive(8, 11.0, 89.0, 24.0, 100.0, 19.0, 113.0, 52.0, 114.0),
  glaive(9, -4.0, 102.0, -2.0, 119.0, -15.0, 123.0, 5.0, 148.0), glaive(10, -15.0, 101.0, -20.0, 117.0, -34.0, 144.0, -33.0, 111.0),
  glaive(11, -22.0, 94.0, -35.0, 104.0, -61.0, 119.0, -42.0, 92.0), glaive(12, -23.0, 91.0, -36.0, 100.0, -64.0, 111.0, -42.0, 88.0),
  glaive(13, -22.0, 90.0, -38.0, 92.0, -68.0, 97.0, -41.0, 79.0), glaive(14, -23.0, 87.0, -39.0, 82.0, -69.0, 78.0, -38.0, 68.0),
  glaive(15, -24.0, 79.0, -40.0, 72.0, -68.0, 61.0, -35.0, 59.0), glaive(16, -25.0, 76.0, -40.0, 68.0, -67.0, 55.0, -34.0, 56.0),
];
export const UP_SMASH_CLEAN_LAST = 9;
const UP_SMASH_TOTAL = 41;
export const UP_SMASH_RING_RADIUS = 24.0;
const UP_SMASH_ARM_RADIUS = 10.0;
export const UP_SMASH_TIPPER: HitEffect = { damage: 18.0, growth: 112.0, base: 30.0, launchX: ANGLES[80].x, launchZ: ANGLES[80].z, electric: false, element: HitElement.slash };
const UP_SMASH_INNER: HitEffect = { damage: 15.0, growth: 100.0, base: 30.0, launchX: ANGLES[80].x, launchZ: ANGLES[80].z, electric: false, element: HitElement.slash };
const UP_SMASH_LATE: HitEffect = { damage: 13.0, growth: 100.0, base: 10.0, launchX: ANGLES[100].x, launchZ: ANGLES[100].z, electric: false, element: HitElement.slash };
const UP_SMASH_FIRST = UP_SMASH_GLAIVE[0]?.frame ?? 7;
const UP_SMASH_LAST = UP_SMASH_GLAIVE.at(-1)?.frame ?? 7;
const UP_SMASH: AuthoredMove = heroMove(UP_SMASH_FIRST, UP_SMASH_LAST - UP_SMASH_FIRST + 1, UP_SMASH_TOTAL - UP_SMASH_LAST, 0, UP_SMASH_GLAIVE.flatMap(g => {
  const ring = blade(g.ringX1, g.ringZ1, g.ringX2, g.ringZ2, UP_SMASH_RING_RADIUS), arm = blade(g.elbowX, g.elbowZ, g.gripX, g.gripZ, UP_SMASH_ARM_RADIUS);
  if (g.frame > UP_SMASH_CLEAN_LAST) return [heroRegion(g.frame, g.frame, ring, UP_SMASH_LATE), heroRegion(g.frame, g.frame, arm, UP_SMASH_LATE)];
  return [heroRegion(g.frame, g.frame, ring, strongHit(UP_SMASH_TIPPER)), heroRegion(g.frame, g.frame, arm, UP_SMASH_INNER)];
}));

const GRAB_EFFECT = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

/** Maiev is modelled on Fox (docs/design/maiev.md), so each aerial auto-cancels in Fox's window for the same aerial (references/melee-frame-data/fightcore.csv). */
const NORMALS: { readonly [style: number]: AuthoredMove | undefined } = {
    ...WARDEN_GROUND.normals,
    [AttackStyle.forwardSmash]: heroMove(15, 3, 30, 0, tipped(15, [[18.0, 69.0, 135.0, 85.0], [18.0, 68.0, 145.0, 79.0], [18.0, 68.0, 150.0, 75.0]], BLADE_RADIUS, 30.0, wardenHit(12.212287902832031, "KILL", 40), wardenHit(9.159215927124023, "KILL", 40))),
    [AttackStyle.upSmash]: UP_SMASH,
    [AttackStyle.downSmash]: splitsMove({
      firstActive: 6, active: 5, recovery: 35, chargeFrame: 1, hip: 10.0, reach: f32(S + 6.0), height: 10.0, radius: 13.0,
      front: { ...downSmashHit(wardenHit(12.0, "EDGE", 25)), element: HitElement.normal },
      back: { ...downSmashHit(wardenHit(12.0, "EDGE", 25, -1.0)), element: HitElement.normal },
    }),
    [AttackStyle.neutralAir]: { ...heroMove(5, 5, 18, 7, NEUTRAL_AIR), autoCancel: { before: 4, from: 36 } },
    [AttackStyle.forwardAir]: { ...heroMove(8, 3, 20, 12, FORWARD_AIR_SLASH), autoCancel: { before: 6, from: 48 } },

    [AttackStyle.backAir]: { ...heroMove(4, 16, 18, 8, [heroRegion(4, 19, blade(-38.0, 66.0, -76.0, 75.0, 13.0), BACK_AIR)]), autoCancel: { before: 4, from: 28 } },

    [AttackStyle.upAir]: { ...heroMove(5, 10, 14, 7, multiHit([
      { first: 5, last: 6, strikes: SKY_LIFT },
      { first: 8, last: 9, strikes: SKY_LIFT },
      { first: 11, last: 14, strikes: SKY_FINISH },
    ])), autoCancel: { before: 8, from: 25 } },
    [AttackStyle.downAir]: FALLING_KNIVES,
    [AttackStyle.grab]: heroMove(6, 2, 23, 0, [heroRegion(6, 7,
      blade(16.0, 45.0, f32(GRAB - 10.0), 45.0, 10.0), GRAB_EFFECT)]),
};





const SHOULDER_Z = 70.0;
const LIMB_RADIUS = 7.0;
const LIMB_LEAD_FRAMES = 2;
const LIMB_HOLD_FRAMES = 4;
const LIMB_POSE_FRAMES = 3;

interface Point {
  readonly x: number;
  readonly z: number;
}


function handOf(strike: StrikeCapsule): Point {
  const near = (x: number, z: number) => f32(f32(x * x) + f32(f32(z - SHOULDER_Z) * f32(z - SHOULDER_Z)));
  return near(strike.x1, strike.z1) <= near(strike.x2, strike.z2) ? { x: strike.x1, z: strike.z1 } : { x: strike.x2, z: strike.z2 };
}


function handAt(move: AuthoredMove, frame: number, reachEnd: boolean): Point | undefined {
  let hand: Point | undefined;
  for (const region of move.regions) {
    const strike = region.hit.strike;
    if (strike === undefined || frame < region.firstFrame || frame > region.lastFrame) continue;

    const candidate = reachEnd ? { x: strike.x2, z: strike.z2 } : handOf(strike);
    if (hand === undefined || Math.abs(candidate.x) < Math.abs(hand.x)) hand = candidate;
  }
  return hand;
}






function limbPoses(move: AuthoredMove | undefined, reachEnd: boolean): readonly HurtPose[] {
  if (move === undefined) return [];
  let first = Number.MAX_SAFE_INTEGER;
  let last = -1;
  for (const region of move.regions) {
    first = Math.min(first, region.firstFrame);
    last = Math.max(last, region.lastFrame);
  }
  const poses: HurtPose[] = [];
  const from = Math.max(0, first - LIMB_LEAD_FRAMES);
  const through = last + LIMB_HOLD_FRAMES;
  for (let poseStart = from; poseStart <= through; poseStart += LIMB_POSE_FRAMES) {
    const poseEnd = through - poseStart < 2 * LIMB_POSE_FRAMES ? through : poseStart + LIMB_POSE_FRAMES - 1;
    const middle = Math.min(last, Math.max(first, floorDiv(poseStart + poseEnd, 2)));
    const hand = handAt(move, middle, reachEnd);
    if (hand !== undefined) poses.push(hurtPose(poseStart, poseEnd, [WARDEN_BODY, hurtPart(0.0, SHOULDER_Z, hand.x, hand.z, LIMB_RADIUS)]));
    if (poseEnd === through) break;
  }
  return poses;
}

function wardenHurtboxes(): FighterHurtboxes {
  const attacks: { [style: number]: readonly HurtPose[] | undefined } = {};
  for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
    if (NORMALS[style] === undefined) continue;

    attacks[style] = limbPoses(NORMALS[style], style === AttackStyle.grab);
  }
  return { stand: [WARDEN_BODY], attacks };
}

export const WARDEN_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  normals: NORMALS,
  hurtboxes: wardenHurtboxes(),
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: throwMove(10, 23, { ...wardenHit(4.0, "EDGE", 40), growth: 80.0, base: 70.0 }),
    [GrabAction.throwBack]: throwMove(15, 23, { ...wardenHit(4.0, "EDGE", 45, -1.0), growth: 70.0, base: 72.0 }),
    [GrabAction.throwUp]: throwMove(11, 9, { ...wardenHit(3.8163399696350098, "JUGGLE", 85), growth: 100.0, base: 70.0 }),
    [GrabAction.throwDown]: throwMove(14, 29, { ...wardenHit(3.0, "CHASE", 70), growth: 100.0, base: 0.0, setKnockback: 90.0 }),
  },
};
