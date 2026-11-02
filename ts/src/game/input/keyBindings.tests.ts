import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action, ACTION_ORDER, ALL_ACTIONS } from "./actions";
import { heldActions, playerKeys, pressKey } from "./playerKeys";
import { PAD_LAYER, padLayerAction } from "./padKeys";
import { BINDING_PRESETS, type BindingPreset, ACTION_KEY_LABELS, ACTION_LABELS, LEFT_SHIFT, RIGHT_SHIFT, SHIFT, actionFor, assignKey, decodeBindings, encodeBindings, keyFor, keyLabel, presetBindings, previousDefaultKeys, slotIndex, TOGGLE_CONTROLS_KEY } from "./keyBindings";
import { type LayoutBindings, layoutSave, decodeLayouts, encodeLayouts, presetLayouts } from "./layoutSave";

const code = (character: string) => character.charCodeAt(0);
const encodeSlots = (save: { layouts: LayoutBindings; active: BindingPreset }) => encodeLayouts(layoutSave(save.layouts, save.active));
const slots = (preset: BindingPreset, action: Action) => `${keyLabel(keyFor(presetBindings(preset), action, 0))} ${keyLabel(keyFor(presetBindings(preset), action, 1))}`;

test("every preset binds U special, I short hop, O grab, Y C-up, J C-left, K C-down, L C-right and P Walk, and Strong to 9 alone (0 on Custom) [k2 property]", () => {
  for (const preset of BINDING_PRESETS) {
    assertEquals(slots(preset, Action.cLeft), "J —", `${preset} C-left`);
    assertEquals(slots(preset, Action.cRight), "L —", `${preset} C-right`);
    assertEquals(slots(preset, Action.cUp), "Y —", `${preset} C-up`);
    assertEquals(slots(preset, Action.cDown), "K —", `${preset} C-down`);
    assertEquals(slots(preset, Action.special), "U —", `${preset} special`);
    assertEquals(slots(preset, Action.shortHop), "I —", `${preset} short hop`);
    assertEquals(slots(preset, Action.grab), "O —", `${preset} grab`);
    assertEquals(slots(preset, Action.modX), "P —", `${preset} Mod X`);
  }
  assertEquals(slots("wasd", Action.strong), "9 —");
  assertEquals(slots("standard", Action.strong), "9 —");
  assertEquals(slots("custom", Action.strong), "0 —");
});

test("a saved WASD or Box layout still on the old defaults (Y as a second Strong key) upgrades on load, and one the player edited stays as saved [k2 property]", () => {
  const previous = (preset: "wasd" | "standard") => ({ keys: previousDefaultKeys(preset) });
  const stock = { layouts: { wasd: previous("wasd"), standard: previous("standard"), custom: presetBindings("custom") }, active: "wasd" as BindingPreset };
  const upgraded = decodeLayouts(encodeSlots(stock));
  for (const preset of ["wasd", "standard"] as const) assertEquals(upgraded?.layouts[preset].keys.join(","), presetBindings(preset).keys.join(","), `${preset} upgraded`);
  const edited = previousDefaultKeys("wasd");
  edited[slotIndex(Action.attack, 0)] = code("B");
  const kept = decodeLayouts(encodeSlots({ ...stock, layouts: { ...stock.layouts, wasd: { keys: edited } } }));
  assertEquals(kept?.layouts.wasd.keys.join(","), edited.join(","), "edited WASD stays");
  assertEquals(kept?.layouts.standard.keys.join(","), presetBindings("standard").keys.join(","), "stock Box still upgrades");
  const swapped = previousDefaultKeys("wasd");
  const wasdInBox = decodeLayouts(encodeSlots({ ...stock, layouts: { ...stock.layouts, standard: { keys: swapped } } }));
  assertEquals(wasdInBox?.layouts.standard.keys.join(","), swapped.join(","), "WASD defaults in the Box slot are not Box defaults");
});

