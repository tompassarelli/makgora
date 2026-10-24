










import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { Console, Effect, Option, Schema } from "effect";
import { issueTests, redTitle } from "./mainRed";
import { effectPlaybackInputs } from "./wisp/effectVisibility";
import { CUE_MODEL_RECORD, RECORD_COMMAND, touchesCueInputs } from "./wisp/cueModels";
import { derivedStepCode } from "./wisp/fighterArt";
import { changedFighters } from "./wisp/fighterArtChanges";

const root = join(import.meta.dir, "../..");
const ZERO = /^0+$/;

export class PrePushRefusal extends Schema.TaggedError<PrePushRefusal>()("PrePushRefusal", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

export interface Check { readonly name: string; readonly directory: string; readonly args: readonly string[]; readonly fix?: string; readonly hosted: boolean; readonly inputs?: readonly string[]; readonly privateStore?: boolean }


const ANIMATION_INPUTS = ["build-inputs/original-clips-static-lights/", "tools/animations/", "ts/scripts/keyThin.ts", "ts/scripts/modelTracks.ts", "ts/scripts/poseError.ts", "ts/scripts/wisp/animJitter.ts"];
const MODEL_INPUTS = ["build-inputs/", "tools/animations/", "ts/src/game/assets/", "ts/src/generated/assets/", "ts/src/generated/stages/", "ts/src/game/presentation/", "ts/scripts/wisp/playerView.ts", "ts/scripts/wisp/model-facts/"];
const MAP_INPUTS = [...MODEL_INPUTS, "ts/src/generated/clips/", "ts/scripts/prePush.ts", "ts/scripts/wisp/", "ts/wisp.lock", "ts/bun.lock", "ts/package.json", "ts/vendor/", "typescript-toolchain.lock"];


const CUE_CHECK = "ts/scripts/cueModels.ts";
const STRIKE_COMMAND = "ts/scripts/wisp/commands/view.ts";
const STRIKE_MEASURES = ["ts/scripts/wisp/strikeMoments.ts", "ts/scripts/heroModelSource.ts", "ts/src/game/presentation/heroStrikeMomentInfo.ts"];
const SUITE_INPUTS = [".github/workflows/farm-test.yml", ".github/workflows/autoland.yml", "ts/scripts/suiteParity.ts", "ts/scripts/prePush.ts"];
const SCRIPT_INPUTS = ["ts/scripts", "ts/src", "ts/package.json", "ts/bunfig.toml"];

function importClosure(entry: string): string[] {
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    for (const { path, kind } of transpiler.scanImports(readFileSync(file, "utf8"))) {
      if (kind === "dynamic-import" || !path.startsWith(".")) continue;
      const base = join(dirname(file), path);
      const found = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((candidate) => existsSync(candidate) && candidate.match(/\.tsx?$/));
      if (found !== undefined) visit(found);
    }
  };
  visit(join(root, entry));
  return [...seen].map((file) => relative(root, file));
}

export function cueInputs(): Set<string> {
  return new Set([CUE_MODEL_RECORD, ...effectPlaybackInputs(root), ...importClosure(CUE_CHECK)]);
}

export function strikeInputs(): Set<string> {
  return new Set(["build-inputs/", STRIKE_COMMAND, ...STRIKE_MEASURES.flatMap(importClosure)]);
}

