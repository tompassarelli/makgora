import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { type WatchSteps, budgetProblem, newerTip, watch, watchOnce } from "./tomBuildWatch";
import { playableMapBuild } from "./wisp/currentPlaytest";
import { PLAYTEST_PREFIX } from "./wisp/project";
import { PLAYABLE_FILE, PREDICT_COST, type Verdict, costPrediction, installName, landingDecision, verdictOf } from "./wisp/greenBuilds";

const sha = (letter: string) => letter.repeat(40);

test("a landed tip builds at once with no CI wait, older and unknown shas never roll it back [k1 scenario]", () => {
  const commits = [sha("a"), sha("b"), sha("c"), sha("d")];
  expect(newerTip(commits, undefined)).toBe(sha("a"));
  for (const previous of [sha("b"), sha("d")]) expect(newerTip(commits, previous)).toBe(sha("a"));
  for (const previous of [sha("a"), sha("e")]) expect(newerTip(commits, previous)).toBeUndefined();
  expect(newerTip([], undefined)).toBeUndefined();
});

test("a landing over its build or landing-to-Maps budget is reported, and one within both clears the report [k1 scenario]", async () => {
  expect(budgetProblem(19_000, 300_000)).toBeUndefined();
  expect(budgetProblem(21_000, 300_000)).toBe("build 21.0 s over its 20 s budget");
  expect(budgetProblem(10_000, 361_000)).toBe("landing to Maps 361 s over its 360 s budget");
  const root = mkdtempSync(join(tmpdir(), "smashcraft-tom-budget-"));
  try {
    const files = { log: join(root, "handoffs/tom-build.log"), attempts: join(root, "state/attempted") };
    const reports: (string | undefined)[] = [];
    const steps = (landedAgo: number): WatchSteps<never> => ({
      tip: (previous) => Effect.succeed(previous === sha("a") ? sha("b") : sha("a")),
      decision: () => Effect.succeed("build"),
      landedAt: () => Effect.sync(() => Date.now() - landedAgo),
      notes: () => Effect.succeed("notes.md"),
      budget: (_, problem) => Effect.sync(() => { reports.push(problem); }),
      build: () => Effect.succeed({ version: "Smashcraft 0.1.1 aaaaaaa", path: "Maps/x.w3x" }),
    });
    await Effect.runPromise(watchOnce(steps(600_000), files));
    await Effect.runPromise(watchOnce(steps(1_000), files));
    expect(reports[0]).toMatch(/^landing to Maps 6\d\d s over its 360 s budget$/);
    expect(reports[1]).toBeUndefined();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("tips landing during a build coalesce into one build of the newest, and no sha builds twice, across restarts and failures [k2 property]", async () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-tom-build-"));
  try {
    const files = { log: join(root, "handoffs/tom-build.log"), attempts: join(root, "state/attempted") };
    let remote = sha("a");
    const built: string[] = [];
    const landing: Record<string, readonly string[]> = { [sha("a")]: [sha("b"), sha("c")] };
    const steps: WatchSteps<never> = {
      tip: () => Effect.sync(() => remote),
      decision: () => Effect.succeed("build"),
      landedAt: () => Effect.succeed(0),
      notes: () => Effect.succeed("notes.md"),
      budget: () => Effect.void,
      build: (revision) => Effect.gen(function*() {
        built.push(revision);
        for (const next of landing[revision] ?? []) remote = next;
        if (revision === sha("d")) return yield* new PlayProblem({ problem: "map build failed" });
        return { version: `0.0.${built.length}`, path: join(root, `Smashcraft 0.0.${built.length}.w3x`) };
      }),
    };
    const tick = () => Effect.runPromise(watchOnce(steps, files).pipe(Effect.result));
    for (let i = 0; i < 4; i++) await tick();
    expect(built).toEqual([sha("a"), sha("c")]);
    const logged = readFileSync(files.log, "utf8").trim().split("\n").map((line) => line.split(" "));
    expect(logged.map(([, revision, version]) => [revision, version])).toEqual([[sha("a"), "0.0.1"], [sha("c"), "0.0.2"]]);
    expect(logged.every((fields) => /^\d{4}-\d\d-\d\dT.*Z$/.test(fields[0]!) && fields.length >= 6 && Number(fields[3]) >= 0 && Number(fields[4]) >= Number(fields[3]))).toBe(true);
    remote = sha("d");
    expect((await tick())._tag).toBe("Failure");
    for (const revision of [sha("d"), sha("a"), sha("c")]) {
      remote = revision;
      await tick();
    }
    expect(built).toEqual([sha("a"), sha("c"), sha("d")]);
    expect(readFileSync(files.log, "utf8").trim().split("\n")).toHaveLength(2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the Tom-facing playable build omits the Lua cost prediction unless --predict-cost asks for it [k2 property]", () => {
  const plain = playableMapBuild("Smashcraft 0.0.9", "/out/Smashcraft 0.0.9.w3x");
  const predicted = playableMapBuild("Smashcraft 0.0.9", "/out/Smashcraft 0.0.9.w3x", true);
  expect(costPrediction(plain)).toEqual({ predict: false, args: plain });
  expect(costPrediction(predicted)).toEqual({ predict: true, args: plain });
  expect(plain).not.toContain(PREDICT_COST);
  expect(plain.slice(0, 6)).toEqual(["bun", "wisp", "map", "build", "--profile", "playable"]);
});

test("a red commit is never built, a pending one waits and builds once its run succeeds, and installs go only to Tom's profile [k2 property]", async () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-tom-build-"));
  try {
    const files = { log: join(root, "tom-build.log"), attempts: join(root, "attempted") };
    let verdict: Verdict = "failure";
    const built: string[] = [];
    const noted: string[] = [];
    let current = sha("a");
    const steps: WatchSteps<never> = {
      tip: () => Effect.sync(() => current),
      decision: () => Effect.succeed(landingDecision(verdict)),
      landedAt: () => Effect.succeed(0),
      notes: (version, revision, previous) => Effect.sync(() => { noted.push(`${version} ${revision} ${previous}`); return "notes.md"; }),
      budget: () => Effect.void,
      build: (revision) => Effect.sync(() => { built.push(revision); return { version: "0.0.1", path: join(root, "Smashcraft 0.0.1 aaaaaaa.w3x") }; }),
    };
    const tick = () => Effect.runPromise(watchOnce(steps, files));
    await tick();
    expect(built).toEqual([]);
    verdict = "success";
    await tick();
    expect(built).toEqual([]);
    verdict = "pending";
    current = sha("b");
    await tick();
    expect(built).toEqual([]);
    verdict = "success";
    await tick();
    expect(built).toEqual([sha("b")]);
    expect(noted).toEqual([`0.0.1 ${sha("b")} undefined`]);
    expect(PLAYTEST_PREFIX).not.toContain("clone-a");
    expect(PLAYTEST_PREFIX).toContain("compatdata/3516115571");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("only a succeeded CI run is green; a failed one is red and anything else waits [k2 property]", () => {
  const run = (status: string, conclusion: string, createdAt: string) => ({ status, conclusion, createdAt });
  expect(landingDecision(verdictOf([]))).toBe("wait");
  expect(landingDecision(verdictOf([run("in_progress", "", "2")]))).toBe("wait");
  expect(landingDecision(verdictOf([run("completed", "failure", "1"), run("completed", "success", "2")]))).toBe("build");
  expect(landingDecision(verdictOf([run("completed", "success", "1"), run("completed", "failure", "2")]))).toBe("red");
});

test("Tom's playable build names the map with the short commit [k2 property]", () => {
  expect(installName("0.0.263", sha("a"))).toBe("Smashcraft 0.0.263 aaaaaaa");
  expect(PLAYABLE_FILE.test(`${installName("0.0.263", sha("a"))}.w3x`)).toBe(true);
});

test("the watcher keeps polling while it runs main's tip and returns, unbuilt, once origin/main moves past it [k2 property]", async () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-tom-build-"));
  try {
    const files = { log: join(root, "tom-build.log"), attempts: join(root, "attempted") };
    const built: string[] = [];
    let remote = sha("a");
    const steps: WatchSteps<never> = {
      tip: () => Effect.sync(() => remote),
      decision: () => Effect.succeed("build"),
      landedAt: () => Effect.succeed(0),
      notes: () => Effect.succeed("notes.md"),
      budget: () => Effect.void,
      build: (revision) => Effect.sync(() => { built.push(revision); return { version: "0.1.1 aaaaaaa", path: join(root, "Smashcraft 0.1.1 aaaaaaa.w3x") }; }),
    };
    const checks: boolean[] = [];
    const current = (answers: boolean[]) => Effect.sync(() => { const answer = answers.shift() ?? false; checks.push(answer); return answer; });
    await Effect.runPromise(watch(steps, files, current([false]), 0));
    expect(built).toEqual([]);
    await Effect.runPromise(watch(steps, files, current([true, true, false]), 0));
    expect(built).toEqual([sha("a")]);
    remote = sha("b");
    await Effect.runPromise(watch(steps, files, current([false]), 0));
    expect(built).toEqual([sha("a")]);
    expect(checks).toEqual([false, true, true, false, false]);
    expect(readFileSync(files.log, "utf8").trim().split(" ").slice(1, 3)).toEqual([sha("a"), "0.1.1-aaaaaaa"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