test("a saved layout still on the C-up 0 (- on Custom), C-down P and Walk K defaults moves to H, K and P on load, and an edited one stays [k2 property]", () => {
  const before = (preset: BindingPreset) => {
    const keys = presetBindings(preset).keys.slice();
    keys[slotIndex(Action.cUp, 0)] = preset === "custom" ? 0xbd : code("0");
    keys[slotIndex(Action.cDown, 0)] = code("P");
    keys[slotIndex(Action.modX, 0)] = code("K");
    return keys;
  };
  const stock = { layouts: { wasd: { keys: before("wasd") }, standard: { keys: before("standard") }, custom: { keys: before("custom") } }, active: "custom" as BindingPreset };
  const upgraded = decodeLayouts(encodeSlots(stock));
  for (const preset of BINDING_PRESETS) assertEquals(upgraded?.layouts[preset].keys.join(","), presetBindings(preset).keys.join(","), `${preset} upgraded`);
  const edited = before("custom");
  edited[slotIndex(Action.attack, 0)] = code("B");
  const kept = decodeLayouts(encodeSlots({ ...stock, layouts: { ...stock.layouts, custom: { keys: edited } } }));
  assertEquals(kept?.layouts.custom.keys.join(","), edited.join(","), "edited Custom stays");
});

test("a saved layout still on the stock keys with C-up on H moves C-up to Y on load, and one with its own C-up key stays as saved [k2 property]", () => {
  const stockWithH = (preset: BindingPreset) => {
    const keys = presetBindings(preset).keys.slice();
    keys[slotIndex(Action.cUp, 0)] = code("H");
    return { keys };
  };
  const stock = { layouts: { wasd: stockWithH("wasd"), standard: stockWithH("standard"), custom: stockWithH("custom") }, active: "wasd" as BindingPreset };
  const upgraded = decodeLayouts(encodeSlots(stock));
  for (const preset of BINDING_PRESETS) assertEquals(slots(preset, Action.cUp), "Y —", `${preset} stock C-up`);
  for (const preset of BINDING_PRESETS) assertEquals(upgraded?.layouts[preset].keys.join(","), presetBindings(preset).keys.join(","), `${preset} upgraded`);
  const own = stockWithH("custom");
  own.keys[slotIndex(Action.cUp, 0)] = code("G");
  const kept = decodeLayouts(encodeSlots({ ...stock, layouts: { ...stock.layouts, custom: own } }));
  assertEquals(kept?.layouts.custom.keys.join(","), own.keys.join(","), "a rebound Custom C-up stays");
  assertEquals(kept?.layouts.wasd.keys.join(","), presetBindings("wasd").keys.join(","), "stock WASD still upgrades");
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
  set(Action.modX, code("P"));
  set(Action.strong, code("0"));
  const loaded = decodeBindings(encodeBindings({ keys: before }));
  assertEquals(loaded?.keys.join(","), before.join(","));
  assertEquals(ACTION_ORDER.length * 2, before.length);
});

test("Custom binds 9 to jump, 8 to Shield R, 0 to Strong and A to light shield, and no layout binds Z, X or G anywhere [k2 property]", () => {
  assertEquals(slots("custom", Action.jump), "9 —");
  assertEquals(slots("custom", Action.rightTrigger), "8 —");
  assertEquals(slots("custom", Action.strong), "0 —");
  assertEquals(slots("custom", Action.lightShield), "A —");
  for (const preset of BINDING_PRESETS) {
    for (const character of ["Z", "X", "G"]) assertEquals(presetBindings(preset).keys.includes(code(character)), false, `${preset} binds ${character}`);
  }
});

test("WASD binds Up to W alone and Jump to 8 alone, and the other layouts keep Space as Up [k2 property]", () => {
  assertEquals(slots("wasd", Action.moveUp), "W —");
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
  const layouts = decodeLayouts(encodeSlots({ layouts: { ...presetLayouts(), custom: { keys } }, active: "custom" }));
  assertEquals(layouts?.layouts.custom.keys.join(","), keys.join(","));
});

