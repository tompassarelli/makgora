import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { basename, dirname, join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Clock, type Duration, Effect } from "effect";
import { ChildProcess, type ChildProcessSpawner } from "effect/process";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "./hostProcess";
import { FETCH_HINT } from "./wisp/buildInputs";
import { type LandingDecision, TOM_EDITION, buildLabel, costPrediction } from "./wisp/greenBuilds";
import { writePlaytestChecklist } from "./wisp/playtestChecklist";
import { type BuildStage, currentPlaytest } from "./wisp/currentPlaytest";
import { installLatest, library, pendingTidy, tidyLibrary } from "./wisp/mapLibrary";
import { PLAYTEST_PREFIX, projectRoot, tsDirectory } from "./wisp/project";
import { clientHold, liveClients } from "./wisp/runningGames";
import { documentsFolder } from "wisp/scripts/warcraft/battleNet";
import { platformLayer } from "wisp/scripts/platform/layer";
import { withPressure } from "wisp/scripts/wisp/testRunner";

export const TOM_BUILD_LOG = join(homedir(), ".local/state/agents/handoffs/tom-build.log");
export const TOM_BUILD_ATTEMPTS = join(homedir(), ".local/state/smashcraft/tom-build/attempted");
const POLL = "10 seconds";
export const BUILD_BUDGET_SECONDS = 20;
export const LAND_TO_MAPS_BUDGET_SECONDS = 360;
export const BUSY_PRESSURE = 20;
export const INPUT_HOSTS = ["gex45"];
export const SPEED_BUDGET_TITLE = "Speed budget: a landing took too long to reach Tom's Maps folder";

export interface Load {
  readonly pressure: number | undefined;
  readonly clients: number | undefined;
}

export interface Timing {
  readonly landed: number;
  readonly onMain: number | undefined;
  readonly started: number;
  readonly finished: number;
  readonly stages: readonly BuildStage[];
  readonly load: Load;
}

export const buildMillis = ({ started, finished }: Timing) => finished - started;
export const landToInstalledMillis = ({ landed, finished }: Timing) => finished - landed;

export const busy = ({ load: { pressure } }: Timing) => pressure !== undefined && pressure > BUSY_PRESSURE;

export const budgetProblem = (timing: Timing): string | undefined => {
  const build = buildMillis(timing);
  const landing = landToInstalledMillis(timing);
  const over = [
    build > BUILD_BUDGET_SECONDS * 1000 ? `build ${(build / 1000).toFixed(1)} s over its ${BUILD_BUDGET_SECONDS} s budget` : undefined,
    landing > LAND_TO_MAPS_BUDGET_SECONDS * 1000 ? `landing to Maps ${(landing / 1000).toFixed(0)} s over its ${LAND_TO_MAPS_BUDGET_SECONDS} s budget` : undefined,
  ].filter((problem) => problem !== undefined);
  return over.length === 0 ? undefined : over.join("; ");
};

const seconds = (millis: number | undefined) => millis === undefined ? "-" : (millis / 1000).toFixed(1);
const known = (value: number | undefined) => value === undefined ? "-" : String(value);

export const stageReport = (timing: Timing) => {
  const { landed, onMain, started, stages, load } = timing;
  const arrival = onMain === undefined
    ? `Commit to build start ${seconds(started - landed)} s (when it reached main is unknown)`
    : `Commit to main ${seconds(onMain - landed)} s (the lane's pre-land gates), main to build start ${seconds(started - onMain)} s (watcher restart, poll and any hold while Tom's Warcraft III ran)`;
  const build = stages.map(({ name, millis }) => `${name} ${seconds(millis)} s`).join(", ");
  return `${arrival}; build ${build}. Build host: CPU pressure some avg10 peak ${known(load.pressure)}%, ${known(load.clients)} live Warcraft III clients; a build above ${BUSY_PRESSURE}% counts against neither budget.`;
};

export interface Built {
  readonly version: string;
  readonly source: string;
  readonly stages: readonly BuildStage[];
}

export interface Installed {
  readonly version: string;
  readonly path: string;
}

