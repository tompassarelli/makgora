import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../input/actions";
import { ACTION_LABELS, BINDING_PRESETS, type BindingPreset, CLEAR_KEY, PRESET_NAMES, encodeBindings, keyFor, keyLabel, presetBindings, previousDefaultKeys, reservedReason, slotIndex, unboundActions } from "../input/keyBindings";
import { CUSTOM_SLOT_COUNT, type LayoutBindings, SLOT_NAME_LIMIT, decodeLayouts, encodeLayouts, layoutSave, presetLayouts } from "../input/layoutSave";
import {
  type BindingLoadResult,
  type BindingSettings,
  applyBindingPreset,
  beginBindingCapture,
  cancelBindingCapture,
  captureBinding,
  clearKey,
  createBindingSettings,
  customizeLayout,
  deleteProfile,
  initializeBindingSettings,
  loadProfile,
  loadSavedBindings,
  beginNaming,
  endNaming,
  nameSlot,
  pickCustomSlot,
  slotLabel,
  pickBindingPreset,
  resetToLayout,
  saveBindingSettings,
  toggleKeyboardPreview,
} from "./bindingSettings";
import { PLAYER_FILE_CAPACITY } from "../core/gameFiles";
import { keyboardCaps } from "./keyboardLayout";

const BACKSPACE = 0x08;
const ESCAPE = 0x1b;
const F6 = 0x75;
const F7 = 0x76;
const EQUALS = 0xbb;
const MINUS = 0xbd;
const OPEN_BRACKET = 0xdb;
const CLOSE_BRACKET = 0xdd;
const code = (character: string) => character.charCodeAt(0);
const encodeSlots = (save: { layouts: LayoutBindings; active: BindingPreset }) => encodeLayouts(layoutSave(save.layouts, save.active));

function customSettings(): BindingSettings {
  const empty: BindingLoadResult = { kind: "empty" };
  const settings = createBindingSettings(0, { load: (_owner, complete) => complete(empty), readLocal: () => empty, save: () => undefined });
  initializeBindingSettings(settings);
  applyBindingPreset(settings, "custom");
  return settings;
}

const slots = (settings: Readonly<BindingSettings>, action: Action) => `${keyLabel(keyFor(settings.bindings, action, 0))} ${keyLabel(keyFor(settings.bindings, action, 1))}`;
const unbound = (settings: Readonly<BindingSettings>) => unboundActions(settings.bindings).join(",");

test("a rebind swaps with the action holding the key, Delete and the x clear a slot, reserved keys stay refused and Reset to layout restores the preset [k2 property]", () => {
  const settings = customSettings();
  assertEquals(slots(settings, Action.modX), "P —", "Custom Mod X");
  assertEquals(slots(settings, Action.strong), "0 —", "Custom Strong");

  beginBindingCapture(settings, Action.modX, 0);
  assertEquals(captureBinding(settings, code("0")), true);
  assertEquals(slots(settings, Action.modX), "0 —", "Mod X after the swap");
  assertEquals(slots(settings, Action.strong), "P —", "Strong after the swap");
  assertEquals(settings.message, `Swapped with ${ACTION_LABELS[Action.strong]}.`);
  assertEquals(settings.capture, undefined);

  beginBindingCapture(settings, Action.modX, 0);
  captureBinding(settings, CLEAR_KEY);
  assertEquals(slots(settings, Action.modX), "— —", "Mod X after Delete");
  assertEquals(unbound(settings), `${Action.modX}`);
  assertEquals(settings.message, `${ACTION_LABELS[Action.modX]} is now unbound.`);
  assertEquals(settings.capture, undefined);

  clearKey(settings, code("P"));
  assertEquals(slots(settings, Action.strong), "— —", "Strong after its x");
  assertEquals(settings.message, `${ACTION_LABELS[Action.strong]} is now unbound.`);
  assertEquals(unbound(settings), `${Action.modX},${Action.strong}`);
  const before = encodeBindings(settings.bindings);
  clearKey(settings, code("C"));
  assertEquals(encodeBindings(settings.bindings), before, "clearing an unbound key");

  beginBindingCapture(settings, Action.attack, 0);
  for (const key of [BACKSPACE, ESCAPE, F6, F7]) {
    assertEquals(captureBinding(settings, key), true);
    assertEquals(settings.message, `${reservedReason(key)}. Press another key.`);
    assertEquals(encodeBindings(settings.bindings), before, `reserved ${keyLabel(key)}`);
    assertEquals(settings.capture?.action, Action.attack);
  }
  cancelBindingCapture(settings);
  assertEquals(settings.capture, undefined);
  assertEquals(settings.message, "Rebind cancelled.");
  assertEquals(reservedReason(EQUALS), undefined);
  assertEquals(reservedReason(MINUS), undefined);
  assertEquals(reservedReason(code("K")), undefined);
  beginBindingCapture(settings, Action.attack, 0);
  assertEquals(captureBinding(settings, code("K")), true);
  assertEquals(slots(settings, Action.attack), "K —", "Attack after binding K");

  resetToLayout(settings);
  assertEquals(encodeBindings(settings.bindings), encodeBindings(presetBindings("custom")), "Reset to layout");
  assertEquals(settings.message, `${PRESET_NAMES.custom} defaults restored. Save to keep them.`);
});

