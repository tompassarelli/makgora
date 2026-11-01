import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { ANKH_BURST_MODEL } from "../../generated/assets/ankhAssetInfo";





import { Character, ProjectileKind } from "../sim/codes";
import type { Projectile } from "../sim/fighter";
import { ALL_HEROES, heroDefinition } from "../roster/kits";
import { FIGHTER_ULTIMATES } from "../sim/ultimates";
import type { AuthoredSpecial, FighterSpecials, SpecialProjectile, TargetedStrike } from "../sim/specials/schema";
import { specialPlacements } from "../sim/specials/placements";
import { FLAME_STRIKE_BURST } from "../fighters/kaelthas/specials";
import { PILLAR_COLUMN_STRETCH, FINGER_COLUMN_WIDTH } from "../fighters/archimonde/specials";
import { ELUNE_SHIMMER } from "../fighters/tyrande/specials";
import { HOOK_MODEL } from "../fighters/butcher/specials";
import { DIRE_WOLF_MODEL, SPIRIT_WOLF_MODEL, TIMBER_WOLF_MODEL } from "../fighters/thrall/wolves";
import { SPECIAL_SLOTS, type SpecialSlot } from "./slotCues";
import type { Fuse } from "./discLook";

export interface CueBirth {
  readonly eachFrame: boolean;
  readonly strike?: number | undefined;
  readonly strikes?: number | undefined;
  readonly strikeRadius?: number | undefined;
  readonly trail?: number | undefined;
  readonly taper?: boolean | undefined;
  readonly voices?: number | undefined;
  readonly lingerFrames?: number | undefined;
}


export const ORIGINAL_PROJECTILE_MODELS = {



  [ProjectileKind.blaster]: "Abilities\\Weapons\\CannonTowerMissile\\CannonTowerMissile.mdx",

  [ProjectileKind.recoil]: "Abilities\\Weapons\\Mortar\\MortarMissile.mdx",

  [ProjectileKind.eyeBeam]: "Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx",
} as const satisfies Record<Exclude<ProjectileKind, typeof ProjectileKind.hero>, string>;


export const ORIGINAL_KINDS: { readonly [character: number]: readonly Exclude<ProjectileKind, typeof ProjectileKind.hero>[] } = {
  [Character.rifleman]: [ProjectileKind.blaster, ProjectileKind.recoil],
  [Character.demonHunter]: [ProjectileKind.eyeBeam],
};


export { SPECIAL_SLOTS };
export type { SpecialSlot };


function chainProjectiles(projectile: SpecialProjectile | undefined, into: SpecialProjectile[]): void {
  if (projectile === undefined) return;
  into.push(projectile);
  chainProjectiles(projectile.expiresInto, into);
  chainProjectiles(projectile.burstInto, into);
  chainProjectiles(projectile.unfloored?.as, into);
}

function strikeProjectiles(strike: Readonly<TargetedStrike> | undefined, into: SpecialProjectile[]): void {
  if (strike === undefined) return;
  chainProjectiles(strike.glyph, into);
  chainProjectiles(strike.bolt, into);
  chainProjectiles(strike.curse?.portal, into);
  chainProjectiles(strike.curse?.summon.shot, into);
}

function formProjectiles(special: AuthoredSpecial | undefined, into: SpecialProjectile[]): void {
  if (special === undefined) return;
  for (const projectile of special.projectiles ?? []) chainProjectiles(projectile, into);
  chainProjectiles(special.toggleAura?.trail?.patch, into);
  for (const placement of specialPlacements(special)) for (const shot of [placement.shot, placement.finalShot, placement.mark]) if (shot !== undefined) into.push(shot);
  strikeProjectiles(special.targetedStrike, into);
  if (special.burst !== undefined) {
    chainProjectiles(special.burst.from, into);
    chainProjectiles(special.burst.into, into);
  }
  for (const followUp of special.followUps ?? []) formProjectiles(followUp.special, into);
  for (const variant of special.variants ?? []) formProjectiles(variant, into);
}


