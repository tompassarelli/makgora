import { assertEquals, test } from "wisp/src/runtime/testing";
import { ACTION_ORDER, Action } from "./actions";
import { BINDING_PRESETS, DEFAULT_PRESET, actionFor, decodeBindings, encodeBindings, inputAction, keyFor, menuAction, pauseMenuKeys, presetBindings, presetOf, previousPresetKeys, rebind, slotIndex, type BindingPreset } from "./keyBindings";
import { PAD_LAYER } from "./padKeys";
import { heldActions, playerKeys, pressKey, releaseKey } from "./playerKeys";

const savedDefaults = (preset: BindingPreset): number[] => preset === "custom" ? presetBindings(preset).keys.slice() : previousPresetKeys(preset);
const code = (character: string) => character.charCodeAt(0);
const TOM_SAVED = "K1083000070000068000032000073057078000085000076000065000056000066191077000074000072000";

const OLD_SAVES: readonly (readonly [string, number])[] = [["K1", 28], ["K2", 30], ["K3", 30], ["K4", 34], ["K5", 34], ["K6", 36], ["K7", 36]];
const UPGRADES: readonly (readonly [Action, 0 | 1, number])[] = [[Action.shortHop, 0, "I".charCodeAt(0)], [Action.rightTrigger, 1, "G".charCodeAt(0)], [Action.exSpecial, 1, "X".charCodeAt(0)]];

function oldSave(version: string, slots: number, keys: readonly number[]): string {
  return version + keys.slice(0, slots).map((key) => String(key).padStart(3, "0")).join("");
}

test("upgrading any older saved binding set gives short hop I, the right trigger G and EX special X when free, and never takes a key the player bound elsewhere [k2 property]", () => {
  for (const preset of ["standard", "custom"] as BindingPreset[]) {
    for (const [action, upgradeSlot, key] of UPGRADES) {
      if (preset !== "custom" && actionFor(presetBindings(preset), key) !== action) continue;
      assertEquals(actionFor(presetBindings(preset), key), action, `${preset} defaults`);
      for (const [version, slots] of OLD_SAVES) {
        const defaults = savedDefaults(preset);
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
    const legacy = savedDefaults(preset);
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
    const previous = savedDefaults(preset);
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
    assertEquals(actionFor(current, "T".charCodeAt(0)), undefined, `${preset} T unbound`);
  }
});

test("ESDF and Hitbox bind only keyboard keys: no Z, X, G or /, 8 jumps and 0 is light shield, while Custom keeps its keys [k2 property]", () => {
  for (const preset of ["esdf", "standard"] as const) {
    const bindings = presetBindings(preset);
    for (const key of [code("Z"), code("X"), code("G"), 191]) assertEquals(actionFor(bindings, key), undefined, `${preset} binds ${key}`);
    assertEquals(actionFor(bindings, code("8")), Action.jump, `${preset} 8`);
    assertEquals(actionFor(bindings, code("0")), Action.lightShield, `${preset} 0`);
  }
  assertEquals(actionFor(presetBindings("esdf"), 32), Action.jump, "esdf space");
  const custom = presetBindings("custom");
  for (const [key, action] of [["Z", Action.jump], ["9", Action.jump], ["8", Action.rightTrigger], ["G", Action.rightTrigger], ["A", Action.lightShield], ["0", Action.exSpecial], ["X", Action.exSpecial]] as const) {
    assertEquals(actionFor(custom, code(key)), action, `custom ${key}`);
  }
  assertEquals(actionFor(custom, 191), Action.smashLeft, "custom /");
});

test("a saved previous ESDF or Hitbox set loads as the new preset, a changed one keeps every key, and Tom's K1 save still loads as Custom [k2 property]", () => {
  for (const preset of ["esdf", "standard"] as const) {
    const previous = previousPresetKeys(preset);
    for (const version of ["KA", "K9"]) {
      assertEquals(encodeBindings(decodeBindings(oldSave(version, previous.length, previous)) ?? { keys: [] }), encodeBindings(presetBindings(preset)), `${preset} ${version}`);
    }
    for (let index = 0; index < previous.length; index++) {
      const changed = previous.slice();
      changed[index] = previous.includes(code("C")) ? 0 : code("C");
      if (changed[index] === previous[index]) continue;
      assertEquals(decodeBindings(oldSave("KA", changed.length, changed))?.keys[index], changed[index], `${preset} KA slot ${index}`);
    }
  }
  assertEquals(encodeBindings(decodeBindings(TOM_SAVED) ?? { keys: [] }), encodeBindings(presetBindings("custom")), "Tom's K1 save");
});

test("every pad key reaches its action with each preset or Tom's save loaded, and a player's own binding of a pad key wins [k2 property]", () => {
  const sets = [...BINDING_PRESETS.map((preset) => [preset, presetBindings(preset)] as const), ["Tom's save", decodeBindings(TOM_SAVED) ?? { keys: [] }] as const];
  for (const [name, bindings] of sets) {
    const keys = playerKeys();
    for (const { action, code: key } of PAD_LAYER) {
      assertEquals(actionFor(bindings, key), undefined, `${name} binds pad key ${key}`);
      assertEquals(inputAction(bindings, key), action, `${name} pad key ${key}`);
      assertEquals(pressKey(keys, key, bindings), action, `${name} press ${key}`);
      assertEquals(heldActions(keys), 1 << action, `${name} holds ${key}`);
      assertEquals(releaseKey(keys, key, bindings), action, `${name} release ${key}`);
      assertEquals(heldActions(keys), 0, `${name} releases ${key}`);
    }
  }
  const esdf = presetBindings("esdf");
  const [pad] = PAD_LAYER;
  if (pad === undefined) throw new Error("empty pad layer");
  const other = pad.action === Action.grab ? Action.attack : Action.grab;
  rebind(esdf, other, 1, pad.code);
  assertEquals(inputAction(esdf, pad.code), other, "player binding wins");
  const keys = playerKeys();
  assertEquals(pressKey(keys, pad.code, esdf), other, "player binding wins on press");
  assertEquals(heldActions(keys), 1 << other, "player binding held");
});

const key = (character: string): number => character.charCodeAt(0);

test("a new player starts on ESDF: E S D F move, A full shield, 0 light shield, Space and 8 jump, and the right hand keeps Hitbox's keys [k3 measure #101]", () => {
  const esdf = presetBindings(DEFAULT_PRESET);
  const expected: readonly (readonly [number, Action])[] = [
    [key("E"), Action.moveUp], [key("S"), Action.moveLeft], [key("D"), Action.moveDown], [key("F"), Action.moveRight],
    [key("A"), Action.leftTrigger], [key("0"), Action.lightShield], [32, Action.jump], [key("8"), Action.jump],
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

test("menus read each preset's own direction, attack and special keys plus the arrows and pad keys, and a pause holds back only its own menu keys [k2 property]", () => {
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
    for (const { action, code: pad } of PAD_LAYER) {
      const expected = menuActions.includes(action) ? action : undefined;
      assertEquals(menuAction(bindings, pad), expected, `${preset} pad key ${pad}`);
      assertEquals(held.includes(pad), expected !== undefined && expected !== Action.moveLeft && expected !== Action.moveRight, `${preset} held pause pad key ${pad}`);
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
