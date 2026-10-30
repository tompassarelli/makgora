export const RUN_MOVES = [{ move: "run", slot: "run" }] as const;

const RUN_SAMPLE_TICKS = [2, 6, 10, 14, 20, 26, 32, 40] as const;

export interface RunShowcaseMove { readonly slot: string; readonly kind: "run"; readonly code: 0; readonly first: number; readonly end: number; readonly samples: readonly number[]; readonly run: true }

/** A full-tilt stick from standing: the dash burst, then the run, sampled across the burst and one and a bit run cycles. */
export function runShowcases(): RunShowcaseMove[] {
  const end = RUN_SAMPLE_TICKS[RUN_SAMPLE_TICKS.length - 1]!;
  return RUN_MOVES.map(({ slot }) => ({ slot, kind: "run", code: 0, first: 0, end, samples: RUN_SAMPLE_TICKS, run: true }));
}
