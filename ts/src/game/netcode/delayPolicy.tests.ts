import { assertEquals, assertLessThan, test } from "wisp/src/runtime/testing";
import { PLAYABLE_BUILD } from "../session/currentBuild";
import { agreedDelay, autoDelay, delayPolicy, observeRtt, rttEstimate } from "./delayPolicy";

const window = PLAYABLE_BUILD.input.kind === "keyboard" ? PLAYABLE_BUILD.input.rollback : 0;

function settledDelay(rttMs: number): number {
  const estimate = rttEstimate();
  for (let sample = 0; sample < 64; sample++) observeRtt(estimate, rttMs);
  return autoDelay(delayPolicy(window), estimate);
}

test("online rollback repairs at most 7 frames with 4 frames of rollback budget and input delay covers the rest of the trip without a ceiling: 100 and 200 ms play at 2 frames, 300 ms at 5, 500 ms at 11, 1000 ms at 26 and 2000 ms at 56 [k3 measure #679]", () => {
  assertEquals(window, 7);
  assertEquals(settledDelay(100), 2);
  assertEquals(settledDelay(200), 2);
  assertEquals(settledDelay(300), 5);
  assertEquals(settledDelay(500), 11);
  assertEquals(settledDelay(1000), 26);
  assertEquals(settledDelay(2000), 56);
  assertLessThan(settledDelay(2000), delayPolicy(window).ceiling);
  assertEquals(agreedDelay([2, 26, 11]), 26);
});
