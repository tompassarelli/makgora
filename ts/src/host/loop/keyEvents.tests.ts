import { assertEquals, test } from "wisp/src/runtime/testing";
import { syncKeyEventTriggers } from "./keyEvents";

test("key registrations stay flat through simulated menu cycles [k2 property]", () => {
  const events = { down: undefined as number | undefined, up: undefined as number | undefined, enabled: false, escapeOnly: false };
  let nextTrigger = 0;
  let registrationBatches = 0;
  const enabled: boolean[] = [];
  const sync = (active: boolean, escapeOnly: boolean): void => syncKeyEventTriggers(
    events,
    active,
    escapeOnly,
    () => nextTrigger++,
    () => { registrationBatches++; },
    (_trigger, value) => { enabled.push(value); },
  );

  sync(true, false);
  for (let cycle = 0; cycle < 20; cycle++) {
    sync(true, true);
    sync(false, false);
    sync(true, false);
  }

  assertEquals(nextTrigger, 2);
  assertEquals(registrationBatches, 1);
  assertEquals(events.enabled, true);
  assertEquals(events.escapeOnly, false);
  assertEquals(enabled.length, 80);
});
