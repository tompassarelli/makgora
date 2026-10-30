import { assertEquals, assertLessThan, test } from "wisp/src/runtime/testing";
import { AUTO_DELAY, agreedDelay, autoDelay, delayPolicy, observeRtt, rttEstimate, stepManualDelay } from "wisp/src/netcode/delay";
import { PLAYABLE_BUILD } from "../../game/session/currentBuild";
import { createMatchState, setHumanCount } from "../../game/lobby/lobbyState";
import { MAX_INPUT_DELAY } from "../../game/netcode/fixedSchedule";
import { createNetDelay, hostDelayFrom, matchDelay } from "./netDelay";

const window = PLAYABLE_BUILD.input.kind === "keyboard" ? PLAYABLE_BUILD.input.rollback : 0;

function settledDelay(rttMs: number): number {
  const estimate = rttEstimate();
  for (let sample = 0; sample < 64; sample++) observeRtt(estimate, rttMs);
  return autoDelay(delayPolicy(window, MAX_INPUT_DELAY), estimate);
}

test("online rollback repairs at most 7 frames with 4 frames of rollback budget and input delay covers the rest of the trip without a ceiling: 100 and 200 ms play at 2 frames, 300 ms at 5, 500 ms at 11, 1000 ms at 26 and 2000 ms at 56 [k3 measure #679]", () => {
  assertEquals(window, 7);
  assertEquals(settledDelay(100), 2);
  assertEquals(settledDelay(200), 2);
  assertEquals(settledDelay(300), 5);
  assertEquals(settledDelay(500), 11);
  assertEquals(settledDelay(1000), 26);
  assertEquals(settledDelay(2000), 56);
  assertLessThan(settledDelay(2000), delayPolicy(window, MAX_INPUT_DELAY).ceiling);
  assertEquals(agreedDelay([2, 26, 11]), 26);
});

test("a host-set input delay overrides Auto for every client, including values above 60, and only the host can set it [k3 measure #679]", () => {
  const game = createMatchState();
  setHumanCount(game, 2);
  const clients = [createNetDelay(window), createNetDelay(window)];
  for (const net of clients) {
    net.proposals[0] = 3;
    net.proposals[1] = 26;
    assertEquals(matchDelay(net, game), 26);
  }
  for (const manual of [2, 0, 70, MAX_INPUT_DELAY]) {
    for (const net of clients) {
      hostDelayFrom(net, game, 1, 9);
      hostDelayFrom(net, game, 0, manual);
      assertEquals(matchDelay(net, game), manual);
    }
  }
  for (const net of clients) {
    hostDelayFrom(net, game, 0, AUTO_DELAY);
    assertEquals(matchDelay(net, game), 26);
  }
  assertEquals(stepManualDelay(delayPolicy(window, MAX_INPUT_DELAY), AUTO_DELAY, 26, 1), 27);
  assertEquals(stepManualDelay(delayPolicy(window, MAX_INPUT_DELAY), 0, 26, -1), 0);
});
