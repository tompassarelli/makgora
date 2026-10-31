


import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import type { AppliedStatus } from "../../sim/appliedStatus";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, frames } from "../../sim/specials/schema";
import { capsule, hit } from "./moves";
import { VALKYR_MODEL } from "../../assets/importedModelInfo";

const h = (fraction: number): number => f32(HERO_REFERENCE_HEIGHT * fraction);

const CHEST = h(f32(0.5));

const AIR_LANDING_LAG = 20;

export const DEATH_GRIP_SPAWN_FRAME = 16;
export const DEATH_GRIP_SPEED = 24.0;
export const DEATH_GRIP_LIFE = 12;
export const DEATH_GRIP_HOLD = 70.0;
export const DEATH_GRIP_PULL_FRAMES = 10;
export const DEATH_GRIP_STUN_FRAMES = 18;
export const DEATH_GRIP_COOLDOWN = 150;
export const DEATH_GRIP_MODEL = "Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilMissile.mdx";

const GRIPPED: AppliedStatus = {
  kind: HeroStatusKind.gripped, frames: DEATH_GRIP_STUN_FRAMES, group: HeroStatusGroup.sleep, immunityFrames: 90,
  pull: { frames: DEATH_GRIP_PULL_FRAMES, hold: DEATH_GRIP_HOLD },
};
export const DEATH_GRIP: SpecialProjectile = {
  model: DEATH_GRIP_MODEL, spawnFrame: DEATH_GRIP_SPAWN_FRAME, offsetX: 50.0, offsetZ: CHEST, velocityX: DEATH_GRIP_SPEED, velocityZ: 0.0,
  life: DEATH_GRIP_LIFE, radius: h(f32(0.15)),
  effect: { damage: 4.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false, element: HitElement.dark },
  reflectable: false, limit: 1, cancelOnInterrupt: true, status: GRIPPED,
};
const deathGrip = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 40,
  cooldownFrames: DEATH_GRIP_COOLDOWN,
  landingLag,
  projectiles: [DEATH_GRIP],
});

const CARRIED: AppliedStatus = { kind: HeroStatusKind.carried, frames: 100, group: HeroStatusGroup.sleep, immunityFrames: 240 };





const valkyrProjectile = (speed: number): SpecialProjectile => ({
  model: VALKYR_MODEL,
  spawnFrame: 26, offsetX: 40.0, offsetZ: f32(CHEST + 10.0), velocityX: speed, velocityZ: 0.0,
  life: 60, radius: h(f32(0.2)), effect: { damage: 5.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false, element: HitElement.dark },
  reflectable: true, limit: 1, status: CARRIED,
});
export const VALKYR = valkyrProjectile(5.0);
const shadowguard = (projectile: SpecialProjectile, landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 52,
  armor: { ...frames(10, 26), maxDamage: 8.0 },
  landingLag,
  projectiles: [projectile],
});

const ASCENT_FRAMES = 23;






function ascension(height: number, steer: number): AuthoredSpecial {
  return {
    endFrame: 46,
    facesStick: true,
    motion: [{ ...frames(8, 30), velocityX: 0.0, velocityZ: f32(h(height) / ASCENT_FRAMES), driftSpeed: f32(h(steer) / ASCENT_FRAMES) }],
    regions: [heroRegion(8, 30, capsule(0.0, 50.0, 0.0, 190.0, 62.0), hit(11.25, "LAUNCH", 80))],
    oncePerAirtime: true,
    helpless: true,
  };
}







const DEFILE_POOL: SpecialProjectile = {
  model: "Abilities\\Spells\\Undead\\UnholyAura\\UnholyAura.mdx",

  modelRadius: 1223.0,
  spawnFrame: 20, offsetX: h(f32(0.6)), offsetZ: 6.0, velocityX: 0.0, velocityZ: 0.0,
  life: 180, activeFrom: 18, radius: h(f32(0.3)),
  effect: { damage: 2.5, growth: 30.0, base: 30.0, launchX: f32(0.173648178), launchZ: f32(0.984807753), electric: false, element: HitElement.dark },
  reflectable: false, limit: 1, needsLineOfSight: true,
  pool: { every: 36, growth: 6.0, maxRadius: h(f32(0.6)) },
};
const DEFILE: AuthoredSpecial = {
  endFrame: 50,
  cooldownFrames: 320,
  groundOnly: true,
  projectiles: [DEFILE_POOL],
};

export const LICH_KING_SPECIALS: FighterSpecials = {
  neutral: {
    name: "Val'kyr Shadowguard",
    description: "A Val'kyr seizes the first foe she reaches and carries them toward the edge; mash to break free.",
    ground: shadowguard(VALKYR, undefined),
    air: shadowguard(VALKYR, AIR_LANDING_LAG),
  },
  side: {
    name: "Death Grip",
    description: "A death coil yanks the first foe it reaches to just in front of him, briefly stunned; shields stop it.",
    ground: deathGrip(undefined),
    air: deathGrip(AIR_LANDING_LAG),
  },
  up: {
    name: "Ascension of the Damned",
    description: "An ice column lifts him in a frost vortex, then a helpless fall.",
    ground: ascension(f32(2.7), f32(1.15)),

  },
  down: {
    name: "Defile",
    description: "Plant Frostmourne to spread a shadow pool; hurting a grounded foe grows it and flashes the edge. Jump out; recasts must wait.",
    ground: DEFILE,
    air: { ...DEFILE, groundOnly: false, landingLag: AIR_LANDING_LAG,
      projectiles: [{ model: DEFILE_POOL.model, modelRadius: DEFILE_POOL.modelRadius, spawnFrame: DEFILE_POOL.spawnFrame,
        offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: -8.0, life: 24,
        radius: DEFILE_POOL.radius, effect: DEFILE_POOL.effect, reflectable: DEFILE_POOL.reflectable, limit: DEFILE_POOL.limit }] },
  },
};
