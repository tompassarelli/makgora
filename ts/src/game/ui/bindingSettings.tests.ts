import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AUTO_DELAY, MAX_FIXED_DELAY, isDelayChoice, nextDelayChoice } from "../netcode/delayPolicy";
import { type BindingPersistence, createBindingSettings, decodeDelay, encodeSettings } from "./bindingSettings";

const NO_STORE: BindingPersistence = { load: () => undefined, readLocal: () => undefined, save: () => undefined };

test("every delay the settings button reaches, from Auto through the ceiling and back to Auto, survives the saved-profile encoding [k2 property]", () => {
  const settings = createBindingSettings(0, NO_STORE);
  const reached: number[] = [];
  let choice = nextDelayChoice(AUTO_DELAY);
  while (choice !== AUTO_DELAY && reached.length <= MAX_FIXED_DELAY) {
    assertTrue(isDelayChoice(choice));
    reached.push(choice);
    settings.delay = choice;
    assertEquals(decodeDelay(encodeSettings(settings)).delay, choice);
    choice = nextDelayChoice(choice);
  }
  assertEquals(choice, AUTO_DELAY);
  assertEquals(reached[0], 0);
  assertEquals(reached.at(-1), MAX_FIXED_DELAY);
  settings.delay = AUTO_DELAY;
  assertEquals(decodeDelay(encodeSettings(settings)).delay, AUTO_DELAY);
});

test("a saved profile whose delay code is any other character loads a fixed delay no higher than the ceiling, or Auto [k2 property]", () => {
  const settings = createBindingSettings(0, NO_STORE);
  const prefix = encodeSettings(settings).slice(0, -1);
  for (let code = 33; code < 127; code++) {
    const delay = decodeDelay(`${prefix}${String.fromCharCode(code)}`).delay;
    assertTrue(delay === AUTO_DELAY || (delay >= 0 && delay <= MAX_FIXED_DELAY));
  }
});
