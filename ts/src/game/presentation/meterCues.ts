import { f32 } from "wisp/src/sim/f32";
import { type Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { hurtCapsule } from "../sim/geometry/contactGeometry";
import { ROSTER_MANA } from "../sim/mana";
import { type AuthoredSpecial, FOLLOW_UP_FORM } from "../sim/specials/schema";
import type { Cue } from "./specialCues";

export interface MeterCue extends Cue {
  readonly lift: number;
}

export const EX_AURA: MeterCue = { model: "Abilities\\Spells\\Items\\TomeOfRetraining\\TomeOfRetrainingCaster.mdx", anchor: "feet", scale: 1.0, lift: 0.0, sequence: "birth", sound: "DivineShield" };
export const SUPER_AURA: MeterCue = { model: "Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedTarget.mdx", anchor: "feet", scale: 1.0, lift: f32(0.15), sequence: "stand" };
export const ULTIMATE_BURST: MeterCue = { model: "Abilities\\Spells\\Other\\Doom\\DoomDeath.mdx", anchor: "feet", scale: f32(0.4), lift: 0.0, sequence: "birth", sound: "FlameStrike" };
export const METER_CUES: readonly MeterCue[] = [EX_AURA, SUPER_AURA, ULTIMATE_BURST];
export const METER_CUE_MOVES: readonly (readonly [string, MeterCue])[] = [["EX aura", EX_AURA], ["full-bar flame aura", SUPER_AURA], ["ultimate flame burst", ULTIMATE_BURST]];

export const METER_CUE_UNIT_RADIUS = 22.0;
export const METER_CUE_UNIT_HEIGHT = 90.0;

export interface MeterCueFit {
  readonly scale: number;
  readonly x: number;
  readonly z: number;
}

export function meterCueFit(cue: MeterCue, character: Character): MeterCueFit {
  const body = hurtCapsule(character);
  const top = f32(body.z2 + body.radius);
  const size = Math.max(f32(body.radius / METER_CUE_UNIT_RADIUS), f32(top / METER_CUE_UNIT_HEIGHT));
  return { scale: f32(cue.scale * size), x: 0.0, z: f32(top * cue.lift) };
}

export const EX_AURA_FRAMES = 30;
export const ULTIMATE_BURST_FRAMES = 16;
export const EX_CAST_VOLUME = 110;
export const ULTIMATE_CAST_VOLUME = 127;

export const meterCueSoundLabels = (): string[] => {
  const labels: string[] = [];
  for (const cue of METER_CUES) if (cue.sound !== undefined) labels.push(cue.sound);
  return labels;
};

/** The first frame the ultimate's own authored effects (projectiles, marks, regions) can show. */
export function ultimateFirstEffectFrame(move: Readonly<AuthoredSpecial> | undefined): number {
  let first = move?.endFrame ?? 0;
  for (const spec of move?.projectiles ?? []) first = Math.min(first, spec.spawnFrame);
  for (const region of move?.regions ?? []) first = Math.min(first, region.firstFrame);
  return first;
}

export interface MeterCueView {
  exAura: boolean;
  superAura: boolean;
  burst: boolean;
  exSound: boolean;
  ultimateSound: boolean;
}

export interface MeterCueState {
  action: SpecialAction;
  readonly view: MeterCueView;
}

export function createMeterCueState(): MeterCueState {
  return { action: SpecialAction.none, view: { exAura: false, superAura: false, burst: false, exSound: false, ultimateSound: false } };
}

export function clearMeterCueState(state: MeterCueState): void {
  state.action = SpecialAction.none;
  const { view } = state;
  view.exAura = false;
  view.superAura = false;
  view.burst = false;
  view.exSound = false;
  view.ultimateSound = false;
}

export function ultimateReady(fighter: Readonly<Fighter>, ultimatesOff: boolean): boolean {
  return !ultimatesOff && fighter.tuning.ultimate !== undefined && !fighter.status.out && fighter.mana.points >= ROSTER_MANA.max && fighter.special.action !== SpecialAction.heroUltimate;
}

/** Reads one confirmed frame of the fighter into the meter cues it shows; sounds are true only on the frame their cast starts. */
export function observeMeterCues(state: MeterCueState, fighter: Readonly<Fighter> | undefined, ultimatesOff: boolean): Readonly<MeterCueView> {
  const { view } = state;
  if (fighter === undefined || fighter.status.out) {
    clearMeterCueState(state);
    return view;
  }
  const { action, ex, form, frame } = fighter.special;
  const started = action !== SpecialAction.none && action !== state.action;
  state.action = action;
  const ultimate = action === SpecialAction.heroUltimate;
  view.ultimateSound = started && ultimate;
  view.exSound = started && !ultimate && ex;
  view.burst = ultimate && frame <= ULTIMATE_BURST_FRAMES;
  view.exAura = ex && !ultimate && action !== SpecialAction.none && form < FOLLOW_UP_FORM && frame <= EX_AURA_FRAMES;
  view.superAura = ultimateReady(fighter, ultimatesOff);
  return view;
}

export const NO_CAST = -1;

/** The first frame of the EX cast the fighter's state holds on `frame`, or NO_CAST. */
export function exCastFrame(fighter: Readonly<Fighter> | undefined, frame: number): number {
  if (fighter === undefined || fighter.status.out) return NO_CAST;
  const { action, ex, form } = fighter.special;
  return ex && action !== SpecialAction.none && action !== SpecialAction.heroUltimate && form < FOLLOW_UP_FORM ? frame - fighter.special.frame + 1 : NO_CAST;
}

/** The first frame of the ultimate the fighter's state holds on `frame`, or NO_CAST. */
export function ultimateCastFrame(fighter: Readonly<Fighter> | undefined, frame: number): number {
  if (fighter === undefined || fighter.status.out) return NO_CAST;
  return fighter.special.action === SpecialAction.heroUltimate ? frame - fighter.special.frame + 1 : NO_CAST;
}

/** A cast cue starts on the first presented frame holding the cast, plays `frames` presented frames, stops if a rollback removes a cast no confirmed frame held, and never restarts for that cast. */
export interface CastCue {
  readonly frames: number;
  cast: number;
  action: SpecialAction;
  start: number;
  heldAt: number;
  live: boolean;
  confirmed: number;
  confirmedHeld: boolean;
}

export function createCastCue(frames: number): CastCue {
  return { frames, cast: NO_CAST, action: SpecialAction.none, start: 0, heldAt: 0, live: false, confirmed: NO_CAST, confirmedHeld: false };
}

export function hideCastCue(cue: CastCue): void {
  cue.cast = NO_CAST;
  cue.action = SpecialAction.none;
  cue.live = false;
}

export function clearCastCue(cue: CastCue): void {
  hideCastCue(cue);
  cue.start = 0;
  cue.heldAt = 0;
  cue.confirmed = NO_CAST;
  cue.confirmedHeld = false;
}

function near(cue: Readonly<CastCue>, cast: number, other: number): boolean {
  return cast !== NO_CAST && other !== NO_CAST && Math.abs(cast - other) <= cue.frames;
}

export function confirmCastCue(cue: CastCue, cast: number): void {
  if (cast !== NO_CAST && !cue.confirmedHeld) cue.confirmed = cast;
  cue.confirmedHeld = cast !== NO_CAST;
}

export function presentCastCue(cue: CastCue, frame: number, cast: number, action: SpecialAction): boolean {
  if (cast !== NO_CAST) {
    const held = cue.cast !== NO_CAST && action === cue.action && ((frame >= cue.heldAt && frame - cue.heldAt <= 1) || near(cue, cast, cue.cast));
    if (!held) {
      cue.cast = cast;
      cue.action = action;
      cue.start = frame;
      cue.live = true;
    }
    cue.heldAt = frame;
  } else if (cue.cast !== NO_CAST && !near(cue, cue.cast, cue.confirmed)) {
    hideCastCue(cue);
  } else if (!cue.confirmedHeld) {
    cue.cast = NO_CAST;
    cue.action = SpecialAction.none;
  }
  if (cue.live && frame - cue.start >= cue.frames) cue.live = false;
  return cue.live && frame >= cue.start;
}
