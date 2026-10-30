










import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Console, Effect, Option, Schema } from "effect";
import { admitted } from "./heavyCapacity";
import { FULL_SUITE_VARIABLE, type LandingCheck, importClosure, landingSelection, selectionLines } from "./landingChecks";
import { issueTests, redTitle } from "./mainRed";
import { CUE_MODEL_RECORD, RECORD_COMMAND, effectPlaybackInputs, touchesCueInputs } from "./wisp/cueInputs";
import { derivedStepCode } from "./wisp/fighterArtCode";
import { changedFighters } from "./wisp/fighterArtChanges";
import { LOCOMOTION_RECORD, LOCOMOTION_TRAILER } from "./locomotionRecord";
import { type Finished, killChildren, runGroup } from "./processGroups";

const root = join(import.meta.dir, "../..");
const ZERO = /^0+$/;

export class PrePushRefusal extends Schema.TaggedError<PrePushRefusal, { readonly brand: unique symbol }>()("PrePushRefusal", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

export interface Check { readonly name: string; readonly directory: string; readonly args: readonly string[]; readonly fix?: string; readonly hosted: boolean; readonly localFix?: boolean; readonly inputs?: readonly string[]; readonly privateStore?: boolean; readonly machineTool?: boolean; readonly readsOnly?: boolean }


const ANIMATION_INPUTS = ["build-inputs/original-clips-static-lights/", "tools/animations/", "ts/scripts/keyThin.ts", "ts/scripts/modelTracks.ts", "ts/scripts/poseError.ts", "ts/scripts/wisp/animJitter.ts"];
const MODEL_INPUTS = ["build-inputs/", "tools/animations/", "ts/src/game/assets/", "ts/src/generated/assets/", "ts/src/generated/stages/", "ts/src/game/presentation/", "ts/scripts/wisp/playerView.ts", "ts/scripts/wisp/model-facts/"];
const MAP_INPUTS = [...MODEL_INPUTS, "ts/src/generated/clips/", "ts/scripts/prePush.ts", "ts/scripts/wisp/", "ts/wisp.lock", "ts/bun.lock", "ts/package.json", "ts/vendor/", "typescript-toolchain.lock"];


const CUE_CHECK = "ts/scripts/cueModels.ts";
const LOCOMOTION_INPUTS = ["ts/src/game/presentation/", "ts/scripts/locomotionLock.ts", LOCOMOTION_RECORD];
const STRIKE_COMMAND = "ts/scripts/wisp/commands/view.ts";
const STRIKE_MEASURES = ["ts/scripts/wisp/strikeMoments.ts", "ts/scripts/heroModelSource.ts", "ts/src/game/presentation/heroStrikeMomentInfo.ts"];
const SUITE_INPUTS = [".github/workflows/farm-test.yml", ".github/workflows/autoland.yml", "ts/scripts/suiteParity.ts", "ts/scripts/prePush.ts"];
const SCRIPT_INPUTS = ["ts/scripts", "ts/src", "ts/package.json", "ts/bunfig.toml"];
const EFFECT_KIT_INPUTS = /^(ts\/|contracts\/|repos\/effect|effect-kit\.json$|typescript-toolchain\.lock$)/;
export const NORTH = join(homedir(), "code/north/main");
export const EFFECT_KIT = join(NORTH, "agent-machinery/scripts/effect-kit.mjs");

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
  const effectKit = paths.some((path) => EFFECT_KIT_INPUTS.test(path));
  const fighterArt = changedFighters(paths, derivedStepCode());
  const locomotion = fighterArt.includes("illidan") || paths.some((path) => LOCOMOTION_INPUTS.some((input) => path === input || input.endsWith("/") && path.startsWith(input)));
  return [
    ...(ts ? [{ name: "balance baseline holds the kit", directory: "ts", args: ["test", "test/balanceBaseline.test.ts"], fix: "keep the listed values inside the fixed bounds, or for an intended kit change re-freeze with bun scripts/balanceFreeze.ts from ts/ and name the change in the commit (smashcraft:docs/design/balance.md).", hosted: false }] : []),
    ...(paths.length > 0 ? [{ name: "clean room", directory: "ts", args: ["scripts/cleanRoom.ts"], fix: "follow wisp:docs/clean-room.md and the line above.", hosted: true, readsOnly: true }] : []),
    ...(ts ? [
      { name: "kind tags, parity ledger and type-check ts", directory: "ts", args: ["run", "check"], fix: "end each refused test title with its kind tag (listed above) or delete the test; for a ledger row, regenerate docs/design/melee-parity.md with bun wisp ledger or give the named row the status it now needs (docs/design/melee-parity-plan.md, \"Ledger\"); fix each type error.", hosted: true },
      { name: "every scene model has facts", directory: "ts", args: ["scripts/wisp.ts", "view", "models", "--check"], fix: "measure the listed models with the command above and commit their shards (smashcraft:docs/player-view.md).", hosted: false, readsOnly: true },
    ] : []),
    ...(effectKit ? [
      { name: "effect-kit check", directory: ".", args: [EFFECT_KIT, "check"], fix: `CI runs north's effect-kit check (smashcraft:.github/workflows/ci.yml); fix each problem above, or if ${EFFECT_KIT} is missing, git clone https://github.com/tompassarelli/north ${NORTH} (git -C ${NORTH} pull keeps it on the main CI clones).`, hosted: false, machineTool: true },
    ] : []),
    ...(suites ? [
      { name: "Autoland suite covers the farm suite", directory: "ts", args: ["scripts/suiteParity.ts"], fix: "give Autoland's suite every farm-test job and input, since safe-push hands a lane to Autoland without its own farm run (smashcraft:docs/ci.md, \"Autoland\").", hosted: true },
    ] : []),
    ...(mapInputs ? [{ name: "private map-build inputs", directory: "ts", args: ["scripts/wisp.ts", "map", "build", "--profile", "playable", "--edition", "classic", "--inputs-only"], fix: "regenerate and store the missing inputs before landing (smashcraft:docs/build-inputs.md).", hosted: false, privateStore: true }] : []),
    ...(models ? [
      { name: "generated models stored", directory: "ts", args: ["scripts/storedModels.ts"], fix: "store the regenerated family (smashcraft:docs/build-inputs.md, \"Change art\").", hosted: false, inputs: ["build-inputs", "tools/animations", ...SCRIPT_INPUTS] },
      { name: "stored portraits match their models", directory: "ts", args: ["test", "test/portraitSources.test.ts"], fix: "re-render the listed fighters with bun scripts/fighterPortraits.ts PRIVATE_OUTPUT --only NAME and store the result as fighter-renders (smashcraft:docs/design/fighter-portraits.md).", hosted: false, privateStore: true },
      { name: "body-fade record names the bodies the clip table plays", directory: "ts", args: ["test", "test/bodyFades.test.ts"], fix: "re-record it with bun scripts/bodyFades.ts --record from ts/ and check that no down action newly fades (smashcraft:docs/commands/animation.md).", hosted: false },
    ] : []),
    ...(cueModels ? [
      { name: "cue models and Classic effect record", directory: "ts", args: ["scripts/cueModels.ts"], fix: `record new models with ${RECORD_COMMAND} from ts/ (smashcraft:docs/commands/workflow.md).`, hosted: true, localFix: true },
    ] : []),
    ...(fighterArt.length > 0 ? [
      { name: `fighter art reproduces (${fighterArt.join(", ")})`, directory: "ts", args: ["scripts/wisp.ts", "inputs", "derive", "--check", ...fighterArt.flatMap((slug) => ["--fighter", slug])], fix: "derive the listed fighters from this landing's producers and commit their pins and generated files (smashcraft:docs/build-inputs.md, \"Change art\").", hosted: false, privateStore: true },
    ] : []),
    ...(locomotion ? [
      { name: "Illidan's walk and run match their locomotion lock", directory: "ts", args: ["scripts/locomotionLock.ts"], fix: `regenerate the model from the current pinned input so the walk and run keep their keys; only an intended walk or run change re-records with bun scripts/locomotionLock.ts --record and a ${LOCOMOTION_TRAILER} trailer naming it (smashcraft:docs/fighter-animation-work.md).`, hosted: false, privateStore: true },
    ] : []),
    ...(strikeMoments ? [
      { name: "strike moments match the committed models", directory: "ts", args: ["scripts/wisp.ts", "view", "strikes", "--check"], fix: "regenerate the tables with bun wisp view strikes --assets \"$(bun wisp inputs path assets)\" from ts/ and commit them (smashcraft:docs/build-inputs.md, \"Change art\").", hosted: false, privateStore: true },
    ] : []),
    ...(animation ? [
      { name: "animation jitter [k3 measure #479]", directory: "ts", args: ["scripts/wisp.ts", "anim", "jitter"], fix: "regenerate the clip pool through thinKeys so close Hermite keys carry slopes (smashcraft:docs/commands/animation.md).", hosted: false, inputs: ["build-inputs", "tools/animations", ...SCRIPT_INPUTS] },
    ] : []),
  ];
}


