import { expect, test } from "bun:test";
import { type Lane, OPEN_STATES, STARTED, TESTING, TEST_SLOTS, TRAIN_TITLE, jobReads, laneSince, listedRuns, openRuns, plan, sinceMisses, testTitle } from "../scripts/autolandCore";

const REPO = "tompassarelli/smashcraft";
const NOW = Date.parse("2026-10-25T21:00:00Z");
const SELF = 9000;
const tip = (index: number): string => index.toString(16).padStart(40, "a");
const pushedAt = (index: number): string => new Date(NOW - (90 - index) * 60_000).toISOString();

const queue = (count: number): Lane[] => Array.from({ length: count }, (_, index) => ({
  branch: `claude/land-${index}`,
  tip: tip(index),
  status: { state: "pending", description: "queued", at: "2026-10-25T20:58:00Z" },
  denylist: "success",
}));

interface FakeRun { readonly id: number; readonly display_title: string; readonly status: string }

const github = (lanes: readonly Lane[], runs: readonly FakeRun[], unpushed: ReadonlySet<string> = new Set()) => {
  const calls: string[] = [];
  const job = { name: "suite / bun 1", status: "in_progress", created_at: "2026-10-25T20:50:00Z", started_at: "2026-10-25T20:50:10Z", labels: ["ubuntu-latest"] };
  const gh = (path: string): unknown => {
    calls.push(path);
    if (path === `repos/${REPO}/actions/workflows/autoland.yml/runs?event=push&per_page=100`)
      return { workflow_runs: lanes.flatMap((lane, index) => unpushed.has(lane.branch) ? [] : [{ head_branch: lane.branch, head_sha: lane.tip, created_at: pushedAt(index), event: "push" }]) };
    const statuses = /^repos\/[^/]+\/[^/]+\/commits\/([0-9a-f]{40})\/statuses\?per_page=100$/.exec(path);
    if (statuses !== null) return [{ context: "autoland", created_at: "2026-10-25T20:58:00Z" }, { context: "autoland", created_at: "2026-10-25T19:00:00Z" }, { context: "denylist", created_at: "2026-10-25T18:00:00Z" }];
    const listed = /\/actions\/workflows\/autoland\.yml\/runs\?status=(\w+)&per_page=100$/.exec(path);
    if (listed !== null) return { workflow_runs: runs.filter((run) => run.status === listed[1]) };
    if (/\/actions\/runs\/\d+\/jobs\?per_page=100$/.test(path)) return { jobs: [job] };
    throw new Error(`unexpected gh api ${path}`);
  };
  return { gh, calls };
};

const testRun = (id: number, slot: number, index: number): FakeRun => ({ id, display_title: testTitle(slot, `claude/busy-${index}`, tip(100 + index)), status: "in_progress" });
const train: FakeRun = { id: 8001, display_title: TRAIN_TITLE, status: "in_progress" };
const pendingPlan: FakeRun = { id: 8002, display_title: "Autoland plan", status: "pending" };

const arrivals = (gh: (path: string) => unknown, lanes: readonly Lane[]) => {
  const pushes = gh(`repos/${REPO}/actions/workflows/autoland.yml/runs?event=push&per_page=100`);
  const statuses = Object.fromEntries(sinceMisses(lanes, pushes).map((missed) => [missed, gh(`repos/${REPO}/commits/${missed}/statuses?per_page=100`)]));
  return laneSince(lanes, pushes, statuses);
};

const planReads = (gh: (path: string) => unknown, lanes: readonly Lane[]) => {
  const since = arrivals(gh, lanes);
  const timed = lanes.map((lane) => since[lane.tip] === undefined ? lane : { ...lane, since: since[lane.tip] });
  const listedOpen = listedRuns(OPEN_STATES.map((state) => gh(`repos/${REPO}/actions/workflows/autoland.yml/runs?status=${state}&per_page=100`)), SELF);
  const reads = jobReads(timed, listedOpen, NOW);
  const jobs = Object.fromEntries(reads.map((id) => [String(id), gh(`repos/${REPO}/actions/runs/${id}/jobs?per_page=100`)]));
  return { lanes: timed, runs: openRuns(listedOpen, reads, jobs) };
};

test("a plan fetches one push-run list and the open-run lists for a ten-lane queue, and jobs only when a test can start, whatever the queue length [k2 property]", () => {
  const lanes = queue(10);
  const busy = Array.from({ length: TEST_SLOTS }, (_, slot) => testRun(7000 + slot, slot, slot));
  const last = 7000 + TEST_SLOTS - 1;
  const full = [...busy, train, pendingPlan, { ...pendingPlan, id: SELF, status: "in_progress" }];
  const saturated = github(lanes, full);
  const read = planReads(saturated.gh, lanes);
  expect(saturated.calls).toHaveLength(1 + OPEN_STATES.length);
  expect(read.lanes.map((lane) => lane.since)).toEqual(lanes.map((_, index) => pushedAt(index)));
  expect(read.runs.map((run) => run.id).toSorted()).toEqual([...busy.map((run) => run.id), 8001, 8002]);
  const withJobs = read.runs.map((run) => ({ ...run, jobs: [{ name: "suite / bun 1", status: "in_progress", created: "2026-10-25T20:50:00Z", started: "2026-10-25T20:50:10Z", labels: ["ubuntu-latest"] }] }));
  expect(plan(read.lanes, read.runs, NOW)).toEqual(plan(read.lanes, withJobs, NOW));

  const own = github(lanes, full.filter((run) => run.id !== last));
  const freed = planReads(own.gh, lanes);
  const jobRuns = freed.runs.filter((run) => run.status === "in_progress").length;
  expect(own.calls).toHaveLength(1 + OPEN_STATES.length + jobRuns);
  expect(plan(freed.lanes, freed.runs, NOW).test).toEqual([{ branch: "claude/land-0", tip: tip(0), slot: TEST_SLOTS - 1 }]);

  const longer = queue(40);
  const forty = github(longer, full);
  planReads(forty.gh, longer);
  expect(forty.calls).toHaveLength(saturated.calls.length);
});

test("a lane missing from the push-run list keeps its first autoland status as its arrival, at one status fetch for that lane alone [k2 property]", () => {
  const lanes = queue(10);
  const { gh, calls } = github(lanes, [], new Set(["claude/land-3"]));
  const since = arrivals(gh, lanes);
  expect(since[tip(3)]).toBe("2026-10-25T19:00:00Z");
  expect(since[tip(4)]).toBe(pushedAt(4));
  expect(calls.filter((path) => path.includes("/statuses"))).toEqual([`repos/${REPO}/commits/${tip(3)}/statuses?per_page=100`]);
  expect(calls).toHaveLength(2);
});

test("a tip whose own test run set testing alone is not dispatched again while the open-run lists miss that run, and is again once that status outlives a live test [k2 property]", () => {
  const testing = (minutesAgo: number): Lane => ({ ...queue(1)[0]!, status: { state: "pending", description: `${TESTING}${"c".repeat(10)}`, at: new Date(NOW - minutesAgo * 60_000).toISOString() } });
  for (const age of [0, 1, 5, STARTED - 0.1]) expect(plan([testing(age)], [], NOW).test).toEqual([]);
  expect(plan([testing(STARTED)], [], NOW).test).toEqual([{ branch: "claude/land-0", tip: tip(0), slot: 0 }]);
});
