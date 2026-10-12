import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { AGED, BOUND, FARM_TITLE, JOB_BUDGET, LEAD, PROFILE, PROFILE_STEP, RUN_BUILD, RUN_PEAK, TEST_SLOTS, laneState, plan, stuckRuns, type Job, type Lane, type Run } from "../scripts/autolandCore";

const recorded: { now: string; lanes: Lane[]; runs: Run[] } = JSON.parse(readFileSync(new URL("fixtures/autoland-backlog.json", import.meta.url), "utf8"));
const now = Date.parse(recorded.now);
const executing = (run: Run): boolean => (run.jobs?.length ?? 0) > 0;
const busySlots = (runs: readonly Run[]): Set<string> => new Set(runs.flatMap((run) => run.status === "completed" ? [] : /^Autoland test (\d+) /.exec(run.title)?.[1] ?? []));
const held = (run: Run): number => (run.jobs ?? []).filter((job) => (job.status === "queued" || job.status === "in_progress") && job.labels.every((label) => /^(ubuntu|windows|macos)-/.test(label))).length;
const project = (run: Run, at: number, now: number): number => {
  if (run.status === "completed") return 0;
  const suite = (run.jobs ?? []).filter((job) => job.name?.startsWith("suite /") === true).map((job) => Date.parse(job.created));
  if (!/^Autoland (test \d+ |train$)/.test(run.title)) return held(run);
  if (suite.length === 0) return Math.max(held(run), RUN_PEAK);
  const start = Math.min(...suite);
  return at === now || now - start >= PROFILE.length * PROFILE_STEP ? held(run) : Math.min(held(run), PROFILE[Math.floor((at - start) / PROFILE_STEP)] ?? 0);
};
const fits = (runs: readonly Run[], added: number, now: number): boolean => Array.from({ length: 24 }, (_, step) => now + step * PROFILE_STEP).every((at) =>
  runs.reduce((sum, run) => sum + project(run, at, now), 0) + added * (at < now + LEAD ? RUN_BUILD : PROFILE[Math.floor((at - now - LEAD) / PROFILE_STEP)] ?? 0) <= JOB_BUDGET);
const allowed = (lanes: readonly Lane[], runs: readonly Run[], now: number): number => {
  const most = Math.min(Array.from({ length: TEST_SLOTS }, (_, slot) => String(slot)).filter((slot) => !busySlots(runs).has(slot)).length, lanes.filter((lane) => laneState(lane, runs, new Set(), now) === "test").length);
  return Array.from({ length: most + 1 }, (_, added) => added).filter((added) => fits(runs, added, now)).at(-1) ?? 0;
};
const waited = (lane: Lane): string => [lane.since, lane.status?.at].filter((at) => at !== undefined).toSorted()[0] ?? "";
const aged = (lane: Lane, now: number): boolean => waited(lane) !== "" && now - Date.parse(waited(lane)) > AGED * 60_000;

test("the #513 backlog sweeps to one run per free slot without touching a healthy run, and a runnerless job is cancelled [k1 scenario]", () => {
  const cancels = stuckRuns(recorded.runs, now);
  const cancelled = new Set(cancels.map((cancel) => cancel.id));
  expect(recorded.runs.filter((run) => !executing(run) && run.title.startsWith("Autoland test ") && Date.parse(run.created ?? "") < now - BOUND.pending * 60_000).every((run) => cancelled.has(run.id ?? 0))).toBe(true);
  expect(recorded.runs.filter(executing).some((run) => cancelled.has(run.id ?? 0))).toBe(false);

  const left = recorded.runs.filter((run) => !cancelled.has(run.id ?? 0));
  const orders = plan(recorded.lanes, left, now).test;
  expect(orders.length).toBe(allowed(recorded.lanes, left, now));
  expect(new Set(orders.map((order) => order.slot)).size).toBe(orders.length);
  expect(plan(recorded.lanes, [...left, ...orders.map((order) => ({ title: `Autoland test ${order.slot} ${order.branch} ${order.tip}`, status: "pending" }))], now).test).toEqual([]);

  const victim = left.find(executing);
  if (victim?.jobs === undefined) throw new Error("the recording has no executing run");
  const created = new Date(now - (BOUND.noRunner + 1) * 60_000).toISOString();
  const hung = { ...victim, jobs: [...victim.jobs, { status: "queued", created, started: null, labels: ["no-such-runner"] }] };
  expect(stuckRuns([...left.filter((run) => run !== victim), hung], now).map((cancel) => cancel.id)).toEqual([victim.id ?? 0]);
});