test("a saved Custom layout still on the old defaults (Z/9 jump, G second on Shield R) moves to the new Custom, and an edited one keeps its first-slot Z [k2 property]", () => {
  const oldCustom = presetBindings("custom").keys.slice();
  oldCustom[slotIndex(Action.cUp, 0)] = code("H");
  oldCustom[slotIndex(Action.jump, 0)] = code("Z");
  oldCustom[slotIndex(Action.jump, 1)] = code("9");
  oldCustom[slotIndex(Action.rightTrigger, 1)] = code("G");
  const stock = decodeLayouts(encodeSlots({ layouts: { ...presetLayouts(), custom: { keys: oldCustom } }, active: "custom" }));
  assertEquals(stock?.layouts.custom.keys.join(","), presetBindings("custom").keys.join(","));
  oldCustom[slotIndex(Action.attack, 0)] = code("B");
  const edited = decodeLayouts(encodeSlots({ layouts: { ...presetLayouts(), custom: { keys: oldCustom } }, active: "custom" }));
  assertEquals(keyFor(edited?.layouts.custom ?? { keys: [] }, Action.jump, 0), code("Z"));
  assertEquals(keyFor(edited?.layouts.custom ?? { keys: [] }, Action.rightTrigger, 1), undefined);
});

test("a saved WASD layout still on the earlier defaults (Space and 8 on Jump) moves to the new one, and an edited one stays [k2 property]", () => {
  const earlier = presetBindings("wasd").keys.slice();
  earlier[slotIndex(Action.cUp, 0)] = code("H");
  earlier[slotIndex(Action.strong, 1)] = code("Y");
  earlier[slotIndex(Action.moveUp, 0)] = code("W");
  earlier[slotIndex(Action.moveUp, 1)] = 0;
  earlier[slotIndex(Action.jump, 0)] = 32;
  earlier[slotIndex(Action.jump, 1)] = code("8");
  const moved = decodeLayouts(encodeSlots({ layouts: { ...presetLayouts(), wasd: { keys: earlier } }, active: "wasd" }));
  assertEquals(moved?.layouts.wasd.keys.join(","), presetBindings("wasd").keys.join(","));
  earlier[slotIndex(Action.attack, 0)] = code("B");
  const kept = decodeLayouts(encodeSlots({ layouts: { ...presetLayouts(), wasd: { keys: earlier } }, active: "wasd" }));
  assertEquals(kept?.layouts.wasd.keys.join(","), earlier.join(","));
});

test("the pad layer keeps its own keys, and a layout binds a pad key only to the action the pad gives it [k2 property]", () => {
  assertEquals(PAD_LAYER.map(({ key }) => key).join(""), "cvt123456/`[]='," + ".-\\");
  for (const preset of BINDING_PRESETS) {
    for (const { code: padCode, action } of PAD_LAYER) {
      const bound = actionFor(presetBindings(preset), padCode);
      assertEquals(bound === undefined || bound === action, true, `${preset} binds pad key ${padCode} to another action`);
    }
  }
  for (const character of ["Z", "X", "G"]) assertEquals(padLayerAction(code(character)), undefined, `${character} is no pad key`);
});

const SEMICOLON = 186;
const SPACE = 32;
const OLD_WALK_SLOT = 28;
const OLD_MOD_X_SLOT = 36;
const OLD_SLOTS = (Action.strong + 1) * 2;
const oldSave = (version: string, keys: readonly number[]) => version + keys.slice(0, OLD_SLOTS).map((key) => String(key).padStart(3, "0")).join("");
const withoutModY = (preset: BindingPreset) => presetBindings(preset).keys.slice(0, OLD_SLOTS);

test("every preset binds Mod Y to ; alone, which is no key the pad layer presses, and labels both modifiers on the controls screen [k2 property]", () => {
  const padKeys = PAD_LAYER.map(({ code: padCode }) => padCode);
  for (const preset of BINDING_PRESETS) {
    assertEquals(slots(preset, Action.modY), "; —", `${preset} Mod Y`);
    assertEquals(padKeys.includes(keyFor(presetBindings(preset), Action.modY, 0) ?? 0), false, `${preset} Mod Y is a pad key`);
  }
  assertEquals(ACTION_LABELS[Action.modX], "Walk (and steep angles)");
  assertEquals(ACTION_KEY_LABELS[Action.modX], "Walk");
  assertEquals(ACTION_LABELS[Action.modY], "Mod Y (shallow angles, wall ride)");
  assertEquals(ACTION_KEY_LABELS[Action.modY], "Mod Y");
});

