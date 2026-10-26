import { downSmashHit } from "../../sim/downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement, LAST_ATTACK_STYLE } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroMove, type AuthoredMove, type FighterMoves, type MoveRegion, type StrikeCapsule, cleanLateMove, jabStep, travelThrough } from "../../sim/heroMoves";
import { type FighterHurtboxes, type HurtPart, type HurtPose, hurtPart, hurtPose } from "../../sim/hurtboxes";
import { groundHit, swing, type GroundKit, type Segment } from "../../sim/heroes/groundNormals";
import type { HitEffect } from "../../sim/hitRegions";
import { type Strike, linkAt, multiHit } from "../../sim/heroes/multiHit";
import { type Angle, capsuleOf, makeHit, path } from "../../sim/heroes/authoring";

const DL = HitElement.slash;
const groundRake = (ends: readonly (readonly [number, number, number])[], angle: Angle) =>
  swing(8, ends.map(([z1, x, z]): Segment => [18.0, z1, x, z]), 10.0, groundHit(10.860000610351562, angle, 90.5, 22.0, DL));
export const DREADLORD_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 3, 14, 0, swing(4, [[18.0, 46.0, 69.0, 46.0], [18.0, 46.0, 69.0, 42.0], [18.0, 46.0, 64.0, 40.0]], 10.0, groundHit(3.620000123977661, 40, 45.25, 25.0, DL)))),
    [AttackStyle.jab2]: jabStep(heroMove(4, 2, 14, 0, swing(4, [[18.0, 50.0, 70.0, 48.0], [18.0, 48.0, 70.0, 44.0]], 10.0, groundHit(2.7150001525878906, 60, 27.150001525878906, 28.0, DL)))),
    [AttackStyle.jab3]: heroMove(6, 3, 20, 0, swing(6, [[18.0, 40.0, 84.0, 44.0], [18.0, 40.0, 88.0, 40.0], [18.0, 40.0, 82.0, 36.0]], 10.0, groundHit(5.430000305175781, 35, 90.5, 22.0, DL))),
    [AttackStyle.forwardTilt]: heroMove(8, 3, 21, 0, groundRake([[46.0, 115.0, 60.0], [46.0, 115.0, 46.0], [46.0, 105.0, 32.0]], 35)),
    [AttackStyle.forwardTiltUp]: heroMove(8, 3, 21, 0, groundRake([[50.0, 100.0, 98.0], [50.0, 110.0, 88.0], [50.0, 100.0, 78.0]], 55)),
    [AttackStyle.forwardTiltDown]: heroMove(8, 3, 21, 0, groundRake([[40.0, 110.0, 16.0], [40.0, 115.0, 4.0], [36.0, 100.0, -6.0]], 20)),
    [AttackStyle.upTilt]: heroMove(7, 4, 20, 0, swing(7, [[18.0, 60.0, 60.0, 80.0], [10.0, 68.0, 30.0, 93.0], [0.0, 70.0, -30.0, 93.0], [-12.0, 65.0, -80.0, 80.0]], 12.0,
      groundHit(8.145000457763672, 90, 81.45000457763672, 25.0, DL))),
    [AttackStyle.downTilt]: heroMove(6, 3, 18, 0, swing(6, [[16.0, 12.0, 95.0, 12.0], [16.0, 10.0, 95.0, 6.0], [16.0, 8.0, 80.0, 2.0]], 10.0, groundHit(5.430000305175781, 180, 27.150001525878906, 30.0, DL))),

    [AttackStyle.dashAttack]: travelThrough(heroMove(7, 8, 24, 0, [
      ...swing(7, [[16.0, 40.0, 90.0, 46.0], [16.0, 40.0, 90.0, 40.0], [16.0, 40.0, 90.0, 40.0], [16.0, 40.0, 90.0, 40.0]], 10.0, groundHit(8.145000457763672, 60, 81.45000457763672, 22.0, DL)),
      ...swing(11, [[-16.0, 40.0, -90.0, 46.0], [-16.0, 40.0, -90.0, 40.0], [-16.0, 40.0, -90.0, 40.0], [-16.0, 40.0, -90.0, 40.0]], 10.0, groundHit(8.145000457763672, 60, 81.45000457763672, 22.0, DL, true)),
    ], 179.0), 14),
  },
  reaches: {},
};