export function checksFor(paths: readonly string[], cues: ReadonlySet<string> = new Set(), strikes: ReadonlySet<string> = new Set()): Check[] {
  const ts = paths.some((path) => path.startsWith("ts/") || path === "typescript-toolchain.lock");
  const animation = paths.some((path) => ANIMATION_INPUTS.some((input) => path === input || input.endsWith("/") && path.startsWith(input)));
  const models = paths.some((path) => MODEL_INPUTS.some((input) => path === input || input.endsWith("/") && path.startsWith(input)));
  const cueModels = touchesCueInputs(paths, cues);
  const strikeMoments = touchesCueInputs(paths, strikes);
  const mapInputs = paths.some((path) => MAP_INPUTS.some((input) => path === input || input.endsWith("/") && path.startsWith(input)));
  const suites = paths.some((path) => SUITE_INPUTS.includes(path));
  const fighterArt = changedFighters(paths, derivedStepCode());
  return [
    ...(paths.length > 0 ? [{ name: "clean room", directory: "ts", args: ["scripts/cleanRoom.ts"], fix: "follow wisp:docs/clean-room.md and the line above.", hosted: true }] : []),
    ...(ts ? [
      { name: "kind tags and type-check ts", directory: "ts", args: ["run", "check"], fix: "end each refused test title with its kind tag (listed above) or delete the test; fix each type error.", hosted: true },
    ] : []),
    ...(suites ? [
      { name: "Autoland suite covers the farm suite", directory: "ts", args: ["scripts/suiteParity.ts"], fix: "give Autoland's suite every farm-test job and input, since safe-push hands a lane to Autoland without its own farm run (smashcraft:docs/ci.md, \"Autoland\").", hosted: true },
    ] : []),
    ...(mapInputs ? [{ name: "private map-build inputs", directory: "ts", args: ["scripts/wisp.ts", "map", "build", "--profile", "playable", "--edition", "classic", "--inputs-only"], fix: "regenerate and store the missing inputs before landing (smashcraft:docs/build-inputs.md).", hosted: false, privateStore: true }] : []),
    ...(models ? [
      { name: "generated models stored", directory: "ts", args: ["scripts/storedModels.ts"], fix: "store the regenerated family (smashcraft:docs/build-inputs.md, \"Change art\").", hosted: false, inputs: ["build-inputs", "tools/animations", ...SCRIPT_INPUTS] },
    ] : []),
    ...(cueModels ? [
      { name: "cue models and Classic effect record", directory: "ts", args: ["scripts/cueModels.ts"], fix: `record new models with ${RECORD_COMMAND} from ts/ (smashcraft:docs/commands/workflow.md).`, hosted: true },
    ] : []),
    ...(fighterArt.length > 0 ? [
      { name: `fighter art reproduces (${fighterArt.join(", ")})`, directory: "ts", args: ["scripts/wisp.ts", "inputs", "derive", "--check", ...fighterArt.flatMap((slug) => ["--fighter", slug])], fix: "derive the listed fighters from this landing's producers and commit their pins and generated files (smashcraft:docs/build-inputs.md, \"Change art\").", hosted: false, privateStore: true },
    ] : []),
    ...(strikeMoments ? [
      { name: "strike moments match the committed models", directory: "ts", args: ["scripts/wisp.ts", "view", "strikes", "--check"], fix: "regenerate the table with bun wisp view strikes --assets \"$(bun wisp inputs path assets)\" from ts/ and commit it (smashcraft:docs/build-inputs.md, \"Change art\").", hosted: false, privateStore: true },
    ] : []),
    ...(animation ? [
      { name: "animation jitter [k3 measure #479]", directory: "ts", args: ["scripts/wisp.ts", "anim", "jitter"], fix: "regenerate the clip pool through thinKeys so close Hermite keys carry slopes (smashcraft:docs/commands/animation.md).", hosted: false, inputs: ["build-inputs", "tools/animations", ...SCRIPT_INPUTS] },
    ] : []),
  ];
}


const liveGroups = new Set<number>();

const signalGroup = (group: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-group, signal);
  } catch {

  }
};


export function killChildren(): void {
  for (const group of liveGroups) signalGroup(group, "SIGKILL");
  liveGroups.clear();
}







export const run = (command: readonly string[], cwd: string, stdout: "pipe" | "ignore" = "pipe") => Effect.acquireUseRelease(
  Effect.try({
    try: () => {
      const child = Bun.spawn([...command], { cwd, stdin: "ignore", stdout, stderr: "pipe", detached: true });
      liveGroups.add(child.pid);
      return child;
    },
    catch: (cause) => new PrePushRefusal({ problem: `pre-push: could not start ${command[0]}: ${String(cause)}` }),
  }),
  (child) => Effect.promise(async () => {
    const output = Promise.all([child.stdout === null ? "" : new Response(child.stdout).text(), new Response(child.stderr).text()]);
    const exitCode = await child.exited;
    signalGroup(child.pid, "SIGKILL");
    const [out, err] = await output;
    return { exitCode, stdout: out, stderr: err };
  }),
  (child) => Effect.promise(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      signalGroup(child.pid, "SIGTERM");
      await Promise.race([child.exited, Bun.sleep(1000)]);
    }
    signalGroup(child.pid, "SIGKILL");
    liveGroups.delete(child.pid);
    await child.exited;
  }),
);