test("the = and - keys capture as bindings, are named, and have a cap on the controls screen's keyboard [k2 property]", () => {
  const settings = customSettings();
  beginBindingCapture(settings, Action.attack, 0);
  assertEquals(captureBinding(settings, EQUALS), true);
  beginBindingCapture(settings, Action.modX, 0);
  assertEquals(captureBinding(settings, MINUS), true);
  assertEquals(slots(settings, Action.attack), "= —", "Attack after binding =");
  assertEquals(slots(settings, Action.modX), "- —", "Mod X after binding -");
  assertEquals(keyLabel(EQUALS), "=");
  assertEquals(keyLabel(MINUS), "-");
  const caps = keyboardCaps(f32(0.12), f32(0.465));
  for (const key of [EQUALS, MINUS]) assertEquals(caps.filter(cap => cap.key === key).length, 1, `cap for ${keyLabel(key)}`);
  const rightEdge = Math.max(...caps.map(cap => cap.x + cap.width));
  assertEquals(rightEdge < f32(0.09) + f32(0.66), true, "keyboard stays inside the controls panel");
});

test("Y captures as a binding for any action, swapping with the action that holds it, and is no longer reserved [k2 property]", () => {
  const settings = customSettings();
  assertEquals(reservedReason(code("Y")), undefined);
  beginBindingCapture(settings, Action.attack, 0);
  assertEquals(captureBinding(settings, code("Y")), true);
  assertEquals(slots(settings, Action.attack), "Y —", "Attack after binding Y");
  assertEquals(slots(settings, Action.strong), "0 —", "Strong before the swap");
  beginBindingCapture(settings, Action.strong, 0);
  assertEquals(captureBinding(settings, code("Y")), true);
  assertEquals(slots(settings, Action.strong), "Y —", "Strong after binding Y");
  assertEquals(slots(settings, Action.attack), "0 —", "Attack after the swap");
  assertEquals(settings.message, `Swapped with ${ACTION_LABELS[Action.attack]}.`);
  assertEquals(settings.capture, undefined);
});

test("the [ and ] keys capture as bindings, are named, and have a cap on the controls screen's keyboard [k2 property]", () => {
  const settings = customSettings();
  beginBindingCapture(settings, Action.attack, 0);
  assertEquals(captureBinding(settings, OPEN_BRACKET), true);
  beginBindingCapture(settings, Action.modX, 0);
  assertEquals(captureBinding(settings, CLOSE_BRACKET), true);
  assertEquals(slots(settings, Action.attack), "[ —", "Attack after binding [");
  assertEquals(slots(settings, Action.modX), "] —", "Mod X after binding ]");
  const caps = keyboardCaps(f32(0.12), f32(0.465));
  for (const key of [OPEN_BRACKET, CLOSE_BRACKET]) assertEquals(caps.filter(cap => cap.key === key).length, 1, `cap for ${keyLabel(key)}`);
  const rightEdge = Math.max(...caps.map(cap => cap.x + cap.width));
  assertEquals(rightEdge < f32(0.09) + f32(0.66), true, "keyboard stays inside the controls panel");
});

test("every cap on the controls screen's keyboard captures as a binding and shows its own name [k2 property]", () => {
  for (const { key } of keyboardCaps(f32(0.12), f32(0.465))) {
    const settings = customSettings();
    beginBindingCapture(settings, Action.attack, 1);
    assertEquals(captureBinding(settings, key), true);
    assertEquals(keyFor(settings.bindings, Action.attack, 1), key, `cap ${key} binds`);
    assertEquals(keyLabel(key).startsWith("KEY "), false, `cap ${key} is named`);
  }
});

