import { Action } from "../../src/game/input/actions";
import { type Scene, fighter, frame, solo } from "../../src/game/match/padScene";
import { Character, ContactKind } from "../../src/game/sim/codes";
import { beginDamageContacts, collectDamageContact, finishDamageContacts } from "../../src/game/sim/contacts";
import {
  CROUCH_CANCEL_KNOCKBACK_SCALE, DI_MAX_DEGREES, ELECTRIC_HITLAG_SCALE, HITLAG_CAP_FRAMES, HITSTUN_FRAMES_PER_KNOCKBACK, KNOCKBACK_CAP,
  KNOCKBACK_DAMAGE_SCALE, KNOCKBACK_GROWTH_ADDEND, KNOCKBACK_GROWTH_SCALE, KNOCKBACK_LAUNCH_SPEED, KNOCKBACK_PERCENT_SCALE, KNOCKBACK_STACKING_FRAMES,
  SMASH_CHARGE_VICTIM_KNOCKBACK_SCALE, STRONG_HIT_EXTRA_HITLAG, damageLevelForKnockback, launchWeightFactor, victimHitlagFrames,
} from "../../src/game/sim/knockback";
import { AIR_KNOCKBACK_DECAY } from "../../src/game/sim/motion";
import { SMASH_FULL_CHARGE_HOLD_FRAMES, SMASH_MAX_CHARGE_FRAMES, SMASH_MAX_DAMAGE_MULTIPLIER } from "../../src/game/sim/moves";
import { ASDI_TRAVEL, HIT_TRAVEL, SDI_PULSE_TRAVEL, SDI_STEP_TRAVEL, STRING_TRAVEL } from "../../src/game/sim/smashDirectionalInfluence";
import { WEAK_HIT_DAMAGE_SCALE, WEAK_HIT_KNOCKBACK_SCALE } from "../../src/game/sim/strongHits";
import { type LedgerRow, PARITY, probe, range, shortNumber } from "./row";

const wiki = (page: string): string => `https://www.ssbwiki.com/${page}`;
const KNOCKBACK = "ts/src/game/sim/knockback.ts";
const DAMAGE = range(1, 50);
const MELEE_FREEZE = "attacker and victim on direct and shield hits; not a projectile's shooter";
const FREEZE_HIT = { damage: 10.0, growth: 100.0, base: 21.0, launchX: 0.7071067690849304, launchZ: 0.7071067690849304, electric: false };

function frozen(direct: boolean, shielded: boolean): string {
  const s: Scene = solo(0, Character.rifleman);
  if (shielded) for (let n = 1; n <= 10; n++) frame(s, [Action.rightTrigger]);
  beginDamageContacts();
  collectDamageContact(s.world, 1, 0, FREEZE_HIT, 1, ContactKind.launch, direct, undefined, shielded);
  finishDamageContacts(s.world);
  const attacker = fighter(s, 1).launch.hitlag > 0;
  const victim = fighter(s, 0).launch.hitlag > 0;
  if (attacker && victim) return "attacker and victim";
  return attacker ? "attacker only" : victim ? "victim only" : "neither";
}

function whoFreezes(): string {
  const direct = frozen(true, false);
  const shield = frozen(true, true);
  const projectile = frozen(false, false);
  if (direct === "attacker and victim" && shield === direct && projectile === "victim only") return MELEE_FREEZE;
  return `direct hit: ${direct}; shield hit: ${shield}; projectile: ${projectile}`;
}

const tumbleKnockback = (): number => range(0, 200).find((knockback) => damageLevelForKnockback(knockback) === 3) ?? Number.NaN;

const meleeHitlag = (damage: number): number => Math.floor(damage / 3 + 3);

