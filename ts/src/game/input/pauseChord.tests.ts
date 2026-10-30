import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "./actions";
import { DEFAULT_PRESET, presetBindings } from "./keyBindings";
import { chordComplete, chordKeys, chordLabels, noteChordKey, pausedInputKeys } from "./pauseChord";

const bindings = presetBindings(DEFAULT_PRESET);
const code = (character: string) => character.charCodeAt(0);
const holding = (...keys: number[]) => {
  const held = chordKeys();
  for (const key of keys) noteChordKey(held, bindings, key, true);
  return held;
};

test("the reset chord needs Attack and two distinct shield keys held, from the player's own bindings or the pad's keys [k2 property]", () => {
  const [shield, light, second, attack] = [code("Q"), code("E"), code("7"), code("N")];
  assertTrue(chordComplete(holding(shield, light, attack), bindings));
  assertTrue(chordComplete(holding(shield, second, attack), bindings));
  assertTrue(chordComplete(holding(0x33, 0x35, 0x43), bindings));
  assertFalse(chordComplete(holding(shield, attack), bindings));
  assertFalse(chordComplete(holding(shield, light), bindings));
  assertFalse(chordComplete(holding(shield, shield, attack), bindings));
  const released = holding(shield, light, attack);
  noteChordKey(released, bindings, light, false);
  assertFalse(chordComplete(released, bindings));
});

test("keys the chord does not use are never tracked, so a camera or jump key cannot complete it [k2 property]", () => {
  const held = holding(code("W"), code("8"), code("N"), code("Q"));
  assertFalse(chordComplete(held, bindings));
  assertFalse(held[code("W")] === true);
});

test("the reset plate names the bound shield, light shield and attack keys, and the pause screen reads every movement, zoom and chord key [k2 property]", () => {
  const labels = chordLabels(bindings);
  assertEquals(`${labels.left} ${labels.right} ${labels.attack}`, "Q E N");
  const keys = pausedInputKeys(bindings);
  for (const action of [Action.moveLeft, Action.cUp, Action.leftTrigger, Action.attack]) assertTrue(keys.includes(bindings.keys[action * 2] ?? -1));
  assertTrue(keys.includes(0x26));
});