export interface HeroProjectileArt {
  readonly slot: SpecialSlot;
  readonly spec: SpecialProjectile;
}


export function heroProjectileArt(specials: Readonly<FighterSpecials>): HeroProjectileArt[] {
  const art: HeroProjectileArt[] = [];
  for (const slot of SPECIAL_SLOTS) {
    const kit = specials[slot];
    const specs: SpecialProjectile[] = [];
    const forms = [kit.ground, kit.air, kit.recall];
    // Use the fixed count because Lua iteration stops at undefined forms.
    for (let form = 0; form < 5; form++) formProjectiles(forms[form], specs);
    for (const spec of specs) if (!art.some((known) => known.spec === spec)) art.push({ slot, spec });
  }
  return art;
}


export function projectileModelOf(projectile: Readonly<Projectile>): string | undefined {
  return projectile.kind === ProjectileKind.hero ? projectile.spec?.model : ORIGINAL_PROJECTILE_MODELS[projectile.kind];
}


export function fighterProjectileModels(character: Character): readonly string[] {
  const specials = heroDefinition(character)?.specials;
  const models: string[] = specials === undefined ? (ORIGINAL_KINDS[character] ?? [ProjectileKind.blaster]).map((kind) => ORIGINAL_PROJECTILE_MODELS[kind]) : [];
  if (specials !== undefined) for (const { spec } of heroProjectileArt(specials)) if (spec.model !== undefined && !models.includes(spec.model)) models.push(spec.model);
  for (const spec of ultimateProjectiles(character)) if (spec.model !== undefined && !models.includes(spec.model)) models.push(spec.model);
  return models;
}


export function ultimateProjectiles(character: Character): readonly SpecialProjectile[] {
  const specs: SpecialProjectile[] = [];
  formProjectiles(FIGHTER_ULTIMATES[character], specs);
  return specs;
}

export function allProjectileModels(): readonly string[] {
  const models: string[] = Object.values(ORIGINAL_PROJECTILE_MODELS);
  for (const character of [Character.rifleman, Character.demonHunter, ...ALL_HEROES.map((hero) => hero.character)]) {
    for (const model of fighterProjectileModels(character)) if (!models.includes(model)) models.push(model);
  }
  return models;
}

// The stock wolves' Walk sequence covers 260 units a second at scale 1 (its MDX move speed).
export const STOCK_WOLF_STRIDE = 260.0;

