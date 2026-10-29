import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { hurtPose } from "../../sim/hurtboxes";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, frames } from "../../sim/specials/schema";
import { STANDING_SHOULDER, sameHit, swingRegions, tilt, utherHit, utherReach } from "./moves";

const H = HERO_REFERENCE_HEIGHT;
const heights = (multiple: number): number => f32(H * f32(multiple));
const perFrame = (distance: number, first: number, last: number): number => f32(distance / (last - first + 1));

export const HOLY_LIGHT_MODEL = "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx";
const HOLY_LIGHT_COLUMN: SpecialProjectile = {
  model: HOLY_LIGHT_MODEL, spawnFrame: 16, offsetX: 72.0, offsetZ: 52.0,
  velocityX: 0.0, velocityZ: 0.0, life: 6, radius: 40.0,
  effect: { ...utherHit(10.0, "LAUNCH", 80, false, HitElement.holy), heal: 2.0, healPerStock: 6.0 }, reflectable: false, limit: 1,
};
const holyLight = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: 44,
  landingLag,
  projectiles: [HOLY_LIGHT_COLUMN],
  hurt: [hurtPose(12, 24, utherReach(40.0, 100.0))],
});

const AURA_FIRST = 6;
const AURA_LAST = 22;
const AURA_STEP = perFrame(heights(f32(0.55)), AURA_FIRST, AURA_LAST);
export const UTHER_SPECIAL_SWINGS = {
  sideSpecial: tilt(STANDING_SHOULDER, 26.0, 34.0, 20, [16.0, -4.0, -22.0, -34.0]),
  upSpecial: tilt(STANDING_SHOULDER, 20.0, 34.0, 8, [30.0, 48.0, 64.0, 78.0, 90.0, 100.0, 108.0]),
} as const;
const devotionAura = (air: boolean): AuthoredSpecial => ({
  endFrame: 40,
  regions: swingRegions(UTHER_SPECIAL_SWINGS.sideSpecial, sameHit(utherHit(11.0, "EDGE", 40, false, HitElement.holy))),
  motion: [
    { ...frames(AURA_FIRST, AURA_LAST), velocityX: AURA_STEP, velocityZ: 0.0, stopsAtBody: true, stopsAtShield: true },
    { ...frames(AURA_LAST + 1, AURA_LAST + 1), velocityX: 0.0, velocityZ: 0.0 },
  ],
  armor: { ...frames(AURA_FIRST, AURA_LAST), maxDamage: 8.0 },
  hurt: [hurtPose(18, 26, utherReach(44.0, 70.0))],
  ...(air ? { oncePerAirtime: true, landingLag: 18 } : {}),
});

const RISE_FIRST = 6;
const RISE_LAST = 27;
const hammerOfTheRighteous = (rise: number): AuthoredSpecial => ({
  endFrame: RISE_LAST,
  regions: swingRegions(UTHER_SPECIAL_SWINGS.upSpecial, (_, index) => utherHit(8.0, "LAUNCH", index < 3 ? 80 : 85, false, HitElement.holy)),
  motion: [
    { ...frames(RISE_FIRST, RISE_LAST - 1), velocityX: perFrame(heights(f32(0.25)), RISE_FIRST, RISE_LAST - 1), velocityZ: perFrame(heights(rise), RISE_FIRST, RISE_LAST - 1), driftSpeed: perFrame(heights(f32(1.1)), RISE_FIRST, RISE_LAST - 1) },
    { ...frames(RISE_LAST, RISE_LAST), velocityX: 0.0, velocityZ: 0.0 },
  ],
  hurt: [hurtPose(6, 16, utherReach(20.0, 140.0))],
  oncePerAirtime: true,
  helpless: true,
});

const DIVINE_SHIELD_END = 50;
const DIVINE_SHIELD_LAST = 26;
const divineShield = (landingLag: number | undefined): AuthoredSpecial => ({
  endFrame: DIVINE_SHIELD_END,
  landingLag,
  guard: { ...frames(4, DIVINE_SHIELD_LAST), heal: 0.0, shieldFrames: DIVINE_SHIELD_END - 2 - DIVINE_SHIELD_LAST },
  defensiveUse: true,
});

export const UTHER_SPECIALS: FighterSpecials = {
  neutral: { name: "Holy Light", description: "A column of light bursts one step ahead and heals you a little when it hits. It punishes a whiff, so place it where they will be.", ground: holyLight(undefined), air: holyLight(18) },
  side: { name: "Devotion Aura", description: "Advance behind a golden aura that shrugs off light hits, then bash with the hammer. Grabs and heavy blows break through; a shield stops you.", ground: devotionAura(false), air: devotionAura(true) },
  up: { name: "Hammer of the Righteous", description: "A rising two-handed hammer arc you can steer a little, then a helpless fall.", ground: hammerOfTheRighteous(f32(2.4)) },
  down: { name: "Divine Shield", description: "A golden bubble turns aside strikes and missiles for a moment. You cannot act inside it, and a grab breaks it.", ground: divineShield(undefined), air: divineShield(20) },
};
