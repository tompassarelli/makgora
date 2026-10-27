import { withExKit } from "../../sim/exSpecialAuthoring";
import { type AuthoredSpecial, type FighterSpecials, FollowUpInput, type SpecialCharge, type SpecialFollowUp, frames } from "../../sim/specials/schema";
import { heroRegion } from "../../sim/heroMoves";
import { hurtPart, hurtPose } from "../../sim/hurtboxes";
import { peonHit } from "./moves";

export const GOLD_SACK_CHARGE: SpecialCharge = { hold: 6, full: 80, stages: 4 };
export const GOLD_SACK_DAMAGE = [8.0, 11.0, 14.0, 17.0, 24.0] as const;
const GOLD_SACK_GROWTH = [65.0, 68.0, 70.0, 72.0, 72.0] as const;
const GOLD_SACK_BASE = [8.0, 10.0, 11.0, 12.0, 12.0] as const;
export const GOLD_SACK_FIRST_ACTIVE = [12, 12, 12, 12, 9] as const;
const GOLD_SACK_ARC = [[0.0, 74.0, 34.0, 104.0], [8.0, 82.0, 62.0, 86.0], [14.0, 70.0, 72.0, 44.0]] as const;
const GOLD_SACK_WINDOW = frames(GOLD_SACK_CHARGE.hold + 1, GOLD_SACK_CHARGE.hold + 1);

const goldSackSwing = (stage: number): AuthoredSpecial => {
  const first = GOLD_SACK_FIRST_ACTIVE[stage] ?? 12;
  const radius = 14.0 + 2.0 * stage;
  const effect = peonHit(GOLD_SACK_DAMAGE[stage] ?? 8.0, 40, GOLD_SACK_GROWTH[stage] ?? 80.0, GOLD_SACK_BASE[stage] ?? 20.0);
  return {
    name: "Gold Sack Bonk", endFrame: first + 26, landingLag: 14, spendsCharge: true,
    regions: GOLD_SACK_ARC.map(([x1, z1, x2, z2], index) => heroRegion(first + index, first + index, { x1, z1, x2, z2, radius }, effect)),
  };
};

const goldSackFollowUps: readonly SpecialFollowUp[] = [
  ...[0, 1, 2, 3, 4].map((stage): SpecialFollowUp => ({ window: GOLD_SACK_WINDOW, chargeStage: stage, special: goldSackSwing(stage) })),
  { window: GOLD_SACK_WINDOW, input: FollowUpInput.shield, special: { name: "Gold Sack Store", endFrame: 8 } },
];

const GOLD_SACK: AuthoredSpecial = { endFrame: GOLD_SACK_CHARGE.hold + 12, charge: GOLD_SACK_CHARGE, followUps: goldSackFollowUps };

const BURROW_STOP = [{ ...frames(1, 52), velocityX: 0.0, velocityZ: 0.0 }];

const BURROW: AuthoredSpecial = {
  endFrame: 52, groundOnly: true, motion: BURROW_STOP,
  placement: {
    frame: 26, offsetX: 80.0, radius: 28.0, height: 76.0, durability: 32.0, life: 240,
    fireAges: [45, 85, 125, 165, 205],
    shot: {
      model: "Abilities\\Weapons\\HunterMissile\\HunterMissile.mdl",
      spawnFrame: 0, offsetX: 28.0, offsetZ: 48.0, velocityX: 12.0, velocityZ: 0.0,
      life: 36, radius: 12.0, effect: peonHit(5.119999885559082, 35, 73.875, 18.0), reflectable: true, limit: 3,
    },
  },
};

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
  neutral: withExKit({ name: "Gold Sack", description: "Stuff gold into the sack, then press again to bonk; shield keeps the charge. A full sack kills.", ground: GOLD_SACK }, { damage: 1.25 }),
  side: withExKit({ name: "Burrow", description: "Build a fragile burrow that fires spears; press again to pack it up.", ground: BURROW, recall: { name: "Pack Up", endFrame: 52, groundOnly: true, recall: true, motion: BURROW_STOP } }, { durability: 1.25, damage: 1.25, recallProtection: 4 }),
  up: withExKit({ name: "Worksite Launch", description: "Vault toward the stage, then fall helpless.", ground: vault(6.0, 16.0) }, { travel: 1.25 }),
  down: withExKit({ name: "Rest", description: "Nap on the spot: a point-blank frame-2 jolt launches straight up and kills early, then the Peon sleeps for nearly four seconds.", ground: REST }, { reach: 1.25 }),
};
