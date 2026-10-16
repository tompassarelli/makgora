import { expect, test } from "bun:test";
import { isReplayFromMatch, startPromptReady } from "../scripts/wisp/gateMoves";

test("a gate replay created during the match remains discoverable after the end timestamp [k2 property]", () => {
  expect(isReplayFromMatch("smashcraft-replay-508.txt", 150, 100)).toBe(true);
  expect(isReplayFromMatch("smashcraft-replay-508.txt", 250, 100)).toBe(true);
  expect(isReplayFromMatch("smashcraft-replay-507.txt", 90, 100)).toBe(false);
  expect(isReplayFromMatch("smashcraft-rates-508-44673996-0.txt", 150, 100)).toBe(false);
});

test("the gate only starts from the ready prompt at the bottom of the character menu [k2 property]", () => {
  expect(startPromptReady([{ text: "Start", y: 920 }, { text: "Click", y: 930 }], 1000)).toBe(true);
  expect(startPromptReady([{ text: "Choose", y: 920 }, { text: "fighter", y: 930 }], 1000)).toBe(false);
  expect(startPromptReady([{ text: "Start", y: 120 }, { text: "Click", y: 930 }], 1000)).toBe(false);
});
