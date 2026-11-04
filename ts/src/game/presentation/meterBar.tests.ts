import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { ULTIMATE_METER_FRAMES } from "../sim/meter";
import { meterPulse, ultimateFill, ultimatePulse } from "./meterBar";

test("the ultimate bar fills with the meter and pulses only when the ultimate is ready [k2 property]", () => {
  for (const frames of [0, 1800, 3600, 7200]) {
    assertEquals(ultimateFill(frames), frames / ULTIMATE_METER_FRAMES);
    assertEquals(meterPulse(false, 0), 0);
  }
  assertTrue(meterPulse(true, 7) > 0);
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