const gitIn = (cwd: string, ...args: string[]) => run(["git", ...args], cwd).pipe(
  Effect.flatMap(({ exitCode, stdout, stderr }) => exitCode === 0
    ? Effect.succeed(stdout.trim())
    : Effect.fail(new PrePushRefusal({ problem: `pre-push: git ${args.join(" ")} exited ${exitCode}${stderr.trim() === "" ? "" : `: ${stderr.trim()}`}` }))),
);

const git = (...args: string[]) => gitIn(root, ...args);


const hasCommit = (commit: string) => run(["git", "cat-file", "-e", `${commit}^{commit}`], root).pipe(Effect.map(({ exitCode }) => exitCode === 0));


const changedPaths = (local: string, remote: string) => Effect.gen(function*() {
  const base = !ZERO.test(remote) && (yield* hasCommit(remote)) ? remote : yield* git("merge-base", local, "origin/main");
  return (yield* git("diff", "--name-only", base, local)).split("\n").filter((path) => path.length > 0);
});

export interface CheckRun { readonly exitCode: number; readonly stdout: string; readonly stderr: string }

export interface Local {
  readonly hosted: boolean;
  readonly cues: () => ReadonlySet<string>;
  readonly strikes: () => ReadonlySet<string>;
  readonly changed: (local: string, remote: string) => Effect.Effect<readonly string[], PrePushRefusal>;
  readonly head: Effect.Effect<string, PrePushRefusal>;
  readonly dirty: (directories: readonly string[]) => Effect.Effect<string, PrePushRefusal>;
  readonly runner: (check: Check) => Effect.Effect<CheckRun, PrePushRefusal>;
  readonly key: (check: Check) => Effect.Effect<Option.Option<string>, PrePushRefusal>;
  readonly cache: { readonly has: (key: string) => Effect.Effect<boolean>; readonly record: (key: string) => Effect.Effect<void> };
}

export const PREPUSH_CACHE = join(homedir(), ".local/state/smashcraft/prepush-cache");

export const checkKey = (repo: string, check: Check) => Effect.gen(function*() {
  const scope = check.inputs ?? [];
  if ((yield* gitIn(repo, "status", "--porcelain", "--", ...scope)) !== "") return Option.none<string>();
  const tree = check.inputs === undefined ? yield* gitIn(repo, "rev-parse", "HEAD^{tree}") : yield* gitIn(repo, "ls-tree", "HEAD", "--", ...check.inputs);
  const lock = existsSync(join(repo, "ts/bun.lock")) ? yield* gitIn(repo, "hash-object", "ts/bun.lock") : "";
  return Option.some(new Bun.CryptoHasher("sha256").update(`${check.name}\0${tree}\0${lock}`).digest("hex"));
});

export const directoryCache = (directory: string): Local["cache"] => ({
  has: (key) => Effect.sync(() => existsSync(join(directory, key))),
  record: (key) => Effect.promise(async () => {
    mkdirSync(directory, { recursive: true });
    await Bun.write(join(directory, key), `${new Date().toISOString()}\n`);
  }),
});

const runCheck = (check: Check) => Effect.gen(function*() {
  const cwd = join(root, check.directory);
  if (!existsSync(join(cwd, "node_modules"))) yield* run([process.execPath, "install", "--frozen-lockfile"], cwd, "ignore");
  return yield* run([process.execPath, ...check.args], cwd);
});

export const laptop: Local = {
  hosted: process.env.GITHUB_ACTIONS === "true",
  cues: cueInputs,
  strikes: strikeInputs,
  changed: changedPaths,
  head: git("rev-parse", "HEAD"),
  dirty: (directories) => git("status", "--porcelain", "--", ...directories),
  runner: runCheck,
  key: (check) => checkKey(root, check),
  cache: directoryCache(PREPUSH_CACHE),
};

export const runChecks = (checks: readonly Check[], local: Local) => Effect.forEach(checks, (check) => Effect.gen(function*() {
  const key = check.privateStore ? Option.none<string>() : yield* local.key(check);
  if (Option.isSome(key) && (yield* local.cache.has(key.value))) return yield* Console.error(`pre-push: ${check.name} passed before on these inputs (cache ${key.value.slice(0, 12)})`);
  const started = performance.now();
  const child = yield* local.runner(check);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (child.exitCode !== 0) {
    return yield* new PrePushRefusal({ problem: `${child.stdout}${child.stderr}\npre-push: ${check.name} failed (${seconds} s); ${check.fix ?? "fix it before landing."}` });
  }
  if (Option.isSome(key)) yield* local.cache.record(key.value);
  yield* Console.error(`pre-push: ${check.name} passed (${seconds} s)`);
}), { discard: true });

