import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { Effect } from "effect";
import { GROUPS, type Group, landingGroups } from "../scripts/landingChecks";
import { groupInputKey } from "../scripts/landingInputs";
import { type FarmRunner, checksVerdict, landOnFarm, localChecks } from "../scripts/landingFarm";
import { checksFor } from "../scripts/prePush";
import { directoryCache } from "../scripts/prePush";

const CODES = ["ts/src/game/sim/codes.ts"];

test("a landing's farm groups are those its reached checks run in, leaving the Lua parity checks and the frame budgets to main's CI unless a shared root reaches them [k2 property]", () => {
  expect(landingGroups(["docs/ci.md"])).toEqual(["clean-room"]);
  expect(landingGroups(CODES)).toEqual(["boot", "computer-0", "computer-1", "clean-room", "static"]);
  expect(landingGroups(["ts/bun.lock"])).toEqual([...GROUPS]);
  expect(landingGroups(["docs/ci.md"], true)).toEqual([...GROUPS]);
});

test("only the checks that read the private stores stay on the landing machine [k2 property]", () => {
  const names = (paths: readonly string[]) => localChecks(checksFor(paths)).map(({ name }) => name);
  expect(names(["docs/ci.md"])).toEqual([]);
  expect(names(CODES).some((name) => name.startsWith("fighter art reproduces"))).toBe(true);
  expect(names(["build-inputs/a"])).toContain("generated models stored");
  expect(names(["ts/bun.lock"])).not.toContain("clean room");
  expect(names(["ts/bun.lock"])).not.toContain("effect-kit check");
});

test("a failing farm check refuses the landing and a passing one is not rerun on the same tree [k1 scenario]", async () => {
  const cache = directoryCache(mkdtempSync(join(tmpdir(), "landing-farm-test-")));
  const calls: string[] = [];
  const failing: FarmRunner = (_head, _base, groups) => Effect.sync(() => void calls.push(groups.join(","))).pipe(Effect.andThen(Effect.fail(new Error("FAIL parity tapes"))));
  const passing: FarmRunner = (_head, _base, groups) => Effect.sync(() => void calls.push(groups.join(",")));
  const refused = await Effect.runPromise(Effect.flip(landOnFarm("", "HEAD", { farm: failing, cache, listing: () => Effect.succeed("") })));
  expect(refused.message).toBe("FAIL parity tapes");
  await Effect.runPromise(landOnFarm("", "HEAD", { farm: failing, cache, listing: () => Effect.succeed("") }).pipe(Effect.flip));
  expect(calls).toHaveLength(2);
  await Effect.runPromise(landOnFarm("", "HEAD", { farm: passing, cache, listing: () => Effect.succeed("") }));
  await Effect.runPromise(landOnFarm("", "HEAD", { farm: failing, cache, listing: () => Effect.succeed("") }));
  expect(calls).toHaveLength(3);
}, 30000);

test("a farm group is reused while the files its checks read are unchanged, however the rest of main moved [k2 property]", () => {
  const listing = (docs: string, source: string) => `100644 blob ${docs}\tdocs/ci.md\n100644 blob ${source}\tts/src/game/sim/codes.ts\n`;
  const key = (group: Group, text: string) => groupInputKey(group, ["ts/src/game/sim/codes.ts"], text);
  expect(key("parity-0", listing("a", "s"))).toBe(key("parity-0", listing("b", "s")));
  expect(key("parity-0", listing("a", "s"))).not.toBe(key("parity-0", listing("a", "t")));
  expect(key("clean-room", listing("a", "s"))).not.toBe(key("clean-room", listing("b", "s")));
  expect(key("static", listing("a", "s"))).toBe(key("static", listing("b", "s")));
  expect(key("parity-0", listing("a", "s"))).not.toBe(key("parity-1", listing("a", "s")));
});

test("a landing passes once every check job passes, without the merge job, and fails on the first failing check job [k2 property]", () => {
  const jobs = (done: number, last = "success") => GROUPS.map((name, index) => ({ name, status: index < done ? "completed" : "in_progress", conclusion: index < done ? (index === done - 1 ? last : "success") : "" }));
  const state = (done: number, last?: string) => ({ status: "in_progress", conclusion: "", jobs: [{ name: "plan", status: "completed", conclusion: "success" }, ...jobs(done, last), { name: "merge", status: "queued", conclusion: "" }] });
  expect(checksVerdict(state(GROUPS.length - 1))).toBe("pending");
  expect(checksVerdict(state(GROUPS.length))).toBe("passed");
  expect(checksVerdict(state(2, "failure"))).toBe("failed");
  expect(checksVerdict(state(GROUPS.length, "skipped"))).toBe("passed");
  expect(checksVerdict({ status: "completed", conclusion: "cancelled", jobs: [] })).toBe("failed");
  const named = ["corpus", "static"] as const;
  const only = (...states: readonly [string, string][]) => ({ status: "in_progress", conclusion: "", jobs: states.map(([name, conclusion]) => ({ name, status: conclusion === "" ? "in_progress" : "completed", conclusion })) });
  expect(checksVerdict(only(["corpus", "success"], ["static", ""]), named)).toBe("pending");
  expect(checksVerdict(only(["corpus", "success"], ["static", "success"]), named)).toBe("passed");
  expect(checksVerdict(only(["corpus", "success"]), named)).toBe("pending");
  expect(checksVerdict(only(["corpus", "failure"], ["static", ""]), named)).toBe("failed");
});
