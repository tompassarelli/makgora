import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";
import { Console, Effect, Schema } from "effect";
import { failedTest } from "./mainRed";
import { collect } from "wisp/scripts/wisp/hostProcess";
import { captureProcess } from "wisp/scripts/wisp/hostProcess";
import { type CiJob, type CiStep, unmeasured } from "./autolandCore";

class SheriffFailure extends Schema.TaggedError<SheriffFailure, { readonly brand: unique symbol }>()("SheriffFailure", { command: Schema.String, problem: Schema.String }) {
  override get message(): string {
    return `${this.command}: ${this.problem}`;
  }
}

export type { CiJob as Job, CiStep as Step };
export interface CiRun { readonly conclusion: string; readonly attempt?: number; readonly jobs: readonly CiJob[] }
export interface Commit { readonly sha: string; readonly message: string; readonly files?: readonly string[] }
export interface Situation {
  readonly run: CiRun;
  readonly previous: (CiRun & { readonly ancestor: boolean }) | undefined;
  readonly commits: readonly Commit[];
  readonly workflowFiles: readonly string[];
}
export type Verdict =
  | { readonly kind: "none"; readonly why: string }
  | { readonly kind: "report"; readonly why: string }
  | { readonly kind: "rerun"; readonly why: string }
  | { readonly kind: "bisect"; readonly why: string; readonly step: string }
  | { readonly kind: "revert"; readonly why: string; readonly step: string; readonly shas: readonly string[] };

export const REVERT_TRAILER = "Sheriff-Reverts:";
export function firstFailingStep(run: CiRun): string | undefined {
  const jobs = run.jobs.filter((job) => job.conclusion === "failure" && unmeasured(job) === undefined).toSorted((a, b) => a.name.localeCompare(b.name));
  for (const job of jobs) {
    const step = job.steps.find((entry) => entry.conclusion === "failure");
    if (step !== undefined) return `${job.name}: ${step.name}`;
  }
  return undefined;
}

export function decide({ run, previous, commits, workflowFiles }: Situation): Verdict {
  if (run.conclusion === "success") return { kind: "none", why: "green" };
  if (run.conclusion !== "failure") return { kind: "report", why: `run ${run.conclusion || "unfinished"}: infrastructure, not the commit` };
  const step = firstFailingStep(run);
  if (step === undefined) {
    const why = `${run.jobs.map(unmeasured).find((reason) => reason !== undefined) ?? "no job failed at a step"}: the run measured nothing`;
    return (run.attempt ?? 1) === 1 ? { kind: "rerun", why: `${why}; rerunning the failed jobs` } : { kind: "report", why: `${why} again; the next run on main decides` };
  }
  if (previous === undefined) return { kind: "report", why: `${step} failed; no earlier finished run on main to compare` };
  if (!previous.ancestor) return { kind: "report", why: `${step} failed; the previous run's commit isn't an ancestor` };
  if (previous.conclusion !== "success") {
    const before = firstFailingStep(previous);
    return { kind: "report", why: before === step ? `${step} failed; main was already red there` : `${step} failed on top of an earlier red at ${before ?? "an unknown step"}: two different failures, a person decides` };
  }
  if (commits.length === 0) return { kind: "report", why: `${step} failed with no new commits since green: not deterministic` };
  const revert = commits.find((commit) => commit.message.includes(REVERT_TRAILER) || /^Revert /.test(commit.message));
  if (revert !== undefined) return { kind: "report", why: `${step} failed on a revert (${revert.sha.slice(0, 10)}); never revert a revert` };
  if (workflowFiles.length > 0) return { kind: "report", why: `${step} failed; the landing changes ${workflowFiles.join(", ")}, which the workflow token can't push back` };
  return { kind: "bisect", why: `${step} failed after a green parent`, step };
}

export const LANE_TRAILER = "Autoland-Lane:";
const REPORTS_TRAILER = "Autoland-Reports: 1";
const REPORT_FILES = new Set(["tools/move-data/advantage-state.jsonl", "tools/move-data/advantage-state.md", "docs/design/melee-parity.md"]);
const LaneRecord = Schema.fromJsonString(Schema.Struct({ branch: Schema.String, count: Schema.Int, issues: Schema.Array(Schema.Int) }));
export interface LandedLane {
  readonly branch: string;
  readonly issues: readonly number[];
  readonly parent: string;
  readonly head: string;
  readonly commits: readonly string[];
}

