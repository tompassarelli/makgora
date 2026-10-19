import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import {
  AUTO_DELAY, CLEAN_SECONDS, type DelayPolicy, ERROR_SECONDS, ERROR_WINDOW_SECONDS, HELD_ERROR_CALLBACKS, type MatchSecond, agreedDelay, cleanSecond, connectionPoor,
  correctDelay, correctedDelay, delayCorrection, delayPolicy, erroredSecond, expectedRollback, highDelay, nextDelay, observeRtt, requestedDelay, rttEstimate,
} from "./delayPolicy";
import { REPLAY_MAX_CORRECTION_FRAMES } from "../replay/limits";

const SAMPLES_PER_STOCK = 900;

function lcg(seed: number): () => number {
  let state = imod(seed, 65536) + 1;
  return () => {
    state = imod(state * 75, 65537);
    return state - 1;
  };
}

function playStocks(policy: DelayPolicy, stocks: readonly number[], jitterMs: number, seed: number): number[] {
  const next = lcg(seed);
  const estimate = rttEstimate();
  const delays: number[] = [];
  let delay = policy.floor;
  for (const baseMs of stocks) {
    for (let sample = 0; sample < SAMPLES_PER_STOCK; sample++) observeRtt(estimate, baseMs + (jitterMs === 0 ? 0 : imod(next(), jitterMs + 1)));
    delay = nextDelay(policy, estimate, delay);
    delays.push(delay);
  }
  return delays;
}

test("over generated round-trip traces the delay stays within 2 and the ceiling and never reverses under jitter [k2 property]", () => {
  const draw = lcg(396);
  for (let trace = 0; trace < 120; trace++) {
    const window = [6, 12, 24][imod(draw(), 3)] ?? 24;
    const ceiling = 2 + imod(draw(), 7);
    const policy = delayPolicy(window, ceiling, 1 + imod(draw(), window - 1));
    const baseMs = imod(draw(), 1400);
    const jitterMs = imod(draw(), 34);
    const delays = playStocks(policy, [baseMs, baseMs, baseMs, baseMs, baseMs], jitterMs, draw());
    let changes = 0;
    for (let stock = 0; stock < delays.length; stock++) {
      const delay = delays[stock] ?? -1;
      assertTrue(delay >= 2 && delay <= ceiling);
      if (stock > 0 && delay !== delays[stock - 1]) {
        changes++;
        assertTrue(delay > (delays[stock - 1] ?? 0));
      }
    }
    assertTrue(changes <= 1);
  }
});

test("over generated jittered round trips up to 1.4 s, Auto leaves at most the rollback budget to prediction, well inside the window, whenever it is below the ceiling [k2 property]", () => {
  const draw = lcg(793);
  const policy = delayPolicy(REPLAY_MAX_CORRECTION_FRAMES);
  assertTrue(policy.budget * 2 < policy.window);
  for (let trace = 0; trace < 200; trace++) {
    const baseMs = imod(draw(), 1400);
    const [delay = -1] = playStocks(policy, [baseMs], imod(draw(), 200), draw());
    const estimate = rttEstimate();
    observeRtt(estimate, baseMs);
    assertTrue(delay >= policy.floor && delay <= policy.ceiling);
    if (delay < policy.ceiling) assertTrue(expectedRollback(estimate, delay) <= policy.budget);
  }
});

const HOLDING: MatchSecond = { held: HELD_ERROR_CALLBACKS, arrivals: 60, deep: 60 };
const CLEAN: MatchSecond = { held: 0, arrivals: 60, deep: 0 };

test("over generated match seconds, error correction never leaves 2 to the ceiling, never rises in a window with fewer errored seconds than its threshold, and falls by one only after a whole clean stretch [k2 property]", () => {
  const draw = lcg(4793);
  const policy = delayPolicy(REPLAY_MAX_CORRECTION_FRAMES);
  for (let trace = 0; trace < 60; trace++) {
    const correction = delayCorrection(policy);
    const delay = policy.floor + imod(draw(), policy.ceiling - policy.floor + 1);
    let errored = 0;
    let clean = 0;
    for (let second = 0; second < 600; second++) {
      const held = imod(draw(), 8) === 0 ? imod(draw(), 6) : 0;
      const arrivals = 30 + imod(draw(), 60);
      const lateMax = imod(draw(), policy.window + 2);
      const sample: MatchSecond = { held, arrivals, deep: lateMax > policy.budget ? imod(draw(), arrivals + 1) : 0 };
      const before = correction.value;
      const window = correction.windowSeconds;
      if (window === 0) errored = 0;
      if (erroredSecond(sample)) errored++;
      clean = cleanSecond(sample) ? clean + 1 : 0;
      correctDelay(policy, correction, delay, sample);
      assertTrue(correction.value >= policy.floor && correction.value <= policy.ceiling);
      if (correction.value > before) assertTrue(window + 1 === ERROR_WINDOW_SECONDS && errored >= ERROR_SECONDS);
      if (correction.value < before) {
        assertEquals(clean, CLEAN_SECONDS);
        assertEquals(correction.value, Math.min(before, delay) - 1);
        clean = 0;
      }
      if (clean === CLEAN_SECONDS) clean = 0;
    }
  }
});

test("held seconds raise the error-corrected delay one frame per window up to the ceiling, a later clean stretch lowers it by one, and Auto takes the higher of it and the ping target [k2 property]", () => {
  const policy = delayPolicy(REPLAY_MAX_CORRECTION_FRAMES);
  const correction = delayCorrection(policy);
  let delay = policy.floor;
  for (let window = 0; window < policy.ceiling * 2; window++) {
    for (let second = 0; second < ERROR_WINDOW_SECONDS; second++) correctDelay(policy, correction, delay, HOLDING);
    assertEquals(correction.value, Math.min(policy.ceiling, delay + 1));
    delay = correction.value;
  }
  for (let second = 1; second < CLEAN_SECONDS; second++) correctDelay(policy, correction, delay, CLEAN);
  assertEquals(correction.value, policy.ceiling);
  correctDelay(policy, correction, delay, CLEAN);
  assertEquals(correction.value, policy.ceiling - 1);
  assertEquals(correctedDelay(policy, correction, policy.floor), policy.ceiling - 1);
  assertEquals(correctedDelay(policy, correction, policy.ceiling + 5), policy.ceiling);
});
