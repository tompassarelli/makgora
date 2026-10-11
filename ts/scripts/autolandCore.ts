export const TEST_SLOTS = 3;
export const JOB_BUDGET = 32;
export const RUN_PEAK = 16;
export const TRAIN_CAP = 4;

export interface Status { readonly state: string; readonly description: string; readonly at: string }
export interface Lane { readonly branch: string; readonly tip: string; readonly status: Status | null; readonly labels?: readonly string[] }
export interface Job { readonly name?: string; readonly status: string; readonly created: string; readonly started: string | null; readonly labels: readonly string[] }
export interface Run { readonly title: string; readonly status: string; readonly id?: number; readonly created?: string; readonly jobs?: readonly Job[] }

export const QUEUED = "queued";
export const WAITING = "waiting to test alone";
export const TRAIN_TITLE = "Autoland train";
export const testTitle = (slot: number, branch: string, tip: string): string => `Autoland test ${slot} ${branch} ${tip}`;
export const passedDescription = (base: string, tree: string): string => `passed alone on ${base} as tree ${tree}`;

const TEST_TITLE = /^Autoland test (\d+) (\S+) ([0-9a-f]{40})$/;
const PASSED = /^passed alone on ([0-9a-f]{40}) as tree ([0-9a-f]{40})$/;
// Runs started before the parallel queue name the branches they hold: "Autoland claude/a claude/b".
const LEGACY_TITLE = /^Autoland (claude\/\S+(?: claude\/\S+)*)$/;

export type LaneState = "test" | "testing" | "passed" | "held" | "done";

export function passedAlone(lane: Lane): { readonly base: string; readonly tree: string } | undefined {
  const [, base, tree] = (lane.status?.state === "pending" ? PASSED.exec(lane.status.description) : null) ?? [];
  return base === undefined || tree === undefined ? undefined : { base, tree };
}

export function laneState(lane: Lane, runs: readonly Run[], retry: ReadonlySet<string> = new Set()): LaneState {
  if (lane.status !== null && lane.status.state !== "pending") return retry.has(lane.branch) ? "test" : "done";
  if (passedAlone(lane) !== undefined) return "passed";
  if (runs.some((run) => { const match = TEST_TITLE.exec(run.title); return run.status !== "completed" && match?.[2] === lane.branch && match[3] === lane.tip; })) return "testing";
  if (lane.status?.description === "bisect" && runs.some((run) => run.status !== "completed" && LEGACY_TITLE.exec(run.title)?.[1]?.split(" ").includes(lane.branch) === true)) return "held";
  return "test";
}

const priority = (lane: Lane): number => lane.labels?.includes("priority:now") === true ? 0 : lane.labels?.includes("playtest-blocking") === true ? 1 : 2;
const byArrival = (lanes: readonly Lane[]): Lane[] => lanes.toSorted((a, b) => priority(a) - priority(b) || (a.status?.at ?? "").localeCompare(b.status?.at ?? "") || a.branch.localeCompare(b.branch));

export interface TestOrder { readonly branch: string; readonly tip: string; readonly slot: number }
export interface Plan { readonly test: readonly TestOrder[]; readonly train: boolean }

const SUITE_JOB = /^suite \//;

export const busy = (runs: readonly Run[]): number => runs.filter((run) => run.status !== "completed").reduce((sum, run) => {
  const jobs = run.jobs ?? [];
  const held = jobs.filter((job) => (job.status === "queued" || job.status === "in_progress") && job.labels.every((label) => HOSTED.test(label))).length;
  return sum + ((TEST_TITLE.test(run.title) || run.title === TRAIN_TITLE) && !jobs.some((job) => SUITE_JOB.test(job.name ?? "")) ? Math.max(held, RUN_PEAK) : held);
}, 0);

