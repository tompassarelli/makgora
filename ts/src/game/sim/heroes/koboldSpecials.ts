import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../codes";
import { upgradeSpecial, withExKit } from "../exSpecialAuthoring";
import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../specials/schema";
import { koboldHit } from "./koboldMoves";

const EMBER: SpecialProjectile = {
  model: "Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx",
  spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
  life: 45, radius: 22.0, effect: koboldHit(3.0, 80, 40.0, 20.0, false, HitElement.fire), reflectable: false, limit: 1,
};
const wick = (air: boolean, life = 30, radius = 14.0): AuthoredSpecial => ({
  endFrame: 36, landingLag: air ? 18 : undefined,
  projectiles: [{ model: "Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx",
    spawnFrame: 12, offsetX: 30.0, offsetZ: 32.0, velocityX: 8.0, velocityZ: 0.0,
    life, radius, effect: koboldHit(4.977240085601807, 35, 58.32944107055664, 18.0, false, HitElement.fire), reflectable: true, limit: 1 }],
});
const leavesEmber = (move: AuthoredSpecial): AuthoredSpecial => ({ ...move, projectiles: move.projectiles?.map(shot => ({ ...shot, expiresInto: EMBER })) });
const flail = (air: boolean): AuthoredSpecial => ({
  name: "You No Take Candle!", endFrame: 30, landingLag: air ? 18 : undefined,
  regions: [
    heroRegion(6, 8, { x1: 10.0, z1: 30.0, x2: 46.0, z2: 30.0, radius: 14.0 }, koboldHit(3.0, 55, 50.0, 20.0)),
    heroRegion(12, 14, { x1: 10.0, z1: 30.0, x2: 46.0, z2: 30.0, radius: 14.0 }, koboldHit(3.0, 55, 50.0, 20.0)),
  ],
});
const litWick = (air: boolean): AuthoredSpecial => ({ ...wick(air), variants: [
  wick(air, 36, 15.0),
  upgradeSpecial(wick(air, 40, 17.0), { damage: 1.25 }),
  leavesEmber(upgradeSpecial(wick(air, 44, 20.0), { damage: 1.5 })),
  flail(air),
] });
const dig = (air: boolean): AuthoredSpecial => ({
  endFrame: 32, landingLag: air ? 20 : undefined,
  motion: [{ ...frames(8, 22), velocityX: 11.0, velocityZ: 0.0, stopsAtShield: true }],
  regions: [heroRegion(8, 22, { x1: 10.0, z1: 18.0, x2: 50.0, z2: 18.0, radius: 16.0 }, koboldHit(9.954480171203613, 40, 71.79007720947266, 22.0))],
});
const litDig = (air: boolean): AuthoredSpecial => ({ ...dig(air), variants: [
  upgradeSpecial(dig(air), { travel: f32(1.1) }),
  upgradeSpecial({ ...dig(air), armor: { ...frames(8, 22), maxDamage: 6.0 } }, { travel: f32(1.2) }),
  upgradeSpecial({ ...dig(air), armor: { ...frames(8, 22), maxDamage: 10.0 } }, { travel: f32(1.3), damage: 1.25 }),
] });
const escape: AuthoredSpecial = {
  endFrame: 34, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(1, 5), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(6, 25), velocityX: 0.0, velocityZ: 16.0, driftSpeed: 5.0 }],
  regions: [heroRegion(6, 14, { x1: 0.0, z1: 18.0, x2: 0.0, z2: 74.0, radius: 22.0 }, koboldHit(6.221549987792969, 80, 62.81631851196289, 30.0))],
};
const mine = (air: boolean): AuthoredSpecial => ({
  endFrame: 34, landingLag: air ? 18 : undefined,
  regions: [
    heroRegion(10, 13, { x1: 10.0, z1: 12.0, x2: 64.0, z2: 12.0, radius: 14.0 }, koboldHit(8.710169792175293, 70, 71.79007720947266, 24.0)),
    heroRegion(10, 13, { x1: -10.0, z1: 12.0, x2: -64.0, z2: 12.0, radius: 14.0 }, koboldHit(8.710169792175293, 70, 71.79007720947266, 24.0, true)),
  ],
});
const litMine = (air: boolean): AuthoredSpecial => ({ ...mine(air), variants: [
  upgradeSpecial(mine(air), { reach: f32(1.1) }),
  upgradeSpecial(mine(air), { reach: f32(1.2) }),
  upgradeSpecial(mine(air), { reach: f32(1.3), damage: f32(1.2) }),
] });

export const KOBOLD_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Wick Flick", description: "Flick candle flame forward. Jump or shield it, then punish the recovery. Brighter candle, longer flame; at full flame it leaves an ember.", ground: litWick(false), air: litWick(true) }, { damage: 1.25 }),
  side: withExKit({ name: "Panic Dig", description: "Scurry forward behind the pick. A raised shield stops the charge. Brighter candle, longer dig; bright enough, little hits no stop him.", ground: litDig(false), air: litDig(true) }, { damage: 1.25 }),
  up: withExKit({ name: "Candle Escape", description: "Spring upward in a panic, steer, then fall helpless.", ground: escape, air: escape }, { travel: 1.25 }),
  down: withExKit({ name: "Mine!", description: "Protect the candle with a two-sided ankle sweep. Jump over the pick. Brighter candle, wider sweep; full flame hits harder.", ground: litMine(false), air: litMine(true) }, { reach: 1.25 }),
};
