import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action } from "../input/actions";
import { ACTION_LABELS, CLEAR_KEY, PRESET_NAMES, encodeBindings, keyFor, keyLabel, presetBindings, reservedReason, unboundActions } from "../input/keyBindings";
import { CUSTOM_SLOT_COUNT, SLOT_NAME_LIMIT, decodeLayouts, encodeLayouts } from "../input/layoutSave";
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
  beginNaming,
  endNaming,
  nameSlot,
  pickCustomSlot,
  slotLabel,
  resetToLayout,
  saveBindingSettings,
} from "./bindingSettings";
import { PLAYER_FILE_CAPACITY } from "../core/gameFiles";
import { bindAttack, code, persistedSettings, slots } from "./bindingSettingsFixture";

const BACKSPACE = 0x08;
const ESCAPE = 0x1b;
const F2 = 0x71;
const F6 = 0x75;
const F7 = 0x76;
const EQUALS = 0xbb;
const MINUS = 0xbd;

function customSettings(): BindingSettings {
  const empty: BindingLoadResult = { kind: "empty" };
  const settings = createBindingSettings(0, { load: (_owner, complete) => complete(empty), readLocal: () => empty, save: () => undefined });
  initializeBindingSettings(settings);
  applyBindingPreset(settings, "custom");
  return settings;
}

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
  for (const key of [BACKSPACE, ESCAPE, F2, F6, F7]) {
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

test("three Custom slots each keep their own keys and name through a save, and the full save fits the player file [k2 property]", () => {
  const stored = { encoded: undefined as string | undefined };
  const settings = persistedSettings(stored);
  const attacks = [code("B"), code("K"), code("L")];
  attacks.forEach((key, slot) => {
    pickCustomSlot(settings, slot);
    bindAttack(settings, key);
  });
  beginNaming(settings);
  nameSlot(settings, "Box \"tour\\ney\" layout");
  endNaming(settings);
  assertEquals(slotLabel(settings), "Box tourney layo", "a name keeps its storable characters up to the limit");
  pickCustomSlot(settings, 1);

  const reopened = persistedSettings(stored);
  assertEquals(reopened.layout, "custom", "reopens on Custom");
  assertEquals(reopened.slot, 1, "reopens on the last picked slot");
  attacks.forEach((key, slot) => {
    pickCustomSlot(reopened, slot);
    assertEquals(keyFor(reopened.bindings, Action.attack, 0), key, `slot ${slot + 1} keys`);
  });
  assertEquals([0, 1, 2].map(slot => slotLabel(reopened, slot)).join(","), "Custom 1,Custom 2,Box tourney layo", "names");
  applyBindingPreset(reopened, "wasd");
  assertEquals(slots(reopened, Action.attack), "N —", "WASD stays stock");

  const longest = createBindingSettings(0, { load: () => undefined, readLocal: () => undefined, save: () => undefined });
  longest.ready = true;
  for (const custom of longest.customs) custom.name = "W".repeat(SLOT_NAME_LIMIT);
  const full = encodeLayouts({ layouts: longest.layouts, active: "custom", customs: longest.customs, slot: CUSTOM_SLOT_COUNT - 1, keyboard: true, stickJump: true, cStickTilt: false });
  assertEquals(full.length <= PLAYER_FILE_CAPACITY, true, `${full.length} characters fit ${PLAYER_FILE_CAPACITY}`);
  assertEquals(decodeLayouts(full)?.customs.map(custom => custom.name).join(","), longest.customs.map(custom => custom.name).join(","), "longest names round-trip");
});

