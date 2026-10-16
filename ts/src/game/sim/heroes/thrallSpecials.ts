import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroRegion, type MoveRegion } from "../heroMoves";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, frames } from "../specials/schema";
import { capsule, thrallHit } from "./thrallMoves";

const h = (multiple: number) => f32(HERO_REFERENCE_HEIGHT * multiple);
const CHAIN_ORIGIN_X = 42.0;
const CHAIN_ORIGIN_Z = 70.0;
const CHAIN_RANGE = 520.0;
const CHAIN_RADIUS = 14.0;
const chainRegion = (): MoveRegion => {
  const region = heroRegion(26, 31, capsule(CHAIN_ORIGIN_X, CHAIN_ORIGIN_Z, CHAIN_ORIGIN_X + CHAIN_RANGE, CHAIN_ORIGIN_Z, CHAIN_RADIUS),
    { ...thrallHit(9.0, 40, 78.87999725341797, 22.0, false, HitElement.electric), electric: true });
  return { ...region, hit: { ...region.hit, minZ: CHAIN_ORIGIN_Z - CHAIN_RANGE - CHAIN_RADIUS, maxZ: CHAIN_ORIGIN_Z + CHAIN_RANGE + CHAIN_RADIUS } };
};
const CHAIN_LIGHTNING: AuthoredSpecial = {
  endFrame: 58, beam: { originX: CHAIN_ORIGIN_X, originZ: CHAIN_ORIGIN_Z, range: CHAIN_RANGE, track: 0.0, chain: true },
  regions: [chainRegion()], landingLag: 18,
};
const wolf = (spawnFrame: number, air: boolean): SpecialProjectile => ({
  spawnFrame, offsetX: 44.0, offsetZ: 20.0, velocityX: 12.0, velocityZ: air ? -3.0 : 0.0,
  life: 28, radius: 20.0, effect: thrallHit(4.0960001945495605, 55, 64.08999633789062, 28.0), reflectable: false, limit: 2,
  model: "units\\orc\\SpiritWolf\\SpiritWolf.mdx",
});
const wolves = (air: boolean): AuthoredSpecial => ({ endFrame: 44, cooldownFrames: 90, projectiles: [wolf(16, air), wolf(24, air)], landingLag: air ? 20 : undefined });
const sight = (height: number): AuthoredSpecial => ({
  endFrame: 40, facesStick: true, oncePerAirtime: true, helpless: true,
  motion: [{ ...frames(1, 8), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(9, 32), velocityX: 0.0, velocityZ: f32(h(height) / 24.0), driftSpeed: f32(h(f32(1.5)) / 24.0) }],
});
const DOOMHAMMER_SLAM: AuthoredSpecial = {
    endFrame: 50, cooldownFrames: 90, groundOnly: true,
    regions: [heroRegion(18, 21, capsule(0.0, 12.0, 119.0, 12.0, 16.0), thrallHit(11.263999938964844, 75, 69.0199966430664, 36.0)), heroRegion(18, 21, capsule(0.0, 12.0, -119.0, 12.0, 16.0), thrallHit(11.263999938964844, 75, 69.0199966430664, 36.0, true))],
  };

export const THRALL_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Chain Lightning", description: "Call down a crackling bolt of lightning at where the nearest foe in front of him stood when he began; it does not follow them, so jump or shield it and punish the slow cast.", ground: CHAIN_LIGHTNING }, { damage: 1.25 }),
  side: withExKit({ name: "Feral Spirit", description: "Send two spirit wolves running low, one after the other.", ground: wolves(false), air: wolves(true) }, { damage: 1.25 }),
  up: withExKit({ name: "Far Sight", description: "Let the spirits guide a rising leap; steer toward the ledge, then fall helpless.", ground: sight(f32(3.1)) }, { travel: 1.25 }),
  down: withExKit({ name: "Doomhammer Slam", description: "Slam the ground on both sides to launch nearby foes; a jump clears it.", ground: DOOMHAMMER_SLAM, air: { ...DOOMHAMMER_SLAM, groundOnly: false, landingLag: 20 } }, { reach: 1.25 }),
};
