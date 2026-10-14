import { expect, test } from "bun:test";
import { Schema } from "effect";
import { Action } from "../src/game/input/actions";
import { actionFor, decodeBindings, presetBindings, slotIndex } from "../src/game/input/keyBindings";

const Rows = Schema.Array(Schema.Struct({ key: Schema.String, action: Schema.String, label: Schema.String }));
const actions: Readonly<Record<string, readonly Action[]>> = {
  attack: [Action.attack], special: [Action.special], jump: [Action.jump], grab: [Action.grab],
  shield: [Action.leftTrigger, Action.rightTrigger], rightTrigger: [Action.rightTrigger], lightShield: [Action.lightShield], shortHop: [Action.shortHop],
  meter: [Action.meter], moveLeft: [Action.moveLeft], moveRight: [Action.moveRight], moveUp: [Action.moveUp], moveDown: [Action.moveDown],
  smashLeft: [Action.smashLeft], smashRight: [Action.smashRight], smashUp: [Action.smashUp], smashDown: [Action.smashDown],
};

test("upstream pad keys reach labelled actions in defaults and sanitized K1 upgrades [k2 property]", () => {
  const rows = process.env.WC3_BINDING_ROWS === undefined
    ? [{ key: "i", action: "shortHop", label: "Short hop" }]
    : Schema.decodeUnknownSync(Rows)(JSON.parse(process.env.WC3_BINDING_ROWS));
  const legacy = [87, 0, 82, 0, 69, 0, 32, 0, 73, 57, 78, 0, 85, 0, 79, 0, 81, 0, 56, 0, 66, 191, 77, 0, 74, 0, 72, 0];
  const failures = new Set<string>();
  let seed = 17391;
  for (let sample = 0; sample < 64; sample++) {
    const slots = [...legacy];
    seed = (seed * 48271) % 2147483647;
    const secondary = [1, 3, 5, 7, 11, 13, 15, 17, 19, 23, 25, 27][seed % 12];
    slots[secondary] = [67, 70, 71, 76, 83, 86][seed % 6];
    const saved = "K1" + slots.map((key) => String(key).padStart(3, "0")).join("");
    const upgraded = decodeBindings(saved);
    expect(upgraded).toBeDefined();
    if (upgraded === undefined) throw new Error("sanitized K1 fixture rejected");
    for (const [name, bindings] of [["standard", presetBindings("standard")], ["custom", presetBindings("custom")], ["K1", upgraded]] as const) {
      for (const row of rows) {
        if (row.action === "start") continue;
        const expected = actions[row.action];
        if (expected === undefined) throw new Error(`unknown contract map action ${row.action}`);
        const key = row.key === "space" ? 32 : row.key.toUpperCase().charCodeAt(0);
        if (name === "K1" && key === slots[secondary]) continue;
        const actual = actionFor(bindings, key);
        if (actual === undefined || !expected.includes(actual)) failures.add(`${name} ${row.label} key ${row.key}: got ${actual}, expected ${row.action}`);
      }
    }
    const rightAlt = slotIndex(Action.rightTrigger, 1);
    const upgradedRight = slots[rightAlt] === 0 && !slots.includes(71) ? 71 : slots[rightAlt];
    for (let slot = 0; slot < slots.length; slot++) {
      const moved = slot === slotIndex(Action.jump, 0) ? 90 : slot === slotIndex(Action.smashUp, 0) ? 48 : slot === slotIndex(Action.smashDown, 0) ? 74 : slot === rightAlt ? upgradedRight : slots[slot];
      expect(upgraded.keys[slot]).toBe(moved);
    }
  }
  expect([...failures]).toEqual([]);
});
