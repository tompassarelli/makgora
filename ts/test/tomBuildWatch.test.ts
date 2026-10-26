import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { type WatchFiles, type WatchSteps, attemptedShas, watchOnce } from "../scripts/tomBuildWatch";
import { FETCH_HINT } from "../scripts/wisp/buildInputs";

const SHA = "1e47721".padEnd(40, "0");
const unstored = new PlayProblem({ problem: `find build input failed for store/impact-assets/abc: impact-assets abc is not in the store; ${FETCH_HINT}` });

const landing = (fetchStores: boolean) => {
  let stored = false;
  const calls: string[] = [];
  const steps: WatchSteps<never> = {
    tip: () => Effect.succeed(SHA),
    decision: () => Effect.succeed("build"),
    landedAt: () => Effect.succeed(0),
    onMain: () => Effect.succeed(undefined),
    measured: (work) => work.pipe(Effect.map((value) => [value, { pressure: 0, clients: 0 }] as const)),
    held: Effect.succeed(undefined),
    build: () => Effect.suspend(() => {
      calls.push("build");
      return stored ? Effect.succeed({ version: "0.1.0-main", source: "map.w3x", stages: [] }) : Effect.fail(unstored);
    }),
    fetchInputs: Effect.suspend(() => {
      calls.push("fetch");
      stored = fetchStores;
      return fetchStores ? Effect.void : Effect.fail(new PlayProblem({ problem: "no host of gex45 stores these" }));
    }),
    install: ({ version }) => Effect.succeed({ version, path: "Maps/00-Smashcraft/map.w3x" }),
    notes: () => Effect.succeed("checklist.md"),
    budget: () => Effect.void,
  };
  return { steps, calls };
};

const run = (fetchStores: boolean) => {
  const directory = mkdtempSync(join(tmpdir(), "tom-build-"));
  const files: WatchFiles = { log: join(directory, "tom-build.log"), attempts: join(directory, "attempted") };
  const { steps, calls } = landing(fetchStores);
  const outcome = Effect.runSync(watchOnce(steps, files).pipe(Effect.result));
  const attempted = attemptedShas(files).has(SHA);
  rmSync(directory, { recursive: true });
  return { outcome, calls, attempted };
};

describe("tom build watcher", () => {
  test("a landing whose pinned input another host stored is fetched, then built and installed once [k1 scenario]", () => {
    const { outcome, calls, attempted } = run(true);
    expect(calls).toEqual(["build", "fetch", "build"]);
    expect(outcome._tag).toBe("Success");
    expect(attempted).toBe(true);
  });

  test("a landing whose input no store host has fails as before and stays unattempted for the next poll [k1 scenario]", () => {
    const { outcome, calls, attempted } = run(false);
    expect(calls).toEqual(["build", "fetch"]);
    expect(outcome._tag === "Failure" && outcome.failure.problem).toBe(unstored.problem);
    expect(attempted).toBe(false);
  });
});
