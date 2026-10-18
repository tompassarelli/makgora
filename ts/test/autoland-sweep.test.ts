import { expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { landedLanes, type Commit } from "../scripts/sheriff";
import { AGED, BOUND, RELEASE_MILESTONE, DIRECT_CAP, FARM_TITLE, JOB_BUDGET, LEAD, PROFILE, PROFILE_STEP, RUN_BUILD, RUN_PEAK, TEST_SLOTS, TRAIN_CAP, TRAIN_TITLE, laneState, lateLane, passedDescription, plan, stuckRuns, train, trainStep, type Job, type Lane, type Run } from "../scripts/autolandCore";

const recorded: { now: string; lanes: Lane[]; runs: Run[] } = JSON.parse(readFileSync(new URL("fixtures/autoland-backlog.json", import.meta.url), "utf8"));
const now = Date.parse(recorded.now);
const executing = (run: Run): boolean => (run.jobs?.length ?? 0) > 0;
const busySlots = (runs: readonly Run[]): Set<string> => new Set(runs.flatMap((run) => run.status === "completed" ? [] : /^Autoland test (\d+) /.exec(run.title)?.[1] ?? []));
const held = (run: Run): number => (run.jobs ?? []).filter((job) => (job.status === "queued" || job.status === "in_progress") && job.labels.every((label) => /^(ubuntu|windows|macos)-/.test(label))).length;
const project = (run: Run, at: number, now: number): number => {
  if (run.status === "completed") return 0;
  const suite = (run.jobs ?? []).filter((job) => job.name?.startsWith("suite /") === true).map((job) => Date.parse(job.created));
  if (!/^Autoland (test \d+ |train$)/.test(run.title) || (run.jobs ?? []).some((job) => job.name === "suite" && job.status === "completed")) return held(run);
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

test("one unfinished train excludes another, and refreshing generated queues takes every passed lane up to the direct pair bound [k2 property]", () => {
  let seed = 51571;
  const next = (n: number): number => { seed = (seed * 48271) % 2147483647; return seed % n; };
  const states = ["requested", "pending", "waiting", "queued", "in_progress", "completed"];
  const base = "b".repeat(40);
  const tree = "c".repeat(40);
  for (let round = 0; round < 400; round++) {
    const lanes: Lane[] = Array.from({ length: next(12) }, (_, index) => {
      const at = new Date(now - next(240) * PROFILE_STEP).toISOString();
      const state = next(4);
      return { branch: `claude/pair-${index}`, tip: index.toString(16).padStart(40, "0"), labels: [[], ["playtest-blocking"], []][next(3)] ?? [], milestones: [[RELEASE_MILESTONE], [], ["After 0.1"]][next(3)] ?? [], status: { state: state < 2 ? "pending" : "success", description: state % 2 === 0 ? passedDescription(base, tree) : "queued", at } };
    });
    const passed = lanes.filter((lane) => lane.status?.state === "pending" && lane.status.description === passedDescription(base, tree));
    const runs: Run[] = states.filter(() => next(3) === 0).map((status) => ({ title: TRAIN_TITLE, status }));
    expect(plan(lanes, runs, now).train).toBe(passed.length > 0 && runs.every((run) => run.status === "completed"));
    if (plan(lanes, runs, now).train) expect(plan(lanes, [...runs, { title: TRAIN_TITLE, status: "pending" }], now).train).toBe(false);
    const priority = (lane: Lane): number => lane.milestones?.includes(RELEASE_MILESTONE) === true ? 0 : lane.labels?.includes("playtest-blocking") === true ? 1 : 2;
    const ordered = passed.toSorted((a, b) => Number(aged(b, now)) - Number(aged(a, now)) || (aged(a, now) ? 0 : priority(a) - priority(b)) || waited(a).localeCompare(waited(b)) || a.branch.localeCompare(b.branch));
    const refreshed = train(lanes, now);
    expect(refreshed.map((lane) => lane.branch)).toEqual(ordered.slice(0, TRAIN_CAP).map((lane) => lane.branch));
    const pair: string[] = [];
    for (const lane of refreshed) {
      pair.push(lane.branch);
      if (trainStep(pair.map(() => true)) === "last") break;
    }
    expect(pair).toEqual(ordered.slice(0, DIRECT_CAP).map((lane) => lane.branch));
    const chosen = refreshed[0];
    if (chosen !== undefined) {
      const original = new Map([["keep", "0"], ["lane", "0"]]);
      const tested = new Map([["keep", "0"], ["lane", "1"]]);
      const moved = new Map([["keep", "1"], ["lane", "0"]]);
      const combined = new Map([["keep", "1"], ["lane", "1"]]);
      const held = Array.from({ length: next(4) }, (_, index) => `claude/held-${index}`);
      const actual = next(3) === 0 ? "wrong" : tree;
      const changed = next(3) === 0;
      const result = next(3);
      const reports = result === 0 ? undefined : result === 1;
      const expected = held.length >= 2 || actual !== tree || changed || reports === false ? "retest" : reports === undefined ? "regenerate" : "land";
      expect(lateLane(lanes, now, chosen.branch, held, actual, original, tested, [moved], changed ? moved : combined, reports)).toBe(expected);
      expect(lateLane(lanes, now, chosen.branch, [chosen.branch], tree, original, tested, [moved], combined, true)).toBe("retest");
    }

  }
});

function landScenarios(modes: readonly string[]): void {
  const workflow = Bun.YAML.parse(readFileSync(new URL("../../.github/workflows/autoland.yml", import.meta.url), "utf8")) as { env: Record<string, string>; jobs: { build: { steps: { id?: string; run?: string }[] }; land: { steps: { id?: string; run?: string }[] } } };
  const shell = workflow.jobs.land.steps.find((step) => step.id === "land")?.run;
  if (shell === undefined) throw new Error("land step missing");
  const root = resolve(import.meta.dir, "../..");
  const evidence = join(root, "ts/build/g515-land");
  mkdirSync(evidence, { recursive: true });
  const quote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
  const executable = (file: string, body: string): void => writeFileSync(file, `#!${bashPath}\n${body}\n`, { mode: 0o755 });
  const command = (cwd: string, args: string[], env?: Record<string, string | undefined>): string => {
    const result = Bun.spawnSync(args, { cwd, env: env ?? process.env, stdout: "pipe", stderr: "pipe" });
    if (result.exitCode !== 0) throw new Error(`${args.join(" ")}: ${result.exitCode}\n${result.stdout.toString()}\n${result.stderr.toString()}`);
    return result.stdout.toString().trim();
  };
  const gitPath = command(root, ["which", "git"]);
  const bashPath = command(root, ["which", "bash"]);
  for (const mode of modes) {
    const fixture = mkdtempSync(join(evidence, `${mode}-`));
    const repo = join(fixture, "repo");
    const bin = join(fixture, "bin");
    const temporary = join(fixture, "runner");
    for (const directory of [repo, bin, temporary, join(repo, "ts/scripts"), join(repo, "tools/move-data")]) mkdirSync(directory, { recursive: true });
    const git = (...args: string[]): string => command(repo, [gitPath, ...args]);
    git("init", "-q"); git("config", "user.name", "fixture"); git("config", "user.email", "fixture@example.invalid");
    for (const file of ["autoland.ts", "autolandCore.ts"]) copyFileSync(join(root, "ts/scripts", file), join(repo, "ts/scripts", file));
    writeFileSync(join(repo, "tools/move-data/advantage-state.jsonl"), "original\n");
    writeFileSync(join(repo, "tools/move-data/advantage-state.md"), "original\n");
    git("add", "."); git("commit", "-qm", "base");
    const base = git("rev-parse", "HEAD");
    const tips: string[] = [];
    const trees: string[] = [];
    for (let index = 0; index < 3; index++) {
      git("checkout", "-q", "--detach", base);
      writeFileSync(join(repo, `ts/lane-${index}.ts`), `export const value${index} = ${index};\n`);
      git("add", "."); git("commit", "-qm", `lane ${index} refs #${515 + index}`);
      tips.push(git("rev-parse", "HEAD")); trees.push(git("rev-parse", "HEAD^{tree}"));
      git("update-ref", `refs/remotes/origin/claude/lane-${index}`, tips[index]!);
    }
    if (mode === "merge-resolution") {
      git("checkout", "-q", "--detach", base);
      writeFileSync(join(repo, "ts/merge-input.txt"), "input\n");
      git("add", "ts/merge-input.txt"); git("commit", "-qm", "additional input");
      const input = git("rev-parse", "HEAD");
      git("checkout", "-q", "--detach", tips[1]!);
      git("merge", "--no-ff", "--no-commit", input);
      writeFileSync(join(repo, "ts/merge-resolution.txt"), "resolved\n");
      git("add", "ts/merge-resolution.txt"); git("commit", "-qm", "resolved combined input");
      tips[1] = git("rev-parse", "HEAD"); trees[1] = git("rev-parse", "HEAD^{tree}");
      git("update-ref", "refs/remotes/origin/claude/lane-1", tips[1]!);
      git("checkout", "-q", "-B", "autoland", base);
      git("checkout", "-q", "--detach", tips[1]!);
      const build = workflow.jobs.build.steps.find((step) => step.id === "build")?.run;
      if (build === undefined) throw new Error("build step missing");
      command(repo, ["bash", "-e", "-c", build.slice(build.indexOf("lane_base=$("), build.indexOf("direct=retest"))], { ...process.env, tip: tips[1]! });
      expect(git("rev-parse", "HEAD^{tree}")).toBe(trees[1]!);
      const verdict = command(repo, ["bash", "-e", "-c", `${workflow.env.PASSED!}\npassed "$TIP" "$BASE" "$TREE" "$BASE" "$TIP"`], { ...process.env, TIP: tips[1]!, BASE: base, TREE: trees[1]!, RUNNER_TEMP: temporary });
      expect(verdict).toBe("land");
      continue;
    }
    git("update-ref", "refs/remotes/origin/main", base);
    git("checkout", "-q", "--detach", tips[0]!);
    git("commit", "--amend", "-q", "--no-edit", "--trailer", 'Autoland-Lane: {"branch":"claude/lane-0","count":1,"issues":[515]}');
    writeFileSync(join(repo, "tools/move-data/advantage-state.jsonl"), "lane one\n");
    writeFileSync(join(repo, "tools/move-data/advantage-state.md"), "lane one\n");
    git("add", "tools/move-data"); git("commit", "-qm", "lane one reports", "--trailer", "Autoland-Reports: 1");
    const solo = git("rev-parse", "HEAD");
    git("checkout", "-q", "--detach", base);
    const lanes = tips.map((tip, index): Lane => ({ branch: `claude/lane-${index}`, tip, status: { state: "pending", description: mode === "proof" && index === 2 ? "queued" : passedDescription(base, mode === "proof" && index === 1 ? git("rev-parse", `${base}^{tree}`) : trees[index]!), at: new Date(now + index).toISOString() } }));
    writeFileSync(join(fixture, "lanes.json"), JSON.stringify(lanes));
    writeFileSync(join(fixture, "land.sh"), shell);
    const pushes = join(fixture, "pushes");
    const events = join(fixture, "events");
    executable(join(bin, "git"), `if [ "$1" = fetch ]; then exit 0; fi
if [ "$1" = push ]; then
  printf '%s\\n' "$*" >> ${quote(events)}
  for arg in "$@"; do
    if [[ "$arg" = *:refs/heads/main ]]; then
      if [ "$MODE" = stale-record ] || { [ "$MODE" = stale-fallback ] && [ -f ${quote(join(fixture, "refused"))} ]; }; then echo 'Classic effect record is missing or stale' >&2; exit 1; fi
      if { [ "$MODE" = non-fast-forward ] || [ "$MODE" = stale-fallback ]; } && [ ! -f ${quote(join(fixture, "refused"))} ]; then
        touch ${quote(join(fixture, "refused"))}; echo 'non-fast-forward' >&2; exit 1
      fi
      echo "\${arg%:refs/heads/main}" >> ${quote(pushes)}
      ${quote(gitPath)} update-ref refs/remotes/origin/main "\${arg%:refs/heads/main}"
    fi
  done
  exit 0
fi
exec ${quote(gitPath)} "$@"`);
    executable(join(bin, "gh"), `printf '%s\\n' "$*" >> ${quote(events)}`);
    executable(join(bin, "bun"), `if [ "$1" = install ]; then echo install >> ${quote(events)}; exit 0; fi
if [ "$1" = scripts/wisp.ts ]; then
  echo regenerate >> ${quote(events)}
  printf 'combined\\n' > ../tools/move-data/advantage-state.jsonl
  printf 'combined\\n' > ../tools/move-data/advantage-state.md
  [ "$MODE" != regeneration ]; exit $?
fi
if [ "$1" = test ]; then echo targets >> ${quote(events)}; [ "$MODE" != targets ]; exit $?; fi
exec ${quote(process.execPath)} "$@"`);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, MODE: mode, TEST: "", TRAIN: "true", SHA: solo, TREE: trees[0]!, BASE: base, SCRATCH: "fixture", BRANCHES: "claude/lane-0", TIPS: tips[0]!, VERDICT: "tested", REPORTS: "success", DETAIL: "", CODE_HEALTH: "success", CODE_HEALTH_VERDICT: "pass", CODE_HEALTH_DETAIL: "", RUNNER_TEMP: temporary, GITHUB_OUTPUT: join(fixture, "outputs"), GITHUB_STEP_SUMMARY: join(fixture, "summary"), GH_REPO: "fixture/fixture", RUN_URL: "fixture", PASSED: workflow.env.PASSED!, REPORTS_RUN: workflow.env.REPORTS_RUN!, LOCAL_REFRESH: workflow.env.LOCAL_REFRESH!, FETCH_LANES: `cat ${quote(join(fixture, "lanes.json"))}` };
    if (mode === "stale-record") {
      for (const staleMode of ["stale-check", "stale-record", "stale-fallback"]) {
        writeFileSync(events, "");
        const staleEnv = { ...env, MODE: staleMode, VERDICT: staleMode === "stale-check" ? "check" : "tested", DETAIL: staleMode === "stale-check" ? "Classic effect record is missing or stale" : "" };
        const result = Bun.spawnSync(["bash", "-e", join(fixture, "land.sh")], { cwd: repo, env: staleEnv, stdout: "pipe", stderr: "pipe" });
        expect(result.exitCode).toBe(1);
        const activity = readFileSync(events, "utf8");
        for (const tip of tips.slice(0, staleMode === "stale-check" ? 1 : 2)) expect(activity).toContain(`statuses/${tip} -f state=error -f context=autoland -f description=local refresh required: Classic effect record`);
        expect(activity).not.toContain("state=success");
        expect(git("rev-parse", "refs/remotes/origin/main")).toBe(base);
        for (let index = 0; index < tips.length; index++) expect(git("rev-parse", `refs/remotes/origin/claude/lane-${index}`)).toBe(tips[index]!);
        expect(readFileSync(join(fixture, "summary"), "utf8")).toContain("source lanes remain for repair and requeue");
      }
      continue;
    }
    command(repo, ["bash", "-e", join(fixture, "land.sh")], env);
    const pushed = readFileSync(pushes, "utf8").trim();
    const commits: Commit[] = git("rev-list", "--reverse", "--first-parent", `${base}..${pushed}`).split("\n").map((sha) => ({ sha, message: git("show", "-s", "--format=%B", sha), files: git("diff-tree", "--no-commit-id", "--name-only", "-r", sha).split("\n") }));
    expect(landedLanes(base, commits)?.map((lane) => ({ branch: lane.branch, issues: lane.issues }))).toEqual(mode === "pair" ? [{ branch: "claude/lane-0", issues: [515] }, { branch: "claude/lane-1", issues: [516] }] : [{ branch: "claude/lane-0", issues: [515] }]);
    expect(git("show", `${pushed}:tools/move-data/advantage-state.md`)).toBe(mode === "pair" ? "combined" : "lane one");
    const activity = readFileSync(events, "utf8");
    expect(activity.includes(":refs/heads/claude/lane-1")).toBe(mode === "pair");
    expect(activity.includes(`statuses/${tips[1]}`)).toBe(mode === "pair");
    if (mode !== "pair") expect(git("rev-parse", "refs/remotes/origin/claude/lane-1")).toBe(tips[1]!);
    if (mode === "targets") expect(activity).toContain("targets");
    if (mode === "non-fast-forward") {
      expect(pushed).toBe(solo);
      expect(activity.split("\n").filter((line) => line.endsWith(":refs/heads/main")).length).toBe(2);
    }
  }
}

test("the complete land shell attributes a regenerated pair, leaves failed targets queued, and retries lane one after a non-fast-forward [k5 boundary autoland-land]", () => {
  landScenarios(["pair", "merge-resolution", "targets", "proof", "regeneration", "non-fast-forward"]);
});

test("stale Classic records return every affected lane for local refresh without publication [k5 boundary autoland-local-refresh]", () => {
  landScenarios(["stale-record"]);
});

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

test("a train that lands its passed-alone trees without a suite holds only its running jobs, so lanes waiting on 14 Oct 03:24Z start in a free slot [k1 scenario]", () => {
  const at = Date.parse("2026-10-14T03:24:26Z");
  const job = (name: string, status: string, created: string): Job => ({ name, status, created, started: status === "queued" ? null : created, labels: name === "suite" ? [] : ["ubuntu-latest"] });
  const suite = ["plan", "perf", "bun 0", "bun 1", "bun 2", "corpus", "parity", ...Array.from({ length: 8 }, (_, shard) => `lua32 ${shard}`)].map((name) => job(`suite / ${name}`, "in_progress", "2026-10-14T03:20:58Z"));
  const runs: Run[] = [
    { title: TRAIN_TITLE, status: "in_progress", jobs: [job("build", "completed", "2026-10-14T03:20:34Z"), job("suite", "completed", "2026-10-14T03:20:56Z"), job("reports", "in_progress", "2026-10-14T03:20:59Z")] },
    { title: "Autoland test 1 claude/land-hb-lich-373fd372d217 373fd372d217c28895c5337401c23682ecfac02b", status: "in_progress", jobs: [job("build", "completed", "2026-10-14T03:20:30Z"), job("reports", "in_progress", "2026-10-14T03:20:58Z"), ...suite] },
  ];
  const lanes: Lane[] = ["claude/land-codex-wisp-revendor-6937794fd995", "claude/land-hb-blademaster-70b77c4b5804"].map((branch, index) => ({ branch, tip: String(index).repeat(40), status: { state: "pending", description: "queued", at: "2026-10-14T03:2" + String(index) + ":00Z" } }));
  expect(plan(lanes, runs, at).test).toEqual([{ branch: "claude/land-codex-wisp-revendor-6937794fd995", tip: "0".repeat(40), slot: 0 }, { branch: "claude/land-hb-blademaster-70b77c4b5804", tip: "1".repeat(40), slot: 2 }]);
});

test("plan fills every free slot whose run fits the measured job profile under JOB_BUDGET at every moment, oldest lane first past AGED minutes, over the #513 backlog, and the sweep cancels exactly the Farm test runs past a bound without replanning [k2 property]", () => {
  let seed = 51531;
  const next = (n: number): number => { seed = (seed * 48271) % 2147483647; return seed % n; };
  const ago = (steps: number): string => new Date(now - steps * PROFILE_STEP).toISOString();
  const statuses = ["requested", "pending", "queued", "in_progress", "completed"];
  for (let round = 0; round < 400; round++) {
    const lanes: Lane[] = recorded.lanes.map((lane) => lane.status === null ? lane : { ...lane, status: { ...lane.status, at: ago(next(240)) }, labels: [[], ["playtest-blocking"], []][next(3)] ?? [], milestones: [[RELEASE_MILESTONE], [], ["After 0.1"]][next(3)] ?? [], ...(next(2) === 0 ? { since: ago(next(240)) } : {}) });
    const runs: Run[] = recorded.runs.filter(() => next(recorded.runs.length) < 2).map((run) => ({ ...run, status: statuses[next(statuses.length)] ?? "completed" }));
    for (let extra = next(5); extra > 0; extra--) {
      const lane = lanes[next(lanes.length)];
      if (lane === undefined) continue;
      const created = ago(next(20));
      const jobs = Array.from({ length: next(16) }, (_, index): Job => ({ name: index % 3 === 0 ? "build" : index % 7 === 5 ? "suite" : `suite / lua32 ${index}`, status: ["queued", "in_progress", "completed"][next(3)] ?? "completed", created, started: created, labels: [next(5) === 0 ? "farm-big" : "ubuntu-latest"] }));
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
      for (const kind of ["identical", "partial", "conflict", "empty", "inflight", "farm-inflight", "replaced", "unreplaced", "untested", "early", "completed"]) {
        const branch = kind === "farm-inflight" ? `claude/land-identical-${round.index}-2` : `claude/land-${kind}-${round.index}`;
        const issue = 1000 + round.index * 20 + ["identical", "partial", "conflict", "empty", "inflight", "farm-inflight", "replaced", "unreplaced", "untested", "early", "completed"].indexOf(kind);
        const files: [string, string][] = kind === "empty" ? [] : [[`file-${round.index}`, kind === "conflict" ? round.other : round.main]];
        if (["partial", "replaced", "unreplaced", "untested", "early"].includes(kind)) files.push([`novel-${kind}-${round.index}`, round.other]);
        let tip = commit(branch, base, files, `generated ${next(1_000_000)}\n\nRefs #${issue}`);
        for (let count = next(3); count > 0; count--) tip = commit(branch, tip, [], `empty commit ${next(1_000_000)}`);
        rows.push({ branch, state: ["replaced", "unreplaced", "untested", "early"].includes(kind) ? "FAILURE" : ["NONE", "SUCCESS", "FAILURE", "PENDING"][next(4)] ?? "NONE", failed: "2026-10-12T00:00:00Z", pushed: "2026-10-11T00:00:00Z" });
        if (["identical", "empty", "replaced", "completed"].includes(kind)) expected.push(branch);
        if (kind === "inflight") runs.push({ workflow: "autoland.yml", head_branch: round.index % 2 === 0 ? branch : "main", title: `Autoland test ${next(3)} ${branch} dummy-sha`, status: ["requested", "pending", "waiting", "queued", "in_progress"][round.index % 5] ?? "in_progress" });
        if (kind === "farm-inflight") runs.push({ workflow: "farm-test.yml", head_branch: "main", title: `Farm test ${branch} t${round.index}`, status: ["requested", "pending", "waiting", "queued", "in_progress"][round.index % 5] ?? "in_progress" });
        if (kind === "completed") runs.push({ workflow: "autoland.yml", head_branch: branch, title: `Autoland test 0 ${branch} dummy-sha`, status: "completed" });
        if (["replaced", "unreplaced", "untested", "early"].includes(kind)) {
          const newer = `claude/land-newer-${kind}-${round.index}`;
          commit(newer, base, [[`newer-${kind}-${round.index}`, round.other]], `new attempt\n\nRefs #${issue}`);
          rows.push({ branch: newer, state: { replaced: "SUCCESS", untested: "NONE", early: "SUCCESS" }[kind] ?? "FAILURE", failed: kind === "untested" ? "" : "2026-10-12T00:00:00Z", pushed: kind === "early" ? "2026-10-11T00:00:00Z" : "2026-10-13T00:00:00Z" });
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
    const guard = workflow.slice(workflow.indexOf('          main=$(git rev-parse origin/main)\n') + '          main=$(git rev-parse origin/main)\n'.length, workflow.indexOf("          bun ts/scripts/autolandSuperseded.ts"));
    const select = (): string[] => command(["bash", "-euo", "pipefail", "-c", `RUNNER_TEMP="$PWD"; GH_REPO=property/repository; RUNS="$3"
      gh() { local endpoint="$3"; local workflow="\${endpoint#*/workflows/}"; workflow="\${workflow%%/*}"; local status="\${endpoint#*status=}"; status="\${status%%&*}"; jq -c --arg workflow "$workflow" --arg status "$status" '.[] | select(.workflow == $workflow and .status == $status) | {head_branch, title, status}' "$RUNS"; }
      ${guard}
      "${process.execPath}" "$1" main "$2" "$RUNNER_TEMP/superseded-runs.json"`, "superseded", resolve(import.meta.dir, "../scripts/autolandSuperseded.ts"), lanes, active]).split("\n").filter(Boolean).map((line) => line.split("\t")[0] ?? "").sort();
    expect(select()).toEqual(expected.sort());
    writeFileSync(active, JSON.stringify([...runs, { workflow: "autoland.yml", head_branch: "main", title: "Autoland train", status: "in_progress" }]));
    expect(select()).toEqual([]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
