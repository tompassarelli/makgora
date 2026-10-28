import { expect, test } from "bun:test";
import { Effect } from "effect";
import { GROUPS, selectGroups } from "../scripts/landingChecks";
import { type FarmChecks, type FarmJob, PrePushRefusal, landingGate } from "../scripts/prePush";
import { tapeShard } from "../scripts/wisp/commands/tapes";

const groups = (paths: readonly string[]) => selectGroups(paths).map(({ group }) => group);

test("a landing selects no farm group for docs, every group for a shared root or gameplay source, and only the parity, corpus and type groups for the tape command [k2 property]", () => {
  expect(groups(["docs/ci.md", "tools/move-data/notes.md"])).toEqual([]);
  for (const root of ["ts/bun.lock", "ts/wisp.lock", "ts/package.json", ".github/workflows/farm-test.yml", "ts/scripts/landingChecks.ts", "unknown"]) expect(groups([root])).toEqual([...GROUPS]);
  expect(groups(["ts/src/game/sim/codes.ts"])).toEqual([...GROUPS]);
  expect(groups(["ts/scripts/wisp/commands/tapes.ts"])).toEqual(["parity-0", "parity-1", "parity-2", "corpus", "types"]);
  expect(selectGroups(["docs/ci.md"], true).map(({ group }) => group)).toEqual([...GROUPS]);
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
const job = (name: string, status: string, conclusion: string): FarmJob => ({ name, status, conclusion, databaseId: name.length });

test("the landing gate refuses on the first failed selected job, cancels the rest of the run and names the job, while an unselected job's failure never counts [k1 scenario]", async () => {
  const cancelled: number[] = [];
  const states = [
    [job("plan", "in_progress", ""), job("corpus", "in_progress", ""), job("types", "in_progress", "")],
    [job("plan", "completed", "success"), job("perf", "completed", "failure"), job("corpus", "completed", "failure"), job("types", "in_progress", "")],
  ];
  const farm: FarmChecks = {
    poll: "1 millis",
    start: () => Effect.succeed({ id: 7, url: "https://example.test/run/7" }),
    state: () => Effect.sync(() => ({ completed: false, jobs: states.shift() ?? [] })),
    cancel: (run) => Effect.sync(() => void cancelled.push(run.id)),
    failedLog: (failed) => Effect.succeed(`${failed.name} log`),
  };
  const refused = await Effect.runPromise(Effect.flip(landingGate(HEAD, ["ts/scripts/wisp/commands/tapes.ts"], farm)));
  expect(refused).toBeInstanceOf(PrePushRefusal);
  expect(refused.problem).toContain("corpus failed on aaaaaaaaaaaa");
  expect(refused.problem).toContain("corpus log");
  expect(refused.problem).not.toContain("perf");
  expect(cancelled).toEqual([7]);
});