function persistedSettings(stored: { encoded: string | undefined }): BindingSettings {
  const result = (): BindingLoadResult => stored.encoded === undefined ? { kind: "empty" } : { kind: "loaded", encoded: stored.encoded };
  const settings = createBindingSettings(0, { load: (_owner, complete) => complete(result()), readLocal: () => result(), save: (_owner, encoded) => { stored.encoded = encoded; } });
  initializeBindingSettings(settings);
  return settings;
}

function bindAttack(settings: BindingSettings, key: number): void {
  beginBindingCapture(settings, Action.attack, 0);
  captureBinding(settings, key);
}

test("each layout keeps its own edits when switching, and only Reset to layout restores the defaults [k2 property]", () => {
  const settings = customSettings();
  bindAttack(settings, code("L"));
  applyBindingPreset(settings, "wasd");
  assertEquals(slots(settings, Action.attack), "N —", "WASD keeps its stock Attack");
  applyBindingPreset(settings, "custom");
  assertEquals(slots(settings, Action.attack), "L —", "Custom keeps the edit after switching back");
  resetToLayout(settings);
  assertEquals(slots(settings, Action.attack), "N —", "Reset to layout");
});

const stockKeys = (preset: BindingPreset) => presetBindings(preset).keys.join(",");

test("editing a key on WASD or Box copies that layout into Custom with the edit applied, selects Custom and saves it, and WASD and Box stay stock [k2 property]", () => {
  for (const preset of ["wasd", "standard"] as const) {
    const stored = { encoded: undefined as string | undefined };
    const settings = persistedSettings(stored);
    applyBindingPreset(settings, preset);
    bindAttack(settings, code("B"));
    assertEquals(settings.layout, "custom", `${preset} edit selects Custom`);
    assertEquals(slots(settings, Action.attack), "B —", `${preset} edit applied`);
    assertEquals(keyFor(settings.bindings, Action.jump, 0), keyFor(presetBindings(preset), Action.jump, 0), `${preset} rest copied`);
    assertEquals(settings.layouts[preset].keys.join(","), stockKeys(preset), `${preset} stays stock in memory`);
    const reopened = persistedSettings(stored);
    assertEquals(reopened.layout, "custom", `${preset} saved as the active layout`);
    assertEquals(slots(reopened, Action.attack), "B —", `${preset} saved edit`);
    applyBindingPreset(reopened, preset);
    assertEquals(reopened.bindings.keys.join(","), stockKeys(preset), `${preset} stays stock when reopened`);
  }
  const swapped = persistedSettings({ encoded: undefined });
  beginBindingCapture(swapped, Action.attack, 0);
  captureBinding(swapped, code("Q"));
  assertEquals(slots(swapped, Action.attack), "Q —", "a swap edits Custom");
  assertEquals(slots(swapped, Action.leftTrigger), "N —", "the swapped action moves in Custom");
  assertEquals(swapped.layouts.wasd.keys.join(","), stockKeys("wasd"), "a swap leaves WASD stock");
});

test("clearing a key on a stock layout copies it into Custom with the key cleared, and a refused key changes nothing [k2 property]", () => {
  const stored = { encoded: undefined as string | undefined };
  const settings = persistedSettings(stored);
  beginBindingCapture(settings, Action.attack, 0);
  captureBinding(settings, BACKSPACE);
  assertEquals(settings.layout, "wasd", "a refused key keeps the layout");
  assertEquals(stored.encoded, undefined, "a refused key saves nothing");
  clearKey(settings, code("N"));
  assertEquals(settings.layout, "custom", "clearing selects Custom");
  assertEquals(slots(settings, Action.attack), "— —", "key cleared in Custom");
  assertEquals(settings.layouts.wasd.keys.join(","), stockKeys("wasd"), "WASD stays stock");
  assertEquals(persistedSettings(stored).layout, "custom", "saved");
});

