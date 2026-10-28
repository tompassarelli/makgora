import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action, ACTION_ORDER } from "./actions";
import { PAD_LAYER, padLayerAction } from "./padKeys";
import { BINDING_PRESETS, type BindingPreset, ACTION_KEY_LABELS, ACTION_LABELS, LEFT_SHIFT, RIGHT_SHIFT, SHIFT, actionFor, assignKey, decodeBindings, decodeLayouts, encodeBindings, encodeLayouts, keyFor, keyLabel, presetBindings, presetLayouts, previousDefaultKeys, slotIndex } from "./keyBindings";

const code = (character: string) => character.charCodeAt(0);
const slots = (preset: BindingPreset, action: Action) => `${keyLabel(keyFor(presetBindings(preset), action, 0))} ${keyLabel(keyFor(presetBindings(preset), action, 1))}`;

test("every preset binds C-left to J, C-right to L, C-down to P and Walk to K, C-up to 0 (- on Custom), and Strong to 9 with Y second (0 on Custom) [k2 property]", () => {
  for (const preset of BINDING_PRESETS) {
    assertEquals(slots(preset, Action.cLeft), "J —", `${preset} C-left`);
    assertEquals(slots(preset, Action.cRight), "L —", `${preset} C-right`);
    assertEquals(slots(preset, Action.cDown), "P —", `${preset} C-down`);
    assertEquals(slots(preset, Action.walk), "K —", `${preset} Walk`);
  }
  for (const preset of BINDING_PRESETS) assertEquals(slots(preset, Action.cUp), preset === "custom" ? "- —" : "0 —", `${preset} C-up`);
  assertEquals(slots("wasd", Action.strong), "9 Y");
  assertEquals(slots("standard", Action.strong), "9 Y");
  assertEquals(slots("custom", Action.strong), "0 —");
});

test("a saved WASD or Box layout still on the old defaults (Strong Y, C-up 9) upgrades on load, and one the player edited stays as saved [k2 property]", () => {
  const previous = (preset: "wasd" | "standard") => ({ keys: previousDefaultKeys(preset) });
  const stock = { layouts: { wasd: previous("wasd"), standard: previous("standard"), custom: presetBindings("custom") }, active: "wasd" as BindingPreset };
  const upgraded = decodeLayouts(encodeLayouts(stock));
  for (const preset of ["wasd", "standard"] as const) assertEquals(upgraded?.layouts[preset].keys.join(","), presetBindings(preset).keys.join(","), `${preset} upgraded`);
  const edited = previousDefaultKeys("wasd");
  edited[slotIndex(Action.attack, 0)] = code("B");
  const kept = decodeLayouts(encodeLayouts({ ...stock, layouts: { ...stock.layouts, wasd: { keys: edited } } }));
  assertEquals(kept?.layouts.wasd.keys.join(","), edited.join(","), "edited WASD stays");
  assertEquals(kept?.layouts.standard.keys.join(","), presetBindings("standard").keys.join(","), "stock Box still upgrades");
  const swapped = previousDefaultKeys("wasd");
  const wasdInBox = decodeLayouts(encodeLayouts({ ...stock, layouts: { ...stock.layouts, standard: { keys: swapped } } }));
  assertEquals(wasdInBox?.layouts.standard.keys.join(","), swapped.join(","), "WASD defaults in the Box slot are not Box defaults");
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
  set(Action.cLeft, code("B"));
  set(Action.cRight, code("M"));
  set(Action.cUp, code("J"));
  set(Action.cDown, code("H"));
  set(Action.walk, code("P"));
  set(Action.strong, code("0"));
  const loaded = decodeBindings(encodeBindings({ keys: before }));
  assertEquals(loaded?.keys.join(","), before.join(","));
  assertEquals(ACTION_ORDER.length * 2, before.length);
});

test("Custom binds 9 to jump, 8 to Shield R, 0 to Strong, - to C-up and A to light shield, and no layout binds Z, X or G anywhere [k2 property]", () => {
  assertEquals(slots("custom", Action.jump), "9 —");
  assertEquals(slots("custom", Action.rightTrigger), "8 —");
  assertEquals(slots("custom", Action.strong), "0 —");
  assertEquals(slots("custom", Action.cUp), "- —");
  assertEquals(slots("custom", Action.lightShield), "A —");
  for (const preset of BINDING_PRESETS) {
    for (const character of ["Z", "X", "G"]) assertEquals(presetBindings(preset).keys.includes(code(character)), false, `${preset} binds ${character}`);
  }
});

test("WASD binds Up to W and Space and Jump to 8 alone, and the other layouts keep Space as Up [k2 property]", () => {
  assertEquals(slots("wasd", Action.moveUp), "W SPACE");
  assertEquals(slots("wasd", Action.jump), "8 —");
  assertEquals(slots("standard", Action.moveUp), "SPACE —");
  assertEquals(slots("standard", Action.jump), "8 —");
});

test("a saved layout with the auto-added Z, X and G in second slots loads without them, in the current and an old format [k2 property]", () => {
  const keys = presetBindings("standard").keys.slice();
  keys[slotIndex(Action.jump, 1)] = code("Z");
  keys[slotIndex(Action.strong, 1)] = code("X");
  keys[slotIndex(Action.rightTrigger, 1)] = code("G");
  const loaded = decodeBindings(encodeBindings({ keys }));
  assertEquals(loaded?.keys[slotIndex(Action.jump, 1)], 0, "jump");
  assertEquals(loaded?.keys[slotIndex(Action.strong, 1)], 0, "strong");
  assertEquals(loaded?.keys[slotIndex(Action.rightTrigger, 1)], 0, "Shield R");
  const old = decodeBindings(oldSave("K9", keys.slice(0, OLD_SLOTS)));
  for (const action of [Action.jump, Action.strong, Action.rightTrigger]) assertEquals(old?.keys[slotIndex(action, 1)], 0, `old format ${ACTION_LABELS[action]}`);
});