test("a saved profile from before Mod X loads with every old key unchanged and ; on Mod Y, in each old format and in the three-layout save [k2 property]", () => {
  for (const preset of BINDING_PRESETS) {
    const old = withoutModY(preset);
    const loaded = decodeBindings(oldSave("KB", old));
    assertEquals(loaded?.keys.slice(0, OLD_SLOTS).join(","), old.join(","), `${preset} old keys`);
    assertEquals(loaded?.keys.slice(OLD_SLOTS).join(","), `${SEMICOLON},0,${TOGGLE_CONTROLS_KEY},0`, `${preset} Mod Y`);
  }
  for (const version of ["KA", "K9", "K8", "K7", "K6"]) {
    const loaded = decodeBindings(oldSave(version, withoutModY("wasd")));
    assertEquals(loaded?.keys.slice(OLD_SLOTS).join(","), `${SEMICOLON},0,${TOGGLE_CONTROLS_KEY},0`, `${version} Mod Y`);
  }
  const layouts = BINDING_PRESETS.map((preset) => oldSave("KB", withoutModY(preset))).join("");
  const loaded = decodeLayouts(`KL1${layouts}`);
  assertEquals(loaded?.active, "standard");
  for (const preset of BINDING_PRESETS) assertEquals(loaded?.layouts[preset].keys.join(","), presetBindings(preset).keys.join(","), `${preset} layout`);
  const current = { layouts: presetLayouts(), active: "custom" as BindingPreset };
  assertEquals(decodeLayouts(encodeSlots(current))?.layouts.custom.keys.join(","), presetBindings("custom").keys.join(","));
});

test("an old save that already uses ; for another action keeps it there and leaves Mod Y unbound [k2 property]", () => {
  const old = withoutModY("standard");
  old[slotIndex(Action.cDown, 1)] = SEMICOLON;
  const loaded = decodeBindings(oldSave("KB", old));
  assertEquals(loaded?.keys.slice(0, OLD_SLOTS).join(","), old.join(","));
  assertEquals(loaded?.keys.slice(OLD_SLOTS).join(","), `0,0,${TOGGLE_CONTROLS_KEY},0`);
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
  const saved = decodeLayouts(encodeSlots({ layouts, active: "standard" }));
  for (const preset of BINDING_PRESETS) assertEquals(saved?.layouts[preset].keys.join(","), layouts[preset].keys.join(","), `${preset} layout save`);
});

test("a saved layout from before Mod Y, with the old Walk on SPACE, the old Mod X on K and C-right on ;, loads with SPACE on Mod X, K on Mod Y and ; still on C-right, alone and inside a layout save [k2 property]", () => {
  const saved = presetBindings("wasd").keys.slice();
  saved[OLD_WALK_SLOT] = SPACE;
  saved[OLD_MOD_X_SLOT] = code("K");
  saved[slotIndex(Action.cDown, 0)] = code("P");
  saved[slotIndex(Action.cRight, 0)] = SEMICOLON;
  const check = (bindings: { keys: number[] } | undefined, label: string) => {
    assertEquals(keyFor(bindings!, Action.modX, 0), SPACE, `${label} Mod X`);
    assertEquals(keyFor(bindings!, Action.modY, 0), code("K"), `${label} Mod Y`);
    assertEquals(keyFor(bindings!, Action.cRight, 0), SEMICOLON, `${label} C-right`);
    assertEquals(bindings!.keys.join(","), saved.join(","), `${label} every other key`);
  };
  check(decodeBindings(encodeBindings({ keys: saved })), "single save");
  const layouts = presetLayouts();
  layouts.wasd = { keys: saved };
  check(decodeLayouts(encodeSlots({ layouts, active: "wasd" }))?.layouts.wasd, "layout save");
});

function asEarlierSave(saved: string): string {
  let earlier = saved.slice(0, 5);
  let at = 5;
  for (let marker = saved.indexOf("KE", at); marker >= 0; marker = saved.indexOf("KE", at)) {
    earlier += saved.slice(at, marker) + "KC" + saved.slice(marker + 2, marker + 116);
    at = marker + 122;
  }
  return earlier + saved.slice(at);
}

