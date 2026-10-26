import { GRAB_MOVE, GROUND_MODES, type Mode, away, toward } from "./comboExplorer";

export const PIVOT_DASH_FRAMES = [1, 2, 3, 4, 6] as const;

const pivotGrab = (dash: number): Mode => ({
  name: `pivot after a ${dash}-frame dash away`,
  hold: (n, start, a, b) => (n < start ? 0 : n < start + dash ? away(a, b) : n === start + dash ? toward(a, b) : 0),
  after: () => 0,
  earliest: (start) => start + dash + 1,
  moves: (a) => (a.motion.grounded ? [GRAB_MOVE] : []),
});

export const PIVOT_MODES: readonly Mode[] = PIVOT_DASH_FRAMES.map(pivotGrab);
export const LINK_GROUND_MODES: readonly Mode[] = [...GROUND_MODES, ...PIVOT_MODES];
