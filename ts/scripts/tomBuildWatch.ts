import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Clock, type Duration, Effect } from "effect";
import { ChildProcess, type ChildProcessSpawner } from "effect/process";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "./hostProcess";
import { type LandingDecision, buildLabel, costPrediction } from "./wisp/greenBuilds";
import { writePlaytestChecklist } from "./wisp/playtestChecklist";
import { TOM_EDITION, currentPlaytest } from "./wisp/currentPlaytest";
import { installLatest, library } from "./wisp/mapLibrary";
import { PLAYTEST_PREFIX, projectRoot } from "./wisp/project";
import { clientHold } from "./wisp/runningGames";
import { documentsFolder } from "wisp/scripts/warcraft/battleNet";

export const TOM_BUILD_LOG = join(homedir(), ".local/state/agents/handoffs/tom-build.log");
export const TOM_BUILD_ATTEMPTS = join(homedir(), ".local/state/smashcraft/tom-build/attempted");
const POLL = "10 seconds";
export const BUILD_BUDGET_SECONDS = 20;
export const LAND_TO_MAPS_BUDGET_SECONDS = 360;
export const SPEED_BUDGET_TITLE = "Speed budget: a landing took too long to reach Tom's Maps folder";

export const budgetProblem = (buildMillis: number, landToInstalledMillis: number): string | undefined => {
  const over = [
    buildMillis > BUILD_BUDGET_SECONDS * 1000 ? `build ${(buildMillis / 1000).toFixed(1)} s over its ${BUILD_BUDGET_SECONDS} s budget` : undefined,
    landToInstalledMillis > LAND_TO_MAPS_BUDGET_SECONDS * 1000 ? `landing to Maps ${(landToInstalledMillis / 1000).toFixed(0)} s over its ${LAND_TO_MAPS_BUDGET_SECONDS} s budget` : undefined,
  ].filter((problem) => problem !== undefined);
  return over.length === 0 ? undefined : over.join("; ");
};

export interface Built {
  readonly version: string;
  readonly source: string;
}

export interface Installed {
  readonly version: string;
  readonly path: string;
}