export function plan(lanes: readonly Lane[], runs: readonly Run[], retry: readonly string[] = []): Plan {
  const retried = new Set(retry);
  const held = busy(runs);
  const free = Array.from({ length: TEST_SLOTS }, (_, slot) => slot).filter((slot) => !runs.some((run) => run.status !== "completed" && TEST_TITLE.exec(run.title)?.[1] === String(slot)));
  const test: TestOrder[] = [];
  let passed = false;
  for (const lane of byArrival(lanes)) {
    const state = laneState(lane, runs, retried);
    passed ||= state === "passed";
    if (state !== "test") continue;
    if (held + RUN_PEAK * (test.length + 1) > JOB_BUDGET) continue;
    const slot = free.shift();
    if (slot === undefined) continue;
    test.push({ branch: lane.branch, tip: lane.tip, slot });
  }
  const trainWaiting = runs.some((run) => run.title === TRAIN_TITLE && run.status !== "in_progress" && run.status !== "completed");
  return { test, train: passed && !trainWaiting };
}

export interface TrainLane { readonly branch: string; readonly tip: string; readonly base: string; readonly tree: string }

export function train(lanes: readonly Lane[]): TrainLane[] {
  return byArrival(lanes).flatMap((lane) => {
    const passed = passedAlone(lane);
    return passed === undefined ? [] : [{ branch: lane.branch, tip: lane.tip, ...passed }];
  }).slice(0, TRAIN_CAP);
}

export type Verdict = "land" | "fail" | "retest";

export function judge(lanes: number, green: boolean): Verdict {
  if (green) return "land";
  return lanes === 1 ? "fail" : "retest";
}

const MINUTE = 60_000;
export const BOUND = { pending: 5, noRunner: 5, hostedQueue: 20, job: 15, test: 30, run: 45, force: 60, idle: 30 } as const;
export const LOOP_TESTS = 3;
const HOSTED = /^(ubuntu|windows|macos)-/;

const minutes = (now: number, at: string): number => (now - Date.parse(at)) / MINUTE;
const group = (title: string): string => TEST_TITLE.exec(title)?.[1] ?? (title === TRAIN_TITLE ? "train" : title.startsWith("Autoland plan") ? "plan" : title);

export function stuck(run: Run, runs: readonly Run[], now: number): string | undefined {
  if (run.status === "completed" || run.created === undefined) return undefined;
  const jobs = run.jobs ?? [];
  const age = minutes(now, run.created);
  if (jobs.length === 0) {
    if (age <= BOUND.pending) return undefined;
    if (TEST_TITLE.test(run.title)) return `pending ${Math.round(age)} min for its test slot`;
    const blocked = runs.some((other) => other !== run && other.status !== "completed" && (other.jobs?.length ?? 0) > 0 && group(other.title) === group(run.title));
    return blocked ? undefined : `pending ${Math.round(age)} min with nothing running in its concurrency group`;
  }
  for (const job of jobs) {
    if (job.status === "queued") {
      const waited = minutes(now, job.created);
      const hosted = job.labels.every((label) => HOSTED.test(label));
      if (waited > (hosted ? BOUND.hostedQueue : BOUND.noRunner)) return `a job waited ${Math.round(waited)} min for a ${job.labels.join(",")} runner`;
    } else if (job.status === "in_progress" && job.started !== null) {
      const ran = minutes(now, job.started);
      if (ran > BOUND.job) return `a job ran ${Math.round(ran)} min`;
    }
  }
  const started = Math.min(...jobs.map((job) => Date.parse(job.created)));
  const ran = (now - started) / MINUTE;
  return ran > (TEST_TITLE.test(run.title) ? BOUND.test : BOUND.run) ? `ran ${Math.round(ran)} min` : undefined;
}

export interface Cancel { readonly id: number; readonly title: string; readonly reason: string; readonly force: boolean }

export function stuckRuns(runs: readonly Run[], now: number): Cancel[] {
  return runs.flatMap((run) => {
    const reason = run.id === undefined ? undefined : stuck(run, runs, now);
    return reason === undefined || run.id === undefined ? [] : [{ id: run.id, title: run.title, reason, force: run.created !== undefined && minutes(now, run.created) > BOUND.force && (run.jobs?.length ?? 0) > 0 }];
  });
}

export const stalled = (lanes: readonly Lane[], landed: string, now: number): boolean =>
  minutes(now, landed) > BOUND.idle && lanes.some((lane) => lane.status?.state === "pending");

export const looping = (descriptions: readonly string[]): boolean =>
  descriptions.filter((description) => description.startsWith("testing alone on ")).length >= LOOP_TESTS;
