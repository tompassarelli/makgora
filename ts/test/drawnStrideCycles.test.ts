import { expect, test } from "bun:test";
import { gaitCycles } from "../scripts/wisp/drawnMotion";

test("a looping foot track counts every gait cycle it draws, whatever its phase, so a stock Walk that loops three times reads three times the foot travel of one loop [k2 property]", () => {
  for (const cycles of [1, 2, 3, 4]) {
    for (const phase of [0.0, 0.13, 0.25, 0.5, 0.77]) {
      const xs = Array.from({ length: 61 }, (_, frame) => 50 * Math.sin(2 * Math.PI * (cycles * frame / 60 + phase)));
      expect(gaitCycles(xs, Math.min(...xs), Math.max(...xs)), `${cycles} cycles at phase ${phase}`).toBe(cycles);
    }
  }
});
