import { withExKit } from "../../sim/exSpecialAuthoring";
import { type AuthoredSpecial, type FighterSpecials, FollowUpInput, type SpecialCharge, type SpecialFollowUp, frames } from "../../sim/specials/schema";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { heroRegion, type MoveRegion, type StrikeCapsule } from "../../sim/heroMoves";
import { hurtPart, hurtPose } from "../../sim/hurtboxes";
import { peonHit } from "./moves";

export const GOLD_SACK_CHARGE: SpecialCharge = { hold: 6, full: 80, stages: 4, releases: true };
export const GOLD_SACK_DAMAGE = [8.0, 11.0, 14.0, 17.0, 24.0] as const;
const GOLD_SACK_GROWTH = [65.0, 68.0, 70.0, 72.0, 72.0] as const;
const GOLD_SACK_BASE = [8.0, 10.0, 11.0, 12.0, 12.0] as const;
export const GOLD_SACK_FIRST_ACTIVE = [24, 22, 21, 19, 17] as const;
export const GOLD_SACK_ACTIVE = [6, 6, 6, 5, 5] as const;
const GOLD_SACK_ENDS = [51, 49, 48, 46, 44] as const;
export const GOLD_SACK_ARC = [[0.0, 78.0, 68.0, 138.0], [16.0, 94.0, 124.0, 102.0], [28.0, 70.0, 144.0, 18.0]] as const;
const GOLD_SACK_LUNGE = { speed: 3.0, first: 2, last: 14 } as const;
const GOLD_SACK_WINDOW = frames(1, GOLD_SACK_CHARGE.hold + 1);

const lerp = (from: number, to: number, share: number): number => f32(from + f32(f32(to - from) * share));

export const goldSackArcAt = (index: number, count: number): StrikeCapsule => {
  const along = f32(f32(index * (GOLD_SACK_ARC.length - 1)) / Math.max(1, count - 1));
  const from = Math.min(GOLD_SACK_ARC.length - 2, Math.floor(along));
  const share = f32(along - from);
  const a = at(GOLD_SACK_ARC, from);
  const b = at(GOLD_SACK_ARC, from + 1);
  return { x1: lerp(a[0], b[0], share), z1: lerp(a[1], b[1], share), x2: lerp(a[2], b[2], share), z2: lerp(a[3], b[3], share), radius: 0.0 };
};

const goldSackSwing = (stage: number): AuthoredSpecial => {
  const first = GOLD_SACK_FIRST_ACTIVE[stage] ?? 24;
  const count = GOLD_SACK_ACTIVE[stage] ?? 6;
  const radius = 14.0 + 2.0 * stage;
  const effect = peonHit(GOLD_SACK_DAMAGE[stage] ?? 8.0, 40, GOLD_SACK_GROWTH[stage] ?? 80.0, GOLD_SACK_BASE[stage] ?? 20.0);
  return {
    name: "Gold Sack Bonk", endFrame: GOLD_SACK_ENDS[stage] ?? 51, landingLag: 14, swingsThroughLanding: true, spendsCharge: true,
    motion: stage === GOLD_SACK_CHARGE.stages ? [{ ...frames(GOLD_SACK_LUNGE.first, GOLD_SACK_LUNGE.last), velocityX: GOLD_SACK_LUNGE.speed, velocityZ: 0.0 }] : undefined,
    regions: Array.from({ length: count }, (_, index) => heroRegion(first + index, first + index, { ...goldSackArcAt(index, count), radius }, effect)),
  };
};

const goldSackFollowUps: readonly SpecialFollowUp[] = [
  ...[0, 1, 2, 3, 4].map((stage): SpecialFollowUp => ({ window: GOLD_SACK_WINDOW, input: FollowUpInput.release, chargeStage: stage, special: goldSackSwing(stage) })),
  { window: GOLD_SACK_WINDOW, input: FollowUpInput.shield, special: { name: "Gold Sack Store", endFrame: 8 } },
];

const GOLD_SACK: AuthoredSpecial = { endFrame: GOLD_SACK_CHARGE.hold + 2, charge: GOLD_SACK_CHARGE, followUps: goldSackFollowUps };

export const LOG_HEAVE_FIRST_ACTIVE = 14;
export const LOG_ON_SHOULDER = frames(20, 25);
export const LOG_HEAVE_END = 30;