test("plan fills every free slot whose run fits the measured job profile under JOB_BUDGET at every moment, oldest lane first past AGED minutes, over the #513 backlog, and the sweep cancels exactly the Farm test runs past a bound without replanning [k2 property]", () => {
  let seed = 51531;
  const next = (n: number): number => { seed = (seed * 48271) % 2147483647; return seed % n; };
  const ago = (steps: number): string => new Date(now - steps * PROFILE_STEP).toISOString();
  const statuses = ["requested", "pending", "queued", "in_progress", "completed"];
  for (let round = 0; round < 400; round++) {
    const lanes: Lane[] = recorded.lanes.map((lane) => lane.status === null ? lane : { ...lane, status: { ...lane.status, at: ago(next(240)) }, labels: [["priority:now"], ["playtest-blocking"], []][next(3)] ?? [], ...(next(2) === 0 ? { since: ago(next(240)) } : {}) });
    const runs: Run[] = recorded.runs.filter(() => next(recorded.runs.length) < 2).map((run) => ({ ...run, status: statuses[next(statuses.length)] ?? "completed" }));
    for (let extra = next(5); extra > 0; extra--) {
      const lane = lanes[next(lanes.length)];
      if (lane === undefined) continue;
      const created = ago(next(20));
      const jobs = Array.from({ length: next(16) }, (_, index): Job => ({ name: index % 3 === 0 ? "build" : `suite / lua32 ${index}`, status: ["queued", "in_progress", "completed"][next(3)] ?? "completed", created, started: created, labels: [next(5) === 0 ? "farm-big" : "ubuntu-latest"] }));
      runs.push({ title: next(3) === 0 ? "Autoland train" : `Autoland test ${next(TEST_SLOTS + 1)} ${lane.branch} ${lane.tip}`, status: next(2) === 0 ? "in_progress" : "pending", jobs });
    }
    const farmAgo = (max: number): string => new Date(now - next(max * 60) * 1000).toISOString();
    const farm: Run[] = Array.from({ length: next(4) }, (_, index) => {
      const jobs = Array.from({ length: next(2) === 0 ? 0 : 1 + next(6) }, (): Job => {
        const status = ["queued", "in_progress", "completed"][next(3)] ?? "completed";
        return { name: "lua", status, created: farmAgo(60), started: status === "queued" ? null : farmAgo(25), labels: [next(2) === 0 ? "farm-big" : "ubuntu-latest"] };
      });
      return { id: 9_000_000 + round * 10 + index, title: `${FARM_TITLE}${recorded.lanes[0]?.tip ?? ""} t${index}`, status: jobs.length === 0 ? "pending" : "in_progress", created: farmAgo(60), jobs };
    });
    const age = (at: string): number => (now - Date.parse(at)) / 60_000;
    const overdue = (run: Run): boolean => (run.jobs ?? []).length === 0 ? age(run.created ?? "") > BOUND.pending
      : (run.jobs ?? []).some((job) => job.status === "queued" ? age(job.created) > (job.labels[0] === "farm-big" ? BOUND.noRunner : BOUND.hostedQueue) : job.status === "in_progress" && age(job.started ?? "") > BOUND.job)
        || Math.max(...(run.jobs ?? []).map((job) => age(job.created))) > BOUND.run;
    const farmCancels = stuckRuns([...runs, ...farm], now).filter((cancel) => cancel.title.startsWith(FARM_TITLE));
    expect(farmCancels.map((cancel) => cancel.id)).toEqual(farm.filter(overdue).map((run) => run.id ?? 0));
    expect(farmCancels.some((cancel) => cancel.replan)).toBe(false);
    const orders = plan(lanes, runs, now).test;
    const slots = orders.map((order) => String(order.slot));
    expect(new Set(slots).size).toBe(orders.length);
    expect(slots.some((slot) => busySlots(runs).has(slot))).toBe(false);
    expect(orders.length).toBe(allowed(lanes, runs, now));
    if (orders.length > 0) expect(fits(runs, orders.length, now)).toBe(true);
    const ordered = new Set(orders.map((order) => order.branch));
    const chosen = lanes.filter((lane) => ordered.has(lane.branch));
    for (const lane of lanes.filter((candidate) => !ordered.has(candidate.branch) && laneState(candidate, runs, new Set(), now) === "test" && aged(candidate, now)))
      expect(chosen.some((other) => !aged(other, now) || waited(other) > waited(lane))).toBe(false);
  }
});
