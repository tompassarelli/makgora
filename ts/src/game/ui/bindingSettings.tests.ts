import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../input/actions";
import { ACTION_LABELS, BINDING_PRESETS, type BindingPreset, CLEAR_KEY, PRESET_NAMES, encodeBindings, encodeLayouts, keyFor, keyLabel, presetBindings, previousDefaultKeys, reservedReason, slotIndex, unboundActions } from "../input/keyBindings";
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
  initializeBindingSettings,
  loadProfile,
  loadSavedBindings,
  pickBindingPreset,
  resetToLayout,
  saveBindingSettings,
} from "./bindingSettings";
import { keyboardCaps } from "./keyboardLayout";

const BACKSPACE = 0x08;
const F6 = 0x75;
const F7 = 0x76;
const EQUALS = 0xbb;
const MINUS = 0xbd;
const OPEN_BRACKET = 0xdb;
const CLOSE_BRACKET = 0xdd;
const code = (character: string) => character.charCodeAt(0);

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
  assertEquals(slots(settings, Action.walk), "K —", "Custom Walk");
  assertEquals(slots(settings, Action.strong), "0 —", "Custom Strong");

  beginBindingCapture(settings, Action.walk, 0);
  assertEquals(captureBinding(settings, code("0")), true);
  assertEquals(slots(settings, Action.walk), "0 —", "Walk after the swap");
  assertEquals(slots(settings, Action.strong), "K —", "Strong after the swap");
  assertEquals(settings.message, `Swapped with ${ACTION_LABELS[Action.strong]}.`);
  assertEquals(settings.capture, undefined);

  beginBindingCapture(settings, Action.walk, 0);
  captureBinding(settings, CLEAR_KEY);
  assertEquals(slots(settings, Action.walk), "— —", "Walk after Delete");
  assertEquals(unbound(settings), `${Action.walk}`);
  assertEquals(settings.message, `${ACTION_LABELS[Action.walk]} is now unbound.`);
  assertEquals(settings.capture, undefined);

  clearKey(settings, code("K"));
  assertEquals(slots(settings, Action.strong), "— —", "Strong after its x");
  assertEquals(settings.message, `${ACTION_LABELS[Action.strong]} is now unbound.`);
  assertEquals(unbound(settings), `${Action.walk},${Action.strong}`);
  const before = encodeBindings(settings.bindings);
  clearKey(settings, code("C"));
  assertEquals(encodeBindings(settings.bindings), before, "clearing an unbound key");

  beginBindingCapture(settings, Action.attack, 0);
  for (const key of [BACKSPACE, F6, F7]) {
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
  beginBindingCapture(settings, Action.walk, 0);
  assertEquals(captureBinding(settings, MINUS), true);
  assertEquals(slots(settings, Action.attack), "= —", "Attack after binding =");
  assertEquals(slots(settings, Action.walk), "- —", "Walk after binding -");
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
  beginBindingCapture(settings, Action.walk, 0);
  assertEquals(captureBinding(settings, CLOSE_BRACKET), true);
  assertEquals(slots(settings, Action.attack), "[ —", "Attack after binding [");
  assertEquals(slots(settings, Action.walk), "] —", "Walk after binding ]");
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

test("a one-set save still on the old WASD defaults opens on WASD with Strong on 9 and C-up on 0, while an edited one stays Custom [k2 property]", () => {
  const stock = persistedSettings({ encoded: encodeBindings({ keys: previousDefaultKeys("wasd") }) });
  assertEquals(stock.layout, "wasd", "an old stock save opens on its layout");
  assertEquals(slots(stock, Action.strong), "9 Y", "Strong moved");
  assertEquals(slots(stock, Action.cUp), "0 —", "C-up moved");
  const edited = { keys: previousDefaultKeys("wasd") };
  edited.keys[slotIndex(Action.attack, 0)] = code("B");
  const own = persistedSettings({ encoded: encodeBindings(edited) });
  assertEquals(own.layout, "custom", "edited keys land on Custom");
  assertEquals(slots(own, Action.strong), "Y —", "edited Strong stays");
});

test("each layout shows the same keys however the screen reaches it: opening on a save from before the layout defaults moved, then clicking layouts and Load profile in any order [k2 property]", () => {
  const own = presetBindings("standard");
  own.keys[slotIndex(Action.attack, 0)] = code("B");
  const old = encodeLayouts({ layouts: { wasd: { keys: previousDefaultKeys("wasd") }, standard: { keys: previousDefaultKeys("standard") }, custom: own }, active: "wasd" });
  const shown = (settings: Readonly<BindingSettings>) => encodeBindings(settings.bindings);
  for (const clicks of [["custom", "wasd", "profile", "custom"], ["standard", "profile", "custom", "wasd"], ["profile", "standard", "custom", "profile", "wasd"]]) {
    const stored = { encoded: old as string | undefined };
    const settings = persistedSettings(stored);
    const seen: Partial<Record<BindingPreset, string>> = { [settings.layout]: shown(settings) };
    for (const click of [...clicks, "wasd", "standard", "custom"]) {
      if (click === "profile") loadProfile(settings);
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
