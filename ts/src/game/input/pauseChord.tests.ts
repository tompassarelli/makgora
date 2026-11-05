import { assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { DEFAULT_PRESET, presetBindings } from "./keyBindings";
import { chordComplete, chordKeys, noteChordKey } from "./pauseChord";

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