test("Customize copies the selected layout into Custom and selects it without an edit or a save, replacing what Custom held, and does nothing in Custom [k2 property]", () => {
  const stored = { encoded: undefined as string | undefined };
  const settings = persistedSettings(stored);
  applyBindingPreset(settings, "custom");
  bindAttack(settings, code("B"));
  const saved = stored.encoded;
  applyBindingPreset(settings, "standard");
  customizeLayout(settings);
  assertEquals(settings.layout, "custom", "Customize selects Custom");
  assertEquals(settings.bindings.keys.join(","), stockKeys("standard"), "Custom is now a copy of Box");
  assertEquals(settings.layouts.standard.keys.join(","), stockKeys("standard"), "Box stays stock");
  assertEquals(stored.encoded, saved, "Customize saves nothing");
  bindAttack(settings, code("B"));
  customizeLayout(settings);
  assertEquals(slots(settings, Action.attack), "B —", "Customize in Custom keeps its keys");
});

test("saving keeps all three layouts and the active one, and a new session reopens on them [k2 property]", () => {
  const stored = { encoded: undefined as string | undefined };
  const settings = persistedSettings(stored);
  applyBindingPreset(settings, "custom");
  bindAttack(settings, code("L"));
  applyBindingPreset(settings, "standard");
  applyBindingPreset(settings, "custom");
  saveBindingSettings(settings);

  const reopened = persistedSettings(stored);
  assertEquals(reopened.layout, "custom", "active layout");
  assertEquals(slots(reopened, Action.attack), "L —", "Custom keys");
  applyBindingPreset(reopened, "standard");
  assertEquals(slots(reopened, Action.attack), "N —", "Box keys");
  applyBindingPreset(reopened, "wasd");
  assertEquals(slots(reopened, Action.attack), "N —", "WASD keys");
});

test("a one-set save from before layouts loads as the active layout's keys, and Load profile reopens it on Custom [k2 property]", () => {
  const keys = presetBindings("wasd");
  keys.keys[slotIndex(Action.attack, 0)] = code("B");
  const old = encodeBindings(keys);
  const settings = persistedSettings({ encoded: old });
  assertEquals(settings.layout, "custom", "own keys land on Custom");
  assertEquals(slots(settings, Action.attack), "B —", "old save keys");
  applyBindingPreset(settings, "wasd");
  assertEquals(slots(settings, Action.attack), "N —", "WASD is still stock");

  const stock = persistedSettings({ encoded: encodeBindings(presetBindings("standard")) });
  assertEquals(stock.layout, "standard", "a stock old save opens on its layout");

  applyBindingPreset(settings, "standard");
  loadSavedBindings(settings, () => undefined);
  assertEquals(settings.layout, "custom", "Load profile selects Custom");
  assertEquals(slots(settings, Action.attack), "B —", "Custom gets the profile");
  applyBindingPreset(settings, "standard");
  assertEquals(slots(settings, Action.attack), "N —", "Box is untouched by Load profile");
});

test("a one-set save still on the old WASD defaults opens on WASD with C-up on Y, while an edited one stays Custom [k2 property]", () => {
  const stock = persistedSettings({ encoded: encodeBindings({ keys: previousDefaultKeys("wasd") }) });
  assertEquals(stock.layout, "wasd", "an old stock save opens on its layout");
  assertEquals(slots(stock, Action.strong), "9 —", "Strong moved");
  assertEquals(slots(stock, Action.cUp), "Y —", "C-up moved");
  const edited = { keys: previousDefaultKeys("wasd") };
  edited.keys[slotIndex(Action.attack, 0)] = code("B");
  const own = persistedSettings({ encoded: encodeBindings(edited) });
  assertEquals(own.layout, "custom", "edited keys land on Custom");
  assertEquals(slots(own, Action.strong), "9 Y", "edited Strong stays");
  assertEquals(slots(own, Action.cUp), "H —", "edited C-up stays");
});

test("each layout shows the same keys however the screen reaches it: opening on a save from before the layout defaults moved, then clicking layouts and Load profile in any order [k2 property]", () => {
  const own = presetBindings("standard");
  own.keys[slotIndex(Action.attack, 0)] = code("B");
  const old = encodeSlots({ layouts: { wasd: { keys: previousDefaultKeys("wasd") }, standard: { keys: previousDefaultKeys("standard") }, custom: own }, active: "wasd" });
  const shown = (settings: Readonly<BindingSettings>) => encodeBindings(settings.bindings);
  for (const clicks of [["custom", "wasd", "profile", "custom"], ["standard", "profile", "custom", "wasd"], ["profile", "standard", "custom", "profile", "wasd"]]) {
    const stored = { encoded: old as string | undefined };
    const settings = persistedSettings(stored);
    const seen: Partial<Record<BindingPreset, string>> = { [settings.layout]: shown(settings) };
    for (const click of [...clicks, "wasd", "standard", "custom"]) {
      if (click === "profile") {
        loadProfile(settings);
        pickCustomSlot(settings, 0);
      }
      else pickBindingPreset(settings, click as BindingPreset);
      const keys = shown(settings);
      assertEquals(keys, seen[settings.layout] ??= keys, `${PRESET_NAMES[settings.layout]} after ${clicks.join(", ")} then ${click}`);
    }
    assertEquals(slots(settings, Action.attack), "B —", `Custom keeps its own keys after ${clicks.join(", ")}`);
    const reopened = persistedSettings(stored);
    for (const preset of BINDING_PRESETS) {
      applyBindingPreset(reopened, preset);
      assertEquals(shown(reopened), seen[preset], `${PRESET_NAMES[preset]} saved after ${clicks.join(", ")}`);
    }
  }
});

