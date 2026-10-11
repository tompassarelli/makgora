import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BOUND, FARM_TITLE, JOB_BUDGET, RUN_PEAK, TEST_SLOTS, busy, laneState, plan, stuckRuns, type Job, type Lane, type Run } from "../scripts/autolandCore";

const recorded: { now: string; lanes: Lane[]; runs: Run[] } = JSON.parse(readFileSync(new URL("fixtures/autoland-backlog.json", import.meta.url), "utf8"));
const now = Date.parse(recorded.now);
const executing = (run: Run): boolean => (run.jobs?.length ?? 0) > 0;
const busySlots = (runs: readonly Run[]): Set<string> => new Set(runs.flatMap((run) => run.status === "completed" ? [] : /^Autoland test (\d+) /.exec(run.title)?.[1] ?? []));
const allowed = (lanes: readonly Lane[], runs: readonly Run[]): number =>
  Math.max(0, Math.min(Array.from({ length: TEST_SLOTS }, (_, slot) => String(slot)).filter((slot) => !busySlots(runs).has(slot)).length, lanes.filter((lane) => laneState(lane, runs) === "test").length, Math.floor((JOB_BUDGET - busy(runs)) / RUN_PEAK)));

test("the #513 backlog sweeps to one run per free slot without touching a healthy run, and a runnerless job is cancelled [k1 scenario]", () => {
  const cancels = stuckRuns(recorded.runs, now);
  const cancelled = new Set(cancels.map((cancel) => cancel.id));
  expect(recorded.runs.filter((run) => !executing(run) && run.title.startsWith("Autoland test ") && Date.parse(run.created ?? "") < now - BOUND.pending * 60_000).every((run) => cancelled.has(run.id ?? 0))).toBe(true);
  expect(recorded.runs.filter(executing).some((run) => cancelled.has(run.id ?? 0))).toBe(false);

  const left = recorded.runs.filter((run) => !cancelled.has(run.id ?? 0));
  const orders = plan(recorded.lanes, left).test;
  expect(orders.length).toBe(allowed(recorded.lanes, left));
  expect(new Set(orders.map((order) => order.slot)).size).toBe(orders.length);
  expect(plan(recorded.lanes, [...left, ...orders.map((order) => ({ title: `Autoland test ${order.slot} ${order.branch} ${order.tip}`, status: "pending" }))]).test).toEqual([]);

  const victim = left.find(executing);
  if (victim?.jobs === undefined) throw new Error("the recording has no executing run");
  const created = new Date(now - (BOUND.noRunner + 1) * 60_000).toISOString();
  const hung = { ...victim, jobs: [...victim.jobs, { status: "queued", created, started: null, labels: ["no-such-runner"] }] };
  expect(stuckRuns([...left.filter((run) => run !== victim), hung], now).map((cancel) => cancel.id)).toEqual([victim.id ?? 0]);
});

test("plan fills each idle slot once, in budget order, and never past JOB_BUDGET hosted jobs over the #513 backlog, and the sweep cancels exactly the Farm test runs past a bound without replanning [k2 property]", () => {
  let seed = 51531;
  const next = (n: number): number => { seed = (seed * 48271) % 2147483647; return seed % n; };
  const job = (name: string, status: string): Job => ({ name, status, created: recorded.now, started: status === "queued" ? null : recorded.now, labels: [next(5) === 0 ? "farm-big" : "ubuntu-latest"] });
  const statuses = ["requested", "pending", "queued", "in_progress", "completed"];
  for (let round = 0; round < 400; round++) {
    const runs: Run[] = recorded.runs.filter(() => next(recorded.runs.length) < 2).map((run) => ({ ...run, status: statuses[next(statuses.length)] ?? "completed" }));
    for (let extra = next(4); extra > 0; extra--) {
      const lane = recorded.lanes[next(recorded.lanes.length)];
      if (lane === undefined) continue;
      const jobs = Array.from({ length: next(14) }, (_, index) => job(index % 3 === 0 ? "build" : `suite / lua32 ${index}`, ["queued", "in_progress", "completed"][next(3)] ?? "completed"));
      runs.push({ title: `Autoland test ${next(TEST_SLOTS + 1)} ${lane.branch} ${lane.tip}`, status: next(2) === 0 ? "in_progress" : "pending", jobs });
    }
    const ago = (max: number): string => new Date(now - next(max * 60) * 1000).toISOString();
    const farm: Run[] = Array.from({ length: next(4) }, (_, index) => {
      const jobs = Array.from({ length: next(2) === 0 ? 0 : 1 + next(6) }, (): Job => {
        const status = ["queued", "in_progress", "completed"][next(3)] ?? "completed";
        return { name: "lua", status, created: ago(60), started: status === "queued" ? null : ago(25), labels: [next(2) === 0 ? "farm-big" : "ubuntu-latest"] };
      });
      return { id: 9_000_000 + round * 10 + index, title: `${FARM_TITLE}${recorded.lanes[0]?.tip ?? ""} t${index}`, status: jobs.length === 0 ? "pending" : "in_progress", created: ago(60), jobs };
    });
    const age = (at: string): number => (now - Date.parse(at)) / 60_000;
    const overdue = (run: Run): boolean => (run.jobs ?? []).length === 0 ? age(run.created ?? "") > BOUND.pending
      : (run.jobs ?? []).some((job) => job.status === "queued" ? age(job.created) > (job.labels[0] === "farm-big" ? BOUND.noRunner : BOUND.hostedQueue) : job.status === "in_progress" && age(job.started ?? "") > BOUND.job)
        || Math.max(...(run.jobs ?? []).map((job) => age(job.created))) > BOUND.run;
    const farmCancels = stuckRuns([...runs, ...farm], now).filter((cancel) => cancel.title.startsWith(FARM_TITLE));
    expect(farmCancels.map((cancel) => cancel.id)).toEqual(farm.filter(overdue).map((run) => run.id ?? 0));
    expect(farmCancels.some((cancel) => cancel.replan)).toBe(false);
    const orders = plan(recorded.lanes, runs).test;
    const slots = orders.map((order) => String(order.slot));
    expect(new Set(slots).size).toBe(orders.length);
    expect(slots.some((slot) => busySlots(runs).has(slot))).toBe(false);
    expect(orders.length).toBe(allowed(recorded.lanes, runs));
    if (orders.length > 0) expect(busy(runs) + RUN_PEAK * orders.length).toBeLessThanOrEqual(JOB_BUDGET);
  }
});