export interface WatchSteps<R> {
  readonly tip: (previous: string | undefined) => Effect.Effect<string | undefined, PlayProblem, R>;
  readonly decision: (sha: string) => Effect.Effect<LandingDecision, PlayProblem, R>;
  readonly landedAt: (sha: string) => Effect.Effect<number, PlayProblem, R>;
  readonly held: Effect.Effect<string | undefined, PlayProblem, R>;
  readonly build: (sha: string) => Effect.Effect<Built, PlayProblem, R>;
  readonly install: (built: Built) => Effect.Effect<Installed, PlayProblem, R>;
  readonly notes: (version: string, sha: string, previous: string | undefined) => Effect.Effect<string, PlayProblem, R>;
  readonly budget: (sha: string, problem: string | undefined) => Effect.Effect<void, never, R>;
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

const forget = (path: string, sha: string) => Effect.try({
  try: () => writeFileSync(path, lines(path).filter((line) => line !== sha).map((line) => `${line}\n`).join("")),
  catch: (cause) => new PlayProblem({ problem: `can't write ${path}: ${String(cause)}` }),
});

export const buildLine = (finished: number, sha: string, { version, path }: Installed, buildMillis: number, landToInstalledMillis: number) =>
  `${new Date(finished).toISOString()} ${sha} ${version.replaceAll(" ", "-")} ${(buildMillis / 1000).toFixed(1)} ${(landToInstalledMillis / 1000).toFixed(1)} ${path}`;

export const watchOnce = <R>(steps: WatchSteps<R>, files: WatchFiles) => Effect.gen(function*() {
  const previous = lines(files.log).at(-1)?.split(" ")[1];
  const sha = yield* steps.tip(previous);
  if (sha === undefined || attemptedShas(files).has(sha)) return undefined;
  if ((yield* steps.held) !== undefined) return undefined;
  const decision = yield* steps.decision(sha);
  if (decision === "wait") return undefined;
  yield* append(files.attempts, sha);
  if (decision === "red") return undefined;
  const started = yield* Clock.currentTimeMillis;
  const built = yield* steps.build(sha);
  const late = yield* steps.held;
  if (late !== undefined) {
    yield* forget(files.attempts, sha);
    console.log(`Held ${sha.slice(0, 7)}: ${late}`);
    return undefined;
  }
  const installed = yield* steps.install(built);
  const finished = yield* Clock.currentTimeMillis;
  const landed = yield* steps.landedAt(sha);
  const line = buildLine(finished, sha, installed, finished - started, finished - landed);
  yield* append(files.log, line);
  yield* steps.budget(sha, budgetProblem(finished - started, finished - landed));
  yield* steps.notes(installed.version, sha, previous).pipe(
    Effect.tap((path) => Effect.sync(() => console.log(`Playtest checklist ${path}`))),
    Effect.catch(({ problem }) => Effect.sync(() => console.error(`Playtest checklist not written: ${problem}`))),
  );
  return line;
});

export const watch = <R>(steps: WatchSteps<R>, files: WatchFiles, current: Effect.Effect<boolean, never, R>, poll: Duration.Input = POLL) => Effect.gen(function*() {
  while (yield* current) {
    const line = yield* watchOnce(steps, files).pipe(
      Effect.catch(({ problem }) => Effect.sync(() => { console.error(`Tom build failed: ${problem}`); return undefined; })),
    );
    if (line !== undefined) console.log(line);
    yield* Effect.sleep(poll);
  }
  console.log("origin/main has moved past this watcher's commit; exiting so the service restarts on the new tip");
});

export const watcherCurrent = Effect.gen(function*() {
  yield* git("fetch", "-q", "origin", "main");
  return (yield* git("rev-parse", "HEAD")) === (yield* git("rev-parse", "origin/main"));
}).pipe(Effect.orElseSucceed(() => true));

const git = (...args: readonly string[]) =>
  runProcess(ChildProcess.make("git", args, { cwd: projectRoot, stdin: "ignore" })).pipe(
    Effect.map((text) => text.trim()),
    Effect.mapError((cause) => new PlayProblem({ problem: `git ${args[0]}: ${cause.message}` })),
  );

export const newerTip = (commits: readonly string[], previous: string | undefined): string | undefined => {
  const tip = commits[0];
  if (tip === undefined || tip === previous) return undefined;
  return previous === undefined || commits.includes(previous) ? tip : undefined;
};

export const hostSteps = (predictCost: boolean): WatchSteps<ChildProcessSpawner.ChildProcessSpawner> => ({
  tip: (previous) => Effect.gen(function*() {
    yield* git("fetch", "-q", "origin", "main");
    const commits = (yield* git("rev-list", "--first-parent", "origin/main")).split("\n");
    return newerTip(commits, previous);
  }),
  decision: () => Effect.succeed("build"),
  landedAt: (sha) => git("show", "-s", "--format=%ct", sha).pipe(Effect.map((seconds) => Number(seconds) * 1000)),
  held: clientHold(documentsFolder(PLAYTEST_PREFIX)),
  build: (sha) => currentPlaytest({ revision: sha, predictCost, helper: false, edition: TOM_EDITION }).pipe(Effect.flatMap(({ map: { file, source } }) => {
    const version = buildLabel(file);
    return version === undefined ? Effect.fail(new PlayProblem({ problem: `not a playable map: ${file}` })) : Effect.succeed({ version, source });
  })),
  install: ({ version, source }) => Effect.try({
    try: () => {
      const documents = documentsFolder(PLAYTEST_PREFIX);
      installLatest(documents, source);
      return { version, path: join(library(documents), basename(source)) };
    },
    catch: (cause) => new PlayProblem({ problem: String(cause) }),
  }),
  notes: writePlaytestChecklist,
  budget: (sha, problem) => reportBudget(sha, problem).pipe(
    Effect.catch(({ problem: failure }) => Effect.sync(() => console.error(`Speed budget not reported: ${failure}`))),
  ),
});

const gh = (...args: readonly string[]) =>
  runProcess(ChildProcess.make("gh", args, { cwd: projectRoot, stdin: "ignore" })).pipe(
    Effect.map((text) => text.trim()),
    Effect.mapError((cause) => new PlayProblem({ problem: `gh ${args.slice(0, 2).join(" ")}: ${cause.message}` })),
  );

const reportBudget = (sha: string, problem: string | undefined) => Effect.gen(function*() {
  const open = (yield* gh("issue", "list", "--state", "open", "--search", `"${SPEED_BUDGET_TITLE}" in:title`, "--json", "number", "--jq", ".[].number")).split("\n").filter((line) => line !== "");
  const body = `Landing ${sha}: ${problem}.\n\nBudgets: build <= ${BUILD_BUDGET_SECONDS} s, commit to installed in Maps/00-Smashcraft <= ${LAND_TO_MAPS_BUDGET_SECONDS} s, measured by the Tom build watcher (smashcraft:tools/tom-build/, ~/.local/state/agents/handoffs/tom-build.log). Find the stage that grew and what it recomputes whose inputs did not change.`;
  if (problem === undefined) {
    for (const number of open) yield* gh("issue", "close", number, "--comment", `Landing ${sha} was within both budgets.`);
    return;
  }
  if (open[0] === undefined) yield* gh("issue", "create", "--title", SPEED_BUDGET_TITLE, "--body", body);
  else yield* gh("issue", "comment", open[0], "--body", body);
});

if (import.meta.main) {
  const { predict, args } = costPrediction(process.argv.slice(2));
  if (args.length > 0) throw new Error("tomBuildWatch takes only --predict-cost");
  BunRuntime.runMain(watch(hostSteps(predict), { log: TOM_BUILD_LOG, attempts: TOM_BUILD_ATTEMPTS }, watcherCurrent).pipe(Effect.provide(BunServices.layer)));
}
