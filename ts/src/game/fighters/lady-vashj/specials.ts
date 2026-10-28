import { f32 } from "wisp/src/sim/f32";
import { CHILL } from "../../sim/chill";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import { hurtPose } from "../../sim/hurtboxes";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, frames } from "../../sim/specials/schema";
import { ladyVashjHit, ladyVashjReach, ladyVashjStrike } from "./moves";

const ARROW_SPEED = 20.0;
const arrow = (velocityX: number, velocityZ: number) => ({ velocityX: f32(ARROW_SPEED * velocityX), velocityZ: f32(ARROW_SPEED * velocityZ) });
const TWELVE = arrow(f32(0.978147601), f32(0.207911691));
const down = (shot: { readonly velocityX: number; readonly velocityZ: number }) => ({ velocityX: shot.velocityX, velocityZ: -shot.velocityZ });
const ARROW_MODEL = "Abilities\\Spells\\Other\\FrostArrows\\NagaColdArrowMissile.mdl";
const coldArrow = (fan?: SpecialProjectile["fan"]): SpecialProjectile => ({
  spawnFrame: 18, offsetX: 50.0, offsetZ: 88.0, velocityX: ARROW_SPEED, velocityZ: 0.0, life: 30, radius: 10.0,
  effect: ladyVashjHit(3.0, 30, 40.0, 14.0), reflectable: true, limit: 1, model: ARROW_MODEL,
  ...(fan === undefined ? { status: { ...CHILL, frames: 60 } } : { fan, velocityX: fan[0]?.velocityX ?? ARROW_SPEED, velocityZ: fan[0]?.velocityZ ?? 0.0 }),
});
const CENTRE_ARROW = coldArrow();
const SIDE_ARROWS = coldArrow([TWELVE, down(TWELVE)]);
const multiShot = (sides: SpecialProjectile, landingLag?: number): AuthoredSpecial => ({
  endFrame: 40, landingLag, projectiles: [CENTRE_ARROW, sides],
  hurt: [hurtPose(12, 26, ladyVashjReach(58.0, 92.0))],
});

const serpent = (bounces: number, drain: number): SpecialProjectile => ({
  spawnFrame: 16, offsetX: 46.0, offsetZ: 46.0, velocityX: 12.0, velocityZ: 0.0, life: 27, radius: 18.0,
  effect: ladyVashjHit(6.0, 40, 50.0, 30.0), reflectable: false, limit: 1,
  model: "Abilities\\Weapons\\SerpentWardMissile\\SerpentWardMissile.mdl",
  bounce: { count: bounces, range: 300.0, falloff: f32(0.8), speed: 14.0, drain },
});
const tidalSerpent = (shot: SpecialProjectile, landingLag?: number): AuthoredSpecial => ({
  endFrame: 52, landingLag, projectiles: [shot],
  hurt: [hurtPose(10, 30, ladyVashjReach(56.0, 60.0))],
});

const SURGE_RISE = f32(f32(HERO_REFERENCE_HEIGHT * 2.0) / 24.0);
const tidalSurge = (rise: number): AuthoredSpecial => ({
  endFrame: 36, oncePerAirtime: true, helpless: true, landingLag: 24,
  motion: [{ ...frames(1, 9), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(10, 33), velocityX: 0.0, velocityZ: rise, driftSpeed: f32(f32(HERO_REFERENCE_HEIGHT * f32(0.3)) / 24.0) }],
  regions: [heroRegion(12, 18, ladyVashjStrike(0.0, -10.0, 0.0, 120.0, 46.0), ladyVashjHit(7.0, 80, 60.0, 40.0))],
});

const MANA_SHIELD: AuthoredSpecial = { endFrame: 12, manaShield: { frame: 6 } };

export const LADY_VASHJ_SPECIALS: FighterSpecials = {
  neutral: {
    name: "Multi-Shot", description: "Three cold arrows in a fan; the centre one chills. Shield or reflect them. Only one volley flies at a time.",
    ground: multiShot(SIDE_ARROWS), air: multiShot(SIDE_ARROWS, 18),
  },
  side: {
    name: "Tidal Serpent", description: "A water serpent that drains ultimate meter and bounces to the next foe, or back to her. Jump or shield it.",
    ground: tidalSerpent(serpent(3, 108)), air: tidalSerpent(serpent(3, 108), 20),
  },
  up: { name: "Tidal Surge", description: "A water column lifts her and pops up anyone above. Falls helpless after.", ground: tidalSurge(SURGE_RISE) },
  down: { name: "Mana Shield", description: "Toggle: hits take half from her ultimate meter instead of her percent. It breaks into a stagger when the meter runs dry; throws go through it.", ground: MANA_SHIELD },
};
