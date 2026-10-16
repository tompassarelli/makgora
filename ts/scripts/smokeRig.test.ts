import { expect, test } from "bun:test";
import { Action } from "../src/game/input/actions";
import { keyFor, presetBindings, slotIndex } from "../src/game/input/keyBindings";
import { Character } from "../src/game/sim/codes";
import { PLAYABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import { SMASHCRAFT_ACCEPT } from "./wisp/acceptChecks";
import { GREEN_GATE_CHECKS, greenGateFailures } from "./wisp/greenBuilds";
import { FREEZE_FRAMES, freezeInvalid, judgeSmoke, smokeLines, smokePace, smokeReceipt } from "./wisp/smokeJudge";
import { rehearsal, rehearseSmoke, smokeApproaches } from "./wisp/smokeRehearsal";
import { SMOKE_BINDINGS, bindingSweep, keyName, smokeSchedule, tapeFrames, xdotoolArgs } from "./wisp/smokeTape";
import { type Settle, specialsReceipt, specialsSpot } from "./wisp/specialsSpot";

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
  expect(freezeInvalid(verdict)).toEqual([]);
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

test("every check the green install requires is declared, so no undeclared gate blocks every install [k2 property]", () => {
  const declared = new Set(SMASHCRAFT_ACCEPT.checks.map(({ id }) => id));
  expect(GREEN_GATE_CHECKS.filter((id) => !declared.has(id))).toEqual([]);
});

test("a special whose effect is still drawn at the next rest fails the spot check, within the rest-to-rest noise [k2 property]", () => {
  const rest = (step: string, count: number, special = false): Settle => ({ step, special, count, onTime: true });
  const moves = [rest("Jab", 100), rest("Grab", 140), rest("Neutral special", 120, true), rest("Side special", 230, true), rest("rest", 900)];
  const results = specialsSpot([moves, [rest("Ultimate", 150, true), rest("rest", 140)]], 10_000);
  expect(results.map(({ step, pass }) => [step, pass])).toEqual([["Neutral special", true], ["Side special", false], ["Ultimate", true]]);
  expect(specialsReceipt(2, results)).toBe("SMASHCRAFT GATE specials fighters=2 checked=3 clear=2 pass=0");
  expect(specialsSpot([[{ ...rest("Neutral special", 120, true), onTime: false }, rest("rest", 120)]], 10_000).map(({ pass }) => pass)).toEqual([false]);
  const gate = SMASHCRAFT_ACCEPT.checks.find(({ id }) => id === "gate-specials-spot");
  const rule = gate?.pass?.find((pass) => pass.kind === "receipt" && "pattern" in pass && pass.pattern.includes("GATE specials"));
  const pattern = new RegExp(rule !== undefined && "pattern" in rule ? rule.pattern : "^$");
  expect(pattern.test(specialsReceipt(PLAYABLE_CHARACTERS.length, results.slice(0, 1)))).toBe(true);
  expect(pattern.test(specialsReceipt(PLAYABLE_CHARACTERS.length, results))).toBe(false);
  expect(pattern.test(specialsReceipt(PLAYABLE_CHARACTERS.length, []))).toBe(false);
});

test("a native client stepping slower than the wall clock still starts every move, and the rig measures that pace from the replay and stretches its keys to match, sending every key edge without xdotool's own delay [k1 scenario]", () => {
  const pace = 59.5 / 60;
  const schedule = smokeSchedule(smokeApproaches(Character.rifleman, Character.demonHunter));
  const paced = rehearsal(Character.rifleman, Character.demonHunter, SMOKE_BINDINGS, schedule, pace);
  expect(smokeLines(judgeSmoke(paced.lines, schedule.flat())).filter((line) => !line.startsWith("PASS"))).toEqual([]);
  expect(Math.abs((smokePace(paced.lines, judgeSmoke(paced.lines, schedule.flat())) ?? 0) - pace)).toBeLessThan(0.005);
  const sweep = bindingSweep();
  const args = xdotoolArgs(sweep, pace);
  const slept = (list: readonly string[]) => list.reduce((total, arg, index) => (list[index - 1] === "sleep" ? total + Number(arg) : total), 0);
  expect(Math.abs(slept(args) - slept(xdotoolArgs(sweep)) / pace)).toBeLessThan(0.05);
  const edges = args.flatMap((arg, index) => (arg === "keydown" || arg === "keyup" ? [args.slice(index + 1, index + 3).join(" ")] : []));
  expect(edges.length).toBe(2 * sweep.length);
  expect(edges.every((edge) => edge === "--delay 0")).toBe(true);
});

test("a client freeze that swallows a special's keys fails that special as invalid for the rerun, the steps after it are still judged on their own keys, and the match's pace is not trusted [k1 scenario]", () => {
  const schedule = smokeSchedule(smokeApproaches(Character.rifleman, Character.demonHunter));
  const steps = schedule[1]?.[0]?.steps ?? [];
  const away = steps.findIndex(({ name }) => name === "Side special away");
  const lost = 110;
  const paced = rehearsal(Character.rifleman, Character.demonHunter, SMOKE_BINDINGS, schedule, 1, { segment: 1, at: tapeFrames(steps.slice(0, away)) + 70, frames: lost });
  const verdict = judgeSmoke(paced.lines, schedule.flat());
  const failed = verdict.results.filter(({ pass }) => !pass);
  expect(failed.map(({ step }) => step)).toEqual(["Side special away", "Side special away"]);
  expect(failed.every((result) => (result.lost ?? 0) > FREEZE_FRAMES)).toBe(true);
  expect(verdict.results.filter(({ step }) => step === "Up special" || step === "Ultimate").every(({ pass }) => pass)).toBe(true);
  expect(freezeInvalid(verdict)).toHaveLength(2);
  expect(freezeInvalid(verdict, ["Side special away"])).toHaveLength(4);
  expect(smokePace(paced.lines, verdict)).toBeUndefined();
  const keys = bindingSweep();
  const sweepOnly = schedule.slice(0, 1);
  const swallowed = rehearsal(Character.rifleman, Character.demonHunter, SMOKE_BINDINGS, sweepOnly, 1, { segment: 0, at: tapeFrames(keys.slice(0, 10)) + 2, frames: 20 });
  expect(smokePace(swallowed.lines, judgeSmoke(swallowed.lines, sweepOnly.flat()))).toBeUndefined();
});

test("a match played with stage hazards on fails its setup, so a hazard that interrupts a move never passes for the game's own failure [k1 scenario]", () => {
  const schedule = smokeSchedule(smokeApproaches(Character.rifleman, Character.demonHunter)).slice(0, 1);
  const on = judgeSmoke(rehearsal(Character.rifleman, Character.demonHunter, SMOKE_BINDINGS, schedule, 1, undefined, true).lines, schedule.flat());
  expect(on.results.filter(({ pass }) => !pass).map(({ step }) => step)).toEqual(["stage hazards off"]);
  expect(smokeReceipt(on, 2)).toEndWith("pass=0");
  const off = judgeSmoke(rehearsal(Character.rifleman, Character.demonHunter, SMOKE_BINDINGS, schedule).lines, schedule.flat());
  expect(off.results.find(({ step }) => step === "stage hazards off")?.pass).toBe(true);
});