export const PROJECTILE_DRAW_CUES: { readonly [model: string]: { readonly scale: number; readonly birth?: CueBirth | undefined; readonly color?: readonly [number, number, number] | undefined; readonly alpha?: number | undefined; readonly stride?: number | undefined } | undefined } = {
  [SPIRIT_WOLF_MODEL]: { scale: f32(0.62), color: [255, 255, 235], alpha: 150, stride: STOCK_WOLF_STRIDE },
  [TIMBER_WOLF_MODEL]: { scale: f32(0.62), stride: STOCK_WOLF_STRIDE },
  [DIRE_WOLF_MODEL]: { scale: f32(0.7), stride: STOCK_WOLF_STRIDE },
  "Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx": { scale: f32(0.16) },
  "Abilities\\Spells\\Human\\ManaFlare\\ManaFlareMissile.mdx": { scale: f32(1.2) },
  "Abilities\\Weapons\\QuillSprayMissile\\QuillSprayMissile.mdx": { scale: 1.5 },
  "Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx": { scale: f32(0.4) },
  "Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx": { scale: 0.5 },
  "Abilities\\Spells\\Undead\\CarrionSwarm\\CarrionSwarmMissile.mdx": { scale: f32(0.85) },
  "Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx": { scale: f32(0.6) },
  "Abilities\\Spells\\Other\\Consecration\\Consecration.mdx": { scale: 1.0 },
  "Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx": { scale: 0.5 },
  "units\\creeps\\PandarenBrewmaster\\PandarenBrewmaster.mdl": { scale: f32(0.6) },
  "units\\creeps\\QuillBeast\\QuillBeast.mdl": { scale: f32(0.9) },
  "units\\creeps\\GrizzlyBear\\GrizzlyBear.mdl": { scale: f32(0.7) },
  "units\\creeps\\WarEagle\\WarEagle.mdl": { scale: f32(0.8) },
  "Abilities\\Spells\\Other\\Monsoon\\MonsoonBoltTarget.mdx": { scale: f32(0.7) },
  "Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx": { scale: f32(0.7) },
  "Abilities\\Spells\\NightElf\\Cyclone\\CycloneTarget.mdx": { scale: 0.5 },
  "Objects\\InventoryItems\\BundleofLumber\\BundleofLumber.mdx": { scale: 0.5 },
  "Units\\Undead\\Locust\\Locust.mdx": { scale: f32(0.6) },
  "Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrikeMissile.mdx": { scale: 1.0, birth: { eachFrame: true } },
  "Abilities\\Spells\\Human\\ManaFlare\\ManaFlareTarget.mdx": { scale: 1.0, birth: { eachFrame: false } },
  "Abilities\\Weapons\\CannonTowerMissile\\CannonTowerMissile.mdx": { scale: 1.0, birth: { eachFrame: false } },
  "Abilities\\Weapons\\Bolt\\BoltImpact.mdx": { scale: 0.5 },
  "Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx": { scale: 1.0, birth: { eachFrame: false } },
  "Objects\\Spawnmodels\\Demon\\DemonLargeDeathExplode\\DemonLargeDeathExplode.mdx": { scale: 1.0, birth: { eachFrame: false } },
  "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx": { scale: 1.0, birth: { eachFrame: false } },
  "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx": { scale: 1.0, birth: { eachFrame: false } },
  "Abilities\\Spells\\Undead\\DeathAndDecay\\DeathAndDecayTarget.mdx": { scale: f32(1.2) },
  "Abilities\\Spells\\Undead\\Possession\\PossessionMissile.mdx": { scale: 0.5 },
  "Doodads\\Dungeon\\Rocks\\Cave_FieryCrator\\Cave_FieryCrator.mdx": { scale: f32(0.75) },
  "Abilities\\Spells\\NightElf\\EntangleMine\\Roots.mdx": { scale: f32(0.5), color: [84, 54, 46] },
  "Doodads\\Cinematic\\FireTrapUp\\FireTrapUp.mdx": { scale: f32(0.7), color: [255, 110, 30] },
};

