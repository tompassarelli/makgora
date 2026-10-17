import { assertEquals, test } from "wisp/src/runtime/testing";
import { ACTION_ORDER, Action } from "./actions";
import { BINDING_PRESETS, DEFAULT_PRESET, actionFor, decodeBindings, encodeBindings, keyFor, menuAction, pauseMenuKeys, presetBindings, presetOf, slotIndex, type BindingPreset } from "./keyBindings";

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

const key = (character: string): number => character.charCodeAt(0);

test("a new player starts on ESDF: E S D F move, A full shield, Q light shield, Space and Z jump, and the right hand keeps Hitbox's keys [k3 measure #101]", () => {
  const esdf = presetBindings(DEFAULT_PRESET);
  const expected: readonly (readonly [number, Action])[] = [
    [key("E"), Action.moveUp], [key("S"), Action.moveLeft], [key("D"), Action.moveDown], [key("F"), Action.moveRight],
    [key("A"), Action.leftTrigger], [key("Q"), Action.lightShield], [32, Action.jump], [key("Z"), Action.jump],
  ];
  for (const [bound, action] of expected) assertEquals(actionFor(esdf, bound), action, `ESDF ${String.fromCharCode(bound)}`);
  assertEquals(keyFor(esdf, Action.jump, 0), 32, "Space is ESDF's first jump key");
  const hitbox = presetBindings("standard");
  const leftHand: readonly Action[] = [Action.moveLeft, Action.moveRight, Action.moveDown, Action.moveUp, Action.jump, Action.leftTrigger, Action.lightShield];
  for (const action of ACTION_ORDER) {
    if (leftHand.includes(action)) continue;
    for (const slot of [0, 1] as const) assertEquals(keyFor(esdf, action, slot), keyFor(hitbox, action, slot), `right hand action ${action} slot ${slot}`);
  }
  assertEquals(keyFor(hitbox, Action.moveUp, 0), 32, "Hitbox keeps up on Space");
});

test("menus read each preset's own direction, attack and special keys plus the arrows, and a pause holds back only its own menu keys [k2 property]", () => {
  const menuActions: readonly Action[] = [Action.moveLeft, Action.moveRight, Action.moveUp, Action.moveDown, Action.attack, Action.special];
  const arrows: readonly (readonly [number, Action])[] = [[0x25, Action.moveLeft], [0x26, Action.moveUp], [0x27, Action.moveRight], [0x28, Action.moveDown]];
  for (const preset of BINDING_PRESETS) {
    const bindings = presetBindings(preset);
    for (const [arrow, action] of arrows) assertEquals(menuAction(bindings, arrow), action, `${preset} arrow ${arrow}`);
    const held = pauseMenuKeys(bindings);
    for (const bound of bindings.keys) {
      if (bound === 0) continue;
      const action = actionFor(bindings, bound);
      const expected = action !== undefined && menuActions.includes(action) ? action : undefined;
      assertEquals(menuAction(bindings, bound), expected, `${preset} key ${bound}`);
      assertEquals(held.includes(bound), expected !== undefined && expected !== Action.moveLeft && expected !== Action.moveRight, `${preset} held pause key ${bound}`);
    }
  }
});

test("the picker names the preset whose every slot is loaded, and none once any one slot moves [k2 property]", () => {
  for (const preset of BINDING_PRESETS) {
    const bindings = presetBindings(preset);
    assertEquals(presetOf(bindings), preset, `${preset} itself`);
    for (let index = 0; index < bindings.keys.length; index++) {
      const moved = { keys: bindings.keys.slice() };
      moved.keys[index] = moved.keys[index] === 0 ? key("T") : 0;
      assertEquals(presetOf(moved), undefined, `${preset} slot ${index} moved`);
    }
  }
});
