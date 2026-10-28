


import { withExKit } from "../../sim/exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import type { AppliedStatus } from "../../sim/appliedStatus";
import { type AuthoredSpecial, type FighterSpecials, type SpecialProjectile, frames } from "../../sim/specials/schema";
import { capsule, hit } from "./moves";
import { VALKYR_MODEL } from "../../assets/importedModelInfo";

import { hurtPart, hurtPose } from "../../sim/hurtboxes";

const HOWLING_BODY = [
  hurtPose(1, 2, [hurtPart(4.0, 47.0, 4.0, 93.0, 50.0)]),
  hurtPose(3, 5, [hurtPart(27.0, 43.0, 27.0, 100.0, 48.0)]),
  hurtPose(6, 7, [hurtPart(46.0, 47.0, 46.0, 99.0, 52.0)]),
  hurtPose(8, 9, [hurtPart(52.0, 45.0, 52.0, 101.0, 50.0)]),
  hurtPose(10, 12, [hurtPart(61.0, 45.0, 61.0, 101.0, 48.0)]),
  hurtPose(13, 14, [hurtPart(61.0, 52.0, 61.0, 93.0, 55.0)]),
  hurtPose(15, 16, [hurtPart(57.0, 56.0, 57.0, 90.0, 59.0)]),
  hurtPose(17, 19, [hurtPart(63.0, 50.0, 63.0, 94.0, 53.0)]),
  hurtPose(20, 21, [hurtPart(63.0, 50.0, 63.0, 94.0, 53.0)]),
  hurtPose(22, 24, [hurtPart(51.0, 52.0, 51.0, 92.0, 55.0)]),
  hurtPose(25, 27, [hurtPart(39.0, 40.0, 39.0, 102.0, 43.0)]),
  hurtPose(28, 30, [hurtPart(30.0, 36.0, 30.0, 107.0, 37.0)]),
  hurtPose(31, 33, [hurtPart(20.0, 35.0, 20.0, 107.0, 36.0)]),
  hurtPose(34, 38, [hurtPart(-2.0, 32.0, -2.0, 92.0, 49.0)]),
];

const h = (fraction: number): number => f32(HERO_REFERENCE_HEIGHT * fraction);

const CHEST = h(f32(0.5));

const AIR_LANDING_LAG = 20;





export const HOWLING_BLAST_SPAWN_FRAME = 22;
export const HOWLING_BLAST_SPEED = h(f32(0.072));
export const HOWLING_BLAST_LIFE = 53;

const blastProjectile = (radius: number, damage: number, status: AppliedStatus | undefined): SpecialProjectile => ({
  model: "Abilities\\Weapons\\FrostWyrmMissile\\FrostWyrmMissile.mdx",
  spawnFrame: HOWLING_BLAST_SPAWN_FRAME, offsetX: 50.0, offsetZ: CHEST, velocityX: HOWLING_BLAST_SPEED, velocityZ: 0.0,
  life: HOWLING_BLAST_LIFE, radius, effect: hit(damage, "POKE", 40), reflectable: true, limit: 1, status,
});
export const HOWLING_BLAST = blastProjectile(h(f32(0.22)), 7.5, undefined);
const HOWLING_BLAST_CAST: AuthoredSpecial = {
  endFrame: 50,
  hurt: HOWLING_BODY,
  armor: { ...frames(10, HOWLING_BLAST_SPAWN_FRAME), maxDamage: 8.0 },
  projectiles: [HOWLING_BLAST],
};







const CARRIED: AppliedStatus = { kind: HeroStatusKind.carried, frames: 100, group: HeroStatusGroup.sleep, immunityFrames: 240 };





const valkyrProjectile = (speed: number): SpecialProjectile => ({
  model: VALKYR_MODEL,
  spawnFrame: 26, offsetX: 40.0, offsetZ: f32(CHEST + 10.0), velocityX: speed, velocityZ: 0.0,
  life: 60, radius: h(f32(0.2)), effect: { damage: 5.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false, element: HitElement.dark },
  reflectable: true, limit: 1, status: CARRIED,
});
const VALKYR = valkyrProjectile(5.0);
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







const DEFILE_POOL: SpecialProjectile = {
  model: "Abilities\\Spells\\Undead\\UnholyAura\\UnholyAura.mdx",

  modelRadius: 1223.0,
  spawnFrame: 20, offsetX: h(f32(0.6)), offsetZ: 6.0, velocityX: 0.0, velocityZ: 0.0,
  life: 180, activeFrom: 18, radius: h(f32(0.3)),
  effect: { damage: 2.5, growth: 30.0, base: 30.0, launchX: f32(0.173648178), launchZ: f32(0.984807753), electric: false, element: HitElement.dark },
  reflectable: false, limit: 1, needsLineOfSight: true,
  pool: { every: 36, growth: 6.0, maxRadius: h(f32(0.6)) },
};
const DEFILE: AuthoredSpecial = {
  endFrame: 50,
  cooldownFrames: 320,
  groundOnly: true,
  projectiles: [DEFILE_POOL],
};

export const LICH_KING_SPECIALS: FighterSpecials = {
  neutral: withExKit({
    name: "Howling Blast",
    description: "A wide frost gust that travels toward the foe.",
    ground: HOWLING_BLAST_CAST,
  }, { range: 1.25 }),
  side: withExKit({
    name: "Val'kyr Shadowguard",
    description: "A Val'kyr seizes the first foe she reaches and carries them toward the edge; mash to break free.",
    ground: shadowguard(VALKYR, undefined),
    air: shadowguard(VALKYR, AIR_LANDING_LAG),
  }, { range: 1.25 }),
  up: withExKit({
    name: "Ascension of the Damned",
    description: "An ice column lifts him in a frost vortex, then a helpless fall.",
    ground: ascension(f32(2.7), f32(1.15)),

  }, { travel: 1.25 }),
  down: withExKit({
    name: "Defile",
    description: "Plant Frostmourne to spread a shadow pool; hurting a grounded foe grows it and flashes the edge. Jump out; recasts must wait.",
    ground: DEFILE,
    air: { ...DEFILE, groundOnly: false, landingLag: AIR_LANDING_LAG,
      projectiles: [{ model: DEFILE_POOL.model, modelRadius: DEFILE_POOL.modelRadius, spawnFrame: DEFILE_POOL.spawnFrame,
        offsetX: 0.0, offsetZ: 0.0, velocityX: 0.0, velocityZ: -8.0, life: 24,
        radius: DEFILE_POOL.radius, effect: DEFILE_POOL.effect, reflectable: DEFILE_POOL.reflectable, limit: DEFILE_POOL.limit }] },
  }, { reach: 1.25 }),
};
