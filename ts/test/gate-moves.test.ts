import { expect, test } from "bun:test";
import { isReplayWrittenDuringMatch } from "../scripts/wisp/gateMoves";

test("a gate replay written before returning to the character menu belongs to that match [k2 property]", () => {
  expect(isReplayWrittenDuringMatch("smashcraft-replay-508.txt", 150, 100, 200)).toBe(true);
  expect(isReplayWrittenDuringMatch("smashcraft-replay-507.txt", 90, 100, 200)).toBe(false);
  expect(isReplayWrittenDuringMatch("smashcraft-rates-508-44673996-0.txt", 150, 100, 200)).toBe(false);
});
