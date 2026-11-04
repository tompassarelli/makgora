import { expect, test } from "bun:test";
import { ROLLBACK_BUDGET, autoDelay, delayPolicy, observeRtt, rttEstimate, smoothedRttMs } from "wisp/src/netcode/delay";
import { createNetDelay, handMeasuredRtt, measuredDelay, noteEcho, noteSent } from "../src/host/loop/netDelay";
import { MAX_INPUT_DELAY, isFixedDelay } from "../src/game/netcode/inputSchedule";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";

const WINDOW = PLAYABLE_BUILD.input.kind === "keyboard" ? PLAYABLE_BUILD.input.rollback : 0;
const buildDelay = PLAYABLE_BUILD.input.kind === "keyboard" ? PLAYABLE_BUILD.input.delay : 0;
if (!isFixedDelay(buildDelay)) throw new Error(`the playable build's delay ${buildDelay} is not a fixed delay`);
const FLOOR = buildDelay;
const POLICY = delayPolicy(WINDOW, MAX_INPUT_DELAY, ROLLBACK_BUDGET, FLOOR);
const ROUND_TRIPS = [0, 20, 60, 100, 170, 300, 500, 1000, 2000];

function settledDelay(rttMs: number): number {
  const estimate = rttEstimate();
  for (let sample = 0; sample < 64; sample++) observeRtt(estimate, rttMs);
  return autoDelay(POLICY, estimate);
}

test("the delay the transport's measured round trip sets is the delay a settled estimate of that round trip gives, never below the floor and never falling as the round trip grows [k2 property]", () => {
  const delays = ROUND_TRIPS.map((rttMs) => handMeasuredRtt(createNetDelay(WINDOW, FLOOR), rttMs));
  delays.forEach((delay, index) => expect(delay).toBe(settledDelay(ROUND_TRIPS[index] ?? 0)));
  ROUND_TRIPS.forEach((rttMs, index) => expect(measuredDelay(WINDOW, FLOOR, rttMs)).toBe(delays[index] ?? -1));
  delays.forEach((delay, index) => {
    expect(delay).toBeGreaterThanOrEqual(POLICY.floor);
    if (index > 0) expect(delay).toBeGreaterThanOrEqual(delays[index - 1] ?? 0);
  });
});

test("a measured round trip of 170 ms plays at 2 frames and 300 ms at 5, and the map's pingDelay holds the same number the hand-over returned [k3 measure #679]", () => {
  const near = createNetDelay(WINDOW, FLOOR), far = createNetDelay(WINDOW, FLOOR);
  expect(handMeasuredRtt(near, 170)).toBe(2);
  expect(handMeasuredRtt(far, 300)).toBe(5);
  expect(near.pingDelay).toBe(2);
  expect(far.pingDelay).toBe(5);
  expect(smoothedRttMs(far.estimate)).toBe(300);
});

test("sync echoes move the estimate of a map that reads them, and leave a map that was handed its round trip where the transport measured it [k1 scenario]", () => {
  const echoed = createNetDelay(WINDOW, FLOOR), handed = createNetDelay(WINDOW, FLOOR);
  handMeasuredRtt(handed, 170);
  for (const net of [echoed, handed]) {
    for (let frame = 0; frame < 20; frame++) {
      noteSent(net, frame);
      net.ticks += 3;
      noteEcho(net, frame);
    }
  }
  expect(handed.estimate.samples).toBe(1);
  expect(smoothedRttMs(handed.estimate)).toBe(170);
  expect(echoed.estimate.samples).toBe(20);
  expect(smoothedRttMs(echoed.estimate)).toBe(100);
});
