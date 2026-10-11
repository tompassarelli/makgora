import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BOUND, TEST_SLOTS, plan, stuckRuns, type Lane, type Run } from "../scripts/autolandCore";

const recorded: { now: string; lanes: Lane[]; runs: Run[] } = JSON.parse(readFileSync(new URL("fixtures/autoland-backlog.json", import.meta.url), "utf8"));
const now = Date.parse(recorded.now);
const executing = (run: Run): boolean => (run.jobs?.length ?? 0) > 0;

test("the #513 backlog sweeps to one run per free slot without touching a healthy run, and a runnerless job is cancelled [k1 scenario]", () => {
  const cancels = stuckRuns(recorded.runs, now);
  const cancelled = new Set(cancels.map((cancel) => cancel.id));
  expect(recorded.runs.filter((run) => !executing(run) && run.title.startsWith("Autoland test ") && Date.parse(run.created ?? "") < now - BOUND.pending * 60_000).every((run) => cancelled.has(run.id ?? 0))).toBe(true);
  expect(recorded.runs.filter(executing).some((run) => cancelled.has(run.id ?? 0))).toBe(false);

  const left = recorded.runs.filter((run) => !cancelled.has(run.id ?? 0));
  const free = TEST_SLOTS - new Set(left.flatMap((run) => /^Autoland test (\d+) /.exec(run.title)?.[1] ?? [])).size;
  const orders = plan(recorded.lanes, left).test;
  expect(orders.length).toBe(free);
  expect(new Set(orders.map((order) => order.slot)).size).toBe(orders.length);
  expect(plan(recorded.lanes, [...left, ...orders.map((order) => ({ title: `Autoland test ${order.slot} ${order.branch} ${order.tip}`, status: "pending" }))]).test).toEqual([]);

  const victim = left.find(executing);
  if (victim?.jobs === undefined) throw new Error("the recording has no executing run");
  const created = new Date(now - (BOUND.noRunner + 1) * 60_000).toISOString();
  const hung = { ...victim, jobs: [...victim.jobs, { status: "queued", created, started: null, labels: ["no-such-runner"] }] };
  expect(stuckRuns([...left.filter((run) => run !== victim), hung], now).map((cancel) => cancel.id)).toEqual([victim.id ?? 0]);
});
