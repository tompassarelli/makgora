import { expect, test } from "bun:test";
import { REEL_HOLD_TICKS, missedFramesProblem } from "../scripts/nativeCapture";

test("a reel holds each capture frame 30 ticks by default, long enough for the drawn stamp to reach a screen capture [k1 scenario]", () => {
  expect(REEL_HOLD_TICKS).toBe(30);
});

test("a missed capture frame is reported by fixture and frame with the hold length, not as a stuck stamp [k1 scenario]", () => {
  const problem = missedFramesProblem([{ fixture: "R01-right", frame: 49, phase: "held", holdTicks: 6 }, { fixture: "R01-right", frame: 52, phase: "held", holdTicks: 6 }]);
  for (const fact of ["missed frames R01-right@49, R01-right@52", "6 ticks (100 ms)", "--hold-ticks", "default 30"]) expect(problem).toContain(fact);
  expect(problem).not.toContain("stuck");
});
