
import { withExKit } from "../../sim/exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { type AuthoredSpecial, CompanionOrder, type FighterSpecials, type SpecialCompanion, type SpecialMotion, type SpecialPlacement, type SpecialProjectile, frames } from "../../sim/specials/schema";
import { capsule, hit } from "./moves";
import type { AppliedStatus } from "../../sim/heroStatus";

const h = (multiple: number): number => f32(HERO_REFERENCE_HEIGHT * f32(multiple));
const AIR_SPECIAL_LANDING_LAG = 20;
const axe = (spawnFrame: number, height: number): SpecialProjectile => ({
  spawnFrame, offsetX: h(f32(0.35)), offsetZ: h(height),
  velocityX: h(f32(0.12)), velocityZ: 0.0, life: 80, radius: h(f32(0.12)),
  effect: hit(3.4094698429107666, "POKE", 40), returnEffect: hit(2.7275757789611816, "LINK", 65),
  returns: { age: 24, speed: h(f32(0.15)) }, reflectable: true, limit: 1,
  model: "Abilities\\Weapons\\Axe\\AxeMissile.mdx",
});
export const WILD_AXES = [axe(16, f32(0.35)), axe(20, f32(0.65))];
const wildAxes = (air: boolean): AuthoredSpecial => ({
  endFrame: 35, projectiles: WILD_AXES,
  landingLag: air ? AIR_SPECIAL_LANDING_LAG : undefined,
});
export const BEAR: SpecialCompanion = {
  followSpeed: h(f32(0.035)), followBehind: h(f32(0.8)), returnSpeed: h(f32(0.06)),
  lungeStartup: 12, lungeActive: 8, lungeRecovery: 80, lungeTravel: h(f32(2.6)),
  bite: capsule(0.0, 25.0, h(f32(0.5)), 60.0, 28.0),
  biteEffect: hit(10.0, "KILL", 40, 1.0, HitElement.normal),
  stunFrames: 18, leash: h(6.0), leashFrames: 120,
};
export const BEAR_PLACEMENT: SpecialPlacement = {
  frame: 29, offsetX: h(f32(0.6)), radius: h(f32(0.4)), height: h(f32(1.1)),
  durability: 20.0, life: 240, fireAges: [], companion: BEAR,
};
const stampede = (spawnFrame: number): SpecialProjectile => ({
  spawnFrame, offsetX: h(f32(0.4)), offsetZ: h(f32(0.15)),
  velocityX: h(f32(0.14)), velocityZ: 0.0, life: 44, radius: h(f32(0.15)),
  effect: hit(0.5, "POKE", 25, 1.0, HitElement.normal), reflectable: false, limit: 1,
  model: "Abilities\\Spells\\Other\\Stampede\\StampedeMissile.mdx",
});
export const STAMPEDE = [stampede(2), stampede(5), stampede(8)];
const SUMMON_BEAR: AuthoredSpecial = { endFrame: 49, groundOnly: true, placement: BEAR_PLACEMENT };
const BEAR_COMMAND: AuthoredSpecial = { name: "Stampede", endFrame: 32, cooldownFrames: 360, command: { frame: 4, order: CompanionOrder.lunge }, projectiles: STAMPEDE };
export const QUILL: SpecialProjectile = {
  spawnFrame: 0, offsetX: h(f32(0.4)), offsetZ: h(f32(0.45)),
  velocityX: h(f32(0.14)), velocityZ: 0.0, life: 24, radius: h(f32(0.12)),
  effect: hit(2.0456817150115967, "LINK", 35, 1.0, HitElement.normal), reflectable: true, limit: 3,
  model: "Abilities\\Weapons\\QuillSprayMissile\\QuillSprayMissile.mdx",
};
const QUILBEAST: SpecialCompanion = {
  ...BEAR, behavior: "sentry", followSpeed: 0.0, lungeStartup: 10, lungeActive: 17, lungeRecovery: 21, lungeTravel: 0.0,
  volleyFrames: [11, 19, 27],
};
export const QUILBEAST_PLACEMENT: SpecialPlacement = {
  slot: 1, frame: 18, offsetX: h(f32(0.65)), radius: h(f32(0.32)), height: h(f32(0.8)),
  durability: 18.0, life: 140, fireAges: [18, 108], shot: QUILL, companion: QUILBEAST,
  model: { path: "units\\creeps\\QuillBeast\\QuillBeast.mdl", height: 120.0, alpha: 255 },
};
const SUMMON_QUILBEAST: AuthoredSpecial = { endFrame: 32, groundOnly: true, placement: QUILBEAST_PLACEMENT };
const QUILL_VOLLEY: AuthoredSpecial = { name: "Quill Volley", endFrame: 24, facesStick: true, command: { frame: 3, order: CompanionOrder.lunge, slot: 1 } };
export const HAWK_STUN: AppliedStatus = { kind: HeroStatusKind.stun, frames: 40, group: HeroStatusGroup.sleep, immunityFrames: 300 };
export const HAWK: SpecialCompanion = {
  ...BEAR, behavior: "flying", followSpeed: h(f32(0.07)), followBehind: -h(f32(0.6)), followHeight: h(f32(1.2)),
  lungeStartup: 8, lungeActive: 8, lungeRecovery: 28, lungeTravel: h(f32(2.0)), lungeDrop: h(f32(1.4)),
  bite: capsule(-20.0, 0.0, 30.0, 40.0, 26.0), biteEffect: hit(5.0, "LINK", 80, 1.0, HitElement.normal), biteStatus: HAWK_STUN,
};
export const HAWK_PLACEMENT: SpecialPlacement = {
  slot: 2, frame: 12, offsetX: h(f32(0.6)), offsetZ: h(f32(1.2)), radius: 18.0, height: 45.0,
  durability: 12.0, life: 600, fireAges: [], companion: HAWK, keepExisting: true,
  model: { path: "units\\creeps\\WarEagle\\WarEagle.mdl", height: 80.0, alpha: 255 },
};
const SUMMON_HAWK: AuthoredSpecial = { endFrame: 26, groundOnly: true, placement: HAWK_PLACEMENT };
const HAWK_DIVE: AuthoredSpecial = { name: "Hawk Dive", endFrame: 24, facesStick: true, command: { frame: 3, order: CompanionOrder.lunge, slot: 2 } };
const lift = (rise: number, drift: number, steer: number): SpecialMotion[] => {
  const segment = (first: number, last: number, share: number): SpecialMotion =>
    ({
      ...frames(first, last), velocityX: f32(f32(drift * share) / (last - first + 1)), velocityZ: f32(f32(rise * share) / (last - first + 1)),
      driftSpeed: f32(f32(steer * share) / (last - first + 1)),
    });
  return [segment(10, 15, 0.5), segment(16, 27, f32(0.46)), segment(28, 32, f32(0.04))];
};
const hawkLift = (rise: number, drift: number, steer: number): AuthoredSpecial => ({
  name: "Hawk Lift", endFrame: 32, motion: lift(rise, drift, steer), facesStick: true, oncePerAirtime: true, helpless: true,
  placement: { ...HAWK_PLACEMENT, frame: 10 },
});
export const BEASTMASTER_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Wild Axes", description: "Throw two axes; move to guide their return through the enemy.", ground: wildAxes(false), air: wildAxes(true) }, { reach: 1.25 }),
  side: withExKit({ name: "Summon Bear", description: "Call Bear; press again and it roars, charges far ahead and mauls for heavy knockback while three thunder lizards stampede.", ground: SUMMON_BEAR, recall: BEAR_COMMAND }, { durability: 1.25 }),
  up: withExKit({ name: "Summon Hawk", description: "Call Hawk, then command a fast dive that stuns whoever it strikes. In the air, Hawk carries him up.", ground: SUMMON_HAWK, recall: HAWK_DIVE, recallGroundOnly: true, air: hawkLift(h(f32(3.48)), h(f32(0.3)), h(f32(3.02))) }, { durability: 1.25 }),
  down: withExKit({ name: "Summon Quilbeast", description: "Set a large Quilbeast firing position; press again for a three-quill volley from it.", ground: SUMMON_QUILBEAST, air: { endFrame: SUMMON_QUILBEAST.endFrame, landingLag: AIR_SPECIAL_LANDING_LAG,
    projectiles: [18, 22, 26].map(spawnFrame => ({ ...QUILL, spawnFrame, offsetZ: 0.0, velocityX: h(f32(0.035)), velocityZ: -h(f32(0.14)) })) }, recall: QUILL_VOLLEY }, { durability: 1.25 }),
};
