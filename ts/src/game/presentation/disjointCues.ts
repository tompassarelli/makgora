import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { type HitRegion, NO_HIT_REGION } from "../sim/hitRegions";
import { runningHeroSpecial } from "../sim/specials/engine";
import { forsakenPaladinSwordAttack } from "../sim/heroes/forsakenPaladinSword";
import { type Cue, type CueBirth } from "./specialCues";
import { REACH_CUE_NORMALS } from "./reachCueInfo";
import { DEMONHUNTER_GLIDE_SLASH_FIRST, DEMONHUNTER_GLIDE_SLASH_LAST, DEMONHUNTER_GLIDE_SLASH_FORM, DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP, felRushRegion, immolationRegion, glideSlashRegion } from "../sim/specials";


const NEUTRAL_FLARE: Cue = { model: "Abilities\\Weapons\\FlyingMachine\\FlyingMachineImpact.mdx", anchor: "body", scale: 0.5, sequence: "stand", seconds: f32(0.3), timeScale: 0.0 };
const FIRE_FLARE: Cue = { ...NEUTRAL_FLARE, model: "Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedDamage.mdx", seconds: f32(0.2), timeScale: 1.0, birth: { eachFrame: false } };
const FROST_FLARE: Cue = { ...NEUTRAL_FLARE, model: "Abilities\\Spells\\Other\\FrostDamage\\FrostDamage.mdx", seconds: f32(0.1), timeScale: 1.0, birth: { eachFrame: false } };
const HOLY_FLARE: Cue = { ...NEUTRAL_FLARE, model: "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx", scale: f32(0.15), sequence: "birth", seconds: f32(0.2) };

export const DISJOINT_CUES: { readonly [character: number]: Cue } = {
  [Character.rifleman]: NEUTRAL_FLARE,
  [Character.demonHunter]: NEUTRAL_FLARE,
  [Character.blademaster]: NEUTRAL_FLARE,
  [Character.mountainKing]: NEUTRAL_FLARE,
  [Character.warden]: NEUTRAL_FLARE,
  [Character.lich]: FROST_FLARE,
  [Character.forsakenPaladin]: HOLY_FLARE,
  [Character.dreadlord]: NEUTRAL_FLARE,
  [Character.shadowHunter]: NEUTRAL_FLARE,
  [Character.pitLord]: FIRE_FLARE,
  [Character.beastmaster]: NEUTRAL_FLARE,
  [Character.lichKing]: FROST_FLARE,
  [Character.chen]: FIRE_FLARE,
  [Character.kaelthas]: FIRE_FLARE,
  [Character.kobold]: FIRE_FLARE,
  [Character.thrall]: NEUTRAL_FLARE,
  [Character.jaina]: FROST_FLARE,
  [Character.sylvanas]: NEUTRAL_FLARE,
  [Character.cairne]: NEUTRAL_FLARE,
  [Character.peon]: NEUTRAL_FLARE,
  [Character.tinker]: NEUTRAL_FLARE,
  [Character.murloc]: NEUTRAL_FLARE,
  [Character.grom]: FIRE_FLARE,
  [Character.malfurion]: NEUTRAL_FLARE,
  [Character.medivh]: NEUTRAL_FLARE,
};


const FORSAKEN_SWORD_NORMALS: readonly AttackStyle[] = Object.values(AttackStyle).filter(style => forsakenPaladinSwordAttack(Character.forsakenPaladin, style));

export const DEFINITIVE_ACCENT_REDRAWS: { readonly [model: string]: string } = {
  "Abilities\\Spells\\NightElf\\FanOfKnives\\FanOfKnivesMissile.mdx": "Popcorn knife",
  "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx": "Popcorn holy light",
  "Abilities\\Spells\\Other\\FrostDamage\\FrostDamage.mdx": "Popcorn frost burst",
  "Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedDamage.mdx": "Popcorn red flame",
};


export function disjointNormals(fighter: Readonly<Fighter>): readonly AttackStyle[] {
  if (fighter.character === Character.forsakenPaladin) return FORSAKEN_SWORD_NORMALS;
  return DISJOINT_CUES[fighter.character] === undefined ? [] : REACH_CUE_NORMALS[fighter.character] ?? [];
}


export function specialAreaRegion(fighter: Readonly<Fighter>, index: number): Readonly<HitRegion> {
  const move = runningHeroSpecial(fighter);
  if (move !== undefined) {
    const region = move.regions?.[index];
    const frame = fighter.special.frame - 1;
    return region !== undefined && frame >= region.firstFrame && frame <= region.lastFrame ? region.hit : NO_HIT_REGION;
  }
  if (index > 0 || fighter.character !== Character.demonHunter) return NO_HIT_REGION;
  const { action, form, frame } = fighter.special;
  if (action === SpecialAction.demonHunterFelRush) return felRushRegion(form, frame);
  if (action === SpecialAction.demonHunterWingAscent && form === DEMONHUNTER_GLIDE_SLASH_FORM && frame >= DEMONHUNTER_GLIDE_SLASH_FIRST && frame <= DEMONHUNTER_GLIDE_SLASH_LAST) return glideSlashRegion();
  if (action !== SpecialAction.demonHunterImmolate) return NO_HIT_REGION;
  return frame >= DEMONHUNTER_IMMOLATE_STARTUP && frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE ? immolationRegion(fighter.motion.grounded) : NO_HIT_REGION;
}

export interface HitAreaPose { visible: boolean; x: number; z: number; scale: number; }



const BODY_MIDDLE = 66.0;

export function hitAreaPose(fighter: Readonly<Fighter>, region: Readonly<HitRegion>, out: HitAreaPose): HitAreaPose {
  out.visible = region.effect.damage > 0.0 && !fighter.status.out;
  const x = f32(f32(region.minX + region.maxX) * 0.5), z = f32(f32(region.minZ + region.maxZ) * 0.5);
  const across = Math.abs(x) >= Math.abs(f32(z - BODY_MIDDLE));
  out.x = f32(fighter.motion.x + f32(fighter.facing * (across ? (x >= 0.0 ? region.maxX : region.minX) : x)));
  out.z = f32(fighter.motion.z + (across ? z : z >= BODY_MIDDLE ? region.maxZ : region.minZ));
  out.scale = f32(Math.max(0.5, f32(Math.max(f32(region.maxX - region.minX), f32(region.maxZ - region.minZ)) / 100.0)));
  return out;
}
