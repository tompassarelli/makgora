import { assertEquals, test } from "wisp/src/runtime/testing";
import { beginKeyPoll, keyTracker, noteKeyDownEvent, noteKeyUpEvent, polledKeyDown } from "./osKeys";

const SEMICOLON = 0xba;

function trackedKey() {
  let held = false;
  const tracker = keyTracker((key) => held && key === SEMICOLON);
  const polls: boolean[] = [];
  const poll = (count = 1) => {
    for (let index = 0; index < count; index++) {
      beginKeyPoll(tracker);
      polls.push(polledKeyDown(tracker, SEMICOLON));
    }
  };
  return { tracker, polls, poll, hold: (down: boolean) => { held = down; } };
}

test("a held key's autorepeat key-down events, arriving 40 polls behind the poll as on a native client, start no press after the key is released [k1 scenario]", () => {
  const { tracker, polls, poll, hold } = trackedKey();
  poll(3);
  hold(true);
  poll(2);
  noteKeyDownEvent(tracker, SEMICOLON, true);
  poll(36);
  for (let repeat = 0; repeat < 4; repeat++) {
    noteKeyDownEvent(tracker, SEMICOLON, true);
    poll(2);
  }
  hold(false);
  poll(1);
  noteKeyDownEvent(tracker, SEMICOLON, true);
  poll(2);
  noteKeyUpEvent(tracker, SEMICOLON);
  poll(20);
  assertEquals(polls.slice(0, 3).join(","), "false,false,false");
  assertEquals(polls.slice(3, 49).every((down) => down), true, "held from the press poll to the release");
  assertEquals(polls.slice(49).some((down) => down), false, "no press after the release");
});

test("a tap the client took between two polls still reports one held poll when its key-down event arrives, after a held key's repeats [k1 scenario]", () => {
  const { tracker, polls, poll, hold } = trackedKey();
  hold(true);
  poll(1);
  noteKeyDownEvent(tracker, SEMICOLON, true);
  noteKeyDownEvent(tracker, SEMICOLON, true);
  hold(false);
  poll(1);
  noteKeyUpEvent(tracker, SEMICOLON);
  poll(2);
  noteKeyDownEvent(tracker, SEMICOLON, true);
  noteKeyUpEvent(tracker, SEMICOLON);
  poll(4);
  assertEquals(polls.join(","), "true,false,false,false,true,false,false,false");
});
