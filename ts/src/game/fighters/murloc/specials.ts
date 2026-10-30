import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../../sim/codes";
import { CHILL } from "../../sim/chill";
import { heroRegion } from "../../sim/heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../../sim/specials/schema";
import type { AppliedStatus } from "../../sim/appliedStatus";
import { murlocHit } from "./moves";

export const NET = { damage: 3.0, radius: 30.0, within: 120.0, baseFrames: 30, framesPerPercent: 0.25, maxFrames: 75, hits: 3, immunityFrames: 120 } as const;
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
  return { ...cast(SNARE), variants: [cast(NET_SHOT)], pairedVariant: { variant: 1, within: NET.within } };
};
export const BELLY_SLIDE = { damage: 5.0, speed: 11.0, firstFrame: 8, lastFrame: 22 } as const;
const bellySlide = (air: boolean): AuthoredSpecial => ({
  endFrame: 32, landingLag: air ? 20 : undefined,
  motion: [{ ...frames(BELLY_SLIDE.firstFrame, BELLY_SLIDE.lastFrame), velocityX: BELLY_SLIDE.speed, velocityZ: 0.0, stopsAtShield: true }],
  regions: [heroRegion(BELLY_SLIDE.firstFrame, BELLY_SLIDE.lastFrame, { x1: 10.0, z1: 22.0, x2: 46.0, z2: 22.0, radius: 18.0 }, murlocHit(BELLY_SLIDE.damage, 40, 72.17433166503906, 22.0))],
});
const SURF_REACH = 120.0;
const SURF_HITS = [{ first: 6, last: 8 }, { first: 9, last: 11 }, { first: 12, last: 14 }];
const surfHit = (last: boolean) => last ? murlocHit(2.0, 80, 63.15253829956055, 30.0) : murlocHit(2.0, 90, 0.0, 14.0);
const TIDAL_SURF: AuthoredSpecial = {
  endFrame: 34, oncePerAirtime: true, helpless: true, facesStick: true,
  rehits: SURF_HITS.slice(1).map(({ first }) => first + 1),
  motion: [
    { ...frames(1, 5), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(6, 25), velocityX: 0.0, velocityZ: 17.0, driftSpeed: 6.0, ride: { reach: SURF_REACH, offset: 30.0, catchUp: 30.0, aloneVelocityZ: 11.0 } },
  ],
  regions: SURF_HITS.map(({ first, last }, index) => heroRegion(first, last, { x1: 0.0, z1: 10.0, x2: -24.0, z2: 80.0, radius: 26.0 }, surfHit(index === SURF_HITS.length - 1))),
};

const PLAGUE: AppliedStatus = { kind: HeroStatusKind.poison, frames: 180, group: HeroStatusGroup.sleep, immunityFrames: 0, tick: { every: 60, damage: 1.0 } };
const DISEASE_CLOUD: AuthoredSpecial = {
  endFrame: 38, cooldownFrames: 150, groundOnly: true,
  projectiles: [{
    model: "war3mapImported\\MurlocSwampCloud.mdx",
    spawnFrame: 14, offsetX: 40.0, offsetZ: 6.0, velocityX: 0.0, velocityZ: 0.0, life: 150, radius: 50.0,
    effect: { ...murlocHit(2.4977293014526367, 80, 27.065372467041016, 30.0, false, HitElement.poison) },
    reflectable: false, limit: 1, needsLineOfSight: true, status: PLAGUE,
    pool: { every: 50, growth: 0.0, maxRadius: 50.0 },
  }],
};

export const MURLOC_SPECIALS: FighterSpecials = {
  neutral: { name: "Net", description: "Throw a net that slows the first enemy it reaches. With Grgl in step and near, both nets are wider and root the foe for a few hits. Shield it or jump it.", ground: ensnare(false), air: ensnare(true) },
  side: { name: "Belly Slide", description: "Belly-slide forward into a hit, and Grgl follows five frames later. A raised shield stops the slide.", ground: bellySlide(false), air: bellySlide(true) },
  up: { name: "Tidal Surf", description: "Ride a wave upward and steer it, carrying a Grgl within reach to the full height, then fall helpless.", ground: TIDAL_SURF },
  down: { name: "Disease Cloud", description: "Leave a small plague cloud that poisons enemies standing in it; jumping clears it.", ground: DISEASE_CLOUD, air: { ...DISEASE_CLOUD, groundOnly: false, landingLag: 20,
    projectiles: DISEASE_CLOUD.projectiles?.map(shot => ({ model: shot.model, spawnFrame: shot.spawnFrame,
      offsetX: 0.0, offsetZ: 22.0, velocityX: 0.0, velocityZ: 0.0, life: shot.life,
      radius: shot.radius, effect: shot.effect, reflectable: shot.reflectable, limit: shot.limit, status: shot.status })) } },
};
