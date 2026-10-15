import { expect, test } from "bun:test";
import { Action } from "../src/game/input/actions";
import { keyFor, presetBindings, slotIndex } from "../src/game/input/keyBindings";
import { Character } from "../src/game/sim/codes";
import { PLAYABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import { SMASHCRAFT_ACCEPT } from "./wisp/acceptChecks";
import { greenGateFailures } from "./wisp/greenBuilds";
import { smokeLines, smokeReceipt } from "./wisp/smokeJudge";
import { rehearseSmoke } from "./wisp/smokeRehearsal";
import { SMOKE_BINDINGS, keyName } from "./wisp/smokeTape";

test("the smoke tape starts every move, the ultimate included, and reaches every standard key for both fighters of a pair [k1 scenario]", () => {
  const verdict = rehearseSmoke(Character.rifleman, Character.demonHunter);
  expect(smokeLines(verdict).filter((line) => !line.startsWith("PASS"))).toEqual([]);
  expect(verdict.results.filter(({ step }) => step === "Ultimate").map(({ pass }) => pass)).toEqual([true, true]);
  expect(smokeReceipt(verdict, 2)).toEndWith("replayed=1 pass=1");
});

test("a key the map no longer binds fails that key and every move pressed with it, and the receipt fails [k1 scenario]", () => {
  const dead = presetBindings("standard");
  const special = keyFor(SMOKE_BINDINGS, Action.special, 0);
  dead.keys[slotIndex(Action.special, 0)] = 0;
  const verdict = rehearseSmoke(Character.rifleman, Character.demonHunter, dead);
  const failed = verdict.results.filter(({ pass }) => !pass);
  expect(failed.filter(({ kind }) => kind === "binding").map(({ step }) => step)).toEqual([`key ${keyName(special ?? 0)}`, `key ${keyName(special ?? 0)}`]);
  expect(failed.some(({ step }) => step === "Neutral special")).toBe(true);
  expect(failed.some(({ step }) => step === "Ultimate")).toBe(true);
  expect(failed.some(({ step }) => step === "Jab")).toBe(false);
  expect(smokeReceipt(verdict, 2)).toEndWith("pass=0");
});

test("the green gate refuses a candidate whose move smoke failed, and the move gate demands the whole roster [k2 property]", () => {
  const declared = SMASHCRAFT_ACCEPT.checks.filter(({ id }) => id.startsWith("gate-")).map(({ id }) => id);
  const results = declared.map((id) => ({ id, verdict: id === "gate-moves" ? "fail" : "pass", reason: "measured" }));
  const failures = greenGateFailures("map", declared, [{ candidateMapSha256: "map", graphicsLook: "classic", results }]);
  expect(failures.map(({ id }) => id)).toContain("gate-moves");
  const gate = SMASHCRAFT_ACCEPT.checks.find(({ id }) => id === "gate-moves");
  const rule = gate?.pass?.find((pass) => pass.kind === "receipt" && "pattern" in pass && pass.pattern.includes("GATE moves"));
  const pattern = new RegExp(rule !== undefined && "pattern" in rule ? rule.pattern : "^$");
  const passing = `SMASHCRAFT GATE moves fighters=${PLAYABLE_CHARACTERS.length} moves=10 started=10 keys=4 live=4 replayed=1 pass=1`;
  expect(pattern.test(passing)).toBe(true);
  expect(pattern.test(passing.replace(`fighters=${PLAYABLE_CHARACTERS.length}`, "fighters=2"))).toBe(false);
  expect(pattern.test(passing.replace("live=4", "live=3"))).toBe(false);
});