export interface WatchSteps<R> {
  readonly tip: (previous: string | undefined) => Effect.Effect<string | undefined, PlayProblem, R>;
  readonly decision: (sha: string) => Effect.Effect<LandingDecision, PlayProblem, R>;
  readonly landedAt: (sha: string) => Effect.Effect<number, PlayProblem, R>;
  readonly onMain: (sha: string) => Effect.Effect<number | undefined, never, R>;
  readonly measured: <A>(work: Effect.Effect<A, PlayProblem, R>) => Effect.Effect<readonly [A, Load], PlayProblem, R>;
  readonly held: Effect.Effect<string | undefined, PlayProblem, R>;
  readonly build: (sha: string) => Effect.Effect<Built, PlayProblem, R>;
  readonly fetchInputs: Effect.Effect<void, PlayProblem, R>;
  readonly tidy: Effect.Effect<string | undefined, PlayProblem, R>;
  readonly install: (built: Built, held: string | undefined) => Effect.Effect<Installed, PlayProblem, R>;
  readonly notes: (version: string, sha: string, previous: string | undefined) => Effect.Effect<string, PlayProblem, R>;
  readonly budget: (sha: string, timing: Timing) => Effect.Effect<void, never, R>;
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

export const buildLine = (sha: string, { version, path }: Installed, timing: Timing) => {
  const { landed, onMain, finished, stages, load } = timing;
  const stageField = stages.length === 0 ? "-" : stages.map(({ name, millis }) => `${name}=${seconds(millis)}`).join(",");
  return [new Date(finished).toISOString(), sha, version.replaceAll(" ", "-"), seconds(buildMillis(timing)), seconds(landToInstalledMillis(timing)),
    seconds(onMain === undefined ? undefined : onMain - landed), known(load.pressure), known(load.clients), stageField, path].join(" ");
};

const logged = (text: string) => Effect.sync(() => {
  console.log(text);
  return undefined;
});

export const missingInputs = ({ problem }: PlayProblem) => problem.includes(FETCH_HINT);

const builtWithInputs = <R>(steps: WatchSteps<R>, sha: string) => Effect.gen(function*() {
  const started = yield* Clock.currentTimeMillis;
  return yield* steps.build(sha).pipe(
    Effect.catchIf(missingInputs, (missing) => steps.fetchInputs.pipe(
      Effect.tapError(({ problem }) => Effect.sync(() => console.error(`Fetching build inputs failed: ${problem}`))),
      Effect.mapError(() => missing),
      Effect.andThen(Clock.currentTimeMillis),
      Effect.flatMap((fetched) => steps.build(sha).pipe(Effect.map((built): Built => ({ ...built, stages: [{ name: "inputs-fetch", millis: fetched - started }, ...built.stages] })))),
    )),
  );
});

export const watchOnce = <R>(steps: WatchSteps<R>, files: WatchFiles) => Effect.gen(function*() {
  const previous = lines(files.log).at(-1)?.split(" ")[1];
  const sha = yield* steps.tip(previous);
  if (sha === undefined || attemptedShas(files).has(sha)) return undefined;
  const decision = yield* steps.decision(sha);
  if (decision === "wait") return yield* logged(`Waiting on ${sha.slice(0, 7)}: its checks have not finished`);
  yield* append(files.attempts, sha);
  if (decision === "red") return yield* logged(`Skipping ${sha.slice(0, 7)}: its checks failed`);
  const started = yield* Clock.currentTimeMillis;
  const [built, load] = yield* steps.measured(builtWithInputs(steps, sha)).pipe(
    Effect.tapError((problem) => missingInputs(problem) ? forget(files.attempts, sha) : Effect.void),
  );
  const held = yield* steps.held;
  if (held !== undefined) console.log(`Installing ${sha.slice(0, 7)} beside the older builds, tidy deferred: ${held}`);
  const copying = yield* Clock.currentTimeMillis;
  const installed = yield* steps.install(built, held);
  const finished = yield* Clock.currentTimeMillis;
  const landed = yield* steps.landedAt(sha);
  const onMain = yield* steps.onMain(sha);
  const timing: Timing = { landed, onMain, started, finished, stages: [...built.stages, { name: "maps-copy", millis: finished - copying }], load };
  const line = buildLine(sha, installed, timing);
  yield* append(files.log, line);
  yield* steps.budget(sha, timing);
  yield* steps.notes(installed.version, sha, previous).pipe(
    Effect.tap((path) => Effect.sync(() => console.log(`Playtest checklist ${path}`))),
    Effect.catch(({ problem }) => Effect.sync(() => console.error(`Playtest checklist not written: ${problem}`))),
  );
  return line;
});

export const watch = <R>(steps: WatchSteps<R>, files: WatchFiles, current: Effect.Effect<boolean, never, R>, poll: Duration.Input = POLL) => Effect.gen(function*() {
  let lastNote: string | undefined;
  while (yield* current) {
    const line = yield* watchOnce(steps, files).pipe(
      Effect.catch(({ problem }) => Effect.sync(() => { console.error(`Tom build failed: ${problem}`); return undefined; })),
    );
    if (line !== undefined) console.log(line);
    const note = yield* steps.tidy.pipe(
      Effect.catch(({ problem }) => Effect.sync(() => { console.error(`Tidy of Maps/00-Smashcraft failed: ${problem}`); return undefined; })),
    );
    if (note !== undefined && note !== lastNote) console.log(note);
    lastNote = note;
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

export const installBuild = (documents: string) => ({ version, source }: Built, held: string | undefined) => Effect.try({
  try: () => {
    installLatest(documents, source, held !== undefined);
    return { version, path: join(library(documents), basename(source)) };
  },
  catch: (cause) => new PlayProblem({ problem: String(cause) }),
});

export const tidyFolder = (documents: string, running: Effect.Effect<string | undefined, PlayProblem, never>) => Effect.gen(function*() {
  const { remove, archive } = pendingTidy(documents);
  const pending = [...remove, ...archive];
  if (pending.length === 0) return undefined;
  const held = yield* running;
  if (held !== undefined) return `Tidy of ${pending.join(", ")} waits: ${held}`;
  yield* Effect.try({ try: () => tidyLibrary(documents), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
  return `Tidied ${pending.join(", ")}`;
});

export const hostSteps = (predictCost: boolean): WatchSteps<ChildProcessSpawner.ChildProcessSpawner> => ({
  tip: (previous) => Effect.gen(function*() {
    yield* git("fetch", "-q", "origin", "main");
    const commits = (yield* git("rev-list", "--first-parent", "origin/main")).split("\n");
    return newerTip(commits, previous);
  }),
  decision: () => Effect.succeed("build"),
  landedAt: (sha) => git("show", "-s", "--format=%ct", sha).pipe(Effect.map((seconds) => Number(seconds) * 1000)),
  onMain: (sha) => gh("api", "repos/{owner}/{repo}/activity?ref=refs/heads/main&activity_type=push&per_page=50", "--jq", `.[] | select(.after == "${sha}") | .timestamp`).pipe(
    Effect.map((text) => Date.parse(text.split("\n")[0] ?? "")),
    Effect.map((at) => Number.isNaN(at) ? undefined : at),
    Effect.orElseSucceed(() => undefined),
  ),
  measured: (work) => Effect.gen(function*() {
    const before = yield* liveClients;
    const { value, pressure } = yield* withPressure(work).pipe(Effect.provide(platformLayer()));
    const after = yield* liveClients;
    const clients = before === undefined || after === undefined ? undefined : Math.max(before, after);
    return [value, { pressure: pressure.peak, clients }] as const;
  }),
  held: clientHold(documentsFolder(PLAYTEST_PREFIX)),
  build: (sha) => currentPlaytest({ revision: sha, predictCost, helper: false, edition: TOM_EDITION }).pipe(Effect.flatMap(({ map: { file, source }, stages }) => {
    const version = buildLabel(file);
    return version === undefined ? Effect.fail(new PlayProblem({ problem: `not a playable map: ${file}` })) : Effect.succeed({ version, source, stages });
  })),
  fetchInputs: runProcess(ChildProcess.make("bun", ["wisp", "inputs", "fetch", ...INPUT_HOSTS.filter((host) => host !== hostname())], { cwd: tsDirectory, stdin: "ignore" })).pipe(
    Effect.tap((text) => Effect.sync(() => console.log(text.trim()))),
    Effect.mapError((cause) => new PlayProblem({ problem: `bun wisp inputs fetch: ${cause.message}` })),
  ),
  install: installBuild(documentsFolder(PLAYTEST_PREFIX)),
  tidy: tidyFolder(documentsFolder(PLAYTEST_PREFIX), clientHold(documentsFolder(PLAYTEST_PREFIX))),
  notes: writePlaytestChecklist,
  budget: (sha, timing) => (busy(timing)
    ? Effect.sync(() => console.log(`Landing ${sha.slice(0, 7)} counts against neither budget: CPU pressure peaked at ${timing.load.pressure}% during its build, above ${BUSY_PRESSURE}%`))
    : reportBudget(sha, timing)).pipe(
    Effect.catch(({ problem: failure }) => Effect.sync(() => console.error(`Speed budget not reported: ${failure}`))),
  ),
});

const gh = (...args: readonly string[]) =>
  runProcess(ChildProcess.make("gh", args, { cwd: projectRoot, stdin: "ignore" })).pipe(
    Effect.map((text) => text.trim()),
    Effect.mapError((cause) => new PlayProblem({ problem: `gh ${args.slice(0, 2).join(" ")}: ${cause.message}` })),
  );

const reportBudget = (sha: string, timing: Timing) => Effect.gen(function*() {
  const problem = budgetProblem(timing);
  const open = (yield* gh("issue", "list", "--state", "open", "--search", `"${SPEED_BUDGET_TITLE}" in:title`, "--json", "number", "--jq", ".[].number")).split("\n").filter((line) => line !== "");
  const body = `Landing ${sha}: ${problem}.\n\n${stageReport(timing)}\n\nBudgets: build <= ${BUILD_BUDGET_SECONDS} s, commit to installed in Maps/00-Smashcraft <= ${LAND_TO_MAPS_BUDGET_SECONDS} s, measured by the Tom build watcher (smashcraft:tools/tom-build/, ~/.local/state/agents/handoffs/tom-build.log). Find the stage that grew and what it recomputes whose inputs did not change.`;
  if (problem === undefined) {
    for (const number of open) yield* gh("issue", "close", number, "--comment", `Landing ${sha} was within both budgets. ${stageReport(timing)}`);
    return;
  }
  if (open[0] === undefined) yield* gh("issue", "create", "--title", SPEED_BUDGET_TITLE, "--body", body, "--label", "bug", "--label", "priority:now", "--label", "evidence:code");
  else yield* gh("issue", "comment", open[0], "--body", body);
});

if (import.meta.main) {
  const { predict, args } = costPrediction(process.argv.slice(2));
  if (args.length > 0) throw new Error("tomBuildWatch takes only --predict-cost");
  BunRuntime.runMain(watch(hostSteps(predict), { log: TOM_BUILD_LOG, attempts: TOM_BUILD_ATTEMPTS }, watcherCurrent).pipe(Effect.provide(BunServices.layer)));
}
