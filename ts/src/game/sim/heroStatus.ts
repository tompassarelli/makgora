



import { max, min } from "../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { addFloat32, roundToFloat32, toInt } from "wisp/src/sim/binary32";
import { floorMod } from "wisp/src/sim/intMath";
import { advanceMash, clearMash } from "./mash";
import { aerialJumps } from "./itemBuffs";
import type { Fighter } from "./fighter";
import { type AttackBuffer, clearAttackBuffer } from "../input/attackBuffer";
import { type Controls, copyControls, neutralControls } from "./roster";
import { cancelAttack, cancelSpecialState } from "./transitions";
import { HERO_STATUS_GROUPS, HeroStatusKind, type HeroStatusGroup, SpecialAction } from "./codes";
import { capPercent } from "./percent";



interface StatusRules {

  readonly blocksActions: boolean;

  readonly blocksSpecials: boolean;

  readonly endsOnDamage: boolean;

  readonly blocksAttacks?: boolean | undefined;

  readonly ethereal?: boolean | undefined;

  readonly mashMinimum?: number | undefined;





  readonly carry?: { readonly speed: number; readonly rise: number } | undefined;

  /** A blocksActions status that still lets hit reactions and grabs read the stick, mash and tech as they do unhexed. */
  readonly keepsHitReactions?: boolean | undefined;

  /** Helpless hops on the ground: every `every` frames, `run` of walk speed sideways and `rise` of a short hop up. */
  readonly hop?: { readonly every: number; readonly run: number; readonly rise: number } | undefined;

  /** Share of the fighter's gravity and max fall speed while the status holds out of hitstun: the disabled fighter floats down. */
  readonly fall?: number | undefined;
}

/** A Hexed or Sleeping fighter falls at a tenth of its gravity and max fall speed: held to the 140-frame Hex and 160-frame Sleep, a median faller still reaches the ledge with its up special (docs/gameplay-design.md). */
export const DISABLED_FALL = 0.10000000149011612;

const RULES: { readonly [kind: number]: StatusRules | undefined } = {
  [HeroStatusKind.root]: { blocksActions: false, blocksSpecials: false, endsOnDamage: true },
  [HeroStatusKind.silence]: { blocksActions: false, blocksSpecials: true, endsOnDamage: false },
  [HeroStatusKind.banish]: { blocksActions: false, blocksSpecials: false, blocksAttacks: true, ethereal: true, endsOnDamage: false },

  [HeroStatusKind.sleep]: { blocksActions: true, blocksSpecials: true, endsOnDamage: true, mashMinimum: 24, fall: DISABLED_FALL },


  [HeroStatusKind.hex]: { blocksActions: true, blocksSpecials: true, blocksAttacks: true, endsOnDamage: false, mashMinimum: 36,
    keepsHitReactions: true, hop: { every: 30, run: 0.5, rise: 0.5 }, fall: DISABLED_FALL },

  [HeroStatusKind.chill]: { blocksActions: false, blocksSpecials: false, endsOnDamage: false },
  [HeroStatusKind.stun]: { blocksActions: true, blocksSpecials: true, endsOnDamage: true },


  [HeroStatusKind.carried]: { blocksActions: true, blocksSpecials: true, endsOnDamage: true, mashMinimum: 20, carry: { speed: 3.0, rise: 0.5 } },
};



export interface AppliedStatus {
  readonly kind: HeroStatusKind;
  readonly frames: number;
  readonly group: HeroStatusGroup;

  readonly immunityFrames: number;

  readonly tick?: { readonly every: number; readonly damage: number } | undefined;




}

const rules = (f: Readonly<Fighter>): StatusRules | undefined => RULES[f.status.condition];



export function heroStatusMashes(f: Readonly<Fighter>): boolean {
  return rules(f)?.mashMinimum !== undefined;
}


export function heroStatusBlocksActions(f: Readonly<Fighter>): boolean {
  return rules(f)?.blocksActions === true;
}


export function isEthereal(f: Readonly<Fighter>): boolean {
  return rules(f)?.ethereal === true;
}


