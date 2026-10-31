


import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import type { AppliedStatus } from "../../sim/appliedStatus";
import { type AuthoredSpecial, type CompanionBody, type FighterSpecials, FollowUpInput, type SpecialCharge, type SpecialCompanion, type SpecialPlacement, type SpecialProjectile, frames } from "../../sim/specials/schema";
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







export const SOUL_CHARGE: SpecialCharge = { hold: 14, full: 180, stages: 1, meter: true, tether: true };
const SOUL_WINDOW = frames(1, SOUL_CHARGE.hold + 1);
export const GHOUL_RISE_FRAME = 18;

const GHOUL_BODY: CompanionBody = {
  weight: 70.0, gravity: f32(1.2), fallSpeed: 14.0, hopSpeed: 24.0, hopReach: h(f32(0.5)), airJumps: 1, airDrift: 5.0,
};
export const GHOUL: SpecialCompanion = {
  engage: 70.0, followSpeed: f32(5.5), followBehind: 0.0, returnSpeed: f32(5.5),
  lungeStartup: 12, lungeActive: 4, lungeRecovery: 30, lungeTravel: 16.0,
  bite: capsule(10.0, 30.0, 55.0, 50.0, 20.0), biteEffect: hit(4.0, "POKE", 40, 1.0, HitElement.normal),
  stunFrames: 0, leash: 0.0, leashFrames: 0, body: GHOUL_BODY,
};
const GHOUL_RISING: SpecialProjectile = {
  model: "Abilities\\Spells\\Undead\\RaiseSkeletonWarrior\\RaiseSkeleton.mdx",
  spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0, life: 40, radius: 1.0, activeFrom: 41,
  effect: hit(0.0, "POKE", 90), reflectable: false, limit: 1,
};
export const GHOUL_PLACEMENT: SpecialPlacement = {
  frame: GHOUL_RISE_FRAME, offsetX: h(f32(0.55)), radius: 22.0, height: 96.0, durability: 1.0, life: 1, fireAges: [],
  refusedWhileOut: true, mark: GHOUL_RISING, companion: GHOUL,
  model: { path: "Units\\Undead\\Ghoul\\Ghoul.mdx", height: 140.0, alpha: 255 },
};
const raiseGhoul = (landingLag: number | undefined): AuthoredSpecial => ({ name: "Raise Ghoul", endFrame: 38, landingLag, spendsCharge: true, placement: GHOUL_PLACEMENT });
const harvestSoul = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: SOUL_CHARGE.hold + 2, landingLag, charge: SOUL_CHARGE, jumpCancelFrame: SOUL_CHARGE.hold,
  followUps: [
    { window: SOUL_WINDOW, input: FollowUpInput.release, chargeStage: 0, special: { name: "Harvest Soul", endFrame: 14, landingLag } },
    { window: SOUL_WINDOW, input: FollowUpInput.shield, special: { name: "Harvest Soul", endFrame: 4, landingLag } },
    { window: frames(0, 0), chargeStage: SOUL_CHARGE.stages, special: raiseGhoul(landingLag) },
  ],
});

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
    name: "Harvest Soul",
    description: "Hold to tether the nearest foe at any range and drain souls into his meter; a hit breaks the tether but keeps what he drained. With a full meter, raise a Ghoul that fights beside him until it is knocked out; one at a time.",
    ground: harvestSoul(undefined),
    air: harvestSoul(AIR_LANDING_LAG),
  },
};
