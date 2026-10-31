import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import { CHARGED_AIM_FRAMES, FollowUpInput, frames, type AuthoredSpecial, type FighterSpecials, type SpecialCharge, type SpecialFollowUp, type SpecialProjectile } from "../../sim/specials/schema";
import { groundHit } from "../../sim/heroes/groundNormals";
import type { AuraTrail, ToggleAura } from "../../sim/specials/auraSchema";
import { butcherReachBody, capsule, hit } from "./moves";

const AIR_LANDING_LAG = 22;
export const HOOK_MODEL = "Abilities\\Weapons\\WyvernSpear\\WyvernSpearMissile.mdx";

export const HOOK_CHARGE: SpecialCharge = { hold: 6, full: 60, stages: 3, releases: true };
export const HOOK_THROW_FRAME = CHARGED_AIM_FRAMES;
export const HOOK_FLIGHT_FRAMES = [14, 18, 23, 28] as const;
export const HOOK_REEL_FRAMES = 14;
export const HOOK_SPEED = f32(420.0 / 16);
export const HOOK_REACH = f32(HOOK_SPEED * HOOK_FLIGHT_FRAMES[3]);
const HOOK_AIM_ALONG = f32(HOOK_SPEED * f32(0.8660254));
const HOOK_AIM_RISE = f32(HOOK_SPEED * f32(0.5));
const HOOK_WHIFF_RECOVERY = 40;
const HOOK_WINDOW = frames(1, HOOK_CHARGE.hold + 1);

const hookHead = (latches: boolean, life: number): SpecialProjectile => ({
  model: HOOK_MODEL, spawnFrame: HOOK_THROW_FRAME, offsetX: 60.0, offsetZ: 80.0, velocityX: HOOK_SPEED, velocityZ: 0.0,
  life, radius: 22.0, modelRadius: 13.75, effect: hit(8.0, "POKE", 40, 1.0, HitElement.slash), reflectable: true, limit: 1,
  cancelOnInterrupt: true, latch: latches ? { reelFrames: HOOK_REEL_FRAMES } : undefined,
});
const hookThrow = (air: boolean, stage: number): AuthoredSpecial => {
  const life = HOOK_FLIGHT_FRAMES[stage] ?? HOOK_FLIGHT_FRAMES[0];
  return {
    name: "Meat Hook Throw", endFrame: HOOK_THROW_FRAME + life + HOOK_WHIFF_RECOVERY, landingLag: air ? AIR_LANDING_LAG : undefined,
    aimFrames: CHARGED_AIM_FRAMES, spendsCharge: true, hurt: butcherReachBody(HOOK_THROW_FRAME - 4, HOOK_THROW_FRAME + life, 120.0, 90.0),
    projectiles: [{ ...hookHead(!air, life), latchesLedge: air ? true : undefined, upVelocityX: HOOK_AIM_ALONG, upVelocityZ: HOOK_AIM_RISE, downVelocity: { velocityX: HOOK_AIM_ALONG, velocityZ: f32(-HOOK_AIM_RISE) } }],
  };
};
const hookFollowUps = (air: boolean): readonly SpecialFollowUp[] => [
  ...[0, 1, 2, 3].map((stage): SpecialFollowUp => ({ window: HOOK_WINDOW, input: FollowUpInput.release, chargeStage: stage, special: hookThrow(air, stage) })),
  { window: HOOK_WINDOW, input: FollowUpInput.shield, special: { name: "Meat Hook Store", endFrame: 8 } },
];
const meatHook = (air: boolean): AuthoredSpecial => ({
  endFrame: HOOK_CHARGE.hold + 2, landingLag: air ? AIR_LANDING_LAG : undefined, charge: HOOK_CHARGE, followUps: hookFollowUps(air),
});

export const CHARGE_ARMOR = { ...frames(8, 14), maxDamage: 3.0, perStack: 1.0 } as const;
export const CHARGE_END_FRAME = 64;
const butchersCharge = (air: boolean): AuthoredSpecial => ({
  endFrame: CHARGE_END_FRAME, landingLag: air ? AIR_LANDING_LAG : undefined,
  hurt: butcherReachBody(8, 22, 60.0, 60.0),
  armor: CHARGE_ARMOR,
  motion: [{ ...frames(1, 7), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(8, 20), velocityX: 15.0, velocityZ: 0.0, stopsAtBody: true, stopsAtShield: true }, { ...frames(21, 22), velocityX: 0.0, velocityZ: 0.0 }],
  regions: [heroRegion(8, 22, capsule(20.0, 50.0, 90.0, 50.0, 46.0), hit(11.0, "EDGE", 40, 1.0, HitElement.normal))],
});

