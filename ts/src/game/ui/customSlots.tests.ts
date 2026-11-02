import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action } from "../input/actions";
import { PRESET_NAMES, encodeBindings, keyFor, keyLabel, presetBindings } from "../input/keyBindings";
import { customSlotEmpty, decodeLayouts } from "../input/layoutSave";
import { type BindingLoadResult, applyBindingPreset, beginBindingCapture, beginNaming, captureBinding, initializeBindingSettings, cancelNaming, closeSlotMenu, createBindingSettings, customButtonLabel, deleteProfile, endNaming, nameSlot, pickBindingPreset, pickCustomSlot, pressCustomButton, resetToLayout, saveBindingSettings, slotLabel } from "./bindingSettings";
import { bindAttack, code, persistedSettings, slots } from "./bindingSettingsFixture";

test("the custom button selects the active Custom slot from WASD or Box, and only once Custom is selected does it open the slot list; picking a slot loads and saves it, and Esc or a click elsewhere closes the list [k2 property]", () => {
  const stored = { encoded: undefined as string | undefined };
  const settings = persistedSettings(stored);
  pickCustomSlot(settings, 1);
  bindAttack(settings, code("B"));
  saveBindingSettings(settings);
  pickBindingPreset(settings, "wasd");
  pressCustomButton(settings);
  assertEquals(settings.layout, "custom", "the custom button selects Custom");
  assertEquals(settings.slot, 1, "on the active slot");
  assertEquals(slots(settings, Action.attack), "B —", "with that slot's keys");
  assertEquals(settings.picking, false, "the first press opens no list");
  pressCustomButton(settings);
  assertEquals(settings.picking, true, "a press on the selected custom button opens the list");
  pressCustomButton(settings);
  assertEquals(settings.picking, false, "a second press closes it");
  pressCustomButton(settings);
  assertEquals(closeSlotMenu(settings), true, "Esc or a click elsewhere closes the list");
  assertEquals(closeSlotMenu(settings), false, "a closed list has nothing to close");
  pressCustomButton(settings);
  pickCustomSlot(settings, 2);
  assertEquals(settings.picking, false, "picking closes the list");
  assertEquals(settings.slot, 2, "the picked slot is active");
  assertEquals(encodeBindings(settings.bindings), encodeBindings(presetBindings("custom")), "with its own keys");
  assertEquals([0, 1, 2].map(slot => customSlotEmpty(settings.customs, slot)).join(","), "true,false,true", "unnamed stock slots are listed as empty");
  assertEquals(persistedSettings(stored).slot, 2, "the pick is saved");
});

test("Rename, Reset and Delete do nothing on WASD or Box [k2 property]", () => {
  const stored = { encoded: undefined as string | undefined };
  const settings = persistedSettings(stored);
  pickCustomSlot(settings, 0);
  beginNaming(settings);
  nameSlot(settings, "primary");
  endNaming(settings);
  for (const preset of ["wasd", "standard"] as const) {
    pickBindingPreset(settings, preset);
    const saved = stored.encoded;
    const keys = encodeBindings(settings.bindings);
    beginNaming(settings);
    resetToLayout(settings);
    deleteProfile(settings);
    assertEquals(settings.naming, false, `Rename on ${PRESET_NAMES[preset]}`);
    assertEquals(settings.layout, preset, `${PRESET_NAMES[preset]} stays selected`);
    assertEquals(encodeBindings(settings.bindings), keys, `${PRESET_NAMES[preset]} keys`);
    assertEquals(slotLabel(settings, 0), "primary", `Delete on ${PRESET_NAMES[preset]} keeps the slot`);
    assertEquals(stored.encoded, saved, `nothing saved on ${PRESET_NAMES[preset]}`);
  }
});

test("the custom button's name gains a * after an unsaved edit and Save clears it [k2 property]", () => {
  const settings = persistedSettings({ encoded: undefined });
  pickCustomSlot(settings, 0);
  assertEquals(customButtonLabel(settings), "Custom 1", "saved");
  bindAttack(settings, code("B"));
  assertEquals(customButtonLabel(settings), "Custom 1*", "after an edit");
  saveBindingSettings(settings);
  assertEquals(customButtonLabel(settings), "Custom 1", "after Save");
  resetToLayout(settings);
  assertEquals(customButtonLabel(settings), "Custom 1*", "after Reset");
});

test("The selected custom button opens the three slots by name or Custom 1-3, and picking one selects and saves it [k2 property]", () => {
  const stored = { encoded: undefined as string | undefined };
  const settings = persistedSettings(stored);
  pickBindingPreset(settings, "custom");
  pressCustomButton(settings);
  assertEquals(settings.picking, true, "the custom button opens the slots");
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

test("Escape while renaming puts the old name back and saves nothing, while Enter or OK keeps the typed name and saves it [k2 property]", () => {
  const stored = { encoded: undefined as string | undefined };
  const settings = persistedSettings(stored);
  pickCustomSlot(settings, 0);
  beginNaming(settings);
  nameSlot(settings, "primary");
  endNaming(settings);
  const saved = stored.encoded;
  beginNaming(settings);
  nameSlot(settings, "typo");
  assertEquals(slotLabel(settings), "typo", "the typed name shows while renaming");
  cancelNaming(settings);
  assertEquals(settings.naming, false, "Escape ends renaming");
  assertEquals(slotLabel(settings), "primary", "Escape restores the old name");
  assertEquals(stored.encoded, saved, "Escape saves nothing");
  beginNaming(settings);
  nameSlot(settings, "second");
  beginNaming(settings);
  assertEquals(settings.naming, false, "OK ends renaming");
  assertEquals(slotLabel(persistedSettings(stored)), "second", "OK saves the typed name");
});
