import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Schema } from "effect";
import { CONTROLLER_CONTRACT_PATH, controllerContractText } from "../codegen/controllerContract";
import { Action } from "../src/game/input/actions";
import { actionFor, decodeBindings, presetBindings, slotIndex } from "../src/game/input/keyBindings";

const Rows = Schema.Array(Schema.Struct({ key: Schema.String, action: Schema.String, label: Schema.String }));
const contract = Schema.decodeUnknownSync(Schema.Struct({ actions: Schema.Array(Schema.Struct({ name: Schema.String, bit: Schema.Number })) }))(JSON.parse(readFileSync(CONTROLLER_CONTRACT_PATH, "utf8")));
const shield: readonly Action[] = [Action.leftTrigger, Action.rightTrigger];
const actionsOf = (name: string): readonly number[] | undefined => {
  if (name === "shield") return shield;
  const action = contract.actions.find((entry) => entry.name === name);
  return action === undefined ? undefined : [action.bit];
};

test("contracts/controller.json is the controller contract the TS sources produce [k5 boundary controller-contract]", () => {
  expect(JSON.parse(readFileSync(CONTROLLER_CONTRACT_PATH, "utf8"))).toEqual(JSON.parse(controllerContractText()));
});

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
        const expected = actionsOf(row.action);
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
      const moved = slot === slotIndex(Action.jump, 0) ? 90 : slot === rightAlt ? upgradedRight : slots[slot];
      expect(upgraded.keys[slot]).toBe(moved);
    }
  }
  expect([...failures]).toEqual([]);
});
