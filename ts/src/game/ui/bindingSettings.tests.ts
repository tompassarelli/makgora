import { assertEquals, test } from "wisp/src/runtime/testing";
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

const BACKSPACE = 0x08;
const F6 = 0x75;
const F7 = 0x76;
const EQUALS = 0xbb;
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
  assertEquals(slots(settings, Action.walk), "P —", "Custom Tilt");
  assertEquals(slots(settings, Action.strong), "0 X", "Custom Strong");

  beginBindingCapture(settings, Action.walk, 0);
  assertEquals(captureBinding(settings, code("0")), true);
  assertEquals(slots(settings, Action.walk), "0 —", "Tilt after the swap");
  assertEquals(slots(settings, Action.strong), "P X", "Strong after the swap");
  assertEquals(settings.message, `Swapped with ${ACTION_LABELS[Action.strong]}.`);
  assertEquals(settings.capture, undefined);

  beginBindingCapture(settings, Action.walk, 0);
  captureBinding(settings, CLEAR_KEY);
  assertEquals(slots(settings, Action.walk), "— —", "Tilt after Delete");
  assertEquals(unbound(settings), `${Action.walk}`);
  assertEquals(settings.message, `${ACTION_LABELS[Action.walk]} is now unbound.`);
  assertEquals(settings.capture, undefined);

  clearKey(settings, code("X"));
  assertEquals(slots(settings, Action.strong), "P —", "Strong after its x");
  assertEquals(settings.message, `X cleared from ${ACTION_LABELS[Action.strong]}.`);
  clearKey(settings, code("P"));
  assertEquals(unbound(settings), `${Action.walk},${Action.strong}`);
  const before = encodeBindings(settings.bindings);
  clearKey(settings, code("C"));
  assertEquals(encodeBindings(settings.bindings), before, "clearing an unbound key");

  beginBindingCapture(settings, Action.attack, 0);
  for (const key of [code("Y"), BACKSPACE, EQUALS, F6, F7]) {
    assertEquals(captureBinding(settings, key), true);
    assertEquals(settings.message, `${reservedReason(key)}. Press another key.`);
    assertEquals(encodeBindings(settings.bindings), before, `reserved ${keyLabel(key)}`);
    assertEquals(settings.capture?.action, Action.attack);
  }
  cancelBindingCapture(settings);
  assertEquals(settings.capture, undefined);
  assertEquals(settings.message, "Rebind cancelled.");
  assertEquals(reservedReason(EQUALS), "= is reserved for saving a moment");
  assertEquals(reservedReason(code("K")), undefined);
  beginBindingCapture(settings, Action.attack, 0);
  assertEquals(captureBinding(settings, code("K")), true);
  assertEquals(slots(settings, Action.attack), "K —", "Attack after binding K");

  resetToLayout(settings);
  assertEquals(encodeBindings(settings.bindings), encodeBindings(presetBindings("custom")), "Reset to layout");
  assertEquals(settings.message, `${PRESET_NAMES.custom} defaults restored. Save to keep them.`);
});
