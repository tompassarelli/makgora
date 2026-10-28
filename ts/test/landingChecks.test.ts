import { expect, test } from "bun:test";
import { Effect } from "effect";
import { CHECKS, GROUPS, landingSelection, selectGroups } from "../scripts/landingChecks";
import { type GateRunner, PrePushRefusal, landingGate } from "../scripts/prePush";
import { tapeShard } from "../scripts/wisp/commands/tapes";

const groups = (paths: readonly string[]) => selectGroups(paths).map(({ group }) => group);
const before = (paths: readonly string[], full = false) => landingSelection(paths, full).run.map(({ check }) => check.name);
const after = (paths: readonly string[]) => landingSelection(paths).afterLanding.map(({ check }) => check.name);
const HERE = CHECKS.filter(({ here }) => here !== undefined).map(({ name }) => name);
const PERF = "four-fighter p99 <= 10 ms and worst <= 14 ms in Classic";
const ROLLBACK = "four-fighter 7-frame rollback p99 <= 10 ms and worst <= 14 ms";

test("a landing runs no check for docs, every check for a shared root or the full suite, and for gameplay source the frame budgets, parity and computer checks [k2 property]", () => {
  expect(before(["docs/ci.md", "tools/move-data/notes.md"])).toEqual([]);
  for (const root of ["ts/bun.lock", "ts/wisp.lock", "ts/package.json", ".github/workflows/farm-test.yml", "ts/scripts/landingChecks.ts", "ts/scripts/landingRun.ts", "unknown"]) {
    expect(before([root])).toEqual(HERE);
    expect(groups([root])).toEqual([...GROUPS]);
  }
  expect(before(["docs/ci.md"], true)).toEqual(HERE);
  expect(before(["ts/src/game/sim/codes.ts"])).toEqual([PERF, ROLLBACK, "parity tapes", "parity numeric", "stack-trace profile TypeScript frames", "every selectable computer fighter is active"]);
  expect(after(["ts/src/game/sim/codes.ts"])).toEqual([]);
  expect(groups(["ts/src/game/sim/codes.ts"])).toEqual(["perf", "rollback", "parity-0", "parity-1", "parity-2", "corpus"]);
  expect(before(["ts/scripts/wisp/commands/tapes.ts"])).toEqual(["parity tapes", "parity numeric", "stack-trace profile TypeScript frames"]);
  expect(before(["ts/test/corpus/2026-10-08T08-30-47-695Z/a/smashcraft-replay-39.txt"])).toEqual(["parity corpus: every native recording replays headless with 0 divergent frames"]);
  expect(before(["ts/src/game/core/gameFiles.ts"])).toContain("type-check edit loop and dependency validation");
  expect(before(["ts/src/host/loop/diagnostics.ts"])).toContain("compiler affected-module and output-equivalence checks");
});

test("the tape shards split every tape into exactly one part, each within one tape of an even share [k2 property]", () => {
  const tapes = Array.from({ length: 46 }, (_, index) => ({ name: `tape-${index}`, text: "x".repeat(270 + ((index * 7919) % 3700)) }));
  const parts = [0, 1, 2].map((index) => tapeShard(tapes, { index, count: 3 }));
  expect(parts.flat().map(({ name }) => name).toSorted()).toEqual(tapes.map(({ name }) => name).toSorted());
  const lengths = parts.map((part) => part.reduce((sum, { text }) => sum + text.length, 0));
  const longest = Math.max(...tapes.map(({ text }) => text.length));
  expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(longest);
});

const HEAD = "a".repeat(40);

test("the landing gate runs the beside checks with the local checks, each tree-editing check alone afterwards, and refuses with the failing check's output [k1 scenario]", async () => {
  const calls: string[][] = [];
  const passing: GateRunner = (checks) => Effect.sync(() => {
    calls.push(checks.map(({ name }) => name));
    return { exitCode: 0, stdout: "", stderr: checks.map(({ name }) => `landing check: ${name} passed (1.0 s)`).join("\n") };
  });
  const local = Effect.sync(() => void calls.push(["local"]));
  await Effect.runPromise(landingGate(HEAD, ["ts/bun.lock"], local, passing));
  const alone = CHECKS.filter(({ here }) => here === "alone").map(({ name }) => [name]);
  expect(calls.slice(-alone.length)).toEqual(alone);
  expect(calls.slice(0, 2).flat()).toContain("local");
  expect(calls.slice(0, 2).flat()).toContain("parity tapes");

  const failing: GateRunner = (checks) => Effect.succeed(checks.some(({ name }) => name === "parity tapes")
    ? { exitCode: 1, stdout: "", stderr: "bun/ts-lua32: 3 divergent frames\nlanding check: parity tapes exited 1 (2.0 s)" }
    : { exitCode: 0, stdout: "", stderr: "" });
  const refused = await Effect.runPromise(Effect.flip(landingGate(HEAD, ["ts/src/game/sim/codes.ts"], Effect.void, failing)));
  expect(refused).toBeInstanceOf(PrePushRefusal);
  expect(refused.problem).toContain("3 divergent frames");
  expect(refused.problem).toContain("a landing check failed on aaaaaaaaaaaa");

  const localRefusal = new PrePushRefusal({ problem: "pre-push: clean room failed" });
  const refusedLocally = await Effect.runPromise(Effect.flip(landingGate(HEAD, ["ts/src/game/sim/codes.ts"], Effect.fail(localRefusal), passing)));
  expect(refusedLocally.problem).toBe("pre-push: clean room failed");
});