const RedIssues = Schema.fromJsonString(Schema.Array(Schema.Struct({ number: Schema.Finite, title: Schema.String, body: Schema.String, url: Schema.String })));


export function redNotice(issue: { readonly number: number; readonly body: string; readonly url: string }): string {
  const tests = issueTests(issue.body);
  const shown = tests.slice(0, 8).join("; ");
  return `pre-push: main is red (#${issue.number} ${issue.url}), ${tests.length} failing: ${shown}${tests.length > 8 ? `; and ${tests.length - 8} more` : ""}`;
}

const mainRedNotice = run(["gh", "issue", "list", "--state", "open", "--search", `"${redTitle("main")}" in:title`, "--json", "number,title,body,url"], root).pipe(
  Effect.flatMap(({ exitCode, stdout }) => (exitCode === 0 ? Schema.decodeEffect(RedIssues)(stdout) : Effect.succeed([]))),
  Effect.map((issues) => issues.filter(({ title }) => title === redTitle("main"))),
  Effect.flatMap(Effect.forEach((issue) => Console.error(redNotice(issue)), { discard: true })),
  Effect.timeout("5 seconds"),
  Effect.ignore,
);


const WORKFLOWS = ".github/workflows/";

export const HAND_OFF = "refs/heads/claude/land-";

export function autolandLands(queue: string, paths: readonly string[]): boolean {
  return queue === "autoland" && !paths.some((path) => path.startsWith(WORKFLOWS));
}

const landingQueue = run(["git", "config", "--file", join(root, ".safe-push"), "--default", "", "landing.queue"], root).pipe(
  Effect.map(({ exitCode, stdout }) => (exitCode === 0 ? stdout.trim() : "")),
);

export const prePush = (input: string, landing: { readonly gate: typeof farmGate; readonly queue: typeof landingQueue; readonly notice?: Effect.Effect<void> } = { gate: farmGate, queue: landingQueue }, local: Local = laptop) => Effect.gen(function*() {
  yield* landing.notice ?? mainRedNotice;
  const pushed = input.split("\n").flatMap((line) => {
    const [, commit, remoteRef, remote] = line.trim().split(/\s+/);
    return commit === undefined || remote === undefined || ZERO.test(commit) || remoteRef?.startsWith("refs/tags/") ? [] : [{ commit, remoteRef, remote }];
  });
  const paths = [...new Set((yield* Effect.forEach(pushed, ({ commit, remote }) => local.changed(commit, remote))).flat())];
  const selected = checksFor(paths, local.cues(), local.strikes()).filter((check) => !(check.privateStore && local.hosted));
  const toMain = pushed.some(({ remoteRef }) => remoteRef === "refs/heads/main");
  const handsOff = pushed.some(({ remoteRef }) => remoteRef === "refs/heads/main" || remoteRef?.startsWith(HAND_OFF) === true);
  const lands = handsOff ? autolandLands(yield* landing.queue, paths) : false;
  const checks = lands ? selected.filter(({ hosted }) => !hosted) : selected;
  const deferred = lands ? selected.filter(({ hosted }) => hosted) : [];
  if (checks.length === 0 && !toMain) return;
  const head = yield* local.head;
  const dirty = checks.length === 0 ? "" : yield* local.dirty(checks.some(({ privateStore }) => privateStore) ? ["."] : [...new Set(checks.map(({ directory }) => directory))]);
  if (pushed.some(({ commit }) => commit !== head) || dirty !== "") {
    return yield* new PrePushRefusal({ problem: `pre-push: the checks read the working tree, so push the clean checked-out commit (HEAD ${head.slice(0, 12)}).\n${dirty}` });
  }
  if (deferred.length > 0) yield* Console.error(`pre-push: Autoland's build runs ${deferred.map(({ name }) => name).join(", ")} in this hook on the rebased candidate before it lands`);
  yield* runChecks(checks, local);
  if (!toMain) return;
  if (lands) return yield* Console.error("pre-push: Autoland runs the farm suite on the rebased candidate before it lands, so this push waits for no farm run");
  yield* landing.gate(head);
});

const FARM_TIMEOUT_MINUTES = 30;
const FarmRuns = Schema.fromJsonString(Schema.Array(Schema.Struct({ displayTitle: Schema.String, conclusion: Schema.String, url: Schema.String })));


