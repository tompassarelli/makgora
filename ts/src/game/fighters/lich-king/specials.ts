


import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import type { AppliedStatus } from "../../sim/appliedStatus";
import { type AuthoredSpecial, type CompanionBody, type FighterSpecials, FollowUpInput, type SpecialCharge, type SpecialCompanion, type SpecialPlacement, type SpecialProjectile, frames } from "../../sim/specials/schema";
import { ANGLES } from "../../sim/heroes/authoring";
import { capsule, hit } from "./moves";

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

export const WYRM_SUMMON_FRAMES = 9;
export const WYRM_RIDE = frames(WYRM_SUMMON_FRAMES + 1, WYRM_SUMMON_FRAMES + 40);
const WYRM_RIDE_FRAMES = WYRM_RIDE.last - WYRM_RIDE.first + 1;
export const WYRM_RISE = f32(h(f32(2.4)) / WYRM_RIDE_FRAMES);
export const WYRM_LIFT = f32(h(f32(0.5)) / WYRM_RIDE_FRAMES);
export const WYRM_DRIFT = f32(h(f32(1.3)) / WYRM_RIDE_FRAMES);
export const WYRM_DISMOUNT_FRAMES = 7;
export const WYRM_BREATH_FRAMES = [14, 26, 38] as const;
export const WYRM_BREATH_LIFE = 16;
export const WYRM_BREATH_SPEED = 9.0;
export const WYRM_BREATH_REACH = 60.0;

const wyrmBreath = (spawnFrame: number): SpecialProjectile => ({
  model: "Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathMissile.mdx",
  spawnFrame, offsetX: 0.0, offsetZ: 30.0, velocityX: 0.0, velocityZ: 0.0,
  life: WYRM_BREATH_LIFE, radius: h(f32(0.25)), effect: hit(5.0, "POKE", 45), reflectable: false, limit: 1,
  breath: { speed: WYRM_BREATH_SPEED, reach: WYRM_BREATH_REACH },
});
export const WYRM_BREATHS = WYRM_BREATH_FRAMES.map((frame) => wyrmBreath(frame));

export const GALE_WYRM_RISE = f32(WYRM_RISE * f32(1.25));
export const GALE_WYRM_DRIFT = f32(WYRM_DRIFT * f32(1.4));

const frostWyrm = (rise: number, drift: number): AuthoredSpecial => ({
  endFrame: WYRM_RIDE.last + WYRM_DISMOUNT_FRAMES,
  facesStick: true,
  turnsAround: true,
  aimFrames: WYRM_RIDE.last,
  motion: [
    { ...frames(1, WYRM_SUMMON_FRAMES), velocityX: 0.0, velocityZ: 0.0 },
    { ...WYRM_RIDE, velocityX: 0.0, velocityZ: rise, driftSpeed: drift, liftSpeed: WYRM_LIFT },
  ],
  projectiles: WYRM_BREATHS,
  oncePerAirtime: true,
  helpless: true,
});
const FROST_WYRM: AuthoredSpecial = { ...frostWyrm(WYRM_RISE, WYRM_DRIFT), spendsEmpowered: true, variants: [frostWyrm(GALE_WYRM_RISE, GALE_WYRM_DRIFT)] };

export const GALE_SPAWN_FRAME = 14;
export const GALE_BEHIND = h(1.0);
export const GALE_SPEED = 16.0;
export const GALE_LIFE = 36;
export const GALE_LEE = h(f32(1.2));
export const GALE_OWNER_PUSH = 9.0;
export const GALE_BOOST_FRAMES = 60;
export const GALE_COOLDOWN = 120;
export const GALE_MODEL = "Abilities\\Spells\\Other\\Tornado\\TornadoElementalSmall.mdx";

const GALE_GROUNDED = { damage: 5.0, growth: 40.0, base: 30.0, launchX: ANGLES[20].x, launchZ: ANGLES[20].z, electric: false, element: HitElement.ice };
export const HOWLING_GALE: SpecialProjectile = {
  model: GALE_MODEL, spawnFrame: GALE_SPAWN_FRAME, offsetX: -GALE_BEHIND, offsetZ: CHEST, velocityX: GALE_SPEED, velocityZ: 0.0,
  life: GALE_LIFE, radius: h(f32(0.45)),
  effect: { damage: 7.0, growth: 60.0, base: 45.0, launchX: ANGLES[25].x, launchZ: ANGLES[25].z, electric: false, element: HitElement.ice },
  reflectable: false, limit: 1,
  gust: { lee: GALE_LEE, leeHeight: h(1.0), groundedEffect: GALE_GROUNDED, ownerPush: GALE_OWNER_PUSH },
};
const howlingGale = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 32,
  cooldownFrames: GALE_COOLDOWN,
  oncePerAirtime: true,
  landingLag,
  projectiles: [HOWLING_GALE],
  empowers: { frame: GALE_SPAWN_FRAME, shots: 1, frames: GALE_BOOST_FRAMES },
});







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
    name: "Death Grip",
    description: "A death coil yanks the first foe it reaches to just in front of him, briefly stunned; shields stop it.",
    ground: deathGrip(undefined),
    air: deathGrip(AIR_LANDING_LAG),
  },
  side: {
    name: "Howling Gale",
    description: "After a short delay a frost gale rises one body behind him and blows forward over him. He breaks the wind, so a foe standing close is spared; farther out it launches standing foes and hurls airborne ones harder. In the air it carries him forward, and Frost Wyrm flies faster and farther while it blows and just after.",
    ground: howlingGale(undefined),
    air: howlingGale(AIR_LANDING_LAG),
  },
  up: {
    name: "Frost Wyrm",
    description: "A Frost Wyrm rises under him and carries him up, steered by the stick, breathing frost where he aims; then he leaps off, helpless.",
    ground: FROST_WYRM,

  },
  down: {
    name: "Harvest Soul",
    description: "Hold to tether the nearest foe at any range and drain souls into his meter; a hit breaks the tether but keeps what he drained. With a full meter, raise a Ghoul that fights beside him until it is knocked out; one at a time.",
    ground: harvestSoul(undefined),
    air: harvestSoul(AIR_LANDING_LAG),
  },
};
