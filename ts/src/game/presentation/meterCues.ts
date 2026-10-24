import { f32 } from "wisp/src/sim/f32";
import { SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { ROSTER_MANA } from "../sim/mana";
import { type AuthoredSpecial, FOLLOW_UP_FORM } from "../sim/specials/schema";
import type { Cue } from "./specialCues";

export const EX_AURA: Cue = { model: "Abilities\\Spells\\Human\\InnerFire\\InnerFireTarget.mdx", anchor: "feet", scale: 1.0, sequence: "birth", sound: "DivineShield" };
export const SUPER_AURA: Cue = { model: "Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedTarget.mdx", anchor: "feet", scale: 1.0, sequence: "stand" };
export const ULTIMATE_BURST: Cue = { model: "Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx", anchor: "body", scale: f32(0.6), sequence: "birth", sound: "FlameStrike" };
export const METER_CUES: readonly Cue[] = [EX_AURA, SUPER_AURA, ULTIMATE_BURST];

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
