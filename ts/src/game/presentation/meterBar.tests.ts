import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { METER } from "../sim/meter";
import { meterDisplay, ultimatePulse } from "./meterBar";

test("the EX cell and the ultimate bar fill independently: a full cell beside a half bar, the reverse, and each over only its own meter [k2 property]", () => {
  const exOnly = meterDisplay(METER.exFrames, METER.ultimateFrames / 2, true, false, 7);
  assertEquals(exOnly.exCell.fill, 1.0);
  assertTrue(exOnly.exCell.lit);
  assertEquals(exOnly.ultimateBar.fill, 0.5);
  assertEquals(exOnly.ultimateBar.pulse, 0);
  const ultimateOnly = meterDisplay(0, METER.ultimateFrames, false, true, 7);
  assertEquals(ultimateOnly.exCell.fill, 0.0);
  assertTrue(!ultimateOnly.exCell.lit);
  assertEquals(ultimateOnly.ultimateBar.fill, 1.0);
  assertTrue(ultimateOnly.ultimateBar.pulse > 0);
  for (const frames of [0, 180, 360, 540, 720]) {
    const display = meterDisplay(frames, 1800, false, false, 0);
    assertEquals(display.exCell.fill, frames / METER.exFrames);
    assertEquals(display.ultimateBar.fill, 0.25);
  }
  for (const frames of [0, 1800, 3600, 7200]) {
    const display = meterDisplay(360, frames, false, false, 0);
    assertEquals(display.exCell.fill, 0.5);
    assertEquals(display.ultimateBar.fill, frames / METER.ultimateFrames);
  }
});

test("the ultimate pulse breathes between a dim and a bright level on a fixed cycle and never reads zero [k2 property]", () => {
  let low = 255, high = 0;
  for (let tick = 0; tick < 48; tick++) {
    const level = ultimatePulse(tick);
    assertEquals(level, ultimatePulse(tick + 48), `tick ${tick}`);
    assertEquals(level > 0 && level <= 255, true, `tick ${tick}`);
    low = Math.min(low, level);
    high = Math.max(high, level);
  }
  assertTrue(high - low >= 120);
});
