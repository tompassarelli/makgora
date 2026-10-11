import { assertEquals, test } from "wisp/src/runtime/testing";
import { ACTION_ORDER, Action } from "./actions";
import { decodeBindings, keyFor, presetBindings, slotIndex, type BindingPreset } from "./keyBindings";

const Z = "Z".charCodeAt(0);
const OLD_SAVES: readonly (readonly [string, number])[] = [["K1", 28], ["K2", 30], ["K3", 30], ["K4", 34], ["K5", 34]];

function oldSave(version: string, slots: number, keys: readonly number[]): string {
  return version + keys.slice(0, slots).map((key) => String(key).padStart(3, "0")).join("");
}

test("upgrading any older saved binding set binds short hop to Z when Z is free and never takes a Z the player bound elsewhere [k2 property]", () => {
  for (const preset of ["standard", "custom"] as BindingPreset[]) {
    for (const [version, slots] of OLD_SAVES) {
      const defaults = presetBindings(preset).keys.slice();
      defaults[slotIndex(Action.shortHop, 0)] = 0;
      defaults[slotIndex(Action.shortHop, 1)] = 0;
      const upgraded = decodeBindings(oldSave(version, slots, defaults));
      assertEquals(upgraded === undefined ? undefined : keyFor(upgraded, Action.shortHop, 0), Z, `${preset} ${version} with Z free`);

      for (const owner of ACTION_ORDER) {
        if (owner === Action.shortHop) continue;
        for (const slot of [0, 1] as const) {
          const index = slotIndex(owner, slot);
          if (index >= slots) continue;
          const keys = defaults.slice();
          keys[index] = Z;
          const decoded = decodeBindings(oldSave(version, slots, keys));
          const where = `${preset} ${version} with Z on action ${owner} slot ${slot}`;
          assertEquals(decoded === undefined ? undefined : keyFor(decoded, owner, slot), Z, where);
          assertEquals(decoded === undefined ? -1 : keyFor(decoded, Action.shortHop, 0), undefined, where);
        }
      }
    }
  }
});
