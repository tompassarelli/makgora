import { f32 } from "wisp/src/sim/f32";
import { Character, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../../sim/specials/schema";
import { DRAGON_SCALE, onyxiaCastBody, onyxiaHit, reachOf } from "./moves";

export const SHADOW_BOLT_MODEL = "Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilMissile.mdl";
export const REVEAL_MODEL = "Abilities\\Spells\\Other\\HowlOfTerror\\HowlCaster.mdl";
export const FLAME_BREATH_MODEL = "Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireMissile.mdx";
export const WING_BUFFET_MODEL = "Abilities\\Spells\\Other\\Tornado\\Tornado_Target.mdl";
export const FORM_SWAP_COOLDOWN = 300;
export const REVEAL_FRAMES = 44;
export const HUMAN_GUISE_FRAMES = 26;

const SHADOW_BOLT: SpecialProjectile = {
  model: SHADOW_BOLT_MODEL, spawnFrame: 9, offsetX: 40.0, offsetZ: 64.0, velocityX: 16.0, velocityZ: 0.0,
  life: 24, radius: 14.0, effect: onyxiaHit(5.0, 40, 40.0, 30.0), reflectable: true, limit: 2,
};
const shadowBolt = (air: boolean): AuthoredSpecial => ({
  endFrame: 30, landingLag: air ? 12 : undefined, hurt: onyxiaCastBody(Character.onyxia, 5, 20), projectiles: [SHADOW_BOLT],
});

const courtlyFeint = (air: boolean): AuthoredSpecial => ({
  endFrame: 34, landingLag: 18, oncePerAirtime: air ? true : undefined,
  motion: [{ ...frames(6, 14), velocityX: 15.0, velocityZ: air ? 1.0 : 0.0, stopsAtShield: true }],
  regions: [heroRegion(10, 14, reachOf(16.0, 48.0, 64.0, 52.0, 30.0), onyxiaHit(7.0, 55, 60.0, 34.0))],
});

const ASCENT_RISE = f32(HERO_REFERENCE_HEIGHT * f32(2.0));
const SHADOW_ASCENT: AuthoredSpecial = {
  endFrame: 36, landingLag: 22, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(8, 25), velocityX: 0.0, velocityZ: f32(ASCENT_RISE / 18.0), driftSpeed: f32(4.0) }],
  regions: [heroRegion(8, 16, reachOf(0.0, 20.0, 0.0, 110.0, 34.0), onyxiaHit(4.0, 80, 60.0, 40.0))],
};

const reveal = (air: boolean): AuthoredSpecial => ({
  endFrame: REVEAL_FRAMES, landingLag: air ? 10 : undefined, cooldownFrames: FORM_SWAP_COOLDOWN, airStall: air ? frames(1, REVEAL_FRAMES) : undefined,
  hurt: onyxiaCastBody(Character.onyxia, 1, REVEAL_FRAMES),
  projectiles: [{ model: REVEAL_MODEL, spawnFrame: 30, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0, life: 14, radius: 1.0, activeFrom: 15,
    effect: onyxiaHit(0.0, 90, 0.0, 0.0), reflectable: false, limit: 2 }],
  regions: [heroRegion(38, 41, reachOf(-90.0, 50.0, 90.0, 50.0, 50.0), onyxiaHit(6.0, 40, 70.0, 40.0, HitElement.fire))],
  becomes: { frame: REVEAL_FRAMES, character: Character.onyxiaDragon },
});

export const PRESTOR_SPECIALS: FighterSpecials = {
  neutral: { name: "Shadow Bolt", description: "A quick, short bolt of shadow that holds a foe in place for her next strike. Shield it or send it back.",
    ground: shadowBolt(false), air: shadowBolt(true) },
  side: { name: "Courtly Feint", description: "A gliding step and a palm strike that pops a foe up into her combos. A shield stops the step.",
    ground: courtlyFeint(false), air: courtlyFeint(true) },
  up: { name: "Shadow Ascent", description: "She rises in a column of shadow that taps anyone she passes, then falls helpless.",
    ground: SHADOW_ASCENT },
  down: { name: "Reveal", description: "The noblewoman drops her guise and becomes Onyxia the dragon. Any hit before the wings open keeps her human; she cannot change back for five seconds.",
    ground: reveal(false), air: reveal(true) },
};

