import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialMotion, type SpecialProjectile } from "../../sim/specials/schema";
import { capsule, hit, tyrandeCastBody } from "./moves";

export const SEARING_ARROW_MODEL = "Abilities\\Weapons\\SearingArrow\\SearingArrowMissile.mdl";
export const MOON_ARROW_MODEL = "Abilities\\Weapons\\MoonPriestessMissile\\MoonPriestessMissile.mdl";
export const ARROW_SPAWN_FRAME = 8;
export const ARROW_LIFE = 22;
export const EMPOWERED_SHOTS = 3;
export const EMPOWERED_FRAMES = 300;
export const ELUNE_REFLECT = frames(4, 12);

const mark = (model: string, spawnFrame: number, life: number, offsetX: number, offsetZ = 0.0): SpecialProjectile => ({
  model, spawnFrame, offsetX, offsetZ, velocityX: 0.0, velocityZ: 0.0, life, radius: 1.0, activeFrom: life + 1,
  effect: hit(0.0, "TAP", 90), reflectable: false, limit: 2,
});

const SEARING_ARROW: SpecialProjectile = {
  model: SEARING_ARROW_MODEL, spawnFrame: ARROW_SPAWN_FRAME, offsetX: 40.0, offsetZ: 70.0, velocityX: 24.0, velocityZ: 0.0,
  life: ARROW_LIFE, radius: 10.0, effect: { ...hit(3.0, "TAP", 20, 1.0, HitElement.fire), growth: 10.0, base: 8.0 }, reflectable: true, limit: 2,
};
const MOON_ARROW: SpecialProjectile = {
  ...SEARING_ARROW, model: MOON_ARROW_MODEL, effect: hit(6.0, "POKE", 30, 1.0, HitElement.arcane), pierces: true,
};
const arrowShot = (air: boolean, arrow: SpecialProjectile): AuthoredSpecial => ({
  endFrame: 24, landingLag: air ? 10 : undefined,
  projectiles: [arrow],
  hurt: tyrandeCastBody(5, 14, 52.0, 72.0),
});
const searingArrows = (air: boolean): AuthoredSpecial => ({
  ...arrowShot(air, SEARING_ARROW), spendsEmpowered: true, variants: [arrowShot(air, MOON_ARROW)],
});

const TRUESHOT_AURA = "Abilities\\Spells\\NightElf\\TrueshotAura\\TrueshotAura.mdl";
const trueshotAura = (air: boolean): AuthoredSpecial => ({
  endFrame: 30, landingLag: air ? 14 : undefined,
  projectiles: [mark(TRUESHOT_AURA, 1, 30, 0.0)],
  empowers: { frame: 14, shots: EMPOWERED_SHOTS, frames: EMPOWERED_FRAMES },
});

export const LEAP_RISE = f32(HERO_REFERENCE_HEIGHT * f32(2.2));
const leapMotion: readonly SpecialMotion[] = [
  { ...frames(1, 5), velocityX: 0.0, velocityZ: 0.0 },
  { ...frames(6, 25), velocityX: 0.0, velocityZ: f32(LEAP_RISE / 20.0), driftSpeed: f32(5.0) },
  { ...frames(26, 32), velocityX: 0.0, velocityZ: 0.0, driftSpeed: f32(5.0) },
];
const MOONLIGHT_LEAP: AuthoredSpecial = {
  endFrame: 32, oncePerAirtime: true, helpless: true, landingLag: 20, facesStick: true,
  projectiles: [mark("Abilities\\Spells\\NightElf\\Starfall\\StarfallCaster.mdx", 5, 20, 0.0)],
  regions: [heroRegion(6, 12, capsule(0.0, 20.0, 0.0, 110.0, 34.0), hit(5.0, "LAUNCH", 80, 1.0, HitElement.arcane))],
  motion: leapMotion,
};

export const ELUNE_SHIMMER = "Abilities\\Spells\\Items\\SpellShieldAmulet\\SpellShieldCaster.mdl";
const eluneGrace = (air: boolean): AuthoredSpecial => ({
  endFrame: 30, landingLag: air ? 10 : undefined, cooldownFrames: 24, jumpCancelFrame: 4,
  airStall: air ? frames(1, 12) : undefined,
  projectiles: [{ ...mark(ELUNE_SHIMMER, 3, 12, 45.0, 60.0), radius: 40.0 }],
  regions: [heroRegion(4, 4, capsule(-34.0, 56.0, 34.0, 56.0, 40.0), { ...hit(2.0, "LINK", 20, 1.0, HitElement.arcane), growth: 0.0, setKnockback: 60.0 })],
  reflects: ELUNE_REFLECT,
});

export const TYRANDE_SPECIALS: FighterSpecials = {
  neutral: { name: "Searing Arrows", description: "A fast flaming arrow that barely staggers, fired on the ground or in the air without stopping. After Trueshot Aura, three moonlit arrows hit harder and pierce the first foe. Shield it or send it back.",
    ground: searingArrows(false), air: searingArrows(true) },
  side: { name: "Trueshot Aura", description: "A short moonlit stance that empowers her next three Searing Arrows for five seconds. She stands still while it rises, so a foe who reads it gets a free hit.",
    ground: trueshotAura(false), air: trueshotAura(true) },
  up: { name: "Moonlight Leap", description: "A star-trailed leap more than twice her height that steers wide and taps anyone she passes, then falls helpless. Guard the ledge high.",
    ground: MOONLIGHT_LEAP },
  down: { name: "Elune's Grace", description: "A silver shimmer that turns back projectiles that touch her and pushes a close foe. Jump out of it early; it cannot be used again at once. Grab her or strike through it.",
    ground: eluneGrace(false), air: eluneGrace(true) },
};