const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const GRAB = f32(HERO_REFERENCE_HEIGHT * f32(0.65));
const CLAW_RADIUS = 10.0;
const WING_RADIUS = 12.0;
const DRAWN_FRONT = 76.0;
const DRAWN_BACK = 38.0;



export const dreadlordHit = makeHit({
  LINK: { growth: 43.249088287353516, base: 12.0 },
  POKE: { growth: 58.97602844238281, base: 18.0 },
  LAUNCH: { growth: 82.56643676757812, base: 20.0 },
  EDGE: { growth: 86.49817657470703, base: 22.0 },
  KILL: { growth: 94.36164093017578, base: 28.0 },
  SPIKE: { growth: 78.63470458984375, base: 22.0 },

  JUGGLE: { growth: 48.753517150878906, base: 50.0 },
  CHASE: { growth: 31.45388412475586, base: 75.0 },
}, HitElement.slash);

const capsule = capsuleOf(CLAW_RADIUS);

const BATWING_DRAG: readonly Strike[] = [
  [capsule(16.0, 30.0, DRAWN_FRONT, 50.0, WING_RADIUS), linkAt(3.0, 28.0, 100)],
  [capsule(0.0, 65.0, 0.0, f32(M - WING_RADIUS), WING_RADIUS), linkAt(3.0, 28.0, 90)],
  [capsule(-16.0, 30.0, -DRAWN_BACK, 50.0, WING_RADIUS), linkAt(3.0, 28.0, 80)],
];





function rake(first: number, heights: readonly number[], reach: number, effect: Readonly<HitEffect>, facing = 1.0): readonly MoveRegion[] {
  return path(first, heights.map(height => capsule(f32(18.0 * facing), 46.0, f32(f32(reach - CLAW_RADIUS) * facing), height)), effect);
}

function wingSweep(first: number, facing: number): readonly MoveRegion[] {
  return path(first, [
    capsule(f32(16.0 * facing), 24.0, f32(f32(L - WING_RADIUS) * facing), 22.0, WING_RADIUS),
    capsule(f32(16.0 * facing), 20.0, f32(f32(L - WING_RADIUS) * facing), 12.0, WING_RADIUS),
    capsule(f32(16.0 * facing), 16.0, f32(f32(L - WING_RADIUS) * facing), 2.0, WING_RADIUS),
  ], downSmashHit(dreadlordHit(12.670000076293945, "EDGE", 25, facing)));
}

