import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Clock, Effect, Schedule, Schema } from "effect";
import { ChildProcess, type ChildProcessSpawner } from "effect/process";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "./hostProcess";
import { installPlaytest } from "./playtestBuild";
import { type LandingDecision, PLAYABLE_FILE, costPrediction, landingDecision, verdictOf } from "./wisp/greenBuilds";
import { writePlaytestChecklist } from "./wisp/playtestChecklist";
import { TOM_EDITION } from "./wisp/currentPlaytest";
import { projectRoot } from "./wisp/project";
import { landedBranches, laneSlug, removeLaneMaps } from "./wisp/laneMaps";
import { documentsFolder } from "wisp/scripts/warcraft/battleNet";
import { PLAYTEST_PREFIX } from "./wisp/commands/play";

export const TOM_BUILD_LOG = join(homedir(), ".local/state/agents/handoffs/tom-build.log");
export const TOM_BUILD_ATTEMPTS = join(homedir(), ".local/state/smashcraft/tom-build/attempted");
const POLL = "30 seconds";
const FIRST_RETIRE_COMMITS = 50;

export interface Installed {
  readonly version: string;
  readonly path: string;
}

export interface WatchSteps<R> {
  readonly tip: Effect.Effect<string, PlayProblem, R>;
  readonly decision: (sha: string) => Effect.Effect<LandingDecision, PlayProblem, R>;
  readonly landedAt: (sha: string) => Effect.Effect<number, PlayProblem, R>;
  readonly build: (sha: string) => Effect.Effect<Installed, PlayProblem, R>;
  readonly notes: (version: string, sha: string, previous: string | undefined) => Effect.Effect<string, PlayProblem, R>;
  readonly retire: (previous: string | undefined, sha: string) => Effect.Effect<readonly string[], PlayProblem, R>;
}

export interface WatchFiles {
  readonly log: string;
  readonly attempts: string;
}

const lines = (path: string) => existsSync(path) ? readFileSync(path, "utf8").split("\n").filter((line) => line !== "") : [];

export const attemptedShas = ({ log, attempts }: WatchFiles): ReadonlySet<string> =>
  new Set([...lines(attempts), ...lines(log).map((line) => line.split(" ")[1] ?? "")].filter((sha) => /^[0-9a-f]{40}$/.test(sha)));

const append = (path: string, line: string) => Effect.try({
  try: () => {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${line}\n`);
  },
  catch: (cause) => new PlayProblem({ problem: `can't write ${path}: ${String(cause)}` }),
});

export const buildLine = (finished: number, sha: string, { version, path }: Installed, buildMillis: number, landToInstalledMillis: number) =>
  `${new Date(finished).toISOString()} ${sha} ${version} ${(buildMillis / 1000).toFixed(1)} ${(landToInstalledMillis / 1000).toFixed(1)} ${path}`;

export const watchOnce = <R>(steps: WatchSteps<R>, files: WatchFiles) => Effect.gen(function*() {
  const sha = yield* steps.tip;
  if (attemptedShas(files).has(sha)) return undefined;
  const decision = yield* steps.decision(sha);
  if (decision === "wait") return undefined;
  yield* append(files.attempts, sha);
  if (decision === "red") return undefined;
  const previous = lines(files.log).at(-1)?.split(" ")[1];
  const started = yield* Clock.currentTimeMillis;
  const installed = yield* steps.build(sha);
  const finished = yield* Clock.currentTimeMillis;
  const landed = yield* steps.landedAt(sha);
  const line = buildLine(finished, sha, installed, finished - started, finished - landed);
  yield* append(files.log, line);
  yield* steps.notes(installed.version, sha, previous).pipe(
    Effect.tap((path) => Effect.sync(() => console.log(`Playtest checklist ${path}`))),
    Effect.catch(({ problem }) => Effect.sync(() => console.error(`Playtest checklist not written: ${problem}`))),
  );
  const retired = yield* steps.retire(previous, sha).pipe(
    Effect.catch(({ problem }) => Effect.sync(() => { console.error(`Lane maps not retired: ${problem}`); return []; })),
  );
  for (const path of retired) console.log(`Removed landed lane map ${path}`);
  return line;
});

export const watch = <R>(steps: WatchSteps<R>, files: WatchFiles) => watchOnce(steps, files).pipe(
  Effect.tap((line) => Effect.sync(() => { if (line !== undefined) console.log(line); })),
  Effect.catch(({ problem }) => Effect.sync(() => console.error(`Tom build failed: ${problem}`))),
  Effect.repeat(Schedule.spaced(POLL)),
);

const git = (...args: readonly string[]) =>
  runProcess(ChildProcess.make("git", args, { cwd: projectRoot, stdin: "ignore" })).pipe(
    Effect.map((text) => text.trim()),
    Effect.mapError((cause) => new PlayProblem({ problem: `git ${args[0]}: ${cause.message}` })),
  );

const CiRuns = Schema.Array(Schema.Struct({ status: Schema.String, conclusion: Schema.String, createdAt: Schema.String }));
const decodeCiRuns = Schema.decodeUnknownEffect(Schema.fromJsonString(CiRuns));

export const hostSteps = (predictCost: boolean): WatchSteps<ChildProcessSpawner.ChildProcessSpawner> => ({
  tip: git("fetch", "-q", "origin", "main").pipe(Effect.andThen(git("rev-parse", "origin/main"))),
  decision: (sha) => runProcess(ChildProcess.make("gh", ["run", "list", "--workflow", "ci.yml", "--commit", sha, "--limit", "20", "--json", "status,conclusion,createdAt"], { cwd: projectRoot, stdin: "ignore" })).pipe(
    Effect.mapError((cause) => new PlayProblem({ problem: `gh run list: ${cause.message}` })),
    Effect.flatMap((text) => decodeCiRuns(text).pipe(Effect.mapError((cause) => new PlayProblem({ problem: cause.message })))),
    Effect.map((runs) => landingDecision(verdictOf(runs))),
  ),
  landedAt: (sha) => git("show", "-s", "--format=%ct", sha).pipe(Effect.map((seconds) => Number(seconds) * 1000)),
  build: (sha) => installPlaytest(sha, predictCost, false, TOM_EDITION, true).pipe(Effect.flatMap(({ file, installed }) => {
    const version = PLAYABLE_FILE.exec(file)?.[1];
    return version === undefined ? Effect.fail(new PlayProblem({ problem: `not a playable map: ${file}` })) : Effect.succeed({ version, path: installed });
  })),
  notes: writePlaytestChecklist,
  retire: (previous, sha) => git("log", "--format=%B", ...(previous === undefined ? ["-n", String(FIRST_RETIRE_COMMITS), sha] : [`${previous}..${sha}`])).pipe(
    Effect.flatMap((messages) => Effect.try({
      try: () => removeLaneMaps(documentsFolder(PLAYTEST_PREFIX), landedBranches(messages).map(laneSlug)),
      catch: (cause) => new PlayProblem({ problem: String(cause) }),
    })),
  ),
});

if (import.meta.main) {
  const { predict, args } = costPrediction(process.argv.slice(2));
  if (args.length > 0) throw new Error("tomBuildWatch takes only --predict-cost");
  BunRuntime.runMain(watch(hostSteps(predict), { log: TOM_BUILD_LOG, attempts: TOM_BUILD_ATTEMPTS }).pipe(Effect.provide(BunServices.layer)));
}
