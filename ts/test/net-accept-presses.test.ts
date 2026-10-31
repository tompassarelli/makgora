import { expect, test } from "bun:test";
import { type CapturedPress, EPOCH_STRIDE, markDrawn } from "../scripts/wisp/net";
import { type SideResult, pressAccounting } from "../scripts/wisp/netAcceptance";

const DELAY = 2;

const row = (epoch: number, frame: number, pressTick: number): CapturedPress => ({
  frame: epoch * EPOCH_STRIDE + frame, pressed: 1, tick: pressTick + 1, frontier: epoch * EPOCH_STRIDE + frame - DELAY, drawnTick: -1, pressTicks: [pressTick],
});

const side = (presses: SideResult["presses"]): SideResult => ({
  summary: "", frames: 7200, checksums: 120, mismatches: 0, rollback: undefined, presses, matchAt: 0, resultAt: 3101,
});

test("presses assigned past the end of a run's first match stay undrawn and after that end when its second match starts, so none counts as drawn 432 ticks late [k1 scenario]", () => {
  const captured = [row(1, 2901, 3098), row(1, 2902, 3099)];
  markDrawn(captured, 1, 2900, 3100);
  captured.push(row(2, 40, 3567));
  markDrawn(captured, 2, 41, 3570);
  expect(captured.map((press) => press.drawnTick)).toEqual([-1, -1, 3570]);
  const endFrames = { "1": EPOCH_STRIDE + 2900, "2": 2 * EPOCH_STRIDE + 41 };
  const accounting = pressAccounting(side({ slot: 0, delay: DELAY, endFrames, conflicts: 0, unmatched: 0, lost: 0, captured, received: {} }), side(undefined));
  expect({ afterEnd: accounting.afterEnd, drawn: accounting.drawn }).toEqual({ afterEnd: 2, drawn: [3] });
});