export function applyHeroStatus(f: Fighter, status: Readonly<AppliedStatus>): void {
  const { status: state } = f;

  if (status.kind === HeroStatusKind.poison) {
    if (state.out) return;
    state.poisonFrames = status.frames;
    state.poisonEvery = status.tick?.every ?? status.frames;
    state.poisonDamage = status.tick?.damage ?? 0.0;
    return;
  }
  if (state.out) return;
  if ((state.conditionImmunity[status.group] ?? 0) > 0) return;
  state.condition = status.kind;
  state.conditionFrames = status.frames;
  if (RULES[status.kind]?.mashMinimum !== undefined) clearMash(f.grab);
  state.conditionGroup = status.group;
  state.conditionImmunityFrames = status.immunityFrames;

  if (RULES[status.kind]?.blocksActions === true) {
    cancelAttack(f);
    cancelSpecialState(f);
  }
}


function endHeroStatus(f: Fighter): void {
  const { status } = f;
  if (status.condition === HeroStatusKind.none) return;
  status.conditionImmunity[status.conditionGroup] = max(status.conditionImmunity[status.conditionGroup] ?? 0, status.conditionImmunityFrames);
  status.condition = HeroStatusKind.none;
  status.conditionFrames = 0;
}


export function cleansePoisonAndSlow(f: Fighter): void {
  f.status.poisonFrames = 0;
  f.status.poisonEvery = 0;
  f.status.poisonDamage = 0.0;
  if (f.status.condition === HeroStatusKind.chill) endHeroStatus(f);
}


export function damageEndsHeroStatus(f: Fighter): void {
  if (rules(f)?.endsOnDamage === true) endHeroStatus(f);
}


export function advanceHeroConditions(f: Fighter): void {
  const { status } = f;
  if (status.poisonFrames > 0) {
    status.poisonFrames--;
    if (floorMod(status.poisonFrames, status.poisonEvery) === 0) status.damage = capPercent(addFloat32(roundToFloat32(status.damage), status.poisonDamage));
  }
  for (let group = 0; group < HERO_STATUS_GROUPS; group++) {
    const left = status.conditionImmunity[group] ?? 0;
    if (left > 0) status.conditionImmunity[group] = left - 1;
  }
  if (status.condition === HeroStatusKind.none) return;
  status.conditionFrames--;
  if (status.conditionFrames <= 0) endHeroStatus(f);
}


export function clearHeroStatus(f: Fighter): void {
  const { status } = f;
  status.condition = HeroStatusKind.none;
  status.conditionFrames = 0;
  status.conditionGroup = 0;
  status.conditionImmunityFrames = 0;
  for (let group = 0; group < HERO_STATUS_GROUPS; group++) status.conditionImmunity[group] = 0;
  status.poisonFrames = 0;
  status.poisonEvery = 0;
  status.poisonDamage = 0.0;
}

const NEUTRAL = neutralControls();

const reacting = (f: Readonly<Fighter>, held: boolean): boolean =>
  held || f.launch.hitlag > 0 || f.launch.hitstun > 0 || f.launch.diPending;






export function maskHeroStatusControls(f: Fighter, input: Controls, commands: AttackBuffer, held: boolean): void {
  const active = rules(f);
  if (active === undefined) return;
  if (active.mashMinimum !== undefined) f.status.conditionFrames = advanceMash(f.grab, input, f.status.conditionFrames, active.mashMinimum) + 1;
  if (active.blocksActions && !(active.keepsHitReactions === true && reacting(f, held))) {
    copyControls(input, NEUTRAL);
    clearAttackBuffer(commands);
    return;
  }
  if (active.blocksAttacks === true) {
    clearAttackBuffer(commands);
    input.attackRequested = false;
    input.attackPressed = false;
    input.getupAttackPressed = false;
  }
  if (active.ethereal === true && f.special.action === SpecialAction.none) {
    input.shield = false;
    input.shieldPressed = false;
  }
  if (active.blocksSpecials && input.specialZ <= 0) input.specialPressed = false;
}


export function carryHeroStatus(f: Fighter): boolean {
  const carry = rules(f)?.carry;
  if (carry === undefined || f.launch.hitstun > 0) return false;
  const { motion } = f;
  motion.vx = f32(-f.facing * carry.speed);
  motion.vz = carry.rise;
  motion.fastFalling = false;
  if (motion.grounded) {
    motion.grounded = false;
    motion.surface = undefined;
    f.jump.remaining = min(f.jump.remaining, aerialJumps(f));
  }
  return true;
}


export function heroStatusFall(f: Readonly<Fighter>): number {
  const fall = rules(f)?.fall;
  return fall === undefined || f.launch.hitstun > 0 ? 1.0 : fall;
}


export function heroStatusHop(f: Readonly<Fighter>): StatusRules["hop"] {
  return rules(f)?.hop;
}