export function landedLanes(base: string, commits: readonly Commit[]): readonly LandedLane[] | undefined {
  const lanes: LandedLane[] = [];
  for (let end = commits.length - 1; end >= 0;) {
    const commit = commits[end]!;
    const records = commit.message.split("\n").filter((line) => line.startsWith(LANE_TRAILER));
    if (records.length === 0 && commit.message.split("\n").includes(REPORTS_TRAILER)) {
      if (commit.files === undefined || commit.files.length === 0 || !commit.files.every((file) => REPORT_FILES.has(file))) return undefined;
      end--;
      continue;
    }
    if (records.length !== 1) return undefined;
    const record = Schema.decodeOption(LaneRecord)(records[0]!.slice(LANE_TRAILER.length).trim());
    if (record._tag === "None") return undefined;
    const { branch, count, issues } = record.value;
    const start = end - count + 1;
    if (!branch.startsWith("claude/") || count < 1 || start < 0 || issues.some((issue) => issue < 1)) return undefined;
    if (commits.slice(start, end).some((entry) => entry.message.split("\n").some((line) => line.startsWith(LANE_TRAILER) || line === REPORTS_TRAILER))) return undefined;
    lanes.unshift({ branch, issues: [...new Set([...issues, ...referencedIssues(commits.slice(start, end + 1))])].toSorted((a, b) => a - b), parent: commits[start - 1]?.sha ?? base, head: commit.sha, commits: commits.slice(start, end + 1).map((entry) => entry.sha) });
    end = start - 1;
  }
  return lanes.length === 0 ? undefined : lanes;
}

export interface Probe { readonly head: string; readonly without?: readonly string[] }
export type ProbeResult = "pass" | "fail" | "unmeasured";
export function* bisect(lanes: readonly LandedLane[], main: string): Generator<Probe, LandedLane | undefined, ProbeResult> {
  const first = lanes[0];
  if (first === undefined) return undefined;
  const results = new Map<string, ProbeResult>();
  const parent = yield { head: first.parent };
  if (parent !== "pass") return undefined;
  results.set(first.parent, parent);
  const full = yield { head: main };
  if (full !== "fail") return undefined;
  results.set(main, full);
  let low = 0;
  let high = lanes.length;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    const head = lanes[middle - 1]!.head;
    const measured = results.get(head) ?? (yield { head });
    if (measured === "unmeasured") return undefined;
    results.set(head, measured);
    if (measured === "pass") low = middle;
    else high = middle;
  }
  const culprit = lanes[low]!;
  if ((results.get(culprit.parent) ?? (yield { head: culprit.parent })) !== "pass") return undefined;
  if ((results.get(culprit.head) ?? (yield { head: culprit.head })) !== "fail") return undefined;
  if ((yield { head: main, without: culprit.commits.toReversed() }) !== "pass") return undefined;
  return culprit;
}

export function suiteProbe(workflow: string, step: string): { readonly args: readonly string[]; readonly env: Readonly<Record<string, string>> } | undefined {
  if (workflow === "Background sweeps") {
    const env = { SWEEPS: "1", SWEEP_PLACEMENT: "background" };
    if (step === "Background sweeps (bun): Run bun run test") return { args: ["run", "test"], env };
    const lua = /^Background sweeps \(lua32 ([0-2])\/3\): Run bun scripts\/lua-tests\.ts$/.exec(step);
    if (lua !== null) return { args: ["scripts/lua-tests.ts"], env: { ...env, LUA_JOBS: "4", LUA_PARTITION: `${lua[1]}/3` } };
  }
  if (workflow !== "CI") return undefined;
  if (step === "Sweeps (Bun): Run bun run test") return { args: ["run", "test"], env: { SWEEPS: "1", SWEEP_PLACEMENT: "gate" } };
  const partition = /^Lua32 \((bot|remainder|sweeps ([1-6])\/6)\): Run bun scripts\/lua-tests\.ts$/.exec(step);
  if (partition === null) return undefined;
  const sweeps = partition[2] !== undefined;
  return { args: ["scripts/lua-tests.ts"], env: {
    GAME_TESTS: partition[1] === "bot" ? "game/match/bot" : "",
    GAME_TESTS_EXCLUDE: partition[1] === "remainder" ? "game/match/bot" : "",
    SWEEP_PLACEMENT: "gate", SWEEPS: sweeps ? "1" : "", LUA_JOBS: sweeps ? "4" : "1",
    LUA_PARTITION: sweeps ? `${Number(partition[2]) - 1}/6` : "0/1",
  } };
}

