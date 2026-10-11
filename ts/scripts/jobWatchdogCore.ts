export const WATCHED_WORKFLOWS = ["autoland.yml", "farm-test.yml"] as const;
export type WatchedWorkflow = typeof WATCHED_WORKFLOWS[number];
export interface JobTiming {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly runner_name: string | null;
  readonly labels: readonly string[];
}
export interface TimingRun {
  readonly id: number;
  readonly workflow: WatchedWorkflow;
  readonly run_attempt: number;
  readonly status: string;
  readonly jobs: readonly JobTiming[];
}
export interface Baseline {
  readonly key: string;
  readonly medianMs: number;
  readonly samples: number;
}
export interface Overrun {
  readonly runId: number;
  readonly jobId: number;
  readonly job: string;
  readonly runner: string;
  readonly elapsedMs: number;
  readonly deadlineMs: number;
  readonly baseline: Baseline;
}
export const runnerClass = (job: JobTiming): string => job.labels.some(label => /^(ubuntu-|windows-|macos-)/.test(label)) ? "hosted" : "self-hosted";
export const timingKey = (workflow: WatchedWorkflow, job: JobTiming): string => `${workflow}:${job.name}:${runnerClass(job)}`;
export function baselines(history: readonly TimingRun[], now: number): readonly Baseline[] {
  const samples = new Map<string, number[]>();
  const recorded = new Set<number>();
  const since = now - 7 * 24 * 60 * 60 * 1000;
  for (const run of history) for (const job of run.jobs) {
    if (job.status !== "completed" || !["success", "failure"].includes(job.conclusion ?? "") || !job.runner_name || !job.started_at || !job.completed_at) continue;
    const start = Date.parse(job.started_at), end = Date.parse(job.completed_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < since || end > now || end <= start) continue;
    if (recorded.has(job.id)) continue;
    recorded.add(job.id);
    const key = timingKey(run.workflow, job);
    const group = samples.get(key) ?? [];
    group.push(end - start);
    samples.set(key, group);
  }
  return [...samples].map(([key, values]) => {
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return { key, medianMs: ((values[mid] ?? 0) + (values[values.length % 2 === 0 ? mid - 1 : mid] ?? 0)) / 2, samples: values.length };
  });
}
export function overruns(runs: readonly TimingRun[], history: readonly TimingRun[], now: number): readonly Overrun[] {
  const measured = new Map(baselines(history, now).map(row => [row.key, row]));
  return runs.flatMap(run => {
    if (run.run_attempt !== 1 || run.status !== "in_progress") return [];
    return run.jobs.flatMap(job => {
      if (job.status !== "in_progress" || !job.runner_name || !job.started_at) return [];
      const baseline = measured.get(timingKey(run.workflow, job));
      if (baseline === undefined) return [];
      const start = Date.parse(job.started_at), elapsedMs = now - start;
      if (!Number.isFinite(start) || elapsedMs <= 2 * baseline.medianMs) return [];
      return [{ runId: run.id, jobId: job.id, job: job.name, runner: job.runner_name, elapsedMs, deadlineMs: start + 2 * baseline.medianMs, baseline }];
    });
  });
}
export const alertLine = (overrun: Overrun): string => `job-watchdog: ${overrun.job} on ${overrun.runner}, elapsed ${Math.ceil(overrun.elapsedMs / 1000)}s > 2x7-day median ${overrun.baseline.medianMs / 1000}s (${overrun.baseline.samples} completed jobs); cancelling run ${overrun.runId}, hosted retry`;
