import { parseArgs } from "node:util";
import { Clock, Console, Effect, FileSystem, Schedule, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { runProcess } from "./hostProcess";
import { alertLine, baselines, overruns, timingKey, WATCHED_WORKFLOWS, type TimingRun, type WatchedWorkflow } from "./jobWatchdogCore";

class WatchdogFailure extends Schema.TaggedError<WatchdogFailure>()("WatchdogFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}
const Job = Schema.Struct({ id: Schema.Finite, name: Schema.String, status: Schema.String, conclusion: Schema.NullOr(Schema.String),
  started_at: Schema.NullOr(Schema.String), completed_at: Schema.NullOr(Schema.String), runner_name: Schema.NullOr(Schema.String), labels: Schema.Array(Schema.String) });
const Run = Schema.Struct({ id: Schema.Finite, path: Schema.String, status: Schema.String, run_attempt: Schema.Finite, created_at: Schema.String, updated_at: Schema.String, display_title: Schema.String });
const History = Schema.Array(Schema.Struct({ id: Schema.Finite, workflow: Schema.Literals(WATCHED_WORKFLOWS), run_attempt: Schema.Finite, status: Schema.String, jobs: Schema.Array(Job) }));
const Receipt = Schema.Struct({ runId: Schema.Finite, jobId: Schema.Finite, line: Schema.String,
  priorFailure: Schema.Boolean, requestedAt: Schema.Finite, phase: Schema.Literals(["cancel", "retry", "done"]), alerted: Schema.Array(Schema.String) });
const Receipts = Schema.Array(Receipt);
const { values } = parseArgs({ args: process.argv.slice(2), options: {
  help: { type: "boolean" }, "probe-run": { type: "string" }, baseline: { type: "boolean" }, once: { type: "boolean" }, apply: { type: "boolean" }, state: { type: "string" }, repo: { type: "string" },
} });
const repo = values.repo ?? "tompassarelli/smashcraft";
const state = values.state ?? `${process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`}/smashcraft-job-watchdog`;
const command = (program: string, args: readonly string[]) => runProcess(ChildProcess.make(program, args)).pipe(Effect.timeout("60 seconds"));
const gh = (...args: string[]) => command("gh", args);
const api = <A, I>(path: string, schema: Schema.Codec<A, I>) => gh("api", `repos/${repo}/${path}`).pipe(Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(schema))));
const workflow = (path: string): WatchedWorkflow | undefined => WATCHED_WORKFLOWS.find(name => path === `.github/workflows/${name}`);
const jobs = (id: number, attempt?: number) => api(`actions/runs/${id}/${attempt === undefined ? "jobs?per_page=100&filter=latest" : `attempts/${attempt}/jobs?per_page=100`}`, Schema.Struct({ jobs: Schema.Array(Job), total_count: Schema.Finite })).pipe(
  Effect.flatMap(result => result.total_count > 100 ? Effect.fail(new WatchdogFailure({ problem: `run ${id} exceeds the bounded 100-job census` })) : Effect.succeed(result.jobs)),
);
const save = <A>(path: string, value: A) => Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(`${path}.next`, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  yield* fs.rename(`${path}.next`, path);
});
const read = <A, I>(path: string, schema: Schema.Codec<A, I>) => Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;
  return yield* Schema.decodeEffect(Schema.fromJsonString(schema))(yield* fs.readFileString(path));
});
const refresh = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;
  const now = yield* Clock.currentTimeMillis;
  let history: readonly TimingRun[] = (yield* fs.exists(`${state}/history.json`)) ? yield* read(`${state}/history.json`, History) : [];
  const known = new Set(history.map(run => `${run.id}:${run.run_attempt}`));
  let requests = 0;
  for (const name of WATCHED_WORKFLOWS) {
    const pages: (typeof Run.Type)[][] = [];
    for (let page = 1; page <= 20; page++) {
      if (requests >= 800) return yield* new WatchdogFailure({ problem: "baseline exhausted its total 800 REST request budget" });
      requests++;
      const result = yield* api(`actions/workflows/${name}/runs?status=completed&per_page=100&page=${page}`, Schema.Struct({ workflow_runs: Schema.Array(Run) }));
      pages.push([...result.workflow_runs]);
      const last = result.workflow_runs.at(-1);
      if (result.workflow_runs.length < 100 || (last !== undefined && Date.parse(last.created_at) < now - 8 * 24 * 60 * 60 * 1000)) break;
      if (page === 20) return yield* new WatchdogFailure({ problem: `${name} exceeded its 20-page history budget; no complete baseline claimed` });
    }
    for (const run of pages.flat()) {
      if (name === "autoland.yml" && !/^Autoland (test|train)(?: |$)/.test(run.display_title)) continue;
      if (Date.parse(run.updated_at) < now - 7 * 24 * 60 * 60 * 1000) continue;
      for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
      if (known.has(`${run.id}:${attempt}`)) continue;
      if (requests >= 800) return yield* new WatchdogFailure({ problem: "baseline exceeded its total 800 REST request budget; partial history saved, refresh again before monitoring" });
      if (requests % 100 === 0) {
        requests++;
        const limit = yield* gh("api", "rate_limit").pipe(Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({ resources: Schema.Struct({ core: Schema.Struct({ remaining: Schema.Finite }) }) })))));
        if (limit.resources.core.remaining <= 3000) return yield* new WatchdogFailure({ problem: "baseline stopped at shared 3000-call reserve" });
      }
      history = [...history, { id: run.id, workflow: name, run_attempt: attempt, status: run.status, jobs: yield* jobs(run.id, attempt) }];
      requests++;
      yield* save(`${state}/history.json`, history);
      if (requests % 25 === 0) yield* Console.log(`baseline: ${requests} REST requests, ${baselines(history, now).length} comparable groups`);
      }
    }
  }
  history = history.filter(run => run.jobs.some(job => job.completed_at !== null && Date.parse(job.completed_at) >= now - 7 * 24 * 60 * 60 * 1000));
  yield* save(`${state}/history.json`, history);
  yield* save(`${state}/baseline-ready.json`, { at: now });
  yield* Console.log(JSON.stringify({ requests, runs: history.length, baselines: baselines(history, now) }));
});
const monitor = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;
  const now = yield* Clock.currentTimeMillis;
  const ready = yield* read(`${state}/baseline-ready.json`, Schema.Struct({ at: Schema.Finite }));
  if (now - ready.at > 24 * 60 * 60 * 1000) return yield* new WatchdogFailure({ problem: "refresh the complete 7-day baseline before monitoring; no guessed median" });
  const history = yield* read(`${state}/history.json`, History);
  let receipts = (yield* fs.exists(`${state}/receipts.json`)) ? yield* read(`${state}/receipts.json`, Receipts) : [];
  const remember = (receipt: typeof Receipt.Type) => Effect.gen(function*() {
    receipts = [...receipts.filter(row => row.runId !== receipt.runId), receipt];
    yield* save(`${state}/receipts.json`, receipts);
  });
  for (let receipt of values.apply ? receipts.filter(row => row.phase !== "done" && (values["probe-run"] === undefined || String(row.runId) === values["probe-run"])) : []) {
    const run = yield* api(`actions/runs/${receipt.runId}`, Run);
    if (workflow(run.path) === undefined) return yield* new WatchdogFailure({ problem: `receipt ${receipt.runId} names an unwatched workflow` });
    for (const node of ["smashcraft-lead", "alerts"]) {
      if (receipt.alerted.includes(node)) continue;
      yield* command("socrates-chat", ["post", "--as", node, "--kind", "notice", "--tag", `job-watchdog-${receipt.runId}`, receipt.line]);
      receipt = { ...receipt, alerted: [...receipt.alerted, node] };
      yield* remember(receipt);
    }
    if (run.run_attempt > 1) { yield* remember({ ...receipt, phase: "done" }); continue; }
    if (run.status !== "completed") {
      const running = yield* jobs(run.id);
      const original = running.find(job => job.id === receipt.jobId);
      if (original?.status === "completed" && original.conclusion !== "cancelled") {
        yield* remember({ ...receipt, phase: "done" });
        continue;
      }
      if (now - receipt.requestedAt >= 40000) yield* gh("api", "--method", "POST", `repos/${repo}/actions/runs/${run.id}/force-cancel`);
      else yield* gh("api", "--method", "POST", `repos/${repo}/actions/runs/${run.id}/cancel`);
      continue;
    }
    const completed = yield* jobs(run.id);
    if (receipt.priorFailure || completed.some(job => job.conclusion === "failure")) {
      yield* Console.log(`run ${run.id}: genuine failure preserved; no automatic test retry`);
      yield* remember({ ...receipt, phase: "done" });
      continue;
    }
    if (completed.find(job => job.id === receipt.jobId)?.conclusion !== "cancelled") {
      yield* remember({ ...receipt, phase: "done" });
      continue;
    }
    receipt = { ...receipt, phase: "retry" };
    yield* remember(receipt);
    yield* gh("api", "--method", "POST", `repos/${repo}/actions/runs/${run.id}/rerun-failed-jobs`);
  }
  const active: TimingRun[] = [];
  for (const name of WATCHED_WORKFLOWS) {
    const page = yield* api(`actions/workflows/${name}/runs?status=in_progress&per_page=100`, Schema.Struct({ workflow_runs: Schema.Array(Run), total_count: Schema.Finite }));
    if (page.total_count > 100) return yield* new WatchdogFailure({ problem: "more than 100 active runs; refusing an incomplete census" });
    for (const run of page.workflow_runs) {
      if (values["probe-run"] !== undefined && String(run.id) !== values["probe-run"]) continue;
      if (run.status !== "in_progress" || run.run_attempt !== 1 || receipts.some(receipt => receipt.runId === run.id)) continue;
      active.push({ id: run.id, workflow: name, run_attempt: run.run_attempt, status: run.status, jobs: yield* jobs(run.id) });
    }
  }
  const measured = new Set(baselines(history, now).map(row => row.key));
  for (const run of active) for (const job of run.jobs.filter(job => job.status === "in_progress" && job.runner_name)) {
    if (!measured.has(timingKey(run.workflow, job))) yield* Console.log(`unknown median: ${run.workflow}/${job.name}; observation only`);
  }
  const acted = new Set<number>();
  for (const candidate of overruns(active, history, now)) {
    if (acted.has(candidate.runId)) continue;
    const line = alertLine(candidate);
    yield* Console.log(line);
    if (!values.apply) continue;
    const current = yield* api(`actions/runs/${candidate.runId}`, Run);
    const currentJobs = yield* jobs(candidate.runId);
    const name = workflow(current.path);
    if (values["probe-run"] !== undefined) {
      const probe = yield* api(`actions/runs/${candidate.runId}`, Schema.Struct({ head_branch: Schema.String }));
      if (probe.head_branch !== "codex/autoland-job-watchdog") return yield* new WatchdogFailure({ problem: "probe cancellation requires the owned watchdog branch" });
    }
    if (name === undefined || !overruns([{ id: current.id, workflow: name, status: current.status, run_attempt: current.run_attempt, jobs: currentJobs }], history, yield* Clock.currentTimeMillis).some(row => row.jobId === candidate.jobId)) continue;
    const notice = currentJobs.some(job => job.conclusion === "failure") ? line.replace(", hosted retry", ", existing failure preserved; no retry") : line;
    yield* remember({ runId: candidate.runId, jobId: candidate.jobId, line: notice, priorFailure: currentJobs.some(job => job.conclusion === "failure"), requestedAt: now, phase: "cancel", alerted: [] });
    yield* gh("api", "--method", "POST", `repos/${repo}/actions/runs/${candidate.runId}/cancel`);
    acted.add(candidate.runId);
  }
});
const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(state, { recursive: true, mode: 0o700 });
  if (values.baseline) return yield* refresh;
  if (values.help) return yield* Console.log("usage: bun scripts/jobWatchdog.ts --baseline | [--once] [--apply] [--state DIRECTORY] [--repo OWNER/REPO] [--probe-run ID]; observation is the default; apply requires checked main or an isolated codex probe");
  if (values.apply && values["probe-run"] === undefined) {
    const local = yield* command("git", ["rev-parse", "HEAD"]);
    const remote = yield* api("commits/main", Schema.Struct({ sha: Schema.String }));
    if (local !== remote.sha) return yield* new WatchdogFailure({ problem: "apply requires the reviewed checked command and routing on current main" });
  }
  yield* Effect.acquireUseRelease(fs.makeDirectory(`${state}/monitor.lock`), () => values.once ? monitor : monitor.pipe(Effect.repeat({ schedule: Schedule.spaced("20 seconds") })), () => fs.remove(`${state}/monitor.lock`));
});
BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));
