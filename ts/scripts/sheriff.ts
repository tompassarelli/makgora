import { appendFileSync } from "node:fs";
import { Console, Effect, Schema } from "effect";
import { captureProcess } from "wisp/scripts/wisp/mapBuild";

class SheriffFailure extends Schema.TaggedError<SheriffFailure>()("SheriffFailure", { command: Schema.String, problem: Schema.String }) {
  override get message(): string {
    return `${this.command}: ${this.problem}`;
  }
}

export interface Step { readonly name: string; readonly conclusion: string }
export interface Job { readonly name: string; readonly conclusion: string; readonly steps: readonly Step[]; readonly failures?: readonly string[] }
export interface CiRun { readonly conclusion: string; readonly attempt?: number; readonly jobs: readonly Job[] }
export interface Commit { readonly sha: string; readonly message: string }
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
  | { readonly kind: "revert"; readonly why: string; readonly step: string; readonly shas: readonly string[] };

export const REVERT_TRAILER = "Sheriff-Reverts:";
const SETUP_STEP = /^(?:Set up job|Complete job|Post |Run actions\/|Run oven-sh\/setup-bun|Run bun install|Install stock texture converter)/;
const INFRA_JOB = new Set(["cancelled", "timed_out", "startup_failure", "action_required", "stale"]);
const UNMEASURED_TITLE = "Unmeasured";
const UNMEASURED = new RegExp(`^${UNMEASURED_TITLE}:|has timed out after|exceeded the maximum execution time|lost communication with the server|received a shutdown signal|The operation was canceled`);

export function unmeasured(job: Job): string | undefined {
  if (INFRA_JOB.has(job.conclusion)) return `job ${job.name} ${job.conclusion}`;
  if (job.conclusion !== "failure") return undefined;
  const step = job.steps.find((entry) => entry.conclusion === "failure");
  if (step === undefined) return `job ${job.name} failed without a failing step (runner lost)`;
  if (SETUP_STEP.test(step.name)) return `setup step failed (${job.name}: ${step.name})`;
  const annotation = job.failures?.find((line) => UNMEASURED.test(line));
  return annotation === undefined ? undefined : `${job.name}: ${annotation}`;
}

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
  return { kind: "revert", why: `${step} failed after a green parent`, step, shas: commits.map((commit) => commit.sha) };
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
const withFailures = <R extends { readonly jobs: readonly (Job & { readonly databaseId: number })[] }>(view: R) =>
  Effect.forEach(view.jobs, (job) => job.conclusion === "failure" ? failureLines(job.databaseId).pipe(Effect.map((failures) => ({ ...job, failures }))) : Effect.succeed(job))
    .pipe(Effect.map((jobs) => ({ ...view, jobs })));

const output = (line: string) => Effect.sync(() => {
  if (process.env.GITHUB_STEP_SUMMARY !== undefined) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Sheriff: ${line}\n`);
}).pipe(Effect.andThen(Console.log(`::notice title=Sheriff::${line}`)));
const setOutput = (key: string, value: string) => Effect.sync(() => {
  if (process.env.GITHUB_OUTPUT !== undefined) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
});

const revertOnMain = (verdict: Extract<Verdict, { kind: "revert" }>, base: string, head: string, runUrl: string, issues: readonly number[]) => Effect.gen(function*() {
  const subject = (yield* git("log", "-1", "--format=%s", head)).trim();
  const title = verdict.shas.length === 1
    ? `Revert "${subject}"`
    : `Revert the ${verdict.shas.length} commits landed in ${base.slice(0, 10)}..${head.slice(0, 10)}`;
  const message = [title, "", `Main went red after a green parent: ${verdict.step}`, `CI run: ${runUrl}`, "",
    ...issues.map((issue) => `Refs smashcraft#${issue}`), `${REVERT_TRAILER} ${verdict.shas.join(" ")}`].join("\n");
  for (let attempt = 1; ; attempt++) {
    yield* git("fetch", "-q", "origin", "main");
    yield* git("checkout", "-q", "-B", "sheriff", "origin/main");
    const reverted = yield* git("revert", "--no-edit", "--no-commit", `${base}..${head}`).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
    if (!reverted) {
      yield* git("revert", "--abort").pipe(Effect.ignore);
      return yield* new SheriffFailure({ command: "git revert", problem: `${base.slice(0, 10)}..${head.slice(0, 10)} doesn't revert cleanly on main` });
    }
    yield* git("commit", "-q", "-m", message);
    const pushed = yield* git("push", "-q", "origin", "HEAD:refs/heads/main").pipe(Effect.as(true), Effect.catch((error) => attempt < 3 ? Effect.succeed(false) : Effect.fail(error)));
    if (pushed) return (yield* git("rev-parse", "HEAD")).trim();
  }
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
  const commits = range === undefined ? [] : (yield* git("log", "-z", "--format=%H%n%B", range)).split("\0").filter((entry) => entry.trim() !== "")
    .map((entry) => ({ sha: entry.slice(0, entry.indexOf("\n")), message: entry.slice(entry.indexOf("\n") + 1).trim() }));
  const workflowFiles = range === undefined ? [] : (yield* git("diff", "--name-only", prior?.headSha ?? "", ci.headSha, "--", ".github/workflows")).split("\n").filter(Boolean);
  const verdict = decide({ run: ci, previous, commits, workflowFiles });
  if (verdict.kind === "rerun") yield* gh("run", "rerun", runId, "--failed");
  if (verdict.kind !== "revert" || prior === undefined) {
    yield* output(`${verdict.kind}: ${verdict.why} (${ci.url})`);
    return yield* Console.log(`${verdict.kind}: ${verdict.why}`);
  }
  const issues = referencedIssues(commits);
  const revert = yield* revertOnMain(verdict, prior.headSha, ci.headSha, ci.url, issues);
  yield* setOutput("reverted", revert);
  // Pushes made with the workflow token start no workflows: start main's CI (main-red follows it).
  yield* gh("workflow", "run", "ci.yml", "--ref", "main").pipe(Effect.catch((error) => Console.warn(`couldn't start main's CI: ${error.message}`)));
  const shorts = verdict.shas.map((sha) => sha.slice(0, 10)).join(", ");
  for (const issue of issues) {
    const { state } = yield* gh("issue", "view", String(issue), "--json", "state").pipe(Effect.flatMap(decode(IssueState, "gh issue view")));
    if (state !== "OPEN") yield* gh("issue", "reopen", String(issue));
  }
  yield* output(`reverted ${shorts} as ${revert.slice(0, 10)} at failing step \`${verdict.step}\`: ${verdict.why} (${ci.url})${issues.length === 0 ? "; no referenced issue" : `; reopened any closed of #${issues.join(", #")}`}`);
  yield* Console.log(`reverted ${shorts} as ${revert}`);
});

if (import.meta.main) {
  const runId = process.argv[2];
  if (runId === undefined || !/^\d+$/.test(runId)) {
    console.error("usage: bun scripts/sheriff.ts RUN_ID");
    process.exit(2);
  }
  await Effect.runPromise(sheriffRun(runId));
}
