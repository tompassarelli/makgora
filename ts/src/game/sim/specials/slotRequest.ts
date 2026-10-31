import type { Fighter } from "../fighter";
import type { Controls } from "../roster";
import { stickMoved } from "../stickHistory";
import { type FighterSpecials, SpecialSlot, specialKit } from "./schema";

const SLOTS = [SpecialSlot.neutral, SpecialSlot.side, SpecialSlot.up, SpecialSlot.down] as const;

export function requestedSlot(f: Readonly<Fighter>, specials: Readonly<FighterSpecials>, input: Readonly<Controls>): SpecialSlot {
  for (const slot of SLOTS) {
    const motion = specialKit(specials, slot).selectedByMotion;
    if (motion !== undefined && stickMoved(f, motion)) return slot;
  }
  return input.specialZ > 0 ? SpecialSlot.up : input.specialZ < 0 ? SpecialSlot.down : input.specialX !== 0 ? SpecialSlot.side : SpecialSlot.neutral;
}
