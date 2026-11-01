import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { DownState, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { GameplanSpecial } from "../sim/gameplan";
import type { Controls } from "../sim/roster";
import { type AuthoredSpecial, type FighterSpecials, type SpecialKit, SpecialForm, SpecialSlot, specialForm, specialKit } from "../sim/specials/schema";
import { OLDEST_WEIGHT, type StickStep, motionCompleted, zoneCode } from "../sim/stickMotion";
import { specialCooldownReady } from "../sim/specials/engine";
import { gameplanOf } from "./botGameplan";
import { projectileMeets, recovering } from "./botHeroKit";

const SLOTS = [SpecialSlot.neutral, SpecialSlot.side, SpecialSlot.up, SpecialSlot.down] as const;
const SLOT_MOVES = [GameplanSpecial.neutral, GameplanSpecial.side, GameplanSpecial.up, GameplanSpecial.down] as const;
const PLAIN_STEPS: readonly (readonly StickStep[])[] = [[{ x: 0, z: 0 }], [{ x: 1, z: 0 }], [{ x: 0, z: 1 }], [{ x: 0, z: -1 }]];
const SLOT_ACTIONS = [SpecialAction.heroNeutral, SpecialAction.heroSide, SpecialAction.heroUp, SpecialAction.heroDown] as const;
const NO_MOTION = -1;

const sideOf = (f: Readonly<Fighter>): number => (f.facing < 0 ? -1 : 1);

const formOf = (f: Readonly<Fighter>): SpecialForm => (f.motion.grounded ? SpecialForm.ground : SpecialForm.air);

function baseMove(f: Readonly<Fighter>, specials: Readonly<FighterSpecials>, slot: number): AuthoredSpecial {
  return specialForm(specialKit(specials, slot), formOf(f));
}

export function castSteps(base: Readonly<AuthoredSpecial>, slot: number, variant: number): readonly StickStep[] | undefined {
  if (variant === 0) return at(PLAIN_STEPS, slot);
  for (const pick of base.variantByMotion ?? []) if (pick.variant === variant) return pick.motion.steps;
  return undefined;
}

function castsAs(f: Readonly<Fighter>, specials: Readonly<FighterSpecials>, slot: number, variant: number, steps: readonly StickStep[]): boolean {
  const side = sideOf(f);
  let recent = f.stick.recent;
  let older = f.stick.older;
  for (const step of steps) {
    older = imod(older, OLDEST_WEIGHT) * 16 + idiv(recent, OLDEST_WEIGHT);
    recent = imod(recent, OLDEST_WEIGHT) * 16 + zoneCode(step.x * side, step.z);
  }
  const last = at(steps, steps.length - 1);
  let requested: number = last.z > 0 ? SpecialSlot.up : last.z < 0 ? SpecialSlot.down : last.x !== 0 ? SpecialSlot.side : SpecialSlot.neutral;
  for (const candidate of SLOTS) {
    const motion = specialKit(specials, candidate).selectedByMotion;
    if (motion !== undefined && motionCompleted(recent, older, side, motion)) {
      requested = candidate;
      break;
    }
  }
  if (requested !== slot) return false;
  let moved = 0;
  for (const pick of baseMove(f, specials, slot).variantByMotion ?? []) {
    if (!motionCompleted(recent, older, side, pick.motion)) continue;
    moved = pick.variant;
    break;
  }
  return moved === variant;
}

function arrival(move: Readonly<AuthoredSpecial>, target: Readonly<Fighter>, localX: number, localZ: number, facing: number): number {
  let soonest = Infinity;
  for (const spec of move.projectiles ?? []) {
    if (!projectileMeets(spec, target, localX, localZ, facing)) continue;
    const speed = Math.abs(spec.velocityX);
    const travel = speed > 0 ? Math.ceil(f32(Math.max(0.0, f32(localX - spec.offsetX)) / speed)) : 0;
    soonest = Math.min(soonest, spec.spawnFrame + travel);
  }
  return soonest;
}

function shieldPressure(move: Readonly<AuthoredSpecial>): number {
  let pressure = 0.0;
  for (const spec of move.projectiles ?? []) pressure = f32(pressure + f32(f32(spec.effect.damage + (spec.effect.shieldDamage ?? 0.0)) * (spec.bites?.count ?? 1)));
  return pressure;
}

const open = (t: Readonly<Fighter>): boolean => recovering(t) || t.launch.hitstun > 0 || (t.motion.grounded && t.down.state !== DownState.none);

function spacedFar(f: Readonly<Fighter>, slot: number): number {
  let far = 0.0;
  for (const spaced of gameplanOf(f.character)?.spacing ?? []) if (spaced.move === at(SLOT_MOVES, slot)) far = Math.max(far, spaced.far);
  return far;
}

function variantFor(f: Readonly<Fighter>, kit: Readonly<SpecialKit>, base: Readonly<AuthoredSpecial>, target: Readonly<Fighter>, slot: number, observationAge: number): number {
  const form = formOf(f);
  const facing = sideOf(f);
  const localX = f32(f32(f32(target.motion.x + f32(target.motion.deltaX * observationAge)) - f.motion.x) * facing);
  const localZ = f32(target.motion.z - f.motion.z);
  const punish = open(target);
  const shielded = target.shield.raised;
  const ranged = localX > spacedFar(f, slot);
  let best = NO_MOTION;
  let bestScore = 0.0;
  const consider = (variant: number): void => {
    const move = specialForm(kit, form, variant);
    const soonest = arrival(move, target, localX, localZ, facing);
    if (soonest === Infinity) return;
    const score = punish ? -soonest : shielded ? shieldPressure(move) : ranged ? (move.projectiles ?? []).length : variant === 0 ? 1 : 0;
    if (best === NO_MOTION || score > bestScore) {
      best = variant;
      bestScore = score;
    }
  };
  consider(0);
  for (const pick of base.variantByMotion ?? []) consider(pick.variant);
  return best;
}

function punishVariant(f: Readonly<Fighter>, kit: Readonly<SpecialKit>, base: Readonly<AuthoredSpecial>, target: Readonly<Fighter>, believed: number): number {
  const form = formOf(f);
  const facing = sideOf(f);
  const localX = f32(f32(target.motion.x - f.motion.x) * facing);
  const localZ = f32(target.motion.z - f.motion.z);
  let best = NO_MOTION;
  let soonest = believed + 1;
  for (const pick of base.variantByMotion ?? []) {
    const frames = arrival(specialForm(kit, form, pick.variant), target, localX, localZ, facing) + pick.motion.steps.length - 1;
    if (frames >= soonest) continue;
    best = pick.variant;
    soonest = frames;
  }
  return best;
}

function hold(input: Controls, step: Readonly<StickStep>, side: number, press: boolean): void {
  input.diStickValid = false;
  input.direction = step.x * side;
  input.verticalDirection = step.z;
  input.down = false;
  if (!press) return;
  input.specialPressed = true;
  input.specialX = step.x * side;
  input.specialZ = step.z;
}

export interface MotionCast {
  motionSlot: number;
  motionVariant: number;
  motionStep: number;
  motionSide: number;
  motionFrame: number;
}

export function clearMotionCast(strategy: MotionCast): void {
  strategy.motionSlot = -1;
  strategy.motionVariant = 0;
  strategy.motionStep = 0;
  strategy.motionSide = 0;
  strategy.motionFrame = -1;
}

export function continueMotionCast(strategy: MotionCast, f: Readonly<Fighter>, frame: number, input: Controls): boolean {
  const slot = strategy.motionSlot;
  if (slot < 0) return false;
  const specials = f.tuning.specials;
  const steps = specials === undefined ? undefined : castSteps(baseMove(f, specials, slot), slot, strategy.motionVariant);
  if (steps === undefined || frame !== strategy.motionFrame || sideOf(f) !== strategy.motionSide || !canAttack(f) || f.special.action !== SpecialAction.none || f.launch.hitstun > 0) {
    clearMotionCast(strategy);
    return false;
  }
  const last = strategy.motionStep >= steps.length - 1;
  hold(input, at(steps, strategy.motionStep), strategy.motionSide, last);
  if (last) clearMotionCast(strategy);
  else {
    strategy.motionStep++;
    strategy.motionFrame = frame + 1;
  }
  return true;
}

function beginMotionCast(strategy: MotionCast, f: Readonly<Fighter>, specials: Readonly<FighterSpecials>, slot: number, variant: number, frame: number, input: Controls): boolean {
  const steps = castSteps(baseMove(f, specials, slot), slot, variant);
  if (steps === undefined || steps.length === 0 || !castsAs(f, specials, slot, variant, steps)) return false;
  strategy.motionSlot = slot;
  strategy.motionVariant = variant;
  strategy.motionStep = 0;
  strategy.motionSide = sideOf(f);
  strategy.motionFrame = frame;
  return continueMotionCast(strategy, f, frame, input);
}

export function pressMotionCast(strategy: MotionCast, f: Readonly<Fighter>, target: Readonly<Fighter>, slot: number, frame: number, observationAge: number, input: Controls): boolean {
  const specials = f.tuning.specials;
  if (specials === undefined) return false;
  const kit = specialKit(specials, slot);
  const base = baseMove(f, specials, slot);
  if ((base.variantByMotion ?? []).length === 0) return false;
  const variant = variantFor(f, kit, base, target, slot, observationAge);
  if (variant === NO_MOTION) return false;
  return beginMotionCast(strategy, f, specials, slot, variant, frame, input) || (variant !== 0 && beginMotionCast(strategy, f, specials, slot, 0, frame, input));
}

export function pressMotionPunish(strategy: MotionCast, f: Readonly<Fighter>, target: Readonly<Fighter>, believed: number, frame: number, input: Controls): boolean {
  const specials = f.tuning.specials;
  if (specials === undefined || strategy.motionSlot >= 0) return false;
  for (const slot of SLOTS) {
    const base = baseMove(f, specials, slot);
    if ((base.variantByMotion ?? []).length === 0 || !specialCooldownReady(f, at(SLOT_ACTIONS, slot))) continue;
    const variant = punishVariant(f, specialKit(specials, slot), base, target, believed);
    if (variant !== NO_MOTION && beginMotionCast(strategy, f, specials, slot, variant, frame, input)) return true;
  }
  return false;
}
