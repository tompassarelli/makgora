import { f32 } from "wisp/src/sim/f32";
const RUN_SAMPLE_TICKS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40] as const;
const WALK_SAMPLE_TICKS = [10, 14, 18, 22, 26, 30, 34, 38] as const;

export const RUN_MOVES = [
  { move: "run", slot: "run", stick: 1, samples: RUN_SAMPLE_TICKS },
  { move: "walk", slot: "walk", stick: f32(0.7), samples: WALK_SAMPLE_TICKS },
] as const;

export interface RunShowcaseMove { readonly slot: string; readonly kind: "run"; readonly code: 0; readonly first: number; readonly end: number; readonly samples: readonly number[]; readonly run: number }

/** A stick from standing, full tilt for the dash burst then the run, or a walk tilt: sampled across one and a bit gait cycles. */
export function runShowcases(): RunShowcaseMove[] {
  return RUN_MOVES.map(({ slot, stick, samples }) => ({ slot, kind: "run", code: 0, first: 0, end: Math.max(...samples), samples, run: stick }));
}