const editedWithCUpOnH = (preset: BindingPreset, edit: (keys: number[]) => void) => {
  const keys = presetBindings(preset).keys.slice();
  keys[slotIndex(Action.cUp, 0)] = code("H");
  edit(keys);
  return { keys };
};

test("any saved layout from before the C-up on Y upgrade moves a C-up on H to Y, unless Y is bound to another action [k2 property]", () => {
  const edited = (preset: BindingPreset) => editedWithCUpOnH(preset, (keys) => {
    keys[slotIndex(Action.attack, 0)] = code("B");
    keys[slotIndex(Action.grab, 0)] = code("G");
  });
  const yTaken = editedWithCUpOnH("custom", (keys) => {
    keys[slotIndex(Action.grab, 0)] = code("Y");
  });
  const layouts = { wasd: edited("wasd"), standard: edited("standard"), custom: yTaken };
  const loaded = decodeLayouts(asEarlierSave(encodeSlots({ layouts, active: "wasd" })));
  assertEquals(keyFor(loaded?.layouts.wasd ?? { keys: [] }, Action.cUp, 0), code("Y"), "edited WASD C-up");
  assertEquals(keyFor(loaded?.layouts.standard ?? { keys: [] }, Action.cUp, 0), code("Y"), "edited Box C-up");
  assertEquals(loaded?.layouts.wasd.keys[slotIndex(Action.attack, 0)], code("B"), "other edits stay");
  assertEquals(loaded?.layouts.custom.keys.join(","), yTaken.keys.join(","), "Y bound elsewhere keeps H");
});

test("a layout saved after the C-up on Y upgrade keeps a deliberate C-up on H [k2 property]", () => {
  const deliberate = editedWithCUpOnH("wasd", (keys) => {
    keys[slotIndex(Action.attack, 0)] = code("B");
  });
  const layouts = { wasd: deliberate, standard: presetBindings("standard"), custom: presetBindings("custom") };
  const loaded = decodeLayouts(encodeSlots({ layouts, active: "wasd" }));
  assertEquals(loaded?.layouts.wasd.keys.join(","), deliberate.keys.join(","), "H stays");
});

test("every preset binds F2 to Toggle controls, a save from before the action gets F2 only where F2 is free, and the toggle never enters a held mask or the sim's action range [k2 property]", () => {
  for (const preset of BINDING_PRESETS) {
    assertEquals(slots(preset, Action.toggleControls), "F2 —", `${preset} Toggle controls`);
    assertEquals(ACTION_LABELS[Action.toggleControls], "Toggle controls panel");
  }
  const taken = presetBindings("wasd");
  taken.keys[slotIndex(Action.cLeft, 0)] = TOGGLE_CONTROLS_KEY;
  taken.keys[slotIndex(Action.toggleControls, 0)] = 0;
  const layouts = { wasd: taken, standard: presetBindings("standard"), custom: presetBindings("custom") };
  layouts.standard.keys[slotIndex(Action.toggleControls, 0)] = 0;
  const loaded = decodeLayouts(asEarlierSave(encodeSlots({ layouts, active: "wasd" })));
  assertEquals(keyFor(loaded?.layouts.wasd ?? { keys: [] }, Action.toggleControls, 0), undefined, "F2 bound to C-left stays with C-left, Toggle controls stays unbound");
  assertEquals(keyFor(loaded?.layouts.wasd ?? { keys: [] }, Action.cLeft, 0), TOGGLE_CONTROLS_KEY);
  assertEquals(keyFor(loaded?.layouts.standard ?? { keys: [] }, Action.toggleControls, 0), TOGGLE_CONTROLS_KEY, "a free F2 is bound on load");
  assertEquals(keyFor(loaded?.layouts.custom ?? { keys: [] }, Action.toggleControls, 0), TOGGLE_CONTROLS_KEY, "the current default survives a load");
  const keys = playerKeys();
  assertEquals(pressKey(keys, TOGGLE_CONTROLS_KEY, presetBindings("wasd")), undefined, "the toggle key makes no input action");
  assertEquals(heldActions(keys), 0, "and no held bit");
  assertEquals(ALL_ACTIONS, (1 << Action.toggleControls) - 1, "the sim's mask range stops before the toggle");
});
