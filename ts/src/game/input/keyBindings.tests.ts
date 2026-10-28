import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action, ACTION_ORDER } from "./actions";
import { PAD_LAYER } from "./padKeys";
import { BINDING_PRESETS, type BindingPreset, ACTION_KEY_LABELS, ACTION_LABELS, decodeBindings, decodeLayouts, encodeBindings, encodeLayouts, keyFor, keyLabel, presetBindings, presetLayouts, slotIndex } from "./keyBindings";

const code = (character: string) => character.charCodeAt(0);
const slots = (preset: BindingPreset, action: Action) => `${keyLabel(keyFor(presetBindings(preset), action, 0))} ${keyLabel(keyFor(presetBindings(preset), action, 1))}`;

test("every preset binds C-left to J, C-right to L, C-down to P and Walk to K, C-up to 9 (- on Custom), and Strong to Y (0 on Custom) [k2 property]", () => {
  for (const preset of BINDING_PRESETS) {
    assertEquals(slots(preset, Action.cLeft), "J —", `${preset} C-left`);
    assertEquals(slots(preset, Action.cRight), "L —", `${preset} C-right`);
    assertEquals(slots(preset, Action.cDown), "P —", `${preset} C-down`);
    assertEquals(slots(preset, Action.walk), "K —", `${preset} Walk`);
  }
  assertEquals(slots("wasd", Action.cUp), "9 —");
  assertEquals(slots("standard", Action.cUp), "9 —");
  assertEquals(slots("custom", Action.cUp), "- —");
  assertEquals(slots("wasd", Action.strong), "Y —");
  assertEquals(slots("standard", Action.strong), "Y —");
  assertEquals(slots("custom", Action.strong), "0 —");
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

const SEMICOLON = 186;
const OLD_SLOTS = (Action.strong + 1) * 2;
const oldSave = (version: string, keys: readonly number[]) => version + keys.slice(0, OLD_SLOTS).map((key) => String(key).padStart(3, "0")).join("");
const withoutModX = (preset: BindingPreset) => presetBindings(preset).keys.slice(0, OLD_SLOTS);

test("every preset binds Mod X to ; alone, which is no key the pad layer presses, and labels it Mod X on the controls screen [k2 property]", () => {
  const padKeys = PAD_LAYER.map(({ code: padCode }) => padCode);
  for (const preset of BINDING_PRESETS) {
    assertEquals(slots(preset, Action.modX), "; —", `${preset} Mod X`);
    assertEquals(padKeys.includes(keyFor(presetBindings(preset), Action.modX, 0) ?? 0), false, `${preset} Mod X is a pad key`);
  }
  assertEquals(ACTION_LABELS[Action.modX], "Mod X");
  assertEquals(ACTION_KEY_LABELS[Action.modX], "Mod X");
});

test("a saved profile from before Mod X loads with every old key unchanged and ; on Mod X, in each old format and in the three-layout save [k2 property]", () => {
  for (const preset of BINDING_PRESETS) {
    const old = withoutModX(preset);
    const loaded = decodeBindings(oldSave("KB", old));
    assertEquals(loaded?.keys.slice(0, OLD_SLOTS).join(","), old.join(","), `${preset} old keys`);
    assertEquals(loaded?.keys.slice(OLD_SLOTS).join(","), `${SEMICOLON},0`, `${preset} Mod X`);
  }
  for (const version of ["KA", "K9", "K8", "K7", "K6"]) {
    const loaded = decodeBindings(oldSave(version, withoutModX("wasd")));
    assertEquals(loaded?.keys.slice(OLD_SLOTS).join(","), `${SEMICOLON},0`, `${version} Mod X`);
  }
  const layouts = BINDING_PRESETS.map((preset) => oldSave("KB", withoutModX(preset))).join("");
  const loaded = decodeLayouts(`KL1${layouts}`);
  assertEquals(loaded?.active, "standard");
  for (const preset of BINDING_PRESETS) assertEquals(loaded?.layouts[preset].keys.join(","), presetBindings(preset).keys.join(","), `${preset} layout`);
  const current = { layouts: presetLayouts(), active: "custom" as BindingPreset };
  assertEquals(decodeLayouts(encodeLayouts(current))?.layouts.custom.keys.join(","), presetBindings("custom").keys.join(","));
});

test("an old save that already uses ; for another action keeps it there and leaves Mod X unbound [k2 property]", () => {
  const old = withoutModX("standard");
  old[slotIndex(Action.cDown, 1)] = SEMICOLON;
  const loaded = decodeBindings(oldSave("KB", old));
  assertEquals(loaded?.keys.slice(0, OLD_SLOTS).join(","), old.join(","));
  assertEquals(loaded?.keys.slice(OLD_SLOTS).join(","), "0,0");
});

