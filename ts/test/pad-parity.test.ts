import { expect, test } from "bun:test";
import { parseTrace } from "../scripts/integrity/padParity";

test("pad parity includes platform mount and drop transitions [k1 scenario]", () => {
  const trace = parseTrace([
    "1 0.017 participant 0 frame 68 phase 2 platform mount deck 1",
    "2 0.033 participant 0 frame 125 phase 2 platform drop deck 1",
  ]);
  expect(trace.events).toEqual([
    { slot: 0, frame: 68, text: "phase 2 platform mount deck 1" },
    { slot: 0, frame: 125, text: "phase 2 platform drop deck 1" },
  ]);
});