test("three Custom slots each keep their own keys and name through a save, and the full save fits the player file [k2 property]", () => {
  const stored = { encoded: undefined as string | undefined };
  const settings = persistedSettings(stored);
  const attacks = [code("B"), code("K"), code("L")];
  attacks.forEach((key, slot) => {
    loadProfile(settings);
    pickCustomSlot(settings, slot);
    bindAttack(settings, key);
  });
  beginNaming(settings);
  nameSlot(settings, "Box \"tour\\ney\" kit");
  endNaming(settings);
  assertEquals(slotLabel(settings), "Box tourney", "a name keeps its storable characters up to the limit");
  pickCustomSlot(settings, 1);

  const reopened = persistedSettings(stored);
  assertEquals(reopened.layout, "custom", "reopens on Custom");
  assertEquals(reopened.slot, 1, "reopens on the last picked slot");
  attacks.forEach((key, slot) => {
    pickCustomSlot(reopened, slot);
    assertEquals(keyFor(reopened.bindings, Action.attack, 0), key, `slot ${slot + 1} keys`);
  });
  assertEquals([0, 1, 2].map(slot => slotLabel(reopened, slot)).join(","), "Custom 1,Custom 2,Box tourney", "names");
  applyBindingPreset(reopened, "wasd");
  assertEquals(slots(reopened, Action.attack), "N —", "WASD stays stock");

  const longest = createBindingSettings(0, { load: () => undefined, readLocal: () => undefined, save: () => undefined });
  longest.ready = true;
  for (const custom of longest.customs) custom.name = "W".repeat(SLOT_NAME_LIMIT);
  const full = encodeLayouts({ layouts: longest.layouts, active: "custom", customs: longest.customs, slot: CUSTOM_SLOT_COUNT - 1, keyboard: true });
  assertEquals(full.length <= PLAYER_FILE_CAPACITY, true, `${full.length} characters fit ${PLAYER_FILE_CAPACITY}`);
  assertEquals(decodeLayouts(full)?.customs.map(custom => custom.name).join(","), longest.customs.map(custom => custom.name).join(","), "longest names round-trip");
});

test("an older one-Custom save loads its Custom into slot 1, and slots 2 and 3 start as stock Custom with no name [k2 property]", () => {
  const own = presetBindings("custom");
  own.keys[slotIndex(Action.attack, 0)] = code("B");
  const settings = persistedSettings({ encoded: `KL${BINDING_PRESETS.indexOf("custom")}${[presetBindings("wasd"), presetBindings("standard"), own].map(bindings => encodeBindings(bindings)).join("")}` });
  assertEquals(settings.slot, 0, "slot 1 is active");
  assertEquals(slots(settings, Action.attack), "B —", "slot 1 holds the old Custom");
  for (const slot of [1, 2]) {
    pickCustomSlot(settings, slot);
    assertEquals(settings.bindings.keys.join(","), presetBindings("custom").keys.join(","), `slot ${slot + 1} stock`);
    assertEquals(slotLabel(settings), `Custom ${slot + 1}`, `slot ${slot + 1} name`);
  }
  const oneSet = persistedSettings({ encoded: encodeBindings(own) });
  assertEquals(oneSet.slot, 0, "a one-set save lands in slot 1");
  assertEquals(slots(oneSet, Action.attack), "B —", "one-set keys in slot 1");
});