const NO_LAUNCH = { growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

const NORMALS: { readonly [style: number]: AuthoredMove | undefined } = {
    ...DREADLORD_GROUND.normals,
    [AttackStyle.forwardSmash]: heroMove(18, 4, 34, 0, [
      ...rake(18, [70.0, 58.0, 46.0, 34.0], L, dreadlordHit(20.298521041870117, "KILL", 40)),
      ...rake(18, [22.0, 34.0, 46.0, 58.0], L, dreadlordHit(20.298521041870117, "KILL", 40)),
    ]),
    [AttackStyle.upSmash]: heroMove(16, 5, 37, 0, path(16, [
      capsule(20.0, 58.0, 70.0, 95.0, WING_RADIUS),
      capsule(12.0, 68.0, 38.0, 125.0, WING_RADIUS),
      capsule(0.0, 75.0, 0.0, f32(L - WING_RADIUS), WING_RADIUS),
      capsule(-12.0, 68.0, -38.0, 125.0, WING_RADIUS),
      capsule(-20.0, 58.0, -70.0, 95.0, WING_RADIUS),
    ], dreadlordHit(18.043128967285156, "KILL", 85))),
    [AttackStyle.downSmash]: heroMove(15, 6, 20, 0, [...wingSweep(15, 1.0), ...wingSweep(18, -1.0)]),


    [AttackStyle.neutralAir]: heroMove(7, 10, 19, 11, multiHit([
      { first: 7, last: 8, strikes: BATWING_DRAG },
      { first: 10, last: 11, strikes: BATWING_DRAG },
      { first: 14, last: 16, strikes: [
        [capsule(16.0, 30.0, DRAWN_FRONT, 45.0, WING_RADIUS), dreadlordHit(7.893868446350098, "POKE", 50)],
        [capsule(0.0, 65.0, 0.0, f32(M - WING_RADIUS), WING_RADIUS), dreadlordHit(7.893868446350098, "POKE", 50)],
        [capsule(-16.0, 30.0, -DRAWN_BACK, 45.0, WING_RADIUS), dreadlordHit(7.893868446350098, "POKE", 50, -1.0)],
      ] },
    ])),
    [AttackStyle.forwardAir]: heroMove(10, 4, 24, 11, rake(10, [88.0, 72.0, 56.0, 40.0], 95.0,dreadlordHit(15.787736892700195, "EDGE", 40))),
    [AttackStyle.backAir]: cleanLateMove(heroMove(9, 4, 25, 11, path(9, [
      capsule(-16.0, 54.0, -76.0, 100.0, WING_RADIUS),
      capsule(-16.0, 46.0, -76.0, 88.0, WING_RADIUS),
      capsule(-16.0, 38.0, -76.0, 76.0, WING_RADIUS),
      capsule(-16.0, 30.0, -76.0, 64.0, WING_RADIUS),
    ], dreadlordHit(16.915433883666992, "KILL", 35, -1.0))), 1),
    [AttackStyle.upAir]: heroMove(7, 3, 21, 12, path(7, [
      capsule(0.0, 68.0, 8.0, f32(M - 12.0), 12.0),
      capsule(0.0, 68.0, 0.0, f32(M - 12.0), 12.0),
      capsule(0.0, 68.0, -8.0, f32(M - 12.0), 12.0),
    ], dreadlordHit(9.021564483642578, "LAUNCH", 85))),
    [AttackStyle.downAir]: heroMove(14, 4, 29, 20, path(14, [
      capsule(-4.0, 40.0, -16.0, 0.0),
      capsule(-8.0, 40.0, -20.0, 0.0),
      capsule(-12.0, 40.0, -24.0, 0.0),
      capsule(-16.0, 40.0, -28.0, 0.0),
    ], dreadlordHit(13.532346725463867, "SPIKE", 270), dreadlordHit(13.532346725463867, "SPIKE", 55))),
    [AttackStyle.grab]: heroMove(7, 3, 26, 0, path(7, [
      capsule(14.0, 35.0, f32(GRAB - 12.0), 40.0, 12.0),
      capsule(14.0, 35.0, f32(GRAB - 12.0), 35.0, 12.0),
      capsule(14.0, 35.0, f32(GRAB - 12.0), 30.0, 12.0),
    ], { damage: 0.0, ...NO_LAUNCH })),
};



const TORSO = hurtPart(0.0, 4.0, 0.0, 103.0, 27.0);
const FOLDED_WINGS = hurtPart(-18.0, 70.0, -30.0, 135.0, 16.0);
export const DREADLORD_STAND: readonly HurtPart[] = [TORSO, FOLDED_WINGS,
  hurtPart(-35.0, 65.0, -50.0, 110.0, 22.0),
  hurtPart(-53.0, 90.0, -53.0, 105.0, 21.0),
  hurtPart(25.0, 65.0, 35.0, 110.0, 22.0),
];

const LIMB_INSET = 2.0;

const BODY_STEP = 55.0;

const POSE_FRAMES = 3;

interface Extent { front: number; back: number; top: number; bottom: number }

function extent(parts: readonly HurtPart[]): Extent {
  const out = { front: -1.0e9, back: 1.0e9, top: -1.0e9, bottom: 1.0e9 };
  for (const p of parts) {
    out.front = Math.max(out.front, f32(Math.max(p.x1, p.x2) + p.radius));
    out.back = Math.min(out.back, f32(Math.min(p.x1, p.x2) - p.radius));
    out.top = Math.max(out.top, f32(Math.max(p.z1, p.z2) + p.radius));
    out.bottom = Math.min(out.bottom, f32(Math.min(p.z1, p.z2) - p.radius));
  }
  return out;
}

function smallStep(a: readonly HurtPart[], b: readonly HurtPart[]): boolean {
  const x = extent(a);
  const y = extent(b);
  return Math.abs(f32(x.front - y.front)) <= BODY_STEP && Math.abs(f32(x.back - y.back)) <= BODY_STEP
    && Math.abs(f32(x.top - y.top)) <= BODY_STEP && Math.abs(f32(x.bottom - y.bottom)) <= BODY_STEP;
}

const torsoZ = (z: number): number => Math.min(Math.max(z, TORSO.z1), TORSO.z2);
const toward = (from: number, to: number, t: number): number => f32(from + f32(f32(to - from) * t));


function drawnOut(strike: Readonly<StrikeCapsule>, t: number): HurtPart {
  return hurtPart(toward(0.0, strike.x1, t), toward(torsoZ(strike.z1), strike.z1, t),
    toward(0.0, strike.x2, t), toward(torsoZ(strike.z2), strike.z2, t), f32(strike.radius - LIMB_INSET));
}










export function dreadlordLimbPoses(regions: readonly MoveRegion[], totalFrames: number, offset = 0): readonly HurtPose[] {
  let first = totalFrames;
  let last = -1;
  for (const region of regions) {
    first = Math.min(first, region.firstFrame);
    last = Math.max(last, region.lastFrame);
  }
  const strikes: StrikeCapsule[] = [];
  for (const region of regions) if (region.hit.strike !== undefined) strikes.push(region.hit.strike);
  const posed = (t: number): readonly HurtPart[] => [...DREADLORD_STAND, ...strikes.map(strike => drawnOut(strike, t))];
  let steps = 1;
  for (;;) {
    let ok = true;
    for (let k = 0; k < steps && ok; k++) ok = smallStep(k === 0 ? DREADLORD_STAND : posed(f32(k / steps)), posed(f32((k + 1) / steps)));
    if (ok) break;
    steps++;
  }
  const lastFrame = totalFrames - 1;
  let peakFirst = Math.max(0, first - 1);
  const peakLast = Math.min(lastFrame, last + 2);
  if (peakLast - peakFirst + 1 < POSE_FRAMES) peakFirst = peakLast - POSE_FRAMES + 1;
  const poses: HurtPose[] = [hurtPose(peakFirst + offset, peakLast + offset, posed(1.0))];
  for (let k = steps - 1; k >= 1; k--) {
    const end = peakFirst - (steps - 1 - k) * POSE_FRAMES - 1;
    const begin = peakLast + (steps - k - 1) * POSE_FRAMES + 1;
    if (end - POSE_FRAMES + 1 < 0 || begin + POSE_FRAMES - 1 > lastFrame) throw new Error("Dreadlord limb ramp does not fit its move");
    const parts = posed(f32(k / steps));
    poses.unshift(hurtPose(end - POSE_FRAMES + 1 + offset, end + offset, parts));
    poses.push(hurtPose(begin + offset, begin + POSE_FRAMES - 1 + offset, parts));
  }
  return poses;
}

const FORWARD_TILT_UP_BODY: readonly HurtPose[] = [
  hurtPose(0, 2, [hurtPart(-11.0, 27.0, 4.0, 33.0, 51.0), hurtPart(1.0, 102.0, 1.0, 99.0, 45.0), hurtPart(-6.0, 151.0, -6.0, 151.0, 6.0), hurtPart(4.0, 33.0, 1.0, 102.0, 8.0), hurtPart(1.0, 99.0, -6.0, 151.0, 8.0)]),
  hurtPose(3, 5, [hurtPart(5.0, 18.0, 5.0, 18.0, 45.0), hurtPart(26.0, 79.0, 26.0, 79.0, 45.0), hurtPart(30.0, 127.0, 30.0, 127.0, 21.0), hurtPart(5.0, 18.0, 26.0, 79.0, 8.0), hurtPart(26.0, 79.0, 30.0, 127.0, 8.0)]),
  hurtPose(6, 8, [hurtPart(2.0, 58.0, 2.0, 58.0, 45.0), hurtPart(-4.0, 139.0, -4.0, 139.0, 45.0), hurtPart(-9.0, 178.0, -9.0, 178.0, 25.0), hurtPart(2.0, 58.0, -4.0, 139.0, 8.0), hurtPart(-4.0, 139.0, -9.0, 178.0, 8.0)]),
  hurtPose(9, 11, [hurtPart(-54.0, 97.0, -42.0, 91.0, 39.0), hurtPart(-31.0, 158.0, -19.0, 158.0, 45.0), hurtPart(-26.0, 187.0, -26.0, 187.0, 16.0), hurtPart(-42.0, 91.0, -31.0, 158.0, 8.0), hurtPart(-19.0, 158.0, -26.0, 187.0, 8.0)]),
  hurtPose(12, 14, [hurtPart(-76.0, 85.0, -76.0, 85.0, 45.0), hurtPart(-19.0, 158.0, -19.0, 158.0, 45.0), hurtPart(-23.0, 183.0, -23.0, 183.0, 20.0), hurtPart(-76.0, 85.0, -19.0, 158.0, 8.0), hurtPart(-19.0, 158.0, -23.0, 183.0, 8.0)]),
  hurtPose(15, 17, [hurtPart(-76.0, 74.0, -76.0, 74.0, 45.0), hurtPart(-21.0, 149.0, -21.0, 149.0, 45.0), hurtPart(-8.0, 178.0, -8.0, 178.0, 25.0), hurtPart(-76.0, 74.0, -21.0, 149.0, 8.0), hurtPart(-21.0, 149.0, -8.0, 178.0, 8.0)]),
  hurtPose(18, 20, [hurtPart(-57.0, 68.0, -39.0, 65.0, 39.0), hurtPart(-23.0, 136.0, -5.0, 136.0, 57.0), hurtPart(-1.0, 173.0, -1.0, 173.0, 30.0), hurtPart(-39.0, 65.0, -23.0, 136.0, 8.0), hurtPart(-5.0, 136.0, -1.0, 173.0, 8.0)]),
  hurtPose(21, 23, [hurtPart(-23.0, 31.0, -23.0, 31.0, 45.0), hurtPart(-2.0, 101.0, -2.0, 101.0, 45.0), hurtPart(0.0, 155.0, 0.0, 155.0, 45.0), hurtPart(-23.0, 31.0, -2.0, 101.0, 8.0), hurtPart(-2.0, 101.0, 0.0, 155.0, 8.0)]),
  hurtPose(24, 26, [hurtPart(-16.0, 27.0, -16.0, 27.0, 45.0), hurtPart(0.0, 97.0, 0.0, 97.0, 45.0), hurtPart(-9.0, 150.0, -9.0, 150.0, 45.0), hurtPart(-16.0, 27.0, 0.0, 97.0, 8.0), hurtPart(0.0, 97.0, -9.0, 150.0, 8.0)]),
  hurtPose(27, 30, [hurtPart(-3.0, 15.0, 3.0, 24.0, 63.0), hurtPart(21.0, 82.0, 42.0, 91.0, 57.0), hurtPart(10.0, 148.0, 10.0, 148.0, 4.0), hurtPart(3.0, 24.0, 21.0, 82.0, 8.0), hurtPart(42.0, 91.0, 10.0, 148.0, 8.0)]),
];

const UP_SMASH_BODY: readonly HurtPose[] = [
  hurtPose(0, 2, [hurtPart(-11.0, 33.0, -11.0, 33.0, 45.0), hurtPart(4.0, 99.0, 4.0, 99.0, 45.0), hurtPart(-9.0, 151.0, -9.0, 151.0, 45.0), hurtPart(-11.0, 33.0, 4.0, 99.0, 8.0), hurtPart(4.0, 99.0, -9.0, 151.0, 8.0)]),
  hurtPose(3, 5, [hurtPart(-11.0, 38.0, -8.0, 32.0, 51.0), hurtPart(35.0, 99.0, 29.0, 93.0, 45.0), hurtPart(7.0, 152.0, 7.0, 152.0, 3.0), hurtPart(-8.0, 32.0, 35.0, 99.0, 8.0), hurtPart(29.0, 93.0, 7.0, 152.0, 8.0)]),
  hurtPose(6, 8, [hurtPart(0.0, 17.0, 0.0, 17.0, 45.0), hurtPart(23.0, 77.0, 23.0, 77.0, 45.0), hurtPart(28.0, 123.0, 28.0, 123.0, 19.0), hurtPart(0.0, 17.0, 23.0, 77.0, 8.0), hurtPart(23.0, 77.0, 28.0, 123.0, 8.0)]),
  hurtPose(9, 11, [hurtPart(-2.0, 26.0, -2.0, 26.0, 57.0), hurtPart(17.0, 90.0, 23.0, 90.0, 45.0), hurtPart(21.0, 139.0, 21.0, 139.0, 10.0), hurtPart(-2.0, 26.0, 17.0, 90.0, 8.0), hurtPart(23.0, 90.0, 21.0, 139.0, 8.0)]),
  hurtPose(12, 14, [hurtPart(2.0, 55.0, 2.0, 55.0, 45.0), hurtPart(2.0, 128.0, 2.0, 128.0, 45.0), hurtPart(5.0, 172.0, 5.0, 172.0, 31.0), hurtPart(2.0, 55.0, 2.0, 128.0, 8.0), hurtPart(2.0, 128.0, 5.0, 172.0, 8.0)]),
  hurtPose(15, 17, [hurtPart(-20.0, 80.0, -20.0, 80.0, 45.0), hurtPart(-7.0, 150.0, -7.0, 150.0, 45.0), hurtPart(-11.0, 180.0, -11.0, 180.0, 23.0), hurtPart(-20.0, 80.0, -7.0, 150.0, 8.0), hurtPart(-7.0, 150.0, -11.0, 180.0, 8.0)]),
  hurtPose(18, 20, [hurtPart(-27.0, 82.0, -27.0, 82.0, 45.0), hurtPart(-9.0, 154.0, -9.0, 154.0, 45.0), hurtPart(-15.0, 180.0, -15.0, 180.0, 23.0), hurtPart(-27.0, 82.0, -9.0, 154.0, 8.0), hurtPart(-9.0, 154.0, -15.0, 180.0, 8.0)]),
  hurtPose(21, 23, [hurtPart(-54.0, 90.0, -48.0, 90.0, 21.0), hurtPart(-29.0, 158.0, -5.0, 158.0, 45.0), hurtPart(-25.0, 187.0, -25.0, 187.0, 16.0), hurtPart(-48.0, 90.0, -29.0, 158.0, 8.0), hurtPart(-5.0, 158.0, -25.0, 187.0, 8.0)]),
  hurtPose(24, 26, [hurtPart(-58.0, 90.0, -58.0, 90.0, 42.0), hurtPart(-19.0, 158.0, -19.0, 158.0, 45.0), hurtPart(-27.0, 187.0, -27.0, 187.0, 16.0), hurtPart(-58.0, 90.0, -19.0, 158.0, 8.0), hurtPart(-19.0, 158.0, -27.0, 187.0, 8.0)]),
  hurtPose(27, 29, [hurtPart(-76.0, 86.0, -76.0, 86.0, 45.0), hurtPart(-19.0, 158.0, -19.0, 158.0, 45.0), hurtPart(-25.0, 185.0, -25.0, 185.0, 18.0), hurtPart(-76.0, 86.0, -19.0, 158.0, 8.0), hurtPart(-19.0, 158.0, -25.0, 185.0, 8.0)]),
  hurtPose(30, 32, [hurtPart(-76.0, 82.0, -76.0, 82.0, 45.0), hurtPart(-20.0, 155.0, -20.0, 155.0, 45.0), hurtPart(-18.0, 181.0, -18.0, 181.0, 22.0), hurtPart(-76.0, 82.0, -20.0, 155.0, 8.0), hurtPart(-20.0, 155.0, -18.0, 181.0, 8.0)]),
  hurtPose(33, 35, [hurtPart(-76.0, 76.0, -76.0, 76.0, 45.0), hurtPart(-21.0, 150.0, -21.0, 150.0, 45.0), hurtPart(-9.0, 180.0, -9.0, 180.0, 23.0), hurtPart(-76.0, 76.0, -21.0, 150.0, 8.0), hurtPart(-21.0, 150.0, -9.0, 180.0, 8.0)]),
  hurtPose(36, 38, [hurtPart(-73.0, 72.0, -73.0, 72.0, 45.0), hurtPart(-22.0, 144.0, -22.0, 144.0, 45.0), hurtPart(-5.0, 176.0, -5.0, 176.0, 27.0), hurtPart(-73.0, 72.0, -22.0, 144.0, 8.0), hurtPart(-22.0, 144.0, -5.0, 176.0, 8.0)]),
  hurtPose(39, 41, [hurtPart(-50.0, 62.0, -50.0, 62.0, 45.0), hurtPart(-16.0, 137.0, -16.0, 137.0, 45.0), hurtPart(-1.0, 175.0, -1.0, 175.0, 28.0), hurtPart(-50.0, 62.0, -16.0, 137.0, 8.0), hurtPart(-16.0, 137.0, -1.0, 175.0, 8.0)]),
  hurtPose(42, 44, [hurtPart(-31.0, 43.0, -31.0, 43.0, 45.0), hurtPart(-4.0, 115.0, -4.0, 115.0, 45.0), hurtPart(1.0, 158.0, 1.0, 158.0, 45.0), hurtPart(-31.0, 43.0, -4.0, 115.0, 8.0), hurtPart(-4.0, 115.0, 1.0, 158.0, 8.0)]),
  hurtPose(45, 47, [hurtPart(-21.0, 29.0, -21.0, 29.0, 45.0), hurtPart(-1.0, 95.0, -1.0, 95.0, 45.0), hurtPart(-1.0, 147.0, -1.0, 147.0, 45.0), hurtPart(-21.0, 29.0, -1.0, 95.0, 8.0), hurtPart(-1.0, 95.0, -1.0, 147.0, 8.0)]),
  hurtPose(48, 50, [hurtPart(-16.0, 26.0, -16.0, 26.0, 45.0), hurtPart(-6.0, 92.0, -6.0, 92.0, 45.0), hurtPart(-9.0, 144.0, -9.0, 144.0, 45.0), hurtPart(-16.0, 26.0, -6.0, 92.0, 8.0), hurtPart(-6.0, 92.0, -9.0, 144.0, 8.0)]),
];

const GETUP_BODY: readonly HurtPose[] = [
  hurtPose(0, 2, [hurtPart(-9.0, 14.0, -9.0, 14.0, 51.0), hurtPart(8.0, 82.0, 2.0, 82.0, 51.0), hurtPart(-21.0, 134.0, -21.0, 134.0, 15.0), hurtPart(-9.0, 14.0, 8.0, 82.0, 8.0), hurtPart(2.0, 82.0, -21.0, 134.0, 8.0)]),
  hurtPose(3, 5, [hurtPart(-34.0, 22.0, -28.0, 22.0, 45.0), hurtPart(-15.0, 105.0, 9.0, 105.0, 69.0), hurtPart(-31.0, 158.0, -31.0, 158.0, 21.0), hurtPart(-28.0, 22.0, -15.0, 105.0, 8.0), hurtPart(9.0, 105.0, -31.0, 158.0, 8.0)]),
  hurtPose(6, 8, [hurtPart(-16.0, 28.0, -16.0, 28.0, 45.0), hurtPart(-6.0, 106.0, -6.0, 106.0, 45.0), hurtPart(-32.0, 158.0, -32.0, 158.0, 45.0), hurtPart(-16.0, 28.0, -6.0, 106.0, 8.0), hurtPart(-6.0, 106.0, -32.0, 158.0, 8.0)]),
  hurtPose(9, 11, [hurtPart(-6.0, 23.0, -6.0, 23.0, 45.0), hurtPart(-12.0, 95.0, -12.0, 95.0, 45.0), hurtPart(-32.0, 150.0, -32.0, 150.0, 45.0), hurtPart(-6.0, 23.0, -12.0, 95.0, 8.0), hurtPart(-12.0, 95.0, -32.0, 150.0, 8.0)]),
  hurtPose(12, 14, [hurtPart(9.0, 15.0, 9.0, 15.0, 45.0), hurtPart(-8.0, 87.0, -8.0, 87.0, 45.0), hurtPart(5.0, 143.0, 5.0, 143.0, 40.0), hurtPart(9.0, 15.0, -8.0, 87.0, 8.0), hurtPart(-8.0, 87.0, 5.0, 143.0, 8.0)]),
  hurtPose(15, 17, [hurtPart(11.0, 16.0, 11.0, 16.0, 45.0), hurtPart(1.0, 90.0, 1.0, 90.0, 45.0), hurtPart(1.0, 147.0, 1.0, 147.0, 45.0), hurtPart(11.0, 16.0, 1.0, 90.0, 8.0), hurtPart(1.0, 90.0, 1.0, 147.0, 8.0)]),
  hurtPose(18, 20, [hurtPart(-13.0, 34.0, -13.0, 34.0, 45.0), hurtPart(-7.0, 97.0, -7.0, 97.0, 45.0), hurtPart(-5.0, 145.0, -5.0, 145.0, 22.0), hurtPart(-13.0, 34.0, -7.0, 97.0, 8.0), hurtPart(-7.0, 97.0, -5.0, 145.0, 8.0)]),
  hurtPose(21, 23, [hurtPart(-25.0, 54.0, 14.0, 66.0, 57.0), hurtPart(-3.0, 96.0, -3.0, 96.0, 57.0), hurtPart(-15.0, 142.0, -15.0, 142.0, 31.0), hurtPart(14.0, 66.0, -3.0, 96.0, 8.0), hurtPart(-3.0, 96.0, -15.0, 142.0, 8.0)]),
  hurtPose(24, 26, [hurtPart(28.0, 50.0, 16.0, 38.0, 45.0), hurtPart(-7.0, 100.0, 26.0, 85.0, 69.0), hurtPart(-9.0, 147.0, -9.0, 147.0, 27.0), hurtPart(16.0, 38.0, -7.0, 100.0, 8.0), hurtPart(26.0, 85.0, -9.0, 147.0, 8.0)]),
  hurtPose(27, 29, [hurtPart(-5.0, 37.0, 4.0, 37.0, 45.0), hurtPart(12.0, 99.0, -18.0, 87.0, 63.0), hurtPart(-2.0, 146.0, -2.0, 146.0, 33.0), hurtPart(4.0, 37.0, 12.0, 99.0, 8.0), hurtPart(-18.0, 87.0, -2.0, 146.0, 8.0)]),
  hurtPose(30, 32, [hurtPart(-23.0, 38.0, -23.0, 38.0, 45.0), hurtPart(-10.0, 100.0, -10.0, 100.0, 45.0), hurtPart(-1.0, 147.0, -1.0, 147.0, 45.0), hurtPart(-23.0, 38.0, -10.0, 100.0, 8.0), hurtPart(-10.0, 100.0, -1.0, 147.0, 8.0)]),
  hurtPose(33, 35, [hurtPart(-15.0, 39.0, -15.0, 39.0, 45.0), hurtPart(-9.0, 102.0, -9.0, 102.0, 45.0), hurtPart(9.0, 151.0, 9.0, 151.0, 45.0), hurtPart(-15.0, 39.0, -9.0, 102.0, 8.0), hurtPart(-9.0, 102.0, 9.0, 151.0, 8.0)]),
  hurtPose(36, 38, [hurtPart(-18.0, 39.0, -18.0, 39.0, 45.0), hurtPart(-5.0, 104.0, -5.0, 104.0, 45.0), hurtPart(11.0, 154.0, 11.0, 154.0, 45.0), hurtPart(-18.0, 39.0, -5.0, 104.0, 8.0), hurtPart(-5.0, 104.0, 11.0, 154.0, 8.0)]),
  hurtPose(39, 41, [hurtPart(-21.0, 39.0, -21.0, 39.0, 45.0), hurtPart(-5.0, 104.0, -5.0, 104.0, 45.0), hurtPart(6.0, 154.0, 6.0, 154.0, 45.0), hurtPart(-21.0, 39.0, -5.0, 104.0, 8.0), hurtPart(-5.0, 104.0, 6.0, 154.0, 8.0)]),
  hurtPose(42, 44, [hurtPart(-20.0, 39.0, -20.0, 39.0, 45.0), hurtPart(-6.0, 104.0, -6.0, 104.0, 45.0), hurtPart(-3.0, 154.0, -3.0, 154.0, 45.0), hurtPart(-20.0, 39.0, -6.0, 104.0, 8.0), hurtPart(-6.0, 104.0, -3.0, 154.0, 8.0)]),
  hurtPose(45, 48, [hurtPart(-18.0, 39.0, -18.0, 39.0, 45.0), hurtPart(-6.0, 103.0, -6.0, 103.0, 45.0), hurtPart(-11.0, 153.0, -11.0, 153.0, 45.0), hurtPart(-18.0, 39.0, -6.0, 103.0, 8.0), hurtPart(-6.0, 103.0, -11.0, 153.0, 8.0)]),
];

function attachedBodies(): FighterHurtboxes {
  const attacks: { [style: number]: readonly HurtPose[] | undefined } = {};
  for (let style = AttackStyle.jab; style <= LAST_ATTACK_STYLE; style++) {
    const move = NORMALS[style];
    if (move !== undefined) attacks[style] = dreadlordLimbPoses(move.regions, move.totalFrames);
  }
  attacks[AttackStyle.forwardTiltUp] = FORWARD_TILT_UP_BODY;
  attacks[AttackStyle.upSmash] = UP_SMASH_BODY;
  attacks[AttackStyle.getupAttack] = GETUP_BODY;
  return { stand: DREADLORD_STAND, attacks };
}

export const DREADLORD_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  normals: NORMALS,
  hurtboxes: attachedBodies(),
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 2.7150001525878906, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 32, effect: { ...dreadlordHit(11.276955604553223, "EDGE", 35), growth: 49.0, base: 61.0 } },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 43, effect: { ...dreadlordHit(13.532346725463867, "KILL", 40, -1.0), growth: 77.0, base: 56.0 } },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 29, effect: dreadlordHit(10.149260520935059, "JUGGLE", 85) },
    [GrabAction.throwDown]: { contactFrame: 19, totalFrames: 44, effect: { ...dreadlordHit(9.021564483642578, "CHASE", 70), growth: 100.0, base: 0.0, setKnockback: 90.0 } },
  },
};