test("a saved layout with Z bound first to jump, or X or G bound first, keeps it [k2 property]", () => {
  const keys = presetBindings("standard").keys.slice();
  keys[slotIndex(Action.jump, 0)] = code("Z");
  keys[slotIndex(Action.strong, 0)] = code("X");
  keys[slotIndex(Action.rightTrigger, 0)] = code("G");
  const loaded = decodeBindings(encodeBindings({ keys }));
  assertEquals(loaded?.keys.join(","), keys.join(","));
  const layouts = decodeLayouts(encodeLayouts({ layouts: { ...presetLayouts(), custom: { keys } }, active: "custom" }));
  assertEquals(layouts?.layouts.custom.keys.join(","), keys.join(","));
});

test("a saved Custom layout still on the old defaults (Z/9 jump, G second on Shield R) moves to the new Custom, and an edited one keeps its first-slot Z [k2 property]", () => {
  const oldCustom = presetBindings("custom").keys.slice();
  oldCustom[slotIndex(Action.jump, 0)] = code("Z");
  oldCustom[slotIndex(Action.jump, 1)] = code("9");
  oldCustom[slotIndex(Action.rightTrigger, 1)] = code("G");
  const stock = decodeLayouts(encodeLayouts({ layouts: { ...presetLayouts(), custom: { keys: oldCustom } }, active: "custom" }));
  assertEquals(stock?.layouts.custom.keys.join(","), presetBindings("custom").keys.join(","));
  oldCustom[slotIndex(Action.attack, 0)] = code("B");
  const edited = decodeLayouts(encodeLayouts({ layouts: { ...presetLayouts(), custom: { keys: oldCustom } }, active: "custom" }));
  assertEquals(keyFor(edited?.layouts.custom ?? { keys: [] }, Action.jump, 0), code("Z"));
  assertEquals(keyFor(edited?.layouts.custom ?? { keys: [] }, Action.rightTrigger, 1), undefined);
});

test("a saved WASD layout still on the earlier defaults (Space and 8 on Jump) moves to the new one, and an edited one stays [k2 property]", () => {
  const earlier = presetBindings("wasd").keys.slice();
  earlier[slotIndex(Action.moveUp, 0)] = code("W");
  earlier[slotIndex(Action.moveUp, 1)] = 0;
  earlier[slotIndex(Action.jump, 0)] = 32;
  earlier[slotIndex(Action.jump, 1)] = code("8");
  const moved = decodeLayouts(encodeLayouts({ layouts: { ...presetLayouts(), wasd: { keys: earlier } }, active: "wasd" }));
  assertEquals(moved?.layouts.wasd.keys.join(","), presetBindings("wasd").keys.join(","));
  earlier[slotIndex(Action.attack, 0)] = code("B");
  const kept = decodeLayouts(encodeLayouts({ layouts: { ...presetLayouts(), wasd: { keys: earlier } }, active: "wasd" }));
  assertEquals(kept?.layouts.wasd.keys.join(","), earlier.join(","));
});

test("the pad layer keeps its own keys, and a layout binds a pad key only to the action the pad gives it [k2 property]", () => {
  assertEquals(PAD_LAYER.map(({ key }) => key).join(""), "cvt123456`[]='," + ".-\\");
  for (const preset of BINDING_PRESETS) {
    for (const { code: padCode, action } of PAD_LAYER) {
      const bound = actionFor(presetBindings(preset), padCode);
      assertEquals(bound === undefined || bound === action, true, `${preset} binds pad key ${padCode} to another action`);
    }
  }
  for (const character of ["Z", "X", "G"]) assertEquals(padLayerAction(code(character)), undefined, `${character} is no pad key`);
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


test("Left and Right Shift are labelled, bind to any action such as Shield, and survive a save and load in each layout [k2 property]", () => {
  assertEquals([SHIFT, LEFT_SHIFT, RIGHT_SHIFT].map((key) => keyLabel(key)).join(), ["SHIFT", "L-SHIFT", "R-SHIFT"].join());
  const layouts = presetLayouts();
  for (const preset of BINDING_PRESETS) {
    const bindings = layouts[preset];
    assertEquals(assignKey(bindings, Action.leftTrigger, 0, LEFT_SHIFT).kind, "bound", `${preset} binds Left Shift`);
    assertEquals(assignKey(bindings, Action.rightTrigger, 1, RIGHT_SHIFT).kind, "bound", `${preset} binds Right Shift`);
    assertEquals(keyFor(bindings, Action.leftTrigger, 0), LEFT_SHIFT);
    const loaded = decodeBindings(encodeBindings(bindings));
    assertEquals(loaded?.keys.join(","), bindings.keys.join(","), `${preset} single save`);
  }
  const saved = decodeLayouts(encodeLayouts({ layouts, active: "standard" }));
  for (const preset of BINDING_PRESETS) assertEquals(saved?.layouts[preset].keys.join(","), layouts[preset].keys.join(","), `${preset} layout save`);
});
