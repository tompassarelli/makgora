import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { LEAVE_HOLD_FRAMES, leaveHold, leaveHoldFill, pressLeaveHold, releaseLeaveHold, tickLeaveHold } from "./leaveHold";

const ticksUntilLeave = (hold: ReturnType<typeof leaveHold>, limit: number): number | undefined => {
  for (let frame = 1; frame <= limit; frame++) if (tickLeaveHold(hold)) return frame;
  return undefined;
};

test("holding Esc on the pause screen leaves on the 60th frame, a shorter hold never does and its release resumes [k2 property]", () => {
  assertEquals(LEAVE_HOLD_FRAMES, 60);
  const full = leaveHold();
  assertTrue(pressLeaveHold(full, 0, 0));
  assertEquals(ticksUntilLeave(full, 120), 60);
  assertEquals(leaveHoldFill(full), 0);

  const short = leaveHold();
  pressLeaveHold(short, 0, 0);
  assertEquals(ticksUntilLeave(short, 59), undefined);
  assertEquals(short.frames, 59);
  assertTrue(leaveHoldFill(short) > 0.5 && leaveHoldFill(short) < 1);
  assertTrue(releaseLeaveHold(short, 0));
  assertEquals(ticksUntilLeave(short, 120), undefined);
  assertEquals(leaveHoldFill(short), 0);

  const tap = leaveHold();
  pressLeaveHold(tap, 0, 0);
  assertTrue(releaseLeaveHold(tap, 0));
  assertEquals(ticksUntilLeave(tap, 120), undefined);
});

test("only the player who paused can hold Esc to leave; another player's Esc is left to resume on press [k2 property]", () => {
  const hold = leaveHold();
  assertFalse(pressLeaveHold(hold, 1, 0));
  assertFalse(pressLeaveHold(hold, 1, undefined));
  assertEquals(ticksUntilLeave(hold, 120), undefined);
  assertTrue(pressLeaveHold(hold, 0, 0));
  assertFalse(releaseLeaveHold(hold, 1));
  assertEquals(ticksUntilLeave(hold, 120), 60);
});