export function referencedIssues(commits: readonly Commit[]): number[] {
  const issues = new Set<number>();
  for (const { message } of commits) {
    for (const match of message.matchAll(/(?:refs|fixes|closes) (?:smashcraft)?#(\d+)/gi)) issues.add(Number(match[1]));
    for (const match of (message.split("\n")[0] ?? "").matchAll(/\(#(\d+)\)/g)) issues.add(Number(match[1]));
  }
  return [...issues].toSorted((a, b) => a - b);
}

const run = (command: string, ...args: string[]) => captureProcess(command, args.join(" "), [command, ...args]).pipe(
  Effect.mapError((cause) => new SheriffFailure({ command: `${command} ${args[0]}`, problem: String(cause) })),
  Effect.flatMap(({ exitCode, stdout, stderr }) => exitCode === 0
    ? Effect.succeed(stdout)
    : Effect.fail(new SheriffFailure({ command: `${command} ${args.join(" ")}`, problem: stderr.trim() }))),
);
const gh = (...args: string[]) => run("gh", ...args);
const git = (...args: string[]) => run("git", ...args);

const decode = <S extends Schema.Top>(schema: S, command: string) => (text: string) =>
  Schema.decodeEffect(Schema.fromJsonString(schema))(text).pipe(Effect.mapError((cause) => new SheriffFailure({ command, problem: String(cause) })));

const StepSchema = Schema.Struct({ name: Schema.String, conclusion: Schema.String });
const JobSchema = Schema.Struct({ name: Schema.String, conclusion: Schema.String, databaseId: Schema.Finite, steps: Schema.Array(StepSchema) });
const RunView = Schema.Struct({
  conclusion: Schema.String, headBranch: Schema.String, headSha: Schema.String, url: Schema.String,
  workflowName: Schema.String, databaseId: Schema.Finite, attempt: Schema.Finite, jobs: Schema.Array(JobSchema),
});
const Annotations = Schema.Array(Schema.Struct({ annotation_level: Schema.String, title: Schema.NullOr(Schema.String), message: Schema.String }));
const RunList = Schema.Array(Schema.Struct({ databaseId: Schema.Finite, conclusion: Schema.String, headSha: Schema.String }));
const IssueState = Schema.Struct({ state: Schema.String });

const viewRun = (id: string) =>
  gh("run", "view", id, "--json", "conclusion,headBranch,headSha,url,workflowName,databaseId,attempt,jobs").pipe(Effect.flatMap(decode(RunView, "gh run view")));

const failureLines = (jobId: number) =>
  gh("api", `repos/{owner}/{repo}/check-runs/${jobId}/annotations`).pipe(
    Effect.flatMap(decode(Annotations, "gh api annotations")),
    Effect.map((entries) => entries.filter((entry) => entry.annotation_level === "failure").map((entry) => entry.title ? `${entry.title}: ${entry.message}` : entry.message)),
  );
const withFailures = <R extends { readonly jobs: readonly (CiJob & { readonly databaseId: number })[] }>(view: R) =>
  Effect.forEach(view.jobs, (job) => job.conclusion === "failure" ? failureLines(job.databaseId).pipe(Effect.map((failures) => ({ ...job, failures }))) : Effect.succeed(job))
    .pipe(Effect.map((jobs) => ({ ...view, jobs })));

const output = (line: string) => Effect.sync(() => {
  if (process.env.GITHUB_STEP_SUMMARY !== undefined) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Sheriff: ${line}\n`);
}).pipe(Effect.andThen(Console.log(`::notice title=Sheriff::${line}`)));
const setOutput = (key: string, value: string) => Effect.sync(() => {
  if (process.env.GITHUB_OUTPUT !== undefined) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
});

const probeLane = (probe: Probe, suite: NonNullable<ReturnType<typeof suiteProbe>>, failures: readonly string[]) => Effect.acquireUseRelease(
  Effect.sync(() => {
    const root = resolve(import.meta.dir, "../../build");
    mkdirSync(root, { recursive: true });
    return mkdtempSync(join(root, "sheriff-"));
  }),
  (path) => Effect.gen(function*() {
    yield* git("worktree", "add", "-q", "--detach", path, probe.head);
    if (probe.without !== undefined) yield* run("git", "-C", path, "revert", "--no-commit", ...probe.without);
    const cwd = join(path, "ts");
    yield* runProcess(ChildProcess.make("bun", ["install", "--frozen-lockfile"], { cwd }));
    const measured = yield* collect(ChildProcess.make("bun", suite.args, { cwd, env: {
      GAME_TESTS: "", GAME_TESTS_EXCLUDE: "", SWEEPS: "", SWEEP_PLACEMENT: "", LUA_PARTITION: "0/1", LUA_JOBS: "1", ...suite.env,
    }, extendEnv: true, stdin: "ignore" }));
    const log = new TextDecoder().decode(measured.stdout) + "\n" + measured.stderr;
    const names = log.split("\n").flatMap((line) => {
      const name = failedTest(line);
      return name === undefined ? [] : [name];
    });
    const result = measured.exitCode === 0 ? "pass" as const
      : measured.exitCode === 1 && failures.every((name) => names.includes(name)) ? "fail" as const : "unmeasured" as const;
    yield* Console.log(`Sheriff probe ${probe.head.slice(0, 10)}${probe.without === undefined ? "" : ` minus ${probe.without.join(" ")}`}: ${result}, exit ${measured.exitCode}${names.length === 0 ? "" : `, ${names.join("; ")}`}`);
    return result;
  }),
  (path) => git("worktree", "remove", "--force", path).pipe(Effect.catch(() => Effect.sync(() => rmSync(path, { recursive: true, force: true })))),
);

const confirmLane = (lanes: readonly LandedLane[], main: string, suite: NonNullable<ReturnType<typeof suiteProbe>>, failures: readonly string[]) => Effect.gen(function*() {
  const search = bisect(lanes, main);
  let next = search.next();
  while (!next.done) next = search.next(yield* probeLane(next.value, suite, failures));
  return next.value;
}).pipe(Effect.timeoutOption("45 minutes"), Effect.map((result) => result._tag === "Some" ? result.value : undefined));

const revertOnMain = (verdict: Extract<Verdict, { kind: "revert" }>, lane: LandedLane, main: string, runUrl: string) => Effect.gen(function*() {
  const message = [`Revert Autoland lane ${lane.branch}`, "", `Main went red after a green parent: ${verdict.step}`, `CI run: ${runUrl}`, "",
    ...lane.issues.map((issue) => `Refs smashcraft#${issue}`), `${REVERT_TRAILER} ${verdict.shas.join(" ")}`].join("\n");
  yield* git("fetch", "-q", "origin", "main");
  if ((yield* git("rev-parse", "origin/main")).trim() !== main) return yield* new SheriffFailure({ command: "git revert", problem: "main moved after lane confirmation; reverts nothing" });
  yield* git("checkout", "-q", "-B", "sheriff", main);
  yield* git("revert", "--no-edit", "--no-commit", ...verdict.shas).pipe(Effect.tapError(() => git("revert", "--abort").pipe(Effect.ignore)));
  yield* git("commit", "-q", "-m", message);
  yield* git("push", "-q", "origin", "HEAD:refs/heads/main");
  return (yield* git("rev-parse", "HEAD")).trim();
});

export const sheriffRun = (runId: string) => Effect.gen(function*() {
  const ci = yield* viewRun(runId).pipe(Effect.flatMap(withFailures));
  if (ci.headBranch !== "main" || ci.conclusion === "success") return yield* Console.log(`run ${runId} on ${ci.headBranch} ${ci.conclusion}: nothing to do`);
  const history = yield* gh("run", "list", "--workflow", ci.workflowName, "--branch", "main", "--limit", "50",
    "--json", "databaseId,conclusion,headSha").pipe(Effect.flatMap(decode(RunList, "gh run list")));
  const finished = history.filter((entry) => entry.conclusion === "success" || entry.conclusion === "failure");
  const index = finished.findIndex((entry) => entry.databaseId === ci.databaseId);
  if (index > 0) return yield* Console.log(`run ${runId} is older than run ${finished[0]?.databaseId}: nothing to do`);
  const prior = finished.slice(index + 1).find((entry) => entry.headSha !== ci.headSha);
  yield* git("fetch", "-q", "origin", "main", ci.headSha);
  const ancestor = prior === undefined ? false
    : yield* git("merge-base", "--is-ancestor", prior.headSha, ci.headSha).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
  const previous = prior === undefined ? undefined
    : { ...(prior.conclusion === "success" ? { conclusion: "success", jobs: [] } : yield* viewRun(String(prior.databaseId)).pipe(Effect.flatMap(withFailures))), ancestor };
  const range = ancestor && prior !== undefined ? `${prior.headSha}..${ci.headSha}` : undefined;
  const commits = range === undefined ? [] : (yield* git("log", "--first-parent", "--reverse", "-z", "--format=%H%n%B", range)).split("\0").filter((entry) => entry.trim() !== "")
    .map((entry) => ({ sha: entry.slice(0, entry.indexOf("\n")), message: entry.slice(entry.indexOf("\n") + 1).trim() }));
  const workflowFiles = range === undefined ? [] : (yield* git("diff", "--name-only", prior?.headSha ?? "", ci.headSha, "--", ".github/workflows")).split("\n").filter(Boolean);
  const verdict = decide({ run: ci, previous, commits, workflowFiles });
  if (verdict.kind === "rerun") yield* gh("run", "rerun", runId, "--failed");
  if (verdict.kind !== "bisect" || prior === undefined) {
    yield* output(`${verdict.kind}: ${verdict.why} (${ci.url})`);
    return yield* Console.log(`${verdict.kind}: ${verdict.why}`);
  }
  const measured = ci.jobs.filter((job) => job.conclusion === "failure" && unmeasured(job) === undefined);
  const ambiguous = ci.jobs.some((job) => job.conclusion !== "success" && job.conclusion !== "skipped" && unmeasured(job) !== undefined);
  const suite = suiteProbe(ci.workflowName, verdict.step);
  if (suite === undefined || measured.length !== 1 || ambiguous || measured[0]!.steps.filter((step) => step.conclusion === "failure").length !== 1) {
    return yield* output(`report: ${verdict.step} is unsupported, multi-step or infrastructure-ambiguous; reverts nothing (${ci.url})`);
  }
  const failedLog = yield* gh("run", "view", runId, "--job", String(measured[0]!.databaseId), "--log-failed");
  const failures = failedLog.split("\n").flatMap((line) => {
    const stamped = line.split("\t")[2];
    const name = stamped === undefined ? undefined : failedTest(stamped.replace(/^\S+Z /, ""));
    return name === undefined ? [] : [name];
  });
  if (failures.length === 0) return yield* output(`report: no recorded failed test in ${verdict.step}; reverts nothing (${ci.url})`);
  const withFiles = yield* Effect.forEach(commits, (commit) => commit.message.split("\n").includes(REPORTS_TRAILER)
    ? git("diff-tree", "--no-commit-id", "--name-only", "-r", commit.sha).pipe(Effect.map((files) => ({ ...commit, files: files.trim().split("\n").filter(Boolean) })))
    : Effect.succeed(commit));
  const lanes = landedLanes(prior.headSha, withFiles);
  if (lanes === undefined) return yield* output(`report: landed range has missing, partial or invalid Autoland lane metadata; reverts nothing (${ci.url})`);
  const main = (yield* git("rev-parse", "origin/main")).trim();
  if (!(yield* git("merge-base", "--is-ancestor", ci.headSha, main).pipe(Effect.as(true), Effect.orElseSucceed(() => false)))) {
    return yield* output(`report: failed commit is no longer on main; reverts nothing (${ci.url})`);
  }
  const lane = yield* confirmLane(lanes, main, suite, failures).pipe(Effect.catch((error) => output(`report: lane confirmation failed: ${String(error)}; reverts nothing (${ci.url})`).pipe(Effect.as(undefined))));
  if (lane === undefined) return yield* output(`report: no lane confirmed failing on its parent and passing on main without it; reverts nothing (${ci.url})`);
  const confirmed = { kind: "revert" as const, why: `confirmed culprit lane ${lane.branch}`, step: verdict.step, shas: lane.commits.toReversed() };
  const issues = lane.issues;
  const revert = yield* revertOnMain(confirmed, lane, main, ci.url);
  yield* setOutput("reverted", revert);
  yield* gh("workflow", "run", "ci.yml", "--ref", "main").pipe(Effect.catch((error) => Console.warn(`couldn't start main's CI: ${error.message}`)));
  const shorts = confirmed.shas.map((sha) => sha.slice(0, 10)).join(", ");
  for (const issue of issues) {
    const { state } = yield* gh("issue", "view", String(issue), "--json", "state").pipe(Effect.flatMap(decode(IssueState, "gh issue view")));
    if (state !== "OPEN") yield* gh("issue", "reopen", String(issue));
  }
  yield* output(`reverted ${shorts} as ${revert.slice(0, 10)} at failing step \`${verdict.step}\`: ${confirmed.why} (${ci.url})${issues.length === 0 ? "; no referenced issue" : `; reopened any closed of #${issues.join(", #")}`}`);
  yield* Console.log(`reverted ${shorts} as ${revert}`);
});

if (import.meta.main) {
  const runId = process.argv[2];
  if (runId === undefined || !/^\d+$/.test(runId)) {
    console.error("usage: bun scripts/sheriff.ts RUN_ID");
    process.exit(2);
  }
  BunRuntime.runMain(sheriffRun(runId).pipe(Effect.provide(BunServices.layer)));
}