export const HIT_ROWS: readonly LedgerRow[] = [
  {
    id: "knockback-percent-term", family: "hits", name: "Knockback: percent term (0.1·p)",
    melee: { value: 0.1, source: wiki("Knockback") }, ours: () => KNOCKBACK_PERCENT_SCALE,
    anchor: { file: KNOCKBACK, symbol: "KNOCKBACK_PERCENT_SCALE" }, status: PARITY,
  },
  {
    id: "knockback-damage-term", family: "hits", name: "Knockback: damage term (0.05·p·d)",
    melee: { value: 0.05, source: wiki("Knockback") }, ours: () => KNOCKBACK_DAMAGE_SCALE,
    anchor: { file: KNOCKBACK, symbol: "KNOCKBACK_DAMAGE_SCALE" }, status: PARITY,
  },
  {
    id: "knockback-growth-scale", family: "hits", name: "Knockback: scale before growth (×1.4)",
    melee: { value: 1.4, source: wiki("Knockback") }, ours: () => KNOCKBACK_GROWTH_SCALE,
    anchor: { file: KNOCKBACK, symbol: "KNOCKBACK_GROWTH_SCALE" }, status: PARITY,
  },
  {
    id: "knockback-growth-addend", family: "hits", name: "Knockback: addend before growth (+18)",
    melee: { value: 18, source: wiki("Knockback") }, ours: () => KNOCKBACK_GROWTH_ADDEND,
    anchor: { file: KNOCKBACK, symbol: "KNOCKBACK_GROWTH_ADDEND" }, status: PARITY,
  },
  {
    id: "knockback-weight-term", family: "hits", name: "Knockback: weight term, probed at weights 40-160",
    melee: { value: "200/(w+100)", source: wiki("Knockback") },
    ours: probe({
      text: "200/(w+100)", inputs: range(40, 160), label: (weight) => `weight ${weight}`,
      ours: launchWeightFactor, melee: (weight) => 200 / (weight + 100),
      close: (ours, melee) => Math.abs(ours - melee) <= 1e-6 * melee,
    }),
    anchor: { file: KNOCKBACK, symbol: "launchWeightFactor" }, status: PARITY,
  },
  {
    id: "knockback-cap", family: "hits", name: "Knockback cap",
    melee: { value: 2500, source: wiki("Knockback") }, ours: () => KNOCKBACK_CAP,
    anchor: { file: KNOCKBACK, symbol: "KNOCKBACK_CAP" }, status: PARITY,
  },
  {
    id: "set-knockback", family: "hits", name: "Set knockback",
    melee: { value: "a hitbox field: percent 10, damage the set value", source: wiki("Knockback") },
    ours: () => "formula only, no move field",
    anchor: { file: KNOCKBACK, symbol: "fixedHitKnockback" },
    status: { kind: "open", reason: "fixedHitKnockback has Melee's formula, but no move can author set knockback until the setKnockback field lands", issue: 272 },
  },
  {
    id: "crouch-cancel-knockback", family: "hits", name: "Crouch cancel knockback",
    melee: { value: 2 / 3, source: wiki("Crouch_cancel") }, ours: () => CROUCH_CANCEL_KNOCKBACK_SCALE,
    anchor: { file: KNOCKBACK, symbol: "CROUCH_CANCEL_KNOCKBACK_SCALE" }, status: PARITY,
  },
  {
    id: "smash-charge-victim-knockback", family: "hits", name: "Knockback on a victim charging a smash",
    melee: { undocumented: "no public page states a multiplier", source: wiki("Knockback") }, ours: () => SMASH_CHARGE_VICTIM_KNOCKBACK_SCALE,
    anchor: { file: KNOCKBACK, symbol: "SMASH_CHARGE_VICTIM_KNOCKBACK_SCALE" },
    status: { kind: "open", reason: "ours; needs a public source or Tom's decision", issue: 292 },
  },
  {
    id: "hitlag", family: "hits", name: "Hitlag, probed at damage 1-50",
    melee: { value: "⌊d/3 + 3⌋", source: wiki("Hitlag") },
    ours: probe({ text: "⌊d/3 + 3⌋", inputs: DAMAGE, label: (damage) => `damage ${damage}`, ours: (damage) => victimHitlagFrames(damage, false, false), melee: meleeHitlag }),
    anchor: { file: KNOCKBACK, symbol: "victimHitlagFrames" }, status: PARITY,
  },
  {
    id: "hitlag-electric", family: "hits", name: "Hitlag on an electric hit",
    melee: { value: 1.5, source: wiki("Hitlag") }, ours: () => ELECTRIC_HITLAG_SCALE,
    anchor: { file: KNOCKBACK, symbol: "ELECTRIC_HITLAG_SCALE" }, status: PARITY,
  },
  {
    id: "hitlag-crouch", family: "hits", name: "Hitlag on a crouching victim, probed at damage 1-50",
    melee: { value: "×2/3", source: wiki("Hitlag") },
    ours: probe({ text: "×2/3", inputs: DAMAGE, label: (damage) => `damage ${damage}`, ours: (damage) => victimHitlagFrames(damage, false, true), melee: (damage) => Math.floor((meleeHitlag(damage) * 2) / 3) }),
    anchor: { file: KNOCKBACK, symbol: "victimHitlagFrames" }, status: PARITY,
  },
  {
    id: "hitlag-cap", family: "hits", name: "Hitlag cap",
    melee: { value: 20, source: wiki("Hitlag") }, ours: () => HITLAG_CAP_FRAMES,
    anchor: { file: KNOCKBACK, symbol: "HITLAG_CAP_FRAMES" }, status: PARITY,
  },
  {
    id: "strong-hit-hitlag", family: "hits", name: "Extra hitlag on a strong hit",
    melee: { value: 0, source: wiki("Hitlag") }, ours: () => STRONG_HIT_EXTRA_HITLAG,
    anchor: { file: KNOCKBACK, symbol: "STRONG_HIT_EXTRA_HITLAG" },
    status: { kind: "open", reason: "ours: both fighters freeze 3 more frames on a strong hit; Melee's strength is per-hitbox values", issue: 292 },
  },
  {
    id: "who-freezes", family: "hits", name: "Who freezes in hitlag, probed headless",
    melee: { value: MELEE_FREEZE, source: wiki("Hitlag") }, ours: whoFreezes,
    anchor: { file: "ts/src/game/sim/contacts.ts", symbol: "collectDamageContact" }, status: PARITY,
  },
  {
    id: "hitstun", family: "hits", name: "Hitstun frames per knockback (⌊0.4·KB⌋)",
    melee: { value: 0.4, source: wiki("Hitstun") }, ours: () => HITSTUN_FRAMES_PER_KNOCKBACK,
    anchor: { file: KNOCKBACK, symbol: "HITSTUN_FRAMES_PER_KNOCKBACK" }, status: PARITY,
  },
  {
    id: "tumble", family: "hits", name: "Tumble threshold, the least knockback that tumbles",
    melee: { value: 80, source: wiki("Tumble") }, ours: tumbleKnockback,
    anchor: { file: KNOCKBACK, symbol: "damageLevelForKnockback" }, status: PARITY,
  },
  {
    id: "launch-speed", family: "hits", name: "Launch speed per knockback (Melee units a frame)",
    melee: { value: 0.03, source: wiki("Knockback") }, ours: () => KNOCKBACK_LAUNCH_SPEED,
    anchor: { file: KNOCKBACK, symbol: "KNOCKBACK_LAUNCH_SPEED" }, status: PARITY,
  },
  {
    id: "launch-decay", family: "hits", name: "Airborne launch decay a frame",
    melee: { value: 0.051, source: wiki("Knockback") }, ours: () => AIR_KNOCKBACK_DECAY,
    anchor: { file: "ts/src/game/sim/motion.ts", symbol: "AIR_KNOCKBACK_DECAY" }, status: PARITY,
  },
  {
    id: "knockback-stacking", family: "hits", name: "Frames before a new launch merges with the old instead of replacing it",
    melee: { undocumented: "not on SmashWiki", source: wiki("Knockback") }, ours: () => KNOCKBACK_STACKING_FRAMES,
    anchor: { file: KNOCKBACK, symbol: "KNOCKBACK_STACKING_FRAMES" },
    status: { kind: "open", reason: "ours; needs a public source or Tom's decision", issue: 292 },
  },
  {
    id: "di-angle", family: "hits", name: "Trajectory DI, most degrees",
    melee: { value: 18, source: wiki("Directional_influence") }, ours: () => DI_MAX_DEGREES,
    anchor: { file: KNOCKBACK, symbol: "DI_MAX_DEGREES" }, status: PARITY,
  },
  {
    id: "asdi", family: "hits", name: "ASDI travel (Melee units)",
    melee: { value: 3, source: wiki("Automatic_smash_directional_influence") }, ours: () => ASDI_TRAVEL,
    anchor: { file: "ts/src/game/sim/smashDirectionalInfluence.ts", symbol: "ASDI_TRAVEL" }, status: PARITY,
  },
  {
    id: "sdi-input", family: "hits", name: "SDI travel per fresh input (Melee units)",
    melee: { value: 6, source: wiki("Smash_directional_influence") }, ours: () => SDI_PULSE_TRAVEL,
    anchor: { file: "ts/src/game/sim/smashDirectionalInfluence.ts", symbol: "SDI_PULSE_TRAVEL" }, status: PARITY,
  },
  {
    id: "sdi-bound", family: "hits", name: "SDI travel bound",
    melee: { value: "none", source: wiki("Smash_directional_influence") },
    ours: () => `${SDI_STEP_TRAVEL} a frame, ${HIT_TRAVEL} a hit with ASDI, ${STRING_TRAVEL} a string`,
    anchor: { file: "ts/src/game/sim/smashDirectionalInfluence.ts", symbol: "STRING_TRAVEL" },
    status: { kind: "deviation", reason: "keeps SDI choices useful while bounding visible jumps and repeated-hit travel (docs/gameplay-design.md, Bounded SDI)", decided: "2026-10-06" },
  },
  {
    id: "sakurai-angle", family: "hits", name: "Sakurai angle (361)",
    melee: { value: "grounded 0° under 32 knockback, 44° from 32.1; airborne 45°", source: wiki("Sakurai_angle") }, ours: () => "none",
    anchor: { file: "ts/src/game/sim/hitRegions.ts", symbol: "HitEffect" },
    status: { kind: "open", reason: "missing: every hit launches along its authored direction", issue: 291 },
  },
  {
    id: "smash-charge-frames", family: "hits", name: "Smash charge frames to full charge",
    melee: { value: 60, source: wiki("Charge") }, ours: () => SMASH_MAX_CHARGE_FRAMES,
    anchor: { file: "ts/src/game/sim/moves.ts", symbol: "SMASH_MAX_CHARGE_FRAMES" }, status: PARITY,
  },
  {
    id: "smash-charge-multiplier", family: "hits", name: "Smash charge damage at full charge",
    melee: { value: 1.3671, source: wiki("Charge") }, ours: () => SMASH_MAX_DAMAGE_MULTIPLIER,
    anchor: { file: "ts/src/game/sim/moves.ts", symbol: "SMASH_MAX_DAMAGE_MULTIPLIER" }, status: PARITY,
  },
  {
    id: "smash-charge-hold", family: "hits", name: "Frames a full charge can be held",
    melee: { value: 0, source: wiki("Charge") }, ours: () => SMASH_FULL_CHARGE_HOLD_FRAMES,
    anchor: { file: "ts/src/game/sim/moves.ts", symbol: "SMASH_FULL_CHARGE_HOLD_FRAMES" },
    status: { kind: "deviation", reason: "a held smash becomes a timing mix-up, one rule for every fighter", decided: "2026-10-26", issue: 328 },
  },
  {
    id: "staling", family: "hits", name: "Stale-move negation",
    melee: { value: "9-move queue", source: wiki("Stale-move_negation") }, ours: () => "none",
    anchor: { file: "ts/src/game/sim/contacts.ts", symbol: "collectDamageContact" },
    status: { kind: "deviation", reason: "move diversity comes from move design, not a repeat penalty", decided: "2026-10-04" },
  },
  {
    id: "clank", family: "hits", name: "Clank and priority",
    melee: { value: "ground attacks within 9% clank; aerials do not clank", source: wiki("Priority") }, ours: () => "strikes trade; only grabs clash",
    anchor: { file: "ts/src/game/sim/attacks.ts", symbol: "resolveAttacks" },
    status: { kind: "deviation", reason: "simultaneous strikes resolve symmetrically as trades, with no unseen priority system (docs/gameplay-design.md, Same-frame strikes and clanking)", decided: "2026-10-06" },
  },
  {
    id: "weak-hit-ratio", family: "hits", name: "Strong and weak hits",
    melee: { value: "authored per hitbox", source: wiki("Fox_(SSBM)/Neutral_aerial") },
    ours: () => `weak hit ${shortNumber(WEAK_HIT_DAMAGE_SCALE)}× damage, ${shortNumber(WEAK_HIT_KNOCKBACK_SCALE)}× growth and base`,
    anchor: { file: "ts/src/game/sim/strongHits.ts", symbol: "WEAK_HIT_DAMAGE_SCALE" },
    status: { kind: "open", reason: "ours: one global ratio instead of per-hitbox values", issue: 292 },
  },
];