export const LOG_TIPPER = { ...peonHit(12.0, 75, 52.0, 68.0, true), strong: true };
export const LOG_BUTT = { ...peonHit(5.0, 70, 20.0, 12.0), strong: false };
const LOG_TIP_FRACTION = f32(0.3);
const LOG_RADIUS = 13.0;
export const LOG_RISING: readonly StrikeCapsule[] = [
  { x1: 17.0, z1: 40.0, x2: 172.0, z2: 22.0, radius: LOG_RADIUS },
  { x1: 16.0, z1: 63.0, x2: 171.5, z2: 75.0, radius: LOG_RADIUS },
];
export const LOG_OVERHEAD: readonly StrikeCapsule[] = [
  { x1: 0.0, z1: 83.0, x2: 135.0, z2: 161.0, radius: LOG_RADIUS },
  { x1: -18.0, z1: 80.0, x2: 71.5, z2: 208.0, radius: LOG_RADIUS },
];
export const LOG_HEAVE_AIR_LANDING_LAG = 15;
const risingLog = (log: Readonly<StrikeCapsule>, frame: number): readonly MoveRegion[] => {
  const x = f32(log.x2 - f32(f32(log.x2 - log.x1) * LOG_TIP_FRACTION));
  const z = f32(log.z2 - f32(f32(log.z2 - log.z1) * LOG_TIP_FRACTION));
  return [heroRegion(frame, frame, { ...log, x1: x, z1: z }, LOG_TIPPER), heroRegion(frame, frame, { ...log, x2: x, z2: z }, LOG_BUTT)];
};

const LOG_REGIONS: readonly MoveRegion[] = [
  ...LOG_RISING.flatMap((log, index) => risingLog(log, LOG_HEAVE_FIRST_ACTIVE + index)),
  ...LOG_OVERHEAD.map((log, index) => heroRegion(LOG_HEAVE_FIRST_ACTIVE + LOG_RISING.length + index, LOG_HEAVE_FIRST_ACTIVE + LOG_RISING.length + index, log, LOG_BUTT)),
];

const LOG_HEAVE: AuthoredSpecial = {
  endFrame: LOG_HEAVE_END, groundOnly: true, motion: [{ ...frames(1, LOG_HEAVE_END), velocityX: 0.0, velocityZ: 0.0 }], regions: LOG_REGIONS,
};

const LOG_HEAVE_AIR: AuthoredSpecial = { endFrame: LOG_HEAVE_END, oncePerAirtime: true, landingLag: LOG_HEAVE_AIR_LANDING_LAG, regions: LOG_REGIONS };

const vault = (x: number, z: number): AuthoredSpecial => ({
  endFrame: 28, motion: [{ ...frames(8, 28), velocityX: 0.0, velocityZ: z, driftSpeed: x }],
  oncePerAirtime: true, helpless: true, facesStick: true,
});

export const REST_SWEET_FIRST = 2;
export const REST_SWEET_LAST = 3;
export const REST_SOUR_FRAME = 4;
export const REST_SLEEP_FRAMES = 225;
export const REST_END_FRAME = REST_SOUR_FRAME + REST_SLEEP_FRAMES;
export const REST_LYING_FRAME = 45;

const REST: AuthoredSpecial = {
  endFrame: REST_END_FRAME, confirmOnly: true,
  regions: [
    heroRegion(REST_SWEET_FIRST, REST_SWEET_LAST, { x1: 0.0, z1: 50.0, x2: 0.0, z2: 50.0, radius: 30.0 }, peonHit(14.0, 90, 147.0, 80.0)),
    heroRegion(REST_SOUR_FRAME, REST_SOUR_FRAME, { x1: 0.0, z1: 50.0, x2: 0.0, z2: 50.0, radius: 40.0 }, peonHit(7.0, 85, 67.5, 50.0)),
  ],
  hurt: [hurtPose(REST_LYING_FRAME, REST_END_FRAME, [hurtPart(0.0, 18.0, 52.0, 18.0, 18.0)])],
};

export const PEON_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Gold Sack", description: "Hold to stuff gold into the sack and release to bonk: a tap bonks at once, a longer hold bonks harder, and a full sack lunges forward and kills. Shield keeps the charge for the next press.", ground: GOLD_SACK }, { shieldSafe: true }),
  side: withExKit({ name: "Log Heave", description: "Grab a huge log by its end and heave it up and over, on the ground or once in the air: its far end pops a foe up and back toward the Peon; the butt end barely moves them.", ground: LOG_HEAVE, air: LOG_HEAVE_AIR }, { reach: 1.25 }),
  up: withExKit({ name: "Worksite Launch", description: "Vault toward the stage, then fall helpless.", ground: vault(6.0, 16.0) }, { travel: 1.25 }),
  down: withExKit({ name: "Rest", description: "Nap on the spot: a point-blank frame-2 jolt launches straight up and kills early, then the Peon sleeps for nearly four seconds.", ground: REST }, { reach: 1.25 }),
};