export const PROJECTILE_DRAW_OFFSETS: { readonly [model: string]: { readonly x: number; readonly z: number; readonly roll?: number | undefined; readonly sequence?: string | undefined; readonly reseek?: boolean | undefined; readonly seconds?: number | undefined; readonly width?: number | undefined; readonly height?: number | undefined; readonly loopFrames?: number | undefined; readonly disc?: readonly [number, number, number] | undefined; readonly discVertical?: boolean | undefined; readonly fuse?: Fuse | undefined } | undefined } = {
  "Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx": { x: 0.0, z: 0.0, sequence: "birth", disc: [155, 225, 255], discVertical: true },
  "Abilities\\Spells\\Other\\Consecration\\Consecration.mdx": { x: 0.0, z: 0.0, disc: [255, 215, 115] },
  "Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx": { x: 0.0, z: 0.0, roll: f32(1.570796327) },
  "Abilities\\Spells\\Human\\ManaFlare\\ManaFlareMissile.mdx": { x: 0.0, z: 0.0, sequence: "birth", seconds: f32(0.2) },
  "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike.mdx": { x: 0.0, z: 0.0, sequence: "birth", height: PILLAR_COLUMN_STRETCH },
  "Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeTarget.mdx": { x: 0.0, z: 0.0, disc: [255, 80, 20], discVertical: true, fuse: { z: FLAME_STRIKE_BURST.offsetZ, hot: [255, 245, 190] } },
  "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx": { x: 0.0, z: 0.0, height: 2.0 },
  "Abilities\\Spells\\Other\\Monsoon\\MonsoonBoltTarget.mdx": { x: 0.0, z: 0.0, width: FINGER_COLUMN_WIDTH },
  "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx": { x: 0.0, z: 0.0, sequence: "birth" },
  [ANKH_BURST_MODEL]: { x: 0.0, z: 0.0, sequence: "stand", reseek: true },
  "Abilities\\Spells\\Human\\Avatar\\AvatarCaster.mdx": { x: 0.0, z: 0.0, sequence: "spell" },
  "Units\\Undead\\Locust\\Locust.mdx": { x: 0.0, z: 0.0, sequence: "walk" },
  "Abilities\\Spells\\Undead\\DeathAndDecay\\DeathAndDecayTarget.mdx": { x: 0.0, z: f32(-59.4), loopFrames: 12, disc: [150, 70, 230] },
  "Abilities\\Spells\\Undead\\PlagueCloud\\PlagueCloudCaster.mdx": { x: 0.0, z: 0.0, sequence: "stand", height: f32(0.4) },
  "Abilities\\Spells\\Undead\\Impale\\ImpaleHitTarget.mdx": { x: 0.0, z: -25.0, width: 1.5, height: 1.25 },
  [ELUNE_SHIMMER]: { x: 0.0, z: 0.0, disc: [205, 225, 255], discVertical: true },
  [HOOK_MODEL]: { x: -20.0, z: 0.0 },
  "Doodads\\Dungeon\\Rocks\\Cave_FieryCrator\\Cave_FieryCrator.mdx": { x: 0.0, z: 0.0, width: f32(1.7), height: f32(0.5) },
  "Doodads\\Cinematic\\FireTrapUp\\FireTrapUp.mdx": { x: 0.0, z: 0.0, width: f32(0.35), height: f32(1.2) },
};


export function restartsStationaryField(model: string, age: number, born: boolean): boolean {
  const loop = PROJECTILE_DRAW_OFFSETS[model]?.loopFrames;
  return born || (loop !== undefined && imod(age, loop) === 0);
}

// A ribbon emitter draws any move of its effect as a streak, so a parked effect waits in the sequence that stops its ribbons; null marks a model with none.
export const RIBBON_PARK_SEQUENCES: { readonly [model: string]: string | null } = {
  "Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx": "Death",
  "Abilities\\Spells\\NightElf\\FanOfKnives\\FanOfKnivesMissile.mdx": "Death",
  "Abilities\\Spells\\Other\\Tornado\\TornadoElementalSmall.mdx": "Death",
  "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx": "Birth",
  "Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx": null,
  "Abilities\\Spells\\Undead\\CarrionSwarm\\CarrionSwarmMissile.mdx": "Death",
  "Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilMissile.mdl": "Death",
  "Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx": "Birth",
  "Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx": "Death",
  "Abilities\\Weapons\\WaterElementalMissile\\WaterElementalMissile.mdx": null,
  "Abilities\\Weapons\\GuardTowerMissile\\GuardTowerMissile.mdx": "Death",
  "Abilities\\Weapons\\RocketMissile\\RocketMissile.mdl": "Death",
  "Abilities\\Weapons\\SearingArrow\\SearingArrowMissile.mdl": "Death",
  "Abilities\\Weapons\\WyvernSpear\\WyvernSpearMissile.mdx": "Death",
  "Units\\Undead\\Locust\\Locust.mdx": "Death",
  "Units\\Undead\\Scarab\\Scarab.mdl": "Death",
};

export function heroPoolSize(specials: Readonly<FighterSpecials>, model: string, least: number): number {
  let size = least;
  for (const slot of SPECIAL_SLOTS) {
    const trail = specials[slot].ground.toggleAura?.trail;
    if (trail?.patch.model === model) size = Math.max(size, trail.limit);
  }
  return size;
}
