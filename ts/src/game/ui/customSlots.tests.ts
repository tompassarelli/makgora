import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action } from "../input/actions";
import { keyFor, keyLabel, presetBindings } from "../input/keyBindings";
import { decodeLayouts } from "../input/layoutSave";
import { type BindingLoadResult, applyBindingPreset, beginBindingCapture, beginNaming, captureBinding, createBindingSettings, deleteProfile, endNaming, initializeBindingSettings, nameSlot, pickBindingPreset, pickCustomSlot, pressCustomButton, saveBindingSettings, slotLabel } from "./bindingSettings";
import { code, persistedSettings } from "./bindingSettingsFixture";

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
