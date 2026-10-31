import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { type WatchFiles, type WatchSteps, attemptedShas, installBuild, tidyFolder, watchOnce } from "../scripts/tomBuildWatch";
import { FETCH_HINT } from "../scripts/wisp/buildInputs";
import { preparationFailure } from "../scripts/wisp/currentPlaytest";
import { library } from "../scripts/wisp/mapLibrary";

const SHA = "1e47721".padEnd(40, "0");
const unstored = new PlayProblem({ problem: `find build input failed for store/impact-assets/abc: impact-assets abc is not in the store; ${FETCH_HINT}` });

const innerStderr = `error: find build input failed for store/illidan-animation: illidan-animation bc5927 is not in the store; ${FETCH_HINT}, else regenerate\n    at build`;
const outer = preparationFailure("bun", `bun run build exited 1: ${innerStderr}`);

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
    install: ({ version }, _held) => Effect.succeed({ version, path: "Maps/00-Smashcraft/map.w3x" }),
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
  test("a landing whose pinned input another host stored is fetched, then built and installed once [k1 scenario]", () => {
    const { outcome, calls, attempted } = run(true);
    expect(calls).toEqual(["fetch", "build"]);
    expect(outcome._tag).toBe("Success");
    expect(outcome._tag === "Success" && outcome.success).toContain("inputs-fetch=0.0,boot=0.0,maps-copy=0.0");
    expect(attempted).toBe(true);
  });

  test("a landing whose input no store host has fails as before and stays unattempted for the next poll [k1 scenario]", () => {
    const { outcome, calls, attempted } = run(false);
    expect(calls).toEqual(["fetch", "build"]);
    expect(outcome._tag === "Failure" && outcome.failure.problem).toBe(unstored.problem);
    expect(attempted).toBe(false);
  });

  test("while a client runs, a new tip still builds and its file appears beside the untouched older builds, and the tidy into old/ waits until the client closes [k1 scenario]", () => {
    const directory = mkdtempSync(join(tmpdir(), "tom-build-"));
    const documents = join(directory, "documents");
    const root = library(documents);
    mkdirSync(root, { recursive: true });
    const older = ["Smashcraft 0.1.3.w3x", "Smashcraft 0.1.4.w3x", "Smashcraft 0.1.5-dev.823.w3x"];
    for (const file of older) writeFileSync(join(root, file), file);
    const source = join(directory, "Smashcraft 0.1.5-dev.824.w3x");
    writeFileSync(source, "next");
    let running: string | undefined = "Warcraft III is running in Tom's prefix (pid 42)";
    const client = Effect.sync(() => running);
    const files: WatchFiles = { log: join(directory, "tom-build.log"), attempts: join(directory, "attempted"), refused: join(directory, "tom-build-refused.log") };
    const steps: WatchSteps<never> = {
      ...landing(true).steps,
      held: client,
      build: () => Effect.succeed({ version: "0.1.5-dev.824", source, stages: [] }),
      install: installBuild(documents),
      tidy: tidyFolder(documents, client),
    };
    const names = () => readdirSync(root).filter((entry) => entry.endsWith(".w3x")).sort();
    try {
      expect(Effect.runSync(watchOnce(steps, files).pipe(Effect.result))._tag).toBe("Success");
      expect(names()).toEqual([...older, "Smashcraft 0.1.5-dev.824.w3x"].sort());
      expect(older.every((file) => readFileSync(join(root, file), "utf8") === file)).toBe(true);
      expect(Effect.runSync(steps.tidy)).toContain("waits: Warcraft III is running");
      expect(names()).toHaveLength(4);
      running = undefined;
      expect(Effect.runSync(steps.tidy)).toContain("Tidied");
      expect(names()).toEqual(["Smashcraft 0.1.4.w3x", "Smashcraft 0.1.5-dev.824.w3x"]);
      expect(existsSync(join(root, "old", "Smashcraft 0.1.3.w3x"))).toBe(true);
      expect(Effect.runSync(steps.tidy)).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  test("the outer bun-failed error carries the child's missing-input line so a sha whose inputs no host had is forgotten for the next poll [k1 scenario]", () => {
    expect(outer.problem).toContain(FETCH_HINT);
    const { outcome, calls, attempted } = run(false, outer);
    expect(calls).toEqual(["fetch", "build"]);
    expect(outcome._tag === "Failure" && outcome.failure.problem).toBe(outer.problem);
    expect(attempted).toBe(false);
  });

  test("a landing that pins nothing new builds once with no inputs-fetch stage in its line [k1 scenario]", () => {
    const directory = mkdtempSync(join(tmpdir(), "tom-build-"));
    const files: WatchFiles = { log: join(directory, "tom-build.log"), attempts: join(directory, "attempted"), refused: join(directory, "tom-build-refused.log") };
    const calls: string[] = [];
    const steps: WatchSteps<never> = {
      ...landing(true).steps,
      fetchInputs: Effect.sync(() => (calls.push("fetch"), false)),
      build: () => Effect.sync(() => (calls.push("build"), { version: "0.1.0-main", source: "map.w3x", stages: [] })),
    };
    try {
      const outcome = Effect.runSync(watchOnce(steps, files).pipe(Effect.result));
      expect(calls).toEqual(["fetch", "build"]);
      expect(outcome._tag === "Success" && outcome.success).not.toContain("inputs-fetch");
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  test("an outer error from a non-input failure stays recorded as attempted even when the fetch before it failed [k1 scenario]", () => {
    const failure = preparationFailure("bun", "bun run build exited 1: error: type check failed");
    const { outcome, calls, attempted } = run(false, failure);
    expect(calls).toEqual(["fetch", "build"]);
    expect(outcome._tag).toBe("Failure");
    expect(attempted).toBe(true);
  });

  test("a built map that does not boot keeps the installed build, writes no build line and logs why it was refused [k1 scenario]", () => {
    const directory = mkdtempSync(join(tmpdir(), "tom-build-"));
    const files: WatchFiles = { log: join(directory, "tom-build.log"), attempts: join(directory, "attempted"), refused: join(directory, "tom-build-refused.log") };
    let installed = false;
    const steps: WatchSteps<never> = {
      ...landing(true).steps,
      build: () => Effect.succeed({ version: "0.3-dev.460", source: "map.w3x", stages: [] }),
      boot: () => Effect.succeed("map.w3x does not reach character select: problem the map threw before character select settled"),
      install: ({ version }) => Effect.sync(() => { installed = true; return { version, path: "Maps/00-Smashcraft/map.w3x" }; }),
    };
    try {
      const outcome = Effect.runSync(watchOnce(steps, files).pipe(Effect.result));
      expect(outcome._tag === "Success" && outcome.success).toBeUndefined();
      expect(installed).toBe(false);
      expect(existsSync(files.log)).toBe(false);
      expect(attemptedShas(files).has(SHA)).toBe(true);
      expect(readFileSync(files.refused, "utf8")).toMatch(new RegExp(`^\\S+ ${SHA} 0.3-dev.460 map.w3x does not reach character select: problem the map threw`));
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
});
