import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { MATCH_TICKS_PER_SECOND } from "../lobby/lobbyState";
import { LEAVE_HOLD_FRAMES, type LeaveHold, leaveHold, leaveHoldFill, pressEscape, releaseEscape, tickLeaveHold } from "./leaveHold";

const ticksUntilLeave = (hold: LeaveHold, limit: number, repeat?: () => void): number | undefined => {
  for (let frame = 1; frame <= limit; frame++) {
    repeat?.();
    if (tickLeaveHold(hold)) return frame;
  }
  return undefined;
};

test("holding Esc on the pause screen leaves after one second of frames, a shorter hold never does and its release resumes [k2 property]", () => {
  assertEquals(LEAVE_HOLD_FRAMES, MATCH_TICKS_PER_SECOND);
  const full = leaveHold();
  assertTrue(pressEscape(full, 0, 0));
  assertEquals(ticksUntilLeave(full, 2 * LEAVE_HOLD_FRAMES), LEAVE_HOLD_FRAMES);
  assertEquals(leaveHoldFill(full), 0);

  const short = leaveHold();
  pressEscape(short, 0, 0);
  assertEquals(ticksUntilLeave(short, LEAVE_HOLD_FRAMES - 1), undefined);
  assertEquals(short.frames, LEAVE_HOLD_FRAMES - 1);
  assertTrue(leaveHoldFill(short) > 0.5 && leaveHoldFill(short) < 1);
  assertTrue(releaseEscape(short, 0));
  assertEquals(ticksUntilLeave(short, 2 * LEAVE_HOLD_FRAMES), undefined);
  assertEquals(leaveHoldFill(short), 0);

  const tap = leaveHold();
  pressEscape(tap, 0, 0);
  assertTrue(releaseEscape(tap, 0));
  assertEquals(ticksUntilLeave(tap, 2 * LEAVE_HOLD_FRAMES), undefined);
});

test("the Esc press that paused, held or key-repeated for 120 frames, never leaves; after its release a fresh 60-frame hold does [k2 property]", () => {
  const hold = leaveHold();
  assertFalse(pressEscape(hold, 0, undefined));
  assertEquals(ticksUntilLeave(hold, 2 * LEAVE_HOLD_FRAMES, () => assertTrue(pressEscape(hold, 0, 0))), undefined);
  assertEquals(leaveHoldFill(hold), 0);
  assertFalse(releaseEscape(hold, 0));
  assertTrue(pressEscape(hold, 0, 0));
  assertEquals(ticksUntilLeave(hold, 2 * LEAVE_HOLD_FRAMES, () => pressEscape(hold, 0, 0)), LEAVE_HOLD_FRAMES);
});

test("only the player who paused can hold Esc to leave; another player's Esc is left to resume on press [k2 property]", () => {
  const hold = leaveHold();
  assertFalse(pressEscape(hold, 1, 0));
  assertFalse(pressEscape(hold, 1, undefined));
  assertEquals(ticksUntilLeave(hold, 2 * LEAVE_HOLD_FRAMES), undefined);
  assertTrue(pressEscape(hold, 0, 0));
  assertFalse(releaseEscape(hold, 1));
  assertEquals(ticksUntilLeave(hold, 2 * LEAVE_HOLD_FRAMES), LEAVE_HOLD_FRAMES);
});
