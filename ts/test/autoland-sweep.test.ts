import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
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

test("supersession selects exactly clean main-tree-equal lanes or separately replaced failed lanes, never in-flight lanes, over generated Git histories [k2 property]", () => {
  const scratch = resolve(import.meta.dir, "../../build");
  mkdirSync(scratch, { recursive: true });
  const directory = mkdtempSync(join(scratch, "superseded-"));
  const command = (args: string[], input?: string): string => {
    const result = Bun.spawnSync(args, { cwd: directory, stdin: input === undefined ? "ignore" : new TextEncoder().encode(input), stdout: "pipe", stderr: "pipe" });
    if (result.exitCode !== 0) throw new Error(`${args.join(" ")}: ${result.stderr.toString()}`);
    return result.stdout.toString().trim();
  };
  try {
    command(["git", "init", "-q"]);
    let seed = 51310;
    const next = (n: number): number => { seed = (seed * 48271) % 2147483647; return seed % n; };
    const rounds = Array.from({ length: 32 }, (_, index) => ({ index, base: `base-${next(1_000_000)}\n`, main: `main-${next(1_000_000)}\n`, other: `other-${next(1_000_000)}\n` }));
    let mark = 0;
    let input = "";
    const commit = (branch: string, parent: number | undefined, files: [string, string][], message: string): number => {
      const id = ++mark;
      input += `commit refs/heads/${branch}\nmark :${id}\ncommitter Property <property@example.invalid> ${1700000000 + id} +0000\ndata ${Buffer.byteLength(message)}\n${message}\n`;
      if (parent !== undefined) input += `from :${parent}\n`;
      for (const [path, text] of files) input += `M 100644 inline ${path}\ndata ${Buffer.byteLength(text)}\n${text}\n`;
      input += "\n";
      return id;
    };
    const base = commit("base", undefined, rounds.map((round) => [`file-${round.index}`, round.base]), "base");
    commit("main", base, rounds.map((round) => [`file-${round.index}`, round.main]), "independently land all changes");
    const expected: string[] = [];
    const rows: { branch: string; state: string; failed: string; pushed: string }[] = [];
    const runs: { workflow: string; head_branch: string; title: string; status: string }[] = [];
    for (const round of rounds) {
      for (const kind of ["identical", "partial", "conflict", "empty", "inflight", "farm-inflight", "replaced", "unreplaced", "completed"]) {
        const branch = kind === "farm-inflight" ? `claude/land-identical-${round.index}-2` : `claude/land-${kind}-${round.index}`;
        const issue = 1000 + round.index * 10 + ["identical", "partial", "conflict", "empty", "inflight", "farm-inflight", "replaced", "unreplaced", "completed"].indexOf(kind);
        const files: [string, string][] = kind === "empty" ? [] : [[`file-${round.index}`, kind === "conflict" ? round.other : round.main]];
        if (["partial", "replaced", "unreplaced"].includes(kind)) files.push([`novel-${kind}-${round.index}`, round.other]);
        let tip = commit(branch, base, files, `generated ${next(1_000_000)}\n\nRefs #${issue}`);
        for (let count = next(3); count > 0; count--) tip = commit(branch, tip, [], `empty commit ${next(1_000_000)}`);
        rows.push({ branch, state: ["replaced", "unreplaced"].includes(kind) ? "FAILURE" : ["NONE", "SUCCESS", "FAILURE", "PENDING"][next(4)] ?? "NONE", failed: "2026-10-12T00:00:00Z", pushed: "2026-10-11T00:00:00Z" });
        if (["identical", "empty", "replaced", "completed"].includes(kind)) expected.push(branch);
        if (kind === "inflight") runs.push({ workflow: "autoland.yml", head_branch: round.index % 2 === 0 ? branch : "main", title: `Autoland test ${next(3)} ${branch} dummy-sha`, status: ["requested", "pending", "waiting", "queued", "in_progress"][round.index % 5] ?? "in_progress" });
        if (kind === "farm-inflight") runs.push({ workflow: "farm-test.yml", head_branch: "main", title: `Farm test ${branch} t${round.index}`, status: ["requested", "pending", "waiting", "queued", "in_progress"][round.index % 5] ?? "in_progress" });
        if (kind === "completed") runs.push({ workflow: "autoland.yml", head_branch: branch, title: `Autoland test 0 ${branch} dummy-sha`, status: "completed" });
        if (["replaced", "unreplaced"].includes(kind)) {
          const newer = `claude/land-newer-${kind}-${round.index}`;
          commit(newer, base, [[`newer-${kind}-${round.index}`, round.other]], `new attempt\n\nRefs #${issue}`);
          rows.push({ branch: newer, state: kind === "replaced" ? "SUCCESS" : "FAILURE", failed: "2026-10-12T00:00:00Z", pushed: "2026-10-13T00:00:00Z" });
        }
      }
    }
    command(["git", "fast-import", "--quiet"], input);
    const tips = new Map(command(["git", "for-each-ref", "--format=%(refname:short) %(objectname)", "refs/heads/claude/"]).split("\n").map((line) => line.split(" ") as [string, string]));
    const lanes = join(directory, "lanes.tsv");
    const active = join(directory, "runs.json");
    writeFileSync(lanes, rows.map((row) => `${row.branch}\t${tips.get(row.branch)}\t${row.state}\t${row.failed}\t${row.pushed}\n`).join(""));
    writeFileSync(active, JSON.stringify(runs));
    const workflow = readFileSync(resolve(import.meta.dir, "../../.github/workflows/autoland-sweep.yml"), "utf8");
    const guard = workflow.slice(workflow.indexOf('          main=$(git rev-parse origin/main)\n') + '          main=$(git rev-parse origin/main)\n'.length, workflow.indexOf("          source ts/scripts/autoland-superseded.sh"));
    const select = (): string[] => command(["bash", "-euo", "pipefail", "-c", `RUNNER_TEMP="$PWD"; GH_REPO=property/repository; RUNS="$3"
      gh() { local endpoint="$3"; local workflow="\${endpoint#*/workflows/}"; workflow="\${workflow%%/*}"; local status="\${endpoint#*status=}"; status="\${status%%&*}"; jq -c --arg workflow "$workflow" --arg status "$status" '.[] | select(.workflow == $workflow and .status == $status) | {head_branch, title, status}' "$RUNS"; }
      ${guard}
      source "$1"; superseded main "$2" "$RUNNER_TEMP/superseded-runs.json"`, "superseded", resolve(import.meta.dir, "../scripts/autoland-superseded.sh"), lanes, active]).split("\n").filter(Boolean).map((line) => line.split("\t")[0] ?? "").sort();
    expect(select()).toEqual(expected.sort());
    writeFileSync(active, JSON.stringify([...runs, { workflow: "autoland.yml", head_branch: "main", title: "Autoland train", status: "in_progress" }]));
    expect(select()).toEqual([]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
