import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../../sim/specials/schema";
import { jainaCastBody, jainaHit } from "./moves";

const h = (n: number) => f32(HERO_REFERENCE_HEIGHT * f32(n));
const WATER_SHOT: SpecialProjectile = {
  model: "Abilities\\Weapons\\WaterElementalMissile\\WaterElementalMissile.mdx",
  spawnFrame: 0, offsetX: 15.0, offsetZ: 55.0, velocityX: h(f32(0.1)), velocityZ: 0.0,
  life: 48, radius: h(f32(0.12)), effect: jainaHit(4.386340141296387, 35, 76.14242553710938, 20.0), reflectable: true, limit: 3,
};
const FROSTBOLT: AuthoredSpecial = {
  endFrame: 37, landingLag: 20, hurt: jainaCastBody(13, 22),
  projectiles: [{
    model: "Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx",
    spawnFrame: 17, offsetX: h(f32(0.35)), offsetZ: 55.0, velocityX: h(f32(0.12)), velocityZ: 0.0,
    life: 64, radius: h(f32(0.12)), effect: jainaHit(6.140875816345215, 35, 81.5811767578125, 18.0), reflectable: true, limit: 1,
  }],
};
const ice = (activeFrom: number, life: number, damage: number): SpecialProjectile => ({
  model: "Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx",
  spawnFrame: 8, offsetX: h(f32(1.6)), offsetZ: 45.0, velocityX: 0.0, velocityZ: 0.0,
  life, activeFrom, radius: h(f32(0.55)), effect: jainaHit(damage, 80, damage === 4.386340141296387 ? 59.826194763183594 : 108.77490234375, 24.0),
  reflectable: false, limit: 1, cancelOnInterrupt: true, needsLineOfSight: true,
});
const BLIZZARD: AuthoredSpecial = {
  endFrame: 48, landingLag: 20, hurt: jainaCastBody(5, 48),
  projectiles: [ice(21, 40, 4.386340141296387), ice(45, 48, 7.018144130706787)],
};
const blink = (distance: number): AuthoredSpecial => ({
  endFrame: 34, aimFrames: 13,
  motion: [{ ...frames(1, 13), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(14, 14), velocityX: 0.0, velocityZ: h(distance), aimedSpeed: h(distance), throughEdge: true },
    { ...frames(15, 34), velocityX: 0.0, velocityZ: 0.0 }],
  intangible: frames(14, 17), oncePerAirtime: true, helpless: true,
});
const SUMMON: AuthoredSpecial = {
  endFrame: 52, groundOnly: true, hurt: jainaCastBody(20, 33),
  placement: {
    frame: 27, offsetX: h(f32(0.65)), radius: 25.0, height: 92.0, durability: 24.0,
    life: 240, fireAges: [36, 84, 132, 180], shot: WATER_SHOT,
  },
};

export const JAINA_SPECIALS: FighterSpecials = {
  neutral: { name: "Frostbolt", description: "A straight frost bolt; jump it or shield it.", ground: FROSTBOLT },
  side: { name: "Blizzard", description: "Ice falls twice on the marked patch ahead; leave it before the first strike.", ground: BLIZZARD },
  up: { name: "Blink", description: "Aim a teleport, then fall helpless.", ground: blink(f32(3.2)) },
  down: { name: "Summon Water Elemental", description: "Summon a fragile ally that fires four water bolts. Press again to recall it.", ground: SUMMON,
    air: { endFrame: SUMMON.endFrame, landingLag: 20, hurt: SUMMON.hurt,
      projectiles: [{ ...WATER_SHOT, spawnFrame: 27, offsetZ: 0.0, velocityX: 0.0, velocityZ: -h(f32(0.1)) }] },
    recall: { endFrame: 26, recall: true } },
};
