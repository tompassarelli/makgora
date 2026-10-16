import { assertEquals, test } from "wisp/src/runtime/testing";
import { ACTION_ORDER, Action } from "./actions";
import { actionFor, decodeBindings, encodeBindings, keyFor, presetBindings, slotIndex, type BindingPreset } from "./keyBindings";

const OLD_SAVES: readonly (readonly [string, number])[] = [["K1", 28], ["K2", 30], ["K3", 30], ["K4", 34], ["K5", 34], ["K6", 36], ["K7", 36]];
const UPGRADES: readonly (readonly [Action, 0 | 1, number])[] = [[Action.shortHop, 0, "I".charCodeAt(0)], [Action.rightTrigger, 1, "G".charCodeAt(0)], [Action.exSpecial, 1, "X".charCodeAt(0)]];

function oldSave(version: string, slots: number, keys: readonly number[]): string {
  return version + keys.slice(0, slots).map((key) => String(key).padStart(3, "0")).join("");
}

test("upgrading any older saved binding set gives short hop I, the right trigger G and EX special X when free, and never takes a key the player bound elsewhere [k2 property]", () => {
  for (const preset of ["standard", "custom"] as BindingPreset[]) {
    for (const [action, upgradeSlot, key] of UPGRADES) {
      assertEquals(actionFor(presetBindings(preset), key), action, `${preset} defaults`);
      for (const [version, slots] of OLD_SAVES) {
        const defaults = presetBindings(preset).keys.slice();
        defaults[slotIndex(action, upgradeSlot)] = 0;
        if (upgradeSlot === 0) defaults[slotIndex(action, 1)] = 0;
        const upgraded = decodeBindings(oldSave(version, slots, defaults));
        assertEquals(upgraded === undefined ? undefined : actionFor(upgraded, key), action, `${preset} ${version} with ${key} free`);

        for (const owner of ACTION_ORDER) {
          for (const slot of [0, 1] as const) {
            const index = slotIndex(owner, slot);
            if (index >= slots || index === slotIndex(action, upgradeSlot) || (owner === action && upgradeSlot === 0)) continue;
            if (action === Action.shortHop && owner === Action.jump && slot === 0) continue;
            if (action === Action.exSpecial && owner === Action.exSpecial) continue;
            const keys = defaults.slice();
            keys[index] = key;
            const decoded = decodeBindings(oldSave(version, slots, keys));
            const where = `${preset} ${version} with ${key} on action ${owner} slot ${slot}`;
            assertEquals(decoded === undefined ? undefined : keyFor(decoded, owner, slot), key, where);
            assertEquals(decoded === undefined ? -1 : keyFor(decoded, action, upgradeSlot), undefined, where);
          }
        }
      }
    }
  }
});


test("saved default upgrades preserve every customized slot and leave current saves unchanged [k2 property]", () => {
  for (const preset of ["standard", "custom"] as BindingPreset[]) {
    const current = presetBindings(preset);
    const legacy = current.keys.slice();
    legacy[slotIndex(Action.jump, 0)] = "I".charCodeAt(0);
    legacy[slotIndex(Action.shortHop, 0)] = "Z".charCodeAt(0);
    legacy[slotIndex(Action.smashUp, 0)] = "J".charCodeAt(0);
    legacy[slotIndex(Action.smashDown, 0)] = "H".charCodeAt(0);
    legacy[slotIndex(Action.lightShield, 0)] = (preset === "custom" ? "0" : "9").charCodeAt(0);
    legacy[slotIndex(Action.lightShield, 1)] = "T".charCodeAt(0);
    legacy[slotIndex(Action.exSpecial, 0)] = "X".charCodeAt(0);
    legacy[slotIndex(Action.exSpecial, 1)] = 0;
    for (const [version, slots] of OLD_SAVES) {
      const decoded = decodeBindings(oldSave(version, slots, legacy));
      assertEquals(decoded === undefined ? "invalid" : encodeBindings(decoded), encodeBindings(current), `${preset} ${version} defaults`);
      for (const character of ["C", "A", "0"]) {
        const customKey = character.charCodeAt(0);
        if (legacy.includes(customKey)) continue;
        for (let index = 0; index < slots; index++) {
          if (character === "0" && index === slotIndex(Action.lightShield, 0)) continue;
          const customized = legacy.slice();
          customized[index] = customKey;
          const upgraded = decodeBindings(oldSave(version, slots, customized));
          assertEquals(upgraded === undefined ? undefined : upgraded.keys[index], customized[index], `${preset} ${version} custom ${character} slot ${index}`);
        }
      }
    }
    const previous = current.keys.slice();
    previous[slotIndex(Action.smashUp, 0)] = "0".charCodeAt(0);
    previous[slotIndex(Action.smashDown, 0)] = "J".charCodeAt(0);
    previous[slotIndex(Action.exSpecial, 0)] = "X".charCodeAt(0);
    previous[slotIndex(Action.exSpecial, 1)] = 0;
    const upgradedPrevious = decodeBindings(oldSave("K8", previous.length, previous));
    assertEquals(upgradedPrevious === undefined ? "invalid" : encodeBindings(upgradedPrevious), encodeBindings(current), `${preset} K8 defaults`);
    for (let index = 0; index < previous.length; index++) {
      for (const character of ["C", "H"]) {
        const customized = previous.slice();
        customized[index] = character.charCodeAt(0);
        const upgraded = decodeBindings(oldSave("K8", customized.length, customized));
        assertEquals(upgraded === undefined ? undefined : upgraded.keys[index], customized[index], `${preset} K8 custom ${character} slot ${index}`);
      }
    }
    const savedCurrent = { keys: legacy };
    const decodedCurrent = decodeBindings(encodeBindings(savedCurrent));
    assertEquals(decodedCurrent === undefined ? "invalid" : encodeBindings(decodedCurrent), encodeBindings(savedCurrent), `${preset} current save`);
    assertEquals(actionFor(current, (preset === "custom" ? "0" : "9").charCodeAt(0)), Action.exSpecial, `${preset} EX special key`);
    assertEquals(actionFor(current, "X".charCodeAt(0)), Action.exSpecial, `${preset} X is the pad EX key`);
    assertEquals(actionFor(current, "G".charCodeAt(0)), Action.rightTrigger, `${preset} G is the pad right shield key`);
    assertEquals(actionFor(current, "T".charCodeAt(0)), undefined, `${preset} T unbound`);
  }
});