export function greenFarmRun(runs: readonly { readonly displayTitle: string; readonly conclusion: string; readonly url: string }[], sha: string): string | undefined {
  return runs.find(({ displayTitle, conclusion }) => conclusion === "success" && displayTitle.startsWith(`Farm test ${sha} `))?.url;
}


export const FARM_RUN_URL = /https:\/\/github\.com\/[^\s]+\/actions\/runs\/(\d+)/;

export type FarmStart = (head: string) => Effect.Effect<CheckRun, PrePushRefusal>;
export type FarmVerdict = "green" | "red" | "infra";
export type FarmConclusion = (runId: string) => Effect.Effect<FarmVerdict, PrePushRefusal>;
const RunConclusion = Schema.fromJsonString(Schema.Struct({ status: Schema.String, conclusion: Schema.String }));

const farmStart: FarmStart = (head) => run([process.execPath, "wisp", "farm", "test", "--ref", head, "--wait"], join(root, "ts"));
const farmConclusion: FarmConclusion = (runId) => Effect.gen(function*() {
  yield* run(["gh", "run", "watch", runId, "--interval", "30"], root, "ignore");
  const viewed = yield* run(["gh", "run", "view", runId, "--json", "status,conclusion"], root);
  const state = viewed.exitCode === 0 ? yield* Schema.decodeEffect(RunConclusion)(viewed.stdout).pipe(Effect.orElseSucceed(() => undefined)) : undefined;
  return state?.status !== "completed" ? "infra" : state.conclusion === "success" ? "green" : "red";
});

export const farmOutcome = (head: string, start: FarmStart = farmStart, conclusion: FarmConclusion = farmConclusion) => Effect.gen(function*() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const farm = yield* start(head);
    if (farm.exitCode === 0) return { verdict: "green" as FarmVerdict, output: `${farm.stdout}${farm.stderr}` };
    const output = `${farm.stdout}${farm.stderr}`;
    const runId = FARM_RUN_URL.exec(output)?.[1];
    if (runId !== undefined) {
      if (/ failed on the farm: | without a summary /.test(output)) return { verdict: "red" as FarmVerdict, output };
      const verdict = yield* conclusion(runId);
      return { verdict, output: `${output}\npre-push: farm run ${runId} concluded ${verdict} after the farm command exited ${farm.exitCode}` };
    }
    if (attempt === 2) return { verdict: "infra" as FarmVerdict, output };
    yield* Console.error(`pre-push: no farm run started on ${head.slice(0, 12)} (infrastructure, not a test result); starting it once more`);
  }
  return { verdict: "infra" as FarmVerdict, output: "" };
});

const farmGate = (head: string) => Effect.gen(function*() {
  const listed = yield* run(["gh", "run", "list", "--workflow", "farm-test.yml", "--status", "success", "--limit", "100", "--json", "displayTitle,conclusion,url"], root);
  const runs = listed.exitCode === 0 ? yield* Schema.decodeEffect(FarmRuns)(listed.stdout).pipe(Effect.orElseSucceed(() => [])) : [];
  const green = greenFarmRun(runs, head);
  if (green !== undefined) return yield* Console.error(`pre-push: the farm suite is green on ${head.slice(0, 12)} (${green})`);
  yield* Console.error(`pre-push: main lands only on a green farm suite for this exact commit; running bun wisp farm test --ref ${head.slice(0, 12)} --wait`);
  const started = performance.now();
  const farm = yield* farmOutcome(head).pipe(Effect.timeoutOption(`${FARM_TIMEOUT_MINUTES} minutes`));
  const minutes = ((performance.now() - started) / 60000).toFixed(1);
  if (Option.isNone(farm)) return yield* new PrePushRefusal({ problem: `pre-push: the farm suite on ${head.slice(0, 12)} didn't finish within ${FARM_TIMEOUT_MINUTES} minutes; NOT landed` });
  if (farm.value.verdict === "infra") {
    return yield* new PrePushRefusal({ problem: `${farm.value.output}\npre-push: INFRA, not a red suite: no farm run started on ${head.slice(0, 12)} in two tries (${minutes} min); NOT landed, re-run safe-push once GitHub accepts the scratch push` });
  }
  if (farm.value.verdict === "red") {
    return yield* new PrePushRefusal({ problem: `${farm.value.output}\npre-push: the farm suite failed on ${head.slice(0, 12)} (${minutes} min); main lands only on a green suite, including tests main already fails` });
  }
  yield* Console.error(`pre-push: the farm suite passed on ${head.slice(0, 12)} (${minutes} min)`);
});
