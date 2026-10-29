import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, type ToggleAura } from "../../sim/specials/schema";
import { butcherReachBody, capsule, hit } from "./moves";

const AIR_LANDING_LAG = 22;
export const HOOK_MODEL = "Abilities\\Weapons\\MeatwagonMissile\\MeatwagonMissile.mdx";

export const HOOK_THROW_FRAME = 14;
export const HOOK_FLIGHT_FRAMES = 16;
export const HOOK_REACH = 420.0;
export const HOOK_REEL_FRAMES = 14;
const HOOK_SPEED = f32(HOOK_REACH / HOOK_FLIGHT_FRAMES);
const HOOK_WHIFF_RECOVERY = 40;

const hook = (latches: boolean): SpecialProjectile => ({
  model: HOOK_MODEL, spawnFrame: HOOK_THROW_FRAME, offsetX: 60.0, offsetZ: 80.0, velocityX: HOOK_SPEED, velocityZ: 0.0,
  life: HOOK_FLIGHT_FRAMES, radius: 22.0, effect: hit(8.0, "POKE", 40, 1.0, HitElement.slash), reflectable: true, limit: 1,
  cancelOnInterrupt: true, latch: latches ? { reelFrames: HOOK_REEL_FRAMES } : undefined,
});
const meatHook = (air: boolean): AuthoredSpecial => ({
  endFrame: HOOK_THROW_FRAME + HOOK_FLIGHT_FRAMES + HOOK_WHIFF_RECOVERY, landingLag: air ? AIR_LANDING_LAG : undefined,
  hurt: butcherReachBody(HOOK_THROW_FRAME - 4, HOOK_THROW_FRAME + HOOK_FLIGHT_FRAMES, 120.0, 90.0),
  projectiles: [hook(!air)],
});

export const CHARGE_ARMOR = { ...frames(8, 20), maxDamage: 5.0, perStack: 1.0 } as const;
const butchersCharge = (air: boolean): AuthoredSpecial => ({
  endFrame: 44, landingLag: air ? AIR_LANDING_LAG : undefined,
  hurt: butcherReachBody(8, 22, 60.0, 60.0),
  armor: CHARGE_ARMOR,
  motion: [{ ...frames(1, 7), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(8, 20), velocityX: 15.0, velocityZ: 0.0, stopsAtBody: true, stopsAtShield: true }, { ...frames(21, 22), velocityX: 0.0, velocityZ: 0.0 }],
  regions: [heroRegion(8, 22, capsule(20.0, 50.0, 90.0, 50.0, 46.0), hit(11.0, "EDGE", 40, 1.0, HitElement.normal))],
});

export const SWING_TETHER = { ...frames(6, 20), reach: capsule(10.0, 80.0, 220.0, 320.0, 60.0) } as const;
const SWING_RISE = f32(HERO_REFERENCE_HEIGHT * f32(1.4));
const hookSwing: AuthoredSpecial = {
  endFrame: 34, oncePerAirtime: true, helpless: true, catchesLedge: true, landingLag: 26, facesStick: true,
  projectiles: [{ ...hook(false), spawnFrame: 6, offsetX: 30.0, offsetZ: 110.0, velocityX: 15.0, velocityZ: 15.0, life: 14, reflectable: false, effect: hit(6.0, "LAUNCH", 70, 1.0, HitElement.slash) }],
  regions: [heroRegion(10, 18, capsule(0.0, 60.0, 30.0, 150.0, 40.0), hit(6.0, "LAUNCH", 80, 1.0, HitElement.normal))],
  motion: [{ ...frames(1, 9), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(10, 24), velocityX: 0.0, velocityZ: f32(SWING_RISE / 15), driftSpeed: 2.0 }],
  ledgeTether: SWING_TETHER,
};

export const ROT: ToggleAura = { frame: 5, radius: 90.0, every: 10, damage: 1.0, slowScale: f32(0.85), slowFrames: 12, selfEvery: 20, selfDamage: 1.0 };
const rot: AuthoredSpecial = { endFrame: 10, toggleAura: ROT };

export const BUTCHER_SPECIALS: FighterSpecials = {
  neutral: { name: "Meat Hook", description: "He flings his hook straight ahead; it catches the first foe it reaches and reels them into his hands. A shield stops it, and a miss leaves him wide open.",
    ground: meatHook(false), air: meatHook(true) },
  side: { name: "Butcher's Charge", description: "A belly-first rush that shrugs off light hits and bowls the foe over. Shield it or hit him hard.",
    ground: butchersCharge(false), air: butchersCharge(true) },
  up: { name: "Hook Swing", description: "He flings the hook up and ahead: if it bites the ledge it reels him there; otherwise he hops a short way and falls helpless.",
    ground: hookSwing },
  down: { name: "Rot", description: "Toggle: a stinking cloud around him burns and slows anyone close, and bleeds him while it lasts. Keep out of it.",
    ground: rot },
};
