import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind } from "../../sim/codes";
import { CHILL } from "../../sim/chill";
import { heroRegion } from "../../sim/heroMoves";
import { surfRide } from "../../sim/specials/surfRide";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../../sim/specials/schema";
import type { AppliedStatus } from "../../sim/appliedStatus";
import { murlocHit } from "./moves";
import { MURLOC_DUO } from "./duo";

export const NET = { damage: 3.0, radius: 30.0, within: 120.0, heldWithin: 260.0, baseFrames: 30, framesPerPercent: 0.25, maxFrames: 75, hits: 3, immunityFrames: 120 } as const;
export const NET_ROOT: AppliedStatus = {
  kind: HeroStatusKind.root, frames: NET.baseFrames, group: HeroStatusGroup.chill, immunityFrames: NET.immunityFrames,
  perPercent: { frames: NET.framesPerPercent, cap: NET.maxFrames }, hits: NET.hits,
};
const SNARE: SpecialProjectile = {
  model: "Abilities\\Spells\\Orc\\Ensnare\\EnsnareMissile.mdx",
  spawnFrame: 12, offsetX: 32.0, offsetZ: 40.0, velocityX: 8.0, velocityZ: f32(0.6), gravity: f32(0.06),
  life: 40, radius: 18.0, effect: murlocHit(4.995458602905273, 35, 45.10895538330078, 16.0), reflectable: true, limit: 1, status: CHILL,
};
const NET_SHOT: SpecialProjectile = {
  ...SNARE, radius: NET.radius, effect: { ...murlocHit(NET.damage, 35), growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0 }, status: NET_ROOT,
};
const ensnare = (air: boolean): AuthoredSpecial => {
  const cast = (shot: SpecialProjectile): AuthoredSpecial => ({ endFrame: 36, landingLag: air ? 18 : undefined, projectiles: [shot] });
  return { ...cast(SNARE), variants: [cast(NET_SHOT)], pairedVariant: { variant: 1, within: NET.within, heldWithin: NET.heldWithin } };
};
export const BELLY_SLIDE = { damage: 5.0, speed: 11.0, firstFrame: 8, lastFrame: 22 } as const;
const bellySlide = (air: boolean): AuthoredSpecial => ({
  endFrame: 32, landingLag: air ? 20 : undefined,
  motion: [{ ...frames(BELLY_SLIDE.firstFrame, BELLY_SLIDE.lastFrame), velocityX: BELLY_SLIDE.speed, velocityZ: 0.0, stopsAtShield: true }],
  regions: [heroRegion(BELLY_SLIDE.firstFrame, BELLY_SLIDE.lastFrame, { x1: 10.0, z1: 22.0, x2: 46.0, z2: 22.0, radius: 18.0 }, murlocHit(BELLY_SLIDE.damage, 40, 72.17433166503906, 22.0))],
});
export const SURF = { reach: 120.0, soloRise: 11.0, linkedRise: 17.0, rideFirst: 6, soloLast: 25, linkedLast: 31, boardDrop: 60.0, push: 14.5 } as const;
const SURF_HITS = [{ first: 6, last: 8 }, { first: 9, last: 11 }, { first: 12, last: 14 }];
const surfHit = (last: boolean) => last ? murlocHit(2.0, 80, 63.15253829956055, 30.0) : murlocHit(2.0, 90, 0.0, 14.0);
const TIDAL_SURF = surfRide({
  endFrame: 34, windUp: 5, rideFrames: { first: SURF.rideFirst, last: SURF.soloLast }, rise: SURF.soloRise, drift: 6.0,
  linked: {
    reach: SURF.reach, endFrame: 40, rideLast: SURF.linkedLast, rise: SURF.linkedRise,
    board: { catchUp: 30.0, drop: SURF.boardDrop }, backflip: { velocityX: -4.0, velocityZ: 7.0 }, push: SURF.push,
  },
  hits: SURF_HITS, hitEffect: surfHit, region: { x1: 0.0, z1: 10.0, x2: -24.0, z2: 80.0, radius: 26.0 },
});

export const REVIVE = { frame: 40, endFrame: 50, offsetX: 60.0 } as const;
export const ORDER = { frame: 6, endFrame: 20 } as const;
export const SWAP = { holdFrame: 19, frame: 31 } as const;
const REVIVE_CAST: AuthoredSpecial = { endFrame: REVIVE.endFrame, groundOnly: true, revive: { frame: REVIVE.frame, offsetX: REVIVE.offsetX } };
const SWAP_CAST: AuthoredSpecial = { endFrame: SWAP.frame, swap: { frame: SWAP.frame, cooldown: MURLOC_DUO.swapCooldown }, airStall: frames(SWAP.holdFrame + 1, SWAP.frame), landingLag: 18 };
const MRGLGLGL: AuthoredSpecial = {
  endFrame: ORDER.endFrame, groundOnly: true, order: { frame: ORDER.frame }, swapHold: { frame: SWAP.holdFrame, variant: 2 },
  variants: [REVIVE_CAST, { ...SWAP_CAST, groundOnly: true }],
};
const MRGLGLGL_AIR: AuthoredSpecial = { endFrame: ORDER.endFrame, landingLag: 18, swapHold: { frame: SWAP.holdFrame, variant: 1 }, variants: [SWAP_CAST] };

export const MURLOC_SPECIALS: FighterSpecials = {
  neutral: { name: "Net", description: "Throw a net that slows the first enemy it reaches. With Grgl in step and near, both nets are wider and root the foe for a few hits. Shield it or jump it.", ground: ensnare(false), air: ensnare(true) },
  side: { name: "Belly Slide", description: "Belly-slide forward into a hit, and Grgl follows five frames later. A raised shield stops the slide.", ground: bellySlide(false), air: bellySlide(true) },
  up: { name: "Tidal Surf", description: "Ride a wave upward and steer it, carrying a Grgl within reach to the full height, then fall helpless.", ground: TIDAL_SURF },
  down: { name: "Mrglglgl!", description: "Tap to make Grgl hold his ground, facing the nearest foe, and tap again to bring him back. With Grgl down, call him back at 0% beside Mrgl, once a stock. A hit while calling cancels it unspent.", ground: MRGLGLGL, air: MRGLGLGL_AIR },
};