export const run = (command: readonly string[], cwd: string, stdout: "pipe" | "ignore" = "pipe") => runGroup(command, { cwd, stdout }).pipe(
  Effect.mapError((failure) => new PrePushRefusal({ problem: `pre-push: ${failure.message}` })),
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

const runCheckOnce = (check: Check, local: Local) => Effect.gen(function*() {
  const key = check.privateStore || check.machineTool ? Option.none<string>() : yield* local.key(check);
  if (Option.isSome(key) && (yield* local.cache.has(key.value))) return yield* Console.error(`pre-push: ${check.name} passed before on these inputs (cache ${key.value.slice(0, 12)})`);
  const started = performance.now();
  const child = yield* local.runner(check);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (child.exitCode !== 0) {
    return yield* new PrePushRefusal({ problem: `${child.stdout}${child.stderr}\npre-push: ${check.name} failed (${seconds} s); ${check.fix ?? "fix it before landing."}` });
  }
  if (Option.isSome(key)) yield* local.cache.record(key.value);
  yield* Console.error(`pre-push: ${check.name} passed (${seconds} s)`);
});

export const runChecks = (checks: readonly Check[], local: Local) => Effect.all([
  Effect.forEach(checks.filter(({ readsOnly }) => readsOnly === true), (check) => runCheckOnce(check, local), { concurrency: "unbounded", discard: true }),
  Effect.forEach(checks.filter(({ readsOnly }) => readsOnly !== true), (check) => runCheckOnce(check, local), { discard: true }),
], { concurrency: "unbounded", discard: true });

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

export const FARM_SCRATCH = "refs/heads/farm/";

export const HAND_OFF ="refs/heads/claude/land-";

export function autolandLands(queue: string, paths: readonly string[]): boolean {
  return queue === "autoland" && !paths.some((path) => path.startsWith(WORKFLOWS));
}

const landingQueue = run(["git", "config", "--file", join(root, ".safe-push"), "--default", "", "landing.queue"], root).pipe(
  Effect.map(({ exitCode, stdout }) => (exitCode === 0 ? stdout.trim() : "")),
);

export const RELEASE_TAG = /^refs\/tags\/v\d+\.\d+(\.\d+)?(-rc\.\d+)?$/;

const CiRuns = Schema.fromJsonString(Schema.Array(Schema.Struct({ conclusion: Schema.NullOr(Schema.String) })));

/** The conclusions of main's CI runs on the commit a pushed tag or commit names, newest first. */
export type MainCi = (commit: string) => Effect.Effect<readonly string[], PrePushRefusal>;

const mainCi: MainCi = (pushed) => Effect.gen(function*() {
  const commit = yield* git("rev-parse", `${pushed}^{commit}`);
  const refusal = (cause: unknown) => new PrePushRefusal({ problem: `pre-push: read main's CI runs on ${commit.slice(0, 12)}: ${cause}` });
  const { exitCode, stdout, stderr } = yield* run(["gh", "api", `repos/{owner}/{repo}/actions/workflows/ci.yml/runs?head_sha=${commit}&branch=main&per_page=20`, "--jq", "[.workflow_runs[] | {conclusion}]"], root);
  if (exitCode !== 0) return yield* refusal(stderr.trim());
  const runs = yield* Schema.decodeEffect(CiRuns)(stdout).pipe(Effect.mapError(refusal));
  return runs.map(({ conclusion }) => conclusion ?? "pending");
});

/** A release or release-candidate tag goes only on a commit main's CI passed, since the parity tapes run there after landing (smashcraft:docs/ci.md, "Landing"). */
const releaseGreen = (tag: string, commit: string, ci: MainCi) => Effect.gen(function*() {
  const conclusions = yield* ci(commit);
  if (conclusions.includes("success")) return;
  return yield* new PrePushRefusal({ problem: `pre-push: ${tag.slice("refs/tags/".length)} names ${commit.slice(0, 12)}, but main's CI has not passed on it (${conclusions.length === 0 ? "no run" : conclusions.join(", ")}); a release candidate needs the parity tapes and every check main runs after landing green on its commit, so tag a commit whose CI run passed or rerun CI on this one.` });
});

export interface Landing {
  readonly gate: (head: string, paths: readonly string[], alongside: Effect.Effect<void, PrePushRefusal>) => Effect.Effect<void, PrePushRefusal>;
  readonly queue: typeof landingQueue;
  readonly notice?: Effect.Effect<void>;
  readonly mainCi?: MainCi;
}

export const prePush = (input: string, landing: Landing = { gate: landingGate, queue: landingQueue }, local: Local = laptop) =>
  Effect.all([landing.notice ?? mainRedNotice, pushChecks(input, landing, local)], { concurrency: "unbounded", discard: true });

const pushChecks = (input: string, landing: Landing, local: Local) => Effect.gen(function*() {
  const released = input.split("\n").flatMap((line) => {
    const [, commit, remoteRef] = line.trim().split(/\s+/);
    return commit === undefined || remoteRef === undefined || ZERO.test(commit) || !RELEASE_TAG.test(remoteRef) ? [] : [{ commit, remoteRef }];
  });
  yield* Effect.forEach(released, ({ commit, remoteRef }) => releaseGreen(remoteRef, commit, landing.mainCi ?? mainCi), { discard: true });
  const pushed = input.split("\n").flatMap((line) => {
    const [, commit, remoteRef, remote] = line.trim().split(/\s+/);
    return commit === undefined || remote === undefined || ZERO.test(commit) || remoteRef?.startsWith("refs/tags/") ? [] : [{ commit, remoteRef, remote }];
  });
  if (pushed.length > 0 && pushed.every(({ remoteRef }) => remoteRef?.startsWith(FARM_SCRATCH) === true)) return;
  const paths = [...new Set((yield* Effect.forEach(pushed,({ commit, remote }) => local.changed(commit, remote))).flat())];
  const selected = checksFor(paths, local.cues(), local.strikes()).filter((check) => !((check.privateStore || check.machineTool) && local.hosted));
  const toMain = pushed.some(({ remoteRef }) => remoteRef === "refs/heads/main");
  const handsOff = pushed.some(({ remoteRef }) => remoteRef === "refs/heads/main" || remoteRef?.startsWith(HAND_OFF) === true);
  const lands = handsOff ? autolandLands(yield* landing.queue, paths) : false;
  const checks = lands ? selected.filter(({ hosted, localFix }) => !hosted || localFix === true) : selected;
  const deferred = lands ? selected.filter(({ hosted, localFix }) => hosted && localFix !== true) : [];
  if (checks.length === 0 && !toMain) return;
  const head = yield* local.head;
  const dirty = checks.length === 0 ? "" : yield* local.dirty(checks.some(({ privateStore, machineTool }) => privateStore || machineTool) ? ["."] : [...new Set(checks.map(({ directory }) => directory))]);
  if (pushed.some(({ commit }) => commit !== head) || dirty !== "") {
    return yield* new PrePushRefusal({ problem: `pre-push: the checks read the working tree, so push the clean checked-out commit (HEAD ${head.slice(0, 12)}).\n${dirty}` });
  }
  if (deferred.length > 0) yield* Console.error(`pre-push: Autoland's build runs ${deferred.map(({ name }) => name).join(", ")} in this hook on the rebased candidate before it lands`);
  if (toMain && !lands) return yield* landing.gate(head, paths, runChecks(checks, local));
  yield* runChecks(checks, local);
  if (lands) yield* Console.error("pre-push: Autoland runs the farm suite on the rebased candidate before it lands, so this push waits for no farm run");
});

const GATE_TIMEOUT_SECONDS = 1200;

export type GateRunner = (checks: readonly LandingCheck[]) => Effect.Effect<Finished, PrePushRefusal>;

export const localRunner: GateRunner = (checks) => run(admitted(process.env.SAFE_PUSH_LOCK_HELD === undefined ? "heavy" : "critical", "land-check", GATE_TIMEOUT_SECONDS,
  [process.execPath, "scripts/landingRun.ts", "here", ...checks.map(({ name }) => name)]), join(root, "ts"));

const phase = (runner: GateRunner, checks: readonly LandingCheck[], head: string) => checks.length === 0 ? Effect.void : runner(checks).pipe(
  Effect.flatMap((finished) => Effect.gen(function*() {
    const lines = finished.stderr.split("\n").filter((line) => line.trim() !== "");
    if (finished.exitCode === 0) return yield* Effect.forEach(lines.filter((line) => line.startsWith("landing check: ")), (line) => Console.error(`pre-push: ${line}`), { discard: true });
    return yield* new PrePushRefusal({ problem: `${finished.stdout}${finished.stderr}\npre-push: a landing check failed on ${head.slice(0, 12)}; main lands only on green checks, including ones main already fails` });
  })),
);

export const landingGate = (head: string, paths: readonly string[], alongside: Effect.Effect<void, PrePushRefusal> = Effect.void, runner: GateRunner = localRunner) => Effect.gen(function*() {
  const landing = landingSelection(paths, process.env[FULL_SUITE_VARIABLE] === "1");
  for (const line of selectionLines(paths, landing)) yield* Console.error(`pre-push: ${line}`);
  const checks = landing.run.map(({ check }) => check);
  const started = performance.now();
  yield* Effect.all([alongside, phase(runner, checks.filter(({ here }) => here === "beside"), head)], { concurrency: "unbounded", discard: true });
  yield* Effect.forEach(checks.filter(({ here }) => here === "alone"), (check) => phase(runner, [check], head), { discard: true });
  const seconds = ((performance.now() - started) / 1000).toFixed(0);
  yield* Console.error(checks.length === 0
    ? `pre-push: no landing check can be affected, so ${head.slice(0, 12)} lands on the local checks; main's CI runs the full suite after it lands`
    : `pre-push: ${checks.length} landing check${checks.length === 1 ? "" : "s"} and the local checks passed on ${head.slice(0, 12)} (${seconds} s)`);
});

if (import.meta.main) {
  for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]] as const) {
    process.on(signal, () => {
      killChildren();
      process.exit(code);
    });
  }
  const refused = await Effect.runPromise(prePush(await Bun.stdin.text()).pipe(
    Effect.as(undefined),
    Effect.catchTag("PrePushRefusal", (refusal: PrePushRefusal) => Effect.succeed(refusal.problem)),
  ));
  if (refused !== undefined) {
    console.error(refused);
    process.exit(1);
  }
}
