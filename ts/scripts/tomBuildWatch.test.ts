import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { type WatchSteps, watchOnce } from "./tomBuildWatch";
import { playableMapBuild } from "./wisp/currentPlaytest";
import { PREDICT_COST, costPrediction } from "./wisp/greenBuilds";

const sha = (letter: string) => letter.repeat(40);

test("tips landing during a build coalesce into one build of the newest, and no sha builds twice, across restarts and failures [k2 property]", async () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-tom-build-"));
  try {
    const files = { log: join(root, "handoffs/tom-build.log"), attempts: join(root, "state/attempted") };
    let remote = sha("a");
    const built: string[] = [];
    const landing: Record<string, readonly string[]> = { [sha("a")]: [sha("b"), sha("c")] };
    const steps: WatchSteps<never> = {
      tip: Effect.sync(() => remote),
      landedAt: () => Effect.succeed(0),
      retire: () => Effect.succeed([]),
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
