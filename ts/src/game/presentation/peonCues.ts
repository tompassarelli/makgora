import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { FOLLOW_UP_FORM, chargeStage } from "../sim/specials/schema";
import { GOLD_SACK_CHARGE, GOLD_SACK_FIRST_ACTIVE, REST_SOUR_FRAME } from "../fighters/peon/specials";
import { ACTIVE_CUE_FRAMES } from "./cueWindows";

interface SackCue {
  readonly model: string;
  readonly anchor: "behind" | "ahead";
  readonly scale: number;
  readonly drawn: true;
  readonly sound?: string | undefined;
  readonly anchorFrames?: readonly { readonly x: number; readonly z: number }[] | undefined;
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
export const GOLD_SACK_SCALES: readonly number[] = [f32(0.6), f32(0.75), f32(0.9), f32(1.05), f32(1.3)];
const GOLD_CLINK = "ReceiveGold";
const GOLD_SACK_SWUNG_SCALE = f32(1.5);
export const GOLD_SACK_ON_BACK = { x: -14.0, z: 84.0 } as const;
const SACK_ON_BACK = Array.from({ length: 40 }, () => GOLD_SACK_ON_BACK);

export const goldSackStage = (charge: number): number => chargeStage(GOLD_SACK_CHARGE, charge);

const goldSackCues = (scale: number, clink: boolean): SackCues => ({
  spell: "Gold Sack",
  startup: { model: GOLD_SACK_MODEL, anchor: "behind", scale, drawn: true, sound: clink ? GOLD_CLINK : undefined, anchorFrames: SACK_ON_BACK },
  active: { model: GOLD_SACK_MODEL, anchor: "ahead", scale: f32(scale * GOLD_SACK_SWUNG_SCALE), drawn: true },
});
export const GOLD_SACK_CUES: readonly SackCues[] = GOLD_SACK_SCALES.map((scale, stage) => goldSackCues(scale, stage > 0));
export const EMPTY_GOLD_SACK_CUES: SackCues = goldSackCues(f32(0.6), false);

export function peonExtraCues(character: Character): readonly SackCues[] {
  return character === Character.peon ? GOLD_SACK_CUES : [];
}

function goldSackCueState(fighter: Readonly<Fighter>): PeonCueState<never> {
  const { form, frame } = fighter.special;
  const branch = form >= FOLLOW_UP_FORM ? idiv(form, FOLLOW_UP_FORM) - 1 : -1;
  const swinging = branch >= 0 && branch <= GOLD_SACK_CHARGE.stages;
  const stage = swinging ? branch : goldSackStage(fighter.special.charge);
  const cues = GOLD_SACK_CUES[stage];
  if (!swinging) return { cues, phase: "startup" };
  const first = GOLD_SACK_FIRST_ACTIVE[stage] ?? 0;
  return { cues, phase: frame < first ? "startup" : frame < first + ACTIVE_CUE_FRAMES ? "active" : "none" };
}

export function peonCueState<Rest>(fighter: Readonly<Fighter>, rest: Rest): PeonCueState<Rest> | undefined {
  const { action, frame } = fighter.special;
  if (action === SpecialAction.heroDown) return { cues: rest, phase: frame <= REST_SOUR_FRAME ? "startup" : "active" };
  return action === SpecialAction.heroNeutral ? goldSackCueState(fighter) : undefined;
}