export const SWING_TETHER = { ...frames(6, 20), reach: capsule(10.0, 80.0, 220.0, 320.0, 60.0) } as const;
const SWING_RISE = f32(HERO_REFERENCE_HEIGHT * f32(1.4));
const hookSwing: AuthoredSpecial = {
  endFrame: 34, oncePerAirtime: true, helpless: true, catchesLedge: true, landingLag: 26, facesStick: true,
  projectiles: [{ ...hookHead(false, 14), spawnFrame: 6, offsetX: 30.0, offsetZ: 110.0, velocityX: 15.0, velocityZ: 15.0, life: 14, reflectable: false, effect: hit(6.0, "LAUNCH", 70, 1.0, HitElement.slash) }],
  regions: [heroRegion(10, 18, capsule(0.0, 60.0, 30.0, 150.0, 40.0), hit(6.0, "LAUNCH", 80, 1.0, HitElement.normal))],
  motion: [{ ...frames(1, 9), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(10, 24), velocityX: 0.0, velocityZ: f32(SWING_RISE / 15), driftSpeed: 2.0 }],
  ledgeTether: SWING_TETHER,
};

export const ROT_RADIUS = 90.0;
export const ROT_PATCH_FRAMES = 180;
export const ROT_PATCH_EVERY = 12;
export const ROT_PATCH_LIMIT = idiv(ROT_PATCH_FRAMES + ROT_PATCH_EVERY - 1, ROT_PATCH_EVERY);
const ROT_PATCH_MODEL = "Abilities\\Spells\\Undead\\PlagueCloud\\PlagueCloudCaster.mdx";

export const ROT_PATCH: SpecialProjectile = {
  model: ROT_PATCH_MODEL, modelRadius: 50.0, spawnFrame: 0, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0,
  life: ROT_PATCH_FRAMES, activeFrom: ROT_PATCH_FRAMES + 1, radius: f32(f32(0.4) * ROT_RADIUS), effect: groundHit(0.0, 85, 0.0, 0.0, HitElement.poison), reflectable: false, limit: ROT_PATCH_LIMIT,
};

export const ROT_TRAIL: AuraTrail<SpecialProjectile> = { patch: ROT_PATCH, every: ROT_PATCH_EVERY, minTravel: 24.0, limit: ROT_PATCH_LIMIT };

export const ROT: ToggleAura<SpecialProjectile> = {
  frame: 5, radius: ROT_RADIUS, every: 10, damage: 1.0, slowScale: f32(0.85), slowFrames: 12, selfEvery: 20, selfDamage: 1.0,
  trail: ROT_TRAIL,
};
const rot: AuthoredSpecial = { endFrame: 10, toggleAura: ROT };

export const BUTCHER_SPECIALS: FighterSpecials = {
  neutral: { name: "Meat Hook", description: "Hold to wind the hook up and release to throw: a tap flings it a short way, a full hold about twice as far, and for a moment after the release the stick angles the throw up or down. It catches the first foe it reaches and reels them into his hands. A shield stops it, and a miss leaves him wide open. Shield keeps the charge for the next press. Thrown in the air, the first hook of each jump that reaches the ledge ahead reels him onto it.",
    ground: meatHook(false), air: meatHook(true) },
  side: { name: "Stitches' Charge", description: "A belly-first rush that shrugs off light hits and bowls the foe over. Shield it or hit him hard.",
    ground: butchersCharge(false), air: butchersCharge(true) },
  up: { name: "Hook Swing", description: "He flings the hook up and ahead: if it bites the ledge it reels him there; otherwise he hops a short way and falls helpless.",
    ground: hookSwing },
  down: { name: "Rot", description: "Toggle: a stinking cloud around him burns and slows anyone close, and bleeds him while it lasts. Moving on the ground with it on, he leaves rot on the floor that goes on burning and slowing foes who cross it for three seconds after he has passed. Keep out of it.",
    ground: rot },
};
