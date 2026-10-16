import { Effect, Schema } from "effect";
import { BunRuntime } from "@effect/platform-bun";
import { decoded, FarmFailure, run } from "wisp/scripts/wisp/farm";

export const Jobs = Schema.Struct({ jobs: Schema.Array(Schema.Struct({
  name: Schema.String, status: Schema.String, conclusion: Schema.NullOr(Schema.String),
  started_at: Schema.NullOr(Schema.String), completed_at: Schema.NullOr(Schema.String),
  runner_name: Schema.NullOr(Schema.String), labels: Schema.Array(Schema.String),
})) });
export type Job = typeof Jobs.Type.jobs[number];
const Runs = Schema.Struct({ workflow_runs: Schema.Array(Schema.Struct({ id: Schema.Finite })) });
const Repos = Schema.Array(Schema.Struct({ full_name: Schema.String, pushed_at: Schema.NullOr(Schema.String) }));
const pages = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string) =>
  run(["gh", "api", path, "--paginate", "--slurp"]).pipe(Effect.flatMap((text) => decoded(Schema.Array(schema), text)));

const hosted = (job: Job) => !job.labels.includes("self-hosted") && (job.runner_name?.startsWith("GitHub Actions") === true || job.labels.some((label) => /^(ubuntu|windows|macos)-/.test(label)));

export function reserveP90(jobs: readonly Job[]): number {
  const events = jobs.filter((job) => hosted(job) && job.started_at !== null && job.completed_at !== null && (job.runner_name ?? "") !== "").flatMap((job) => [
    { at: Date.parse(job.started_at ?? ""), delta: 1 }, { at: Date.parse(job.completed_at ?? ""), delta: -1 },
  ]).filter((event) => Number.isFinite(event.at)).sort((a, b) => a.at - b.at || a.delta - b.delta);
  const durations = new Map<number, number>();
  let active = 0, before = events[0]?.at ?? 0;
  for (const event of events) {
    if (active > 0) durations.set(active, (durations.get(active) ?? 0) + event.at - before);
    active += event.delta;
    before = event.at;
  }
  const total = [...durations.values()].reduce((sum, time) => sum + time, 0);
  let elapsed = 0;
  for (const [concurrent, duration] of [...durations].sort(([a], [b]) => a - b)) {
    elapsed += duration;
    if (elapsed >= total * 0.9) return concurrent;
  }
  return 0;
}

export const readJobs = (repo: string, id: number) => pages(Jobs, `repos/${repo}/actions/runs/${id}/jobs?per_page=100`).pipe(Effect.map((all) => all.flatMap((page) => page.jobs)));

export const runnerAdmission = (repo: string, excludeRun: number) => Effect.gen(function*() {
  const owner = repo.split("/")[0] ?? "";
  const repositories = (yield* pages(Repos, `users/${owner}/repos?type=owner&per_page=100`)).flat();
  const recent = repositories.filter((item) => item.full_name === repo || Date.parse(item.pushed_at ?? "") > Date.now() - 14 * 86400000);
  const historyJobs: Job[] = [];
  let samples = 0, busy = 0;
  for (const item of recent) {
    const workflows = yield* run(["gh", "api", `repos/${item.full_name}/actions/workflows?per_page=100`, "--jq", '.workflows[] | select(.name == "Autoland") | .id']);
    for (const workflow of workflows.split("\n").filter(Boolean)) {
      const history = yield* decoded(Runs, yield* run(["gh", "api", `repos/${item.full_name}/actions/workflows/${workflow}/runs?status=completed&per_page=10`]));
      for (const prior of history.workflow_runs) { historyJobs.push(...yield* readJobs(item.full_name, prior.id)); samples++; }
    }
    for (const status of ["queued", "in_progress"]) {
      const active = (yield* pages(Runs, `repos/${item.full_name}/actions/runs?status=${status}&per_page=100`)).flatMap((page) => page.workflow_runs);
      for (const activeRun of active) {
        if (item.full_name === repo && activeRun.id === excludeRun) continue;
        busy += (yield* readJobs(item.full_name, activeRun.id)).filter((job) => hosted(job) && job.status === "in_progress").length;
      }
    }
  }
  const reserve = reserveP90(historyJobs);
  if (reserve === 0) return yield* new FarmFailure({ problem: "No completed hosted Autoland jobs to measure the reserve" });
  const parallel = Math.max(0, 40 - busy - reserve);
  const measurement = `Hosted admission: 40 - ${busy} busy - ${reserve} reserve = ${parallel} farm slots; reserve is time-weighted p90 concurrent hosted jobs across ${samples} Autoland runs in ${recent.length} recently active public repositories`;
  console.error(measurement);
  if (parallel === 0) return yield* new FarmFailure({ problem: `${measurement}; no free capacity for a farm` });
  return { parallel, reserve, measurement };
});

if (import.meta.main) BunRuntime.runMain(runnerAdmission(process.env.GITHUB_REPOSITORY ?? "", Number(process.env.GITHUB_RUN_ID)).pipe(
  Effect.tap((admission) => Effect.sync(() => console.log(`parallel=${admission.parallel}\nadmission=${admission.measurement}`))),
));
