import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../input/actions";
import { ACTION_LABELS, CLEAR_KEY, PRESET_NAMES, encodeBindings, keyFor, keyLabel, presetBindings, reservedReason, unboundActions } from "../input/keyBindings";
import {
  type BindingLoadResult,
  type BindingSettings,
  applyBindingPreset,
  beginBindingCapture,
  cancelBindingCapture,
  captureBinding,
  clearKey,
  createBindingSettings,
  initializeBindingSettings,
  resetToLayout,
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
  assertEquals(slots(settings, Action.walk), "H —", "Custom Tilt");
  assertEquals(slots(settings, Action.strong), "Y X", "Custom Strong");

  beginBindingCapture(settings, Action.walk, 0);
  assertEquals(captureBinding(settings, code("0")), true);
  assertEquals(slots(settings, Action.walk), "0 —", "Tilt after the swap");
  assertEquals(slots(settings, Action.cUp), "H J", "C-up after the swap");
  assertEquals(settings.message, `Swapped with ${ACTION_LABELS[Action.cUp]}.`);
  assertEquals(settings.capture, undefined);

  beginBindingCapture(settings, Action.walk, 0);
  captureBinding(settings, CLEAR_KEY);
  assertEquals(slots(settings, Action.walk), "— —", "Tilt after Delete");
  assertEquals(unbound(settings), `${Action.walk}`);
  assertEquals(settings.message, `${ACTION_LABELS[Action.walk]} is now unbound.`);
  assertEquals(settings.capture, undefined);

  clearKey(settings, code("X"));
  assertEquals(slots(settings, Action.strong), "Y —", "Strong after its x");
  assertEquals(settings.message, `X cleared from ${ACTION_LABELS[Action.strong]}.`);
  clearKey(settings, code("Y"));
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
  assertEquals(slots(settings, Action.walk), "- —", "Tilt after binding -");
  assertEquals(keyLabel(EQUALS), "=");
  assertEquals(keyLabel(MINUS), "-");
  const caps = keyboardCaps(f32(0.12), f32(0.465));
  for (const key of [EQUALS, MINUS]) assertEquals(caps.filter(cap => cap.key === key).length, 1, `cap for ${keyLabel(key)}`);
  const rightEdge = Math.max(...caps.map(cap => cap.x + cap.width));
  assertEquals(rightEdge < f32(0.09) + f32(0.66), true, "keyboard stays inside the controls panel");
});

test("Y captures as a binding for any action, swapping with Strong, and is no longer reserved [k2 property]", () => {
  const settings = customSettings();
  assertEquals(reservedReason(code("Y")), undefined);
  beginBindingCapture(settings, Action.attack, 0);
  assertEquals(captureBinding(settings, code("Y")), true);
  assertEquals(slots(settings, Action.attack), "Y —", "Attack after binding Y");
  assertEquals(slots(settings, Action.strong), "N X", "Strong after the swap");
  assertEquals(settings.message, `Swapped with ${ACTION_LABELS[Action.strong]}.`);
  clearKey(settings, code("Y"));
  beginBindingCapture(settings, Action.strong, 0);
  assertEquals(captureBinding(settings, code("Y")), true);
  assertEquals(slots(settings, Action.strong), "Y X", "Strong after binding Y");
  assertEquals(settings.capture, undefined);
});

test("the [ and ] keys capture as bindings, are named, and have a cap on the controls screen's keyboard [k2 property]", () => {
  const settings = customSettings();
  beginBindingCapture(settings, Action.attack, 0);
  assertEquals(captureBinding(settings, OPEN_BRACKET), true);
  beginBindingCapture(settings, Action.walk, 0);
  assertEquals(captureBinding(settings, CLOSE_BRACKET), true);
  assertEquals(slots(settings, Action.attack), "[ —", "Attack after binding [");
  assertEquals(slots(settings, Action.walk), "] —", "Tilt after binding ]");
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
