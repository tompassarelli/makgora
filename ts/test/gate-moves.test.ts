import { expect, test } from "bun:test";
import { isReplayFromMatch } from "../scripts/wisp/gateMoves";

test("a gate replay created during the match remains discoverable after the end timestamp [k2 property]", () => {
  expect(isReplayFromMatch("smashcraft-replay-508.txt", 150, 100)).toBe(true);
  expect(isReplayFromMatch("smashcraft-replay-508.txt", 250, 100)).toBe(true);
  expect(isReplayFromMatch("smashcraft-replay-507.txt", 90, 100)).toBe(false);
  expect(isReplayFromMatch("smashcraft-rates-508-44673996-0.txt", 150, 100)).toBe(false);
});
