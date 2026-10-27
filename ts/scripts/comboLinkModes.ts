import { SpecialAction } from "../src/game/sim/codes";
import { type Defender, GRAB_MOVE, GROUND_MODES, JUMP, type Mode, type Saved, type Sim, away, defenderMask, hop, toward } from "./comboExplorer";

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
const JUMP_CANCEL_MODES: readonly Mode[] = [
  hop("jump-cancelled short hop", 0, false, true), hop("jump-cancelled full hop", 0, true, true), hop("jump-cancelled full hop in place", 0, true, false),
];

const inSpecial = (sim: Sim): boolean => sim.a.special.action !== SpecialAction.none;

export function jumpCancelFrame(sim: Sim, saved: readonly (Saved | undefined)[], d: Defender, start: number): number | undefined {
  for (let n = 1; n < start; n++) {
    const own = saved[n];
    if (own === undefined) continue;
    sim.load(own);
    if (!inSpecial(sim)) continue;
    const mask = defenderMask(d, n, undefined, sim.b, sim.a);
    sim.step(0, mask);
    if (!inSpecial(sim)) continue;
    sim.load(own);
    sim.step(JUMP, mask);
    if (!inSpecial(sim)) return n;
  }
  return undefined;
}

export const modeStarts = (modes: readonly Mode[], start: number, jumpCancel: number | undefined): readonly (readonly [Mode, number])[] => [
  ...modes.map((mode) => [mode, start] as const),
  ...(jumpCancel === undefined ? [] : JUMP_CANCEL_MODES.map((mode) => [mode, jumpCancel] as const)),
];
