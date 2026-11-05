import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Deferred, Effect, Exit, Fiber } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { type WatchFiles, type WatchSteps, attemptedShas, watchOnce } from "../scripts/tomBuildWatch";
import { FETCH_HINT } from "../scripts/wisp/buildInputs";
import { KILLED_HINT, preparationFailure } from "../scripts/wisp/currentPlaytest";

const SHA = "1e47721".padEnd(40, "0");
const unstored = new PlayProblem({ problem: `find build input failed for store/impact-assets/abc: impact-assets abc is not in the store; ${FETCH_HINT}` });


const landing = (fetchStores: boolean, failure: PlayProblem = unstored) => {
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
      return stored ? Effect.succeed({ version: "0.1.0-main", source: "map.w3x", stages: [] }) : Effect.fail(failure);
    }),
    prepareBoot: Effect.void,
    boot: () => Effect.succeed(undefined),
    tidy: Effect.succeed(undefined),
    fetchInputs: Effect.suspend(() => {
      calls.push("fetch");
      stored = fetchStores;
      return fetchStores ? Effect.succeed(true) : Effect.fail(new PlayProblem({ problem: "no host of gex45 stores these" }));
    }),
    install: ({ version }, _held) => Effect.succeed({ version, path: "Maps/00-Makgora/map.w3x" }),
    notes: () => Effect.succeed("checklist.md"),
    windowLibrary: () => Effect.void,
    budget: () => Effect.void,
  };
  return { steps, calls };
};

const run = (fetchStores: boolean, failure: PlayProblem = unstored) => {
  const directory = mkdtempSync(join(tmpdir(), "tom-build-"));
  const files: WatchFiles = { log: join(directory, "tom-build.log"), attempts: join(directory, "attempted"), refused: join(directory, "tom-build-refused.log") };
  const { steps, calls } = landing(fetchStores, failure);
  const outcome = Effect.runSync(watchOnce(steps, files).pipe(Effect.result));
  const attempted = attemptedShas(files).has(SHA);
  rmSync(directory, { recursive: true });
  return { outcome, calls, attempted };
};

describe("tom build watcher", () => {

  test("a build interrupted mid-flight is forgotten, so the next poll builds the same sha [k1 scenario]", async () => {
    const directory = mkdtempSync(join(tmpdir(), "tom-build-"));
    const files: WatchFiles = { log: join(directory, "tom-build.log"), attempts: join(directory, "attempted"), refused: join(directory, "tom-build-refused.log") };
    const calls: string[] = [];
    try {
      const building = await Effect.runPromise(Deferred.make<void>());
      const interrupted: WatchSteps<never> = {
        ...landing(true).steps,
        fetchInputs: Effect.succeed(false),
        build: () => Effect.gen(function*() {
          calls.push("build");
          yield* Deferred.succeed(building, undefined);
          return yield* Effect.never;
        }),
      };
      const exit = await Effect.runPromise(Effect.gen(function*() {
        const fiber = yield* Effect.forkChild(watchOnce(interrupted, files));
        yield* Deferred.await(building);
        expect(attemptedShas(files).has(SHA)).toBe(true);
        yield* Fiber.interrupt(fiber);
        return yield* Fiber.await(fiber);
      }));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(attemptedShas(files).has(SHA)).toBe(false);
      const next: WatchSteps<never> = {
        ...landing(true).steps,
        fetchInputs: Effect.succeed(false),
        build: () => Effect.sync(() => (calls.push("build"), { version: "0.1.0-main", source: "map.w3x", stages: [] })),
      };
      const outcome = Effect.runSync(watchOnce(next, files).pipe(Effect.result));
      expect(calls).toEqual(["build", "build"]);
      expect(outcome._tag === "Success" && outcome.success).toContain(SHA);
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  test("a build whose process a signal killed stays unattempted for the next poll [k1 scenario]", () => {
    const failure = preparationFailure("bun", "bun run build exited 130");
    expect(failure.problem).toContain(KILLED_HINT);
    const { outcome, attempted } = run(false, failure);
    expect(outcome._tag).toBe("Failure");
    expect(attempted).toBe(false);
  });
});