test("Load profile opens the three slots by name or Custom 1-3, and picking one selects and saves it [k2 property]", () => {
  const stored = { encoded: undefined as string | undefined };
  const settings = persistedSettings(stored);
  loadProfile(settings);
  assertEquals(settings.picking, true, "Load profile opens the slots");
  assertEquals([0, 1, 2].map(slot => slotLabel(settings, slot)).join(","), "Custom 1,Custom 2,Custom 3");
  pickCustomSlot(settings, 2);
  assertEquals(settings.picking, false, "picking closes the slots");
  assertEquals(settings.layout, "custom");
  assertEquals(settings.slot, 2);
  beginNaming(settings);
  assertEquals(settings.naming, true, "naming starts");
  nameSlot(settings, "Friend");
  endNaming(settings);
  assertEquals(settings.naming, false, "Enter ends naming");
  loadProfile(settings);
  assertEquals([0, 1, 2].map(slot => slotLabel(settings, slot)).join(","), "Custom 1,Custom 2,Friend");
  assertEquals(persistedSettings(stored).slot, 2, "the pick is saved");
  assertEquals(slotLabel(persistedSettings(stored)), "Friend", "the name is saved");
});

test("Delete profile empties the selected Custom slot to the stock Custom keys with no name, saves it, and leaves the other slots as they were [k2 property]", () => {
  const empty: BindingLoadResult = { kind: "empty" };
  let saved = "";
  const settings = createBindingSettings(0, { load: (_owner, complete) => complete(empty), readLocal: () => empty, save: (_owner, text) => { saved = text; } });
  initializeBindingSettings(settings);
  applyBindingPreset(settings, "custom");
  const named = (slot: number, name: string) => {
    pickCustomSlot(settings, slot);
    beginNaming(settings);
    nameSlot(settings, name);
    endNaming(settings);
    beginBindingCapture(settings, Action.attack, 0);
    captureBinding(settings, code("B"));
    saveBindingSettings(settings);
  };
  named(0, "Keep");
  named(1, "Gone");
  deleteProfile(settings);
  assertEquals(slotLabel(settings, 1), "Custom 2");
  assertEquals(settings.layout, "custom");
  assertEquals(settings.bindings.keys.join(","), presetBindings("custom").keys.join(","));
  assertEquals(slotLabel(settings, 0), "Keep");
  assertEquals(keyLabel(keyFor(settings.customs[0]?.bindings ?? settings.bindings, Action.attack, 0)), "B");
  const reloaded = decodeLayouts(saved);
  assertEquals(reloaded?.customs[1]?.name, "");
  assertEquals(reloaded?.customs[1]?.bindings.keys.join(","), presetBindings("custom").keys.join(","));
  assertEquals(reloaded?.customs[0]?.name, "Keep");
});

test("a brand-new player has Show keyboard in game on, turning it off is saved with their controls and a load brings it back off, and a save from before the setting loads with it off [k2 property]", () => {
  const saved: string[] = [];
  const empty: BindingLoadResult = { kind: "empty" };
  const settings = createBindingSettings(0, { load: (_owner, complete) => complete(saved.length === 0 ? empty : { kind: "loaded", encoded: saved[saved.length - 1] ?? "" }), readLocal: () => empty, save: (_owner, encoded) => { saved.push(encoded); } });
  initializeBindingSettings(settings);
  assertEquals(settings.keyboard, true, "fresh profile");
  toggleKeyboardPreview(settings);
  assertEquals(settings.keyboard, false, "turned off");
  assertEquals(saved.length, 1, "saved at once");
  assertEquals(decodeLayouts(saved[0] ?? "")?.keyboard, false, "saved as off");

  const again = createBindingSettings(0, { load: (_owner, complete) => complete({ kind: "loaded", encoded: saved[0] ?? "" }), readLocal: () => empty, save: () => undefined });
  initializeBindingSettings(again);
  assertEquals(again.keyboard, false, "off after a load");
  toggleKeyboardPreview(again);
  assertEquals(again.keyboard, true, "on again");

  const current = encodeLayouts(layoutSave(presetLayouts(), "wasd", false));
  const withHints = "KN" + current.slice(2, 4) + "1" + current.slice(5);
  assertEquals(decodeLayouts(withHints)?.keyboard, false, "a save from the new-player hints days, hints on");
  const older = "KM" + current.slice(2, 4) + current.slice(5);
  assertEquals(decodeLayouts(older)?.keyboard, false, "a save from before either setting");
  assertEquals(decodeLayouts(encodeLayouts(layoutSave(presetLayouts(), "wasd", true)))?.keyboard, true, "on survives a save and load");
});
