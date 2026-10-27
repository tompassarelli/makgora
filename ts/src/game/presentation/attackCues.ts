






import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { type HitRegion, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { attackStartupFrames } from "../sim/moves";
import { HERO_ROSTER } from "../roster/kits";
import { type Cue, fighterOwnCues, timed } from "./specialCues";
import { DISJOINT_CUES } from "./disjointCues";

const cue = (model: string, scale: number): Cue => ({ model, anchor: "body", scale });


export interface AttackCue {
  readonly name: string;
  readonly fromActive: number;
  readonly cue: Cue;
}

const SHEAR: readonly AttackCue[] = [{ name: "Shear", fromActive: 0, cue: timed(cue("Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx", f32(0.9)), "stand", 0.0) }];

export const ATTACK_CUES: { readonly [character: number]: { readonly [style: number]: readonly AttackCue[] } } = {
  [Character.blademaster]: {
    [AttackStyle.downAir]: [{ name: "Crescent Tipper", fromActive: 0, cue: cue("Abilities\\Spells\\Human\\SunderingBlades\\SunderingBlades.mdx", f32(0.45)) }],
    [AttackStyle.neutralAir]: [{ name: "Blade Wheel", fromActive: 0, cue: cue("Abilities\\Spells\\Human\\SunderingBlades\\SunderingBlades.mdx", f32(0.7)) }],
  },
  [Character.grom]: {
    [AttackStyle.neutralAir]: [{ name: "Axe Whirl", fromActive: 0, cue: cue("Abilities\\Spells\\Human\\SunderingBlades\\SunderingBlades.mdx", f32(0.7)) }],
  },
  [Character.warden]: {
    [AttackStyle.downAir]: [{ name: "Falling Knives", fromActive: 0, cue: cue("Abilities\\Spells\\NightElf\\FanOfKnives\\FanOfKnivesMissile.mdx", f32(0.3)) }],
    [AttackStyle.upAir]: [{ name: "Sky Crescent", fromActive: 0, cue: cue("Abilities\\Spells\\Human\\SunderingBlades\\SunderingBlades.mdx", f32(0.45)) }],
  },
  [Character.shadowHunter]: {
    [AttackStyle.downAir]: [{ name: "Glaive drill", fromActive: 0, cue: cue("Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx", f32(1.2)) }],
  },
  [Character.lich]: {
    [AttackStyle.neutralAir]: [{ name: "Frost Halo", fromActive: 0, cue: cue("Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx", f32(0.3)) }],

    [AttackStyle.upTilt]: [{ name: "Ice crown", fromActive: 0, cue: cue("Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx", f32(0.3)) }],
  },
  [Character.pitLord]: {

    [AttackStyle.dashAttack]: [{ name: "Demonic Bulk", fromActive: 0, cue: cue("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", f32(0.45)) }],
  },





  [Character.demonHunter]: {

    [AttackStyle.forwardSmash]: [{ name: "Fel Lunge", fromActive: 0, cue: timed(cue("Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx", f32(1.3)), "stand", 0.0) }],

    [AttackStyle.forwardAir]: [{ name: "Twin glaives", fromActive: 0, cue: timed(cue("Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx", 1.0), "stand", 0.0) }],

    [AttackStyle.forwardTilt]: SHEAR,
    [AttackStyle.forwardTiltUp]: SHEAR,
    [AttackStyle.forwardTiltDown]: SHEAR,
  },
};


export interface AttackCueState {
  cue: Cue | undefined;
  x: number;
  z: number;
  key: number;
}


const scratch: HitRegion = emptyHitRegion();


export function attackCueState(fighter: Readonly<Fighter>, out: AttackCueState): AttackCueState {
  out.cue = undefined;
  const { style, frame, smashChargeFrames } = fighter.attack;
  if (style === undefined || fighter.status.out) return out;
  const cues = ATTACK_CUES[fighter.character]?.[style];
  if (cues === undefined) return out;
  const moves = fighter.tuning.moves;
  const count = authoredHitRegionCount(style, moves);
  for (let index = 0; index < count; index++) {
    const region = authoredHitRegion(scratch, fighter.character, style, frame, smashChargeFrames, index, moves);
    if (region.effect.damage <= 0.0) continue;
    const activeFrame = frame - attackStartupFrames(style, moves);
    let chosen = 0;
    for (let entry = 0; entry < cues.length; entry++) {
      const each = cues[entry];
      if ((each?.fromActive ?? 0) <= activeFrame) chosen = entry;
    }
    out.cue = cues[chosen]?.cue;
    out.x = f32(f32(region.minX + region.maxX) * 0.5);
    out.z = f32(f32(region.minZ + region.maxZ) * 0.5);

    out.key = index * 1000 + region.window * 10 + chosen;
    return out;
  }
  return out;
}


export function fighterAttackCues(character: Character): readonly Cue[] {
  const out: Cue[] = [];
  for (const cues of Object.values(ATTACK_CUES[character] ?? {})) for (const { cue } of cues) if (!out.includes(cue)) out.push(cue);
  return out;
}


export function allAttackCueModels(): readonly string[] {
  const models: string[] = [];
  for (const { model } of Object.values(DISJOINT_CUES)) if (!models.includes(model)) models.push(model);
  for (const character of [ Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)]) {
    for (const { model } of fighterAttackCues(character)) if (!models.includes(model)) models.push(model);
  }
  return models;
}


export function fighterRenderedCues(character: Character): readonly Cue[] {
  const out: Cue[] = [];
  for (const cue of [...fighterOwnCues(character), ...fighterAttackCues(character)]) if (!out.includes(cue)) out.push(cue);
  return out;
}