const D = DRAGON_SCALE;
const BREATH_TICKS = [14, 20, 26, 32] as const;
const FLAME_BREATH: AuthoredSpecial = {
  endFrame: 52, landingLag: 18, hurt: onyxiaCastBody(Character.onyxiaDragon, 8, 40),
  projectiles: [{ model: FLAME_BREATH_MODEL, spawnFrame: 12, offsetX: f32(60.0 * D), offsetZ: f32(50.0 * D), velocityX: 8.0, velocityZ: 0.0, life: 24, radius: 1.0, activeFrom: 25,
    effect: onyxiaHit(0.0, 90, 0.0, 0.0), reflectable: false, limit: 2 }],
  regions: BREATH_TICKS.map((first, index) => heroRegion(first, first + 3, reachOf(f32(40.0 * D), f32(50.0 * D), f32(120.0 * D), f32(40.0 * D), f32(30.0 * D)),
    index === BREATH_TICKS.length - 1 ? onyxiaHit(7.0, 35, 104.0, 30.0, HitElement.fire) : { ...onyxiaHit(3.0, 40, 0.0, 0.0, HitElement.fire), setKnockback: 30.0 })),
  rehits: BREATH_TICKS.slice(1).map((first) => first),
};

const wingBuffet = (air: boolean): AuthoredSpecial => ({
  endFrame: 40, landingLag: air ? 16 : undefined, airStall: air ? frames(1, 24) : undefined,
  projectiles: [{ model: WING_BUFFET_MODEL, spawnFrame: 12, offsetX: f32(50.0 * D), offsetZ: f32(30.0 * D), velocityX: 14.0, velocityZ: 0.0,
    life: 22, radius: 44.0, effect: { ...onyxiaHit(4.0, 25, 0.0, 0.0, HitElement.normal), setKnockback: 120.0 }, reflectable: false, limit: 1 }],
});

const LIFT_RISE = f32(HERO_REFERENCE_HEIGHT * f32(2.6));
const WING_LIFT: AuthoredSpecial = {
  endFrame: 40, landingLag: 26, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(10, 31), velocityX: 0.0, velocityZ: f32(LIFT_RISE / 22.0), driftSpeed: f32(6.0) }],
  regions: [heroRegion(10, 14, reachOf(-60.0, 40.0, 60.0, 40.0, 60.0), onyxiaHit(9.0, 80, 90.0, 40.0, HitElement.normal))],
};

const humanGuise = (air: boolean): AuthoredSpecial => ({
  endFrame: HUMAN_GUISE_FRAMES, landingLag: air ? 8 : undefined, cooldownFrames: FORM_SWAP_COOLDOWN,
  hurt: onyxiaCastBody(Character.onyxiaDragon, 1, HUMAN_GUISE_FRAMES),
  projectiles: [{ model: REVEAL_MODEL, spawnFrame: 4, offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: 0.0, life: 14, radius: 1.0, activeFrom: 15,
    effect: onyxiaHit(0.0, 90, 0.0, 0.0), reflectable: false, limit: 2 }],
  becomes: { frame: HUMAN_GUISE_FRAMES, character: Character.onyxia },
});

export const DRAGON_SPECIALS: FighterSpecials = {
  neutral: { name: "Flame Breath", description: "A cone of fire ahead of her that holds a foe through three bursts and launches on the fourth. Get out of the cone or shield it.",
    ground: FLAME_BREATH },
  side: { name: "Wing Buffet", description: "One beat of her wings sends a gust that shoves a foe far away, best off the ledge. It barely hurts.",
    ground: wingBuffet(false), air: wingBuffet(true) },
  up: { name: "Wing Lift", description: "A great wingbeat that lifts her high and knocks away anyone beside her, then she falls helpless.",
    ground: WING_LIFT },
  down: { name: "Human Guise", description: "She folds her wings and returns to Lady Katrana Prestor; she cannot become the dragon again for five seconds.",
    ground: humanGuise(false), air: humanGuise(true) },
};
