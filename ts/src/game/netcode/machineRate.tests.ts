import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import { FULL_SPEED_FPS, SATURATED_BUSY_MS, SLOW_FPS, SUSTAIN_SECONDS, machineRate, noteMachineSecond, secondFps } from "./machineRate";

test("a machine is named slow only after it runs under full pace while saturated for consecutive seconds, and cleared only after as many seconds back at pace [k2 property]", () => {
  const slowFps = SLOW_FPS - 14;
  const rate = machineRate();
  for (let second = 1; second < SUSTAIN_SECONDS; second++) {
    noteMachineSecond(rate, slowFps, SATURATED_BUSY_MS);
    assertFalse(rate.slow);
  }
  noteMachineSecond(rate, slowFps, SATURATED_BUSY_MS);
  assertTrue(rate.slow);
  assertEquals(rate.fps, slowFps);
  noteMachineSecond(rate, slowFps, SATURATED_BUSY_MS - 1);
  assertTrue(rate.slow);
  for (let second = 2; second < SUSTAIN_SECONDS; second++) {
    noteMachineSecond(rate, FULL_SPEED_FPS, 0);
    assertTrue(rate.slow);
  }
  noteMachineSecond(rate, FULL_SPEED_FPS, 0);
  assertFalse(rate.slow);
  const held = machineRate();
  for (let second = 0; second < SUSTAIN_SECONDS * 3; second++) noteMachineSecond(held, slowFps, SATURATED_BUSY_MS - 1);
  assertFalse(held.slow);
  const busy = machineRate();
  for (let second = 0; second < SUSTAIN_SECONDS * 3; second++) noteMachineSecond(busy, SLOW_FPS, 1000);
  assertFalse(busy.slow);
  const flicker = machineRate();
  for (let second = 0; second < SUSTAIN_SECONDS * 3; second++) noteMachineSecond(flicker, imod(second, 2) === 0 ? slowFps : FULL_SPEED_FPS, SATURATED_BUSY_MS);
  assertFalse(flicker.slow);
  assertEquals(secondFps(104, 1), FULL_SPEED_FPS);
  assertEquals(secondFps(40, 1), 40);
  assertEquals(secondFps(81, 2), 41);
});
