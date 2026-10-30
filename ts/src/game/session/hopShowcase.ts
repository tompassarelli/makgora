import type { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster, neutralControls } from "../sim/roster";
import { advanceFighter } from "../sim/step";

export const HOP_MOVES = [
  { move: "jump-squat", slot: "jumpSquat", full: true },
  { move: "short-hop", slot: "shortHop", full: false },
  { move: "full-hop", slot: "fullHop", full: true },
] as const;

const HOP_STRIP_FRAMES = 8;
const HOP_LIMIT = 150;
const SQUAT_STRIP_AIR_FRAMES = 2;
const FULL_HOP_HOLD_PAST_SQUAT = 2;

export interface HopShowcaseMove { readonly slot: string; readonly kind: "hop"; readonly code: 0; readonly first: number; readonly end: number; readonly samples: readonly number[]; readonly jump: { readonly frames: number } }

export interface HopTimeline { readonly squat: number; readonly air: number }

/** The ticks a lone fighter spends in the jump squat and in the air after a jump press held (full) or released the next tick (short). */
export function hopTimeline(character: Character, full: boolean): HopTimeline {
  const fighter = createFighter(character, 0.0, 1);
  const world = createRoster(1, [fighter]);
  const neutral = neutralControls(), held = { ...neutral, jumpHeld: true }, press = { ...held, jumpPressed: true };
  for (let tick = 0; tick < 30; tick++) advanceFighter(world, 0, 0, neutral, 0.0);
  let squat = 0, air = 0;
  for (let tick = 0; tick < HOP_LIMIT; tick++) {
    advanceFighter(world, 0, 0, tick === 0 ? press : full ? held : neutral, 0.0);
    if (!fighter.motion.grounded) air++;
    else if (air > 0) break;
    else squat++;
  }
  if (air === 0) throw new Error(`character ${character}: the ${full ? "full" : "short"} hop leaves the ground`);
  return { squat, air };
}

const spread = (from: number, to: number, count: number): number[] =>
  Array.from({ length: count }, (_, index) => from + Math.round(index * (to - from) / Math.max(1, count - 1)));

export function hopShowcases(character: Character): HopShowcaseMove[] {
  return HOP_MOVES.map(({ slot, move, full }) => {
    const { squat, air } = hopTimeline(character, full);
    const squatOnly = move === "jump-squat";
    const samples = squatOnly ? spread(1, squat + SQUAT_STRIP_AIR_FRAMES, Math.min(HOP_STRIP_FRAMES, squat + SQUAT_STRIP_AIR_FRAMES)) : spread(squat, squat + air, HOP_STRIP_FRAMES);
    return { slot, kind: "hop", code: 0, first: squat, end: squat + air, samples, jump: { frames: full ? squat + FULL_HOP_HOLD_PAST_SQUAT : 1 } };
  });
}
