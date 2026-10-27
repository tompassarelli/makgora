import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action, ACTION_ORDER } from "./actions";
import { BINDING_PRESETS, type BindingPreset, ACTION_LABELS, decodeBindings, encodeBindings, keyFor, keyLabel, presetBindings, slotIndex } from "./keyBindings";

const code = (character: string) => character.charCodeAt(0);
const slots = (preset: BindingPreset, action: Action) => `${keyLabel(keyFor(presetBindings(preset), action, 0))} ${keyLabel(keyFor(presetBindings(preset), action, 1))}`;

test("every preset binds C-down to P, Strong to Y, Tilt to H and C-up to J plus 9 (0 on Custom, which keeps X as a second Strong) [k2 property]", () => {
  for (const preset of BINDING_PRESETS) {
    assertEquals(slots(preset, Action.cDown), "P —", `${preset} C-down`);
    assertEquals(slots(preset, Action.walk), "H —", `${preset} Tilt`);
    assertEquals(slots(preset, Action.cLeft).charAt(0), "B", `${preset} C-left`);
    assertEquals(slots(preset, Action.cRight), "M —", `${preset} C-right`);
  }
  assertEquals(slots("wasd", Action.cUp), "9 J");
  assertEquals(slots("standard", Action.cUp), "9 J");
  assertEquals(slots("custom", Action.cUp), "0 J");
  assertEquals(slots("wasd", Action.strong), "Y —");
  assertEquals(slots("standard", Action.strong), "Y —");
  assertEquals(slots("custom", Action.strong), "Y X");
});

test("no preset binds one key to two actions, and each survives a save and load unchanged [k2 property]", () => {
  for (const preset of BINDING_PRESETS) {
    const { keys } = presetBindings(preset);
    const bound = keys.filter((key) => key !== 0);
    assertEquals(new Set(bound).size, bound.length, `${preset} duplicate key`);
    assertEquals(decodeBindings(encodeBindings({ keys }))?.keys.join(","), keys.join(","), `${preset} round trip`);
  }
});

test("the four C-stick actions read C-up, C-down, C-left and C-right on the controls screen [k2 property]", () => {
  assertEquals([Action.cUp, Action.cDown, Action.cLeft, Action.cRight].map((action) => ACTION_LABELS[action]).join(), ["C-up", "C-down", "C-left", "C-right"].join());
});

test("a custom profile saved before the C-stick rename loads with the same keys [k2 property]", () => {
  const { keys } = presetBindings("custom");
  const before = keys.slice();
  const set = (action: Action, first: number, second = 0) => {
    before[slotIndex(action, 0)] = first;
    before[slotIndex(action, 1)] = second;
  };
  set(Action.cUp, code("J"));
  set(Action.cDown, code("H"));
  set(Action.walk, code("P"));
  set(Action.strong, code("0"), code("X"));
  const loaded = decodeBindings(encodeBindings({ keys: before }));
  assertEquals(loaded?.keys.join(","), before.join(","));
  assertEquals(ACTION_ORDER.length * 2, before.length);
});
