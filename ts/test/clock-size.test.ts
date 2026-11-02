import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import {
  CLOCK_DIGIT_SIZE, CLOCK_GLYPH_TOP, CLOCK_HUNDREDTHS_SIZE, CLOCK_TOP_MARGIN_SHARE, MATCH_CLOCK_BOX, MELEE_CLOCK_SHARE, SCREEN_CENTRE_X, SCREEN_HEIGHT_UNITS, clockOuterShare,
} from "../src/game/ui/clockLayout";

const within = (actual: number, expected: number, fraction: number): boolean => Math.abs(actual - expected) <= expected * fraction;

test("the match clock's digits stand at Melee's share of the screen height: 5.0% for MM:SS and 4.17% for the hundredths, measured with the outline [k3 measure docs/design/match-flow.md]", () => {
  expect(within(clockOuterShare(CLOCK_DIGIT_SIZE), MELEE_CLOCK_SHARE.digitHeight, 0.03)).toBe(true);
  expect(within(clockOuterShare(CLOCK_HUNDREDTHS_SIZE), MELEE_CLOCK_SHARE.hundredthsHeight, 0.03)).toBe(true);
  expect(CLOCK_HUNDREDTHS_SIZE).toBeLessThan(CLOCK_DIGIT_SIZE);
});

test("the clock keeps 4% of the screen height above its digits, centred and inside the 4:3 safe area [k3 measure docs/design/match-flow.md]", () => {
  expect(within(1 - CLOCK_GLYPH_TOP / SCREEN_HEIGHT_UNITS, CLOCK_TOP_MARGIN_SHARE, 0.01)).toBe(true);
  expect(CLOCK_TOP_MARGIN_SHARE).toBe(f32(0.04));
  expect(MATCH_CLOCK_BOX.left).toBeGreaterThan(0);
  expect(MATCH_CLOCK_BOX.left + MATCH_CLOCK_BOX.width).toBeLessThan(0.8);
  expect(MATCH_CLOCK_BOX.top).toBeLessThanOrEqual(SCREEN_HEIGHT_UNITS);
  expect(Math.abs(MATCH_CLOCK_BOX.left + MATCH_CLOCK_BOX.width / 2 - SCREEN_CENTRE_X)).toBeLessThan(0.02);
});
