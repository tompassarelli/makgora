import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { FOLLOW_UP_FORM, chargeStage } from "../sim/specials/schema";
import { GOLD_SACK_CHARGE, GOLD_SACK_FIRST_ACTIVE, REST_SOUR_FRAME } from "../fighters/peon/specials";

interface SackCue {
  readonly model: string;
  readonly anchor: "behind" | "ahead";
  readonly scale: number;
  readonly drawn: true;
  readonly sound?: string | undefined;
  readonly anchorFrames?: readonly { readonly x: number; readonly z: number }[] | undefined;
  readonly lingerFrames?: number | undefined;
}

export interface SackCues {
  readonly spell: string;
  readonly startup: SackCue;
  readonly active: SackCue;
}

interface PeonCueState<Rest> {
  readonly cues: Rest | SackCues | undefined;
  readonly phase: "none" | "startup" | "active";
}

export const GOLD_SACK_MODEL = "Objects\\InventoryItems\\PotofGold\\PotofGold.mdx";
export const GOLD_SACK_FULL_SCALE = f32(1.3);
const GOLD_CLINK = "ReceiveGold";
export const GOLD_SACK_ON_BACK = { x: -14.0, z: 84.0 } as const;
const GOLD_SACK_GLINT = "Abilities\\Spells\\Items\\ResourceItems\\ResourceEffectTarget.mdx";
export const GOLD_SACK_COIN_SPILL = "Abilities\\Spells\\Other\\Transmute\\PileofGold.mdx";
const GLINT_SCALE = f32(0.8);
const FULL_GLINT_SCALE = f32(1.6);
const COIN_SPILL_SCALE = f32(0.35);
const COIN_SPILL_LINGER_FRAMES = 45;
const GLINT_LINGER_FRAMES = 40;
const SACK_MOUTH = Array.from({ length: GOLD_SACK_CHARGE.hold + 12 }, () => ({ x: 26.0, z: 58.0 }));
const STRUCK = Array.from({ length: 40 }, () => ({ x: 62.0, z: 80.0 }));

export const goldSackStage = (charge: number): number => chargeStage(GOLD_SACK_CHARGE, charge);
export const goldSackFull = (charge: number): boolean => goldSackStage(charge) === GOLD_SACK_CHARGE.stages;

export const goldSackStored = (fighter: Readonly<Fighter>): boolean =>
  !fighter.status.out && goldSackFull(fighter.special.charge) && fighter.special.action !== SpecialAction.heroNeutral;

const goldSackCues = (stage: number): SackCues => ({
  spell: "Gold Sack",
  startup: { model: GOLD_SACK_GLINT, anchor: "ahead", scale: stage >= GOLD_SACK_CHARGE.stages ? FULL_GLINT_SCALE : GLINT_SCALE, drawn: true, sound: GOLD_CLINK, anchorFrames: SACK_MOUTH, lingerFrames: GLINT_LINGER_FRAMES },
  active: { model: GOLD_SACK_COIN_SPILL, anchor: "ahead", scale: COIN_SPILL_SCALE, drawn: true, anchorFrames: STRUCK, lingerFrames: COIN_SPILL_LINGER_FRAMES },
});
const GOLD_SACK_CUES: readonly SackCues[] = Array.from({ length: GOLD_SACK_CHARGE.stages }, (_, handful) => goldSackCues(handful + 1));
export const GOLD_SACK_SLOT_CUES: SackCues = at(GOLD_SACK_CUES, 0);

export function peonExtraCues(character: Character): readonly SackCues[] {
  return character === Character.peon ? GOLD_SACK_CUES : [];
}

function goldSackCueState(fighter: Readonly<Fighter>): PeonCueState<never> {
  const { form, frame } = fighter.special;
  const { hit } = fighter.special;
  const branch = form >= FOLLOW_UP_FORM ? idiv(form, FOLLOW_UP_FORM) - 1 : -1;
  if (branch > GOLD_SACK_CHARGE.stages) return { cues: undefined, phase: "none" };
  if (branch < 0) {
    const stage = goldSackStage(fighter.special.charge);
    return goldSackFull(fighter.special.charge) ? { cues: at(GOLD_SACK_CUES, stage - 1), phase: "startup" } : { cues: undefined, phase: "none" };
  }
  return { cues: GOLD_SACK_SLOT_CUES, phase: hit && frame >= (GOLD_SACK_FIRST_ACTIVE[branch] ?? 0) ? "active" : "none" };
}

export function peonCueState<Rest>(fighter: Readonly<Fighter>, rest: Rest): PeonCueState<Rest> | undefined {
  const { action, frame } = fighter.special;
  if (action === SpecialAction.heroDown) return { cues: rest, phase: frame <= REST_SOUR_FRAME ? "startup" : "active" };
  if (action === SpecialAction.heroSide && !fighter.motion.grounded) return { cues: rest, phase: "none" };
  return action === SpecialAction.heroNeutral ? goldSackCueState(fighter) : undefined;
}
