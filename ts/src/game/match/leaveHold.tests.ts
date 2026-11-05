import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { LEAVE_HOLD_FRAMES, type LeaveHold, leaveHold, leaveHoldFill, pressEscape, releaseEscape, tickLeaveHold } from "./leaveHold";

const ticksUntilLeave = (hold: LeaveHold, limit: number, repeat?: () => void): number | undefined => {
  for (let frame = 1; frame <= limit; frame++) {
    repeat?.();
    if (tickLeaveHold(hold)) return frame;
  }
  return undefined;
};

test("the Esc press that paused, held or key-repeated for 120 frames, never leaves; after its release a fresh 60-frame hold does [k2 property]", () => {
  const hold = leaveHold();
  assertFalse(pressEscape(hold, 0, undefined));
  assertEquals(ticksUntilLeave(hold, 2 * LEAVE_HOLD_FRAMES, () => assertTrue(pressEscape(hold, 0, 0))), undefined);
  assertEquals(leaveHoldFill(hold), 0);
  assertFalse(releaseEscape(hold, 0));
  assertTrue(pressEscape(hold, 0, 0));
  assertEquals(ticksUntilLeave(hold, 2 * LEAVE_HOLD_FRAMES, () => pressEscape(hold, 0, 0)), LEAVE_HOLD_FRAMES);
});
