export const TEST_SLOTS = 3;
export const JOB_BUDGET = 32;
export const RUN_PEAK = 11;
export const RUN_BUILD = 2;
export const PROFILE = [11, 11, 11, 11, 7, 6, 1, 1, 1] as const;
export const PROFILE_STEP = 30_000;
export const LEAD = 30_000;
export const AGED = 60;
export const TRAIN_CAP = 4;
export const DIRECT_CAP = 2;
export const DISPATCHED = 2;

export interface Status { readonly state: string; readonly description: string; readonly at: string }
export interface Lane { readonly branch: string; readonly tip: string; readonly status: Status | null; readonly since?: string; readonly labels?: readonly string[]; readonly milestones?: readonly string[] }
export interface Job { readonly name?: string; readonly status: string; readonly created: string; readonly started: string | null; readonly labels: readonly string[] }
export interface Run { readonly title: string; readonly status: string; readonly id?: number; readonly created?: string; readonly jobs?: readonly Job[] }

export const QUEUED = "queued";
export const WAITING = "waiting to test alone";
export const TRAIN_TITLE = "Autoland train";
export const FARM_TITLE = "Farm test ";
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

export function laneState(lane: Lane, runs: readonly Run[], retry: ReadonlySet<string> = new Set(), now = Number.POSITIVE_INFINITY): LaneState {
  if (lane.status !== null && lane.status.state !== "pending") return retry.has(lane.branch) ? "test" : "done";
  if (passedAlone(lane) !== undefined) return "passed";
  if (lane.status?.description === WAITING && minutes(now, lane.status.at) < DISPATCHED) return "testing";
  const rerun = RERUN.exec(lane.status?.description ?? "")?.[1];
  if (rerun !== undefined && (minutes(now, lane.status?.at ?? "") < BOUND.idle || runs.some((run) => run.status !== "completed" && String(run.id) === rerun))) return "testing";
  if (runs.some((run) => { const match = TEST_TITLE.exec(run.title); return run.status !== "completed" && match?.[2] === lane.branch && match[3] === lane.tip; })) return "testing";
  if (lane.status?.description === "bisect" && runs.some((run) => run.status !== "completed" && LEGACY_TITLE.exec(run.title)?.[1]?.split(" ").includes(lane.branch) === true)) return "held";
  return "test";
}

export const RELEASE_MILESTONE = "Public 0.1";
const priority = (lane: Lane): number => lane.milestones?.includes(RELEASE_MILESTONE) === true ? 0 : lane.labels?.includes("playtest-blocking") === true ? 1 : 2;
const waited = (lane: Lane): string => [lane.since, lane.status?.at].filter((at): at is string => at !== undefined).toSorted()[0] ?? "";
const aged = (lane: Lane, now: number): number => waited(lane) !== "" && minutes(now, waited(lane)) > AGED ? 0 : 1;
const byArrival = (lanes: readonly Lane[], now: number): Lane[] => lanes.toSorted((a, b) => aged(a, now) - aged(b, now) || (aged(a, now) === 0 ? 0 : priority(a) - priority(b)) || waited(a).localeCompare(waited(b)) || a.branch.localeCompare(b.branch));

export interface TestOrder { readonly branch: string; readonly tip: string; readonly slot: number }
export interface Plan { readonly test: readonly TestOrder[]; readonly train: boolean }

const SUITE_JOB = /^suite \//;

const hostedHeld = (run: Run): number => (run.jobs ?? []).filter((job) => (job.status === "queued" || job.status === "in_progress") && job.labels.every((label) => HOSTED.test(label))).length;
const suiteStart = (run: Run): number | undefined => {
  const starts = (run.jobs ?? []).filter((job) => SUITE_JOB.test(job.name ?? "")).map((job) => Date.parse(job.created));
  return starts.length === 0 ? undefined : Math.min(...starts);
};
const suiteSkipped = (run: Run): boolean => (run.jobs ?? []).some((job) => job.name === "suite" && job.status === "completed");
const peaks = (run: Run): boolean => (TEST_TITLE.test(run.title) || run.title === TRAIN_TITLE) && !suiteSkipped(run);

export const busy = (runs: readonly Run[]): number => runs.filter((run) => run.status !== "completed").reduce((sum, run) =>
  sum + (peaks(run) && suiteStart(run) === undefined ? Math.max(hostedHeld(run), RUN_PEAK) : hostedHeld(run)), 0);

const step = (now: number, start: number): number => Math.max(0, Math.floor((now - start) / PROFILE_STEP));

export const forecast = (runs: readonly Run[], now: number): number => runs.filter((run) => run.status !== "completed").reduce((sum, run) => {
  const held = hostedHeld(run);
  const start = suiteStart(run);
  if (!peaks(run)) return sum + held;
  if (start === undefined) return sum + Math.max(held, RUN_PEAK);
  return sum + (step(now, start) >= PROFILE.length ? held : Math.min(held, PROFILE[step(now + LEAD, start)] ?? 0));
}, 0);

export function plan(lanes: readonly Lane[], runs: readonly Run[], now: number, retry: readonly string[] = []): Plan {
  const retried = new Set(retry);
  const held = busy(runs);
  const peak = forecast(runs, now);
  const free = Array.from({ length: TEST_SLOTS }, (_, slot) => slot).filter((slot) => !runs.some((run) => run.status !== "completed" && TEST_TITLE.exec(run.title)?.[1] === String(slot)));
  const test: TestOrder[] = [];
  let passed = false;
  for (const lane of byArrival(lanes, now)) {
    const state = laneState(lane, runs, retried, now);
    passed ||= state === "passed";
    if (state !== "test") continue;
    if (held + RUN_BUILD * (test.length + 1) > JOB_BUDGET || peak + RUN_PEAK * (test.length + 1) > JOB_BUDGET) continue;
    const slot = free.shift();
    if (slot === undefined) continue;
    test.push({ branch: lane.branch, tip: lane.tip, slot });
  }
  const trainOpen = runs.some((run) => run.title === TRAIN_TITLE && run.status !== "completed");
  return { test, train: passed && !trainOpen };
}

export interface TrainLane { readonly branch: string; readonly tip: string; readonly base: string; readonly tree: string }

export function train(lanes: readonly Lane[], now: number): TrainLane[] {
  return byArrival(lanes, now).flatMap((lane) => {
    const passed = passedAlone(lane);
    return passed === undefined ? [] : [{ branch: lane.branch, tip: lane.tip, ...passed }];
  }).slice(0, TRAIN_CAP);
}

export function lateLane(lanes: readonly Lane[], now: number, branch: string, held: readonly string[], actualTree: string, base: Tree, tested: Tree, main: readonly Tree[], landed: Tree | undefined, reports: boolean | undefined): "regenerate" | "land" | "retest" {
  const candidate = train(lanes, now).find((lane) => lane.branch === branch && !held.includes(lane.branch));
  if (held.length >= DIRECT_CAP || candidate === undefined || actualTree !== candidate.tree || pastMain(base, tested, main, landed) !== "land" || reports === false) return "retest";
  return reports === undefined ? "regenerate" : "land";
}

export type TrainStep = "suite" | "direct" | "last" | "drop";

export function trainStep(direct: readonly boolean[]): TrainStep {
  if (direct[0] !== true) return "suite";
  if (direct.at(-1) !== true) return "drop";
  return direct.length >= DIRECT_CAP ? "last" : "direct";
}

export type Verdict = "land" | "fail" | "retest";

export function judge(lanes: number, green: boolean): Verdict {
  if (green) return "land";
  return lanes === 1 ? "fail" : "retest";
}

const MINUTE = 60_000;
export const BOUND = { pending: 5, noRunner: 5, hostedQueue: 20, job: 15, test: 30, run: 45, force: 60, idle: 30, handback: 10 } as const;
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

export interface Cancel { readonly id: number; readonly title: string; readonly reason: string; readonly force: boolean; readonly replan: boolean }

export function stuckRuns(runs: readonly Run[], now: number): Cancel[] {
  return runs.flatMap((run) => {
    const reason = run.id === undefined ? undefined : stuck(run, runs, now);
    return reason === undefined || run.id === undefined ? [] : [{ id: run.id, title: run.title, reason, force: run.created !== undefined && minutes(now, run.created) > BOUND.force && (run.jobs?.length ?? 0) > 0, replan: !run.title.startsWith(FARM_TITLE) }];
  });
}

export const stalled = (lanes: readonly Lane[], landed: string, now: number): boolean =>
  minutes(now, landed) > BOUND.idle && lanes.some((lane) => lane.status?.state === "pending");

export const looping = (descriptions: readonly string[]): boolean =>
  descriptions.filter((description) => description.startsWith("testing alone on ")).length >= LOOP_TESTS;

export type Tree = ReadonlyMap<string, string>;
const NEVER_DISJOINT = /^(?:\.github\/workflows\/|ts\/scripts\/autoland)/;
const changed = (from: Tree, to: Tree): string[] => [...new Set([...from.keys(), ...to.keys()])].filter((path) => from.get(path) !== to.get(path));

export function pastMain(base: Tree, tested: Tree, main: readonly Tree[], landed: Tree | undefined): "land" | "retest" {
  if (landed === undefined) return "retest";
  const train = new Set(changed(base, tested));
  let before = base;
  for (const tree of main) {
    if (changed(before, tree).some((path) => train.has(path) || NEVER_DISJOINT.test(path))) return "retest";
    before = tree;
  }
  const expected = new Map(before);
  for (const path of train) {
    const entry = tested.get(path);
    if (entry === undefined) expected.delete(path);
    else expected.set(path, entry);
  }
  return expected.size === landed.size && [...expected].every(([path, entry]) => landed.get(path) === entry) ? "land" : "retest";
}

export type Landing = "land" | "passed" | "wait";

export function landing(solo: boolean, base: Tree, tested: Tree, main: readonly Tree[], landed: Tree | undefined): Landing {
  if (pastMain(base, tested, main, landed) === "land") return "land";
  return solo ? "passed" : "wait";
}

export const GENERATED_REPORTS: readonly string[] = ["tools/move-data/advantage-state.jsonl", "tools/move-data/advantage-state.md", "ts/test/lua/cost-baseline.tsv"];
export const CACHE_RECORDS: readonly string[] = ["ts/scripts/wisp/cue-models.tsv"];
const PIN = /^build-inputs\/([^/]+)(?:\/[^/.][^/]*)?$/;
export const pinFamily = (path: string): string | undefined => PIN.exec(path)?.[1];

export interface FamilySides { readonly base: Tree; readonly ours: Tree; readonly theirs: Tree }
export interface Conflict { readonly path: string; readonly sides?: FamilySides }
export type Resolution =
  | { readonly resolve: true; readonly pins: readonly { readonly path: string; readonly tree: Tree; readonly hash: string }[]; readonly reports: readonly string[] }
  | { readonly resolve: false; readonly why: string };

export const familyHash = (tree: Tree): string =>
  [...tree.keys()].sort().reduce((hasher, path) => hasher.update(`${path}\0${tree.get(path)}\n`), new Bun.CryptoHasher("sha256")).digest("hex");

export function mergeFamily({ base, ours, theirs }: FamilySides): { readonly tree: Tree } | { readonly both: readonly string[] } {
  const tree = new Map<string, string>();
  const both: string[] = [];
  for (const path of new Set([...base.keys(), ...ours.keys(), ...theirs.keys()])) {
    const [was, mine, other] = [base.get(path), ours.get(path), theirs.get(path)];
    if (mine !== other && mine !== was && other !== was) { both.push(path); continue; }
    const entry = mine === was ? other : mine;
    if (entry !== undefined) tree.set(path, entry);
  }
  return both.length > 0 ? { both: both.sort() } : { tree };
}

export function resolveConflicts(conflicts: readonly Conflict[]): Resolution {
  const recorded = conflicts.filter(({ path }) => CACHE_RECORDS.includes(path)).map(({ path }) => path);
  if (recorded.length > 0) return { resolve: false, why: `${recorded.join(" ")} is recorded from the Warcraft III install that Autoland's runners don't hold, so Autoland keeps neither side; rebase the lane onto main, run bun scripts/cueModels.ts --record from ts/ on the landing machine, and push again` };
  const source = conflicts.filter(({ path }) => pinFamily(path) === undefined && !GENERATED_REPORTS.includes(path)).map(({ path }) => path);
  if (source.length > 0) return { resolve: false, why: `${source.join(" ")} ${source.length === 1 ? "is" : "are"} not generated; Autoland never resolves source` };
  const pins: { path: string; tree: Tree; hash: string }[] = [];
  for (const { path, sides } of conflicts.filter(({ path }) => pinFamily(path) !== undefined)) {
    if (sides === undefined) return { resolve: false, why: `the build-inputs store holding ${path}'s three families isn't reachable from Autoland's runner` };
    const merged = mergeFamily(sides);
    if ("both" in merged) return { resolve: false, why: `${path} changed ${merged.both.length} file(s) on both sides: ${merged.both.slice(0, 5).join(" ")}` };
    pins.push({ path, tree: merged.tree, hash: familyHash(merged.tree) });
  }
  return { resolve: true, pins, reports: conflicts.filter(({ path }) => GENERATED_REPORTS.includes(path)).map(({ path }) => path) };
}

const FLAGGED = /<!-- autoland-conflict-lane (\S+) ([0-9a-f]{40}) -->/g;

export const flaggedLanes = (bodies: readonly string[], lanes: readonly Lane[]): readonly { readonly branch: string; readonly tip: string }[] => {
  const marked = new Map(bodies.flatMap((body) => [...body.matchAll(FLAGGED)]).map(([, branch = "", tip = ""]) => [`${branch} ${tip}`, { branch, tip }]));
  return [...marked.values()].filter(({ branch, tip }) => lanes.some((lane) => lane.branch === branch && lane.tip === tip && lane.status?.state !== "success"));
};

const ISSUE_REF = /\b(?:refs|fixes|closes)[: ]+(?:(?:tompassarelli\/)?smashcraft)?#(\d+)/gi;
export const issueRefs = (messages: string): readonly number[] => [...new Set([...messages.matchAll(ISSUE_REF)].map(([, number = ""]) => Number(number)))].toSorted((a, b) => a - b);

export type BoxNeed = "native" | "tom" | "definitive";
export interface Box { readonly line: number; readonly text: string; readonly done: boolean; readonly check?: string; readonly needs?: BoxNeed }

const BOX = /^(\s*[-*] \[)([ xX])(\] )(.*)$/;
const CHECK = /\bcheck: `([^`]+)`\s*\.?\s*$/;
const NEED = /\[(native|tom|definitive)\]/i;

export const boxes = (body: string): readonly Box[] => body.split("\n").flatMap((line, index) => {
  const match = BOX.exec(line);
  if (match === null) return [];
  const [, , mark = " ", , text = ""] = match;
  const check = CHECK.exec(text)?.[1];
  const needs = NEED.exec(text)?.[1]?.toLowerCase() as BoxNeed | undefined;
  return [{ line: index, text, done: mark !== " ", ...(check === undefined ? {} : { check }), ...(needs === undefined ? {} : { needs }) }];
});

export const pendingChecks = (body: string): readonly string[] => [...new Set(boxes(body).flatMap((box) => !box.done && box.needs === undefined && box.check !== undefined ? [box.check] : []))];

export interface Autoclose { readonly body: string; readonly close: boolean; readonly comment?: string; readonly marker: string }

const NEEDS_LABEL: Record<BoxNeed, string> = { native: "needs a native capture", tom: "needs Tom", definitive: "needs a Definitive capture" };
const summary = (box: Box): string => box.text.replace(CHECK, "").trim().slice(0, 160);

export function autoclose(body: string, passed: ReadonlyMap<string, boolean>, sha: string): Autoclose {
  const lines = body.split("\n");
  const all = boxes(body);
  const ticked = all.filter((box) => !box.done && box.needs === undefined && box.check !== undefined && passed.get(box.check) === true);
  for (const box of ticked) lines[box.line] = (lines[box.line] ?? "").replace(BOX, "$1x$3$4");
  const open = all.filter((box) => !box.done && !ticked.includes(box));
  const close = ticked.length > 0 && open.length === 0;
  const failed = open.filter((box) => box.needs === undefined && box.check !== undefined);
  const waiting = open.filter((box) => box.needs !== undefined);
  const unchecked = open.filter((box) => box.needs === undefined && box.check === undefined);
  const sections = [
    ticked.length > 0 ? [`Ticked by auto-close after ${sha} landed:`, ...ticked.map((box) => `- ${summary(box)} (\`${box.check}\` passed)`)] : [],
    failed.length > 0 ? ["Checks that didn't pass on this main stay open:", ...failed.map((box) => `- ${summary(box)} (\`${box.check}\` ${passed.has(box.check ?? "") ? "failed" : "didn't run"})`)] : [],
    waiting.length > 0 ? ["Left open for a person:", ...waiting.map((box) => `- ${summary(box)} (${NEEDS_LABEL[box.needs ?? "tom"]})`)] : [],
    unchecked.length > 0 ? ["Left open with no declared check (end the box with check: `COMMAND`, or tag it [native], [tom] or [definitive]):", ...unchecked.map((box) => `- ${summary(box)}`)] : [],
  ].filter((section) => section.length > 0);
  const marker = `<!-- auto-close ${new Bun.CryptoHasher("sha256").update(JSON.stringify([close, ticked, open])).digest("hex").slice(0, 16)} -->`;
  const declared = all.some((box) => box.check !== undefined || box.needs !== undefined);
  const comment = !declared ? undefined : [...(close ? [`Closed by auto-close after ${sha} landed: every Done-when box is ticked.`] : []), ...sections.map((section) => section.join("\n"))].join("\n\n");
  return { body: lines.join("\n"), close, marker, ...(comment === undefined ? {} : { comment }) };
}

export interface CiStep { readonly name: string; readonly conclusion: string }
export interface CiJob { readonly name: string; readonly conclusion: string; readonly steps: readonly CiStep[]; readonly failures?: readonly string[] }
const SETUP_STEP = /^(?:Set up job|Complete job|Post |Run actions\/|Run oven-sh\/setup-bun|Run bun install|Install stock texture converter)/;
const INFRA_JOB = new Set(["cancelled", "timed_out", "startup_failure", "action_required", "stale"]);
const UNMEASURED_TITLE = "Unmeasured";
const UNMEASURED = new RegExp(`^${UNMEASURED_TITLE}:|has timed out after|exceeded the maximum execution time|lost communication with the server|received a shutdown signal|The operation was canceled`);

export function unmeasured(job: CiJob): string | undefined {
  if (INFRA_JOB.has(job.conclusion)) return `job ${job.name} ${job.conclusion}`;
  if (job.conclusion !== "failure") return undefined;
  const step = job.steps.find((entry) => entry.conclusion === "failure");
  if (step === undefined) return `job ${job.name} failed without a failing step (runner lost)`;
  if (SETUP_STEP.test(step.name)) return `setup step failed (${job.name}: ${step.name})`;
  const annotation = job.failures?.find((line) => UNMEASURED.test(line));
  return annotation === undefined ? undefined : `${job.name}: ${annotation}`;
}


const MERGE_JOB = /(?:^|\/ )merge$/;
export const RERUN = /^rerunning run (\d+): /;

export function laneRerun(jobs: readonly CiJob[], attempt: number, testFailures: number): string | undefined {
  if (attempt !== 1 || testFailures > 0) return undefined;
  const failed = jobs.filter((job) => job.conclusion !== "" && job.conclusion !== "success" && job.conclusion !== "skipped" && job.conclusion !== "neutral");
  const reasons = failed.map(unmeasured);
  const first = reasons.find((reason) => reason !== undefined);
  return first !== undefined && failed.every((job, index) => reasons[index] !== undefined || MERGE_JOB.test(job.name)) ? first : undefined;
}

export function parseList<T>(text: string, source: string, is: (value: unknown) => value is T): T[] {
  if (text.trim() === "") throw new Error(`${source}: empty input, the fetch returned nothing`);
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error(`${source}: truncated or malformed JSON (${text.length} bytes)`); }
  if (!Array.isArray(value) || !value.every(is)) throw new Error(`${source}: expected a list of ${is.name.slice(2).toLowerCase()} records`);
  return value;
}

export const CONFLICT_STATUS = "conflicts with main ";

export const handbackDue = (lanes: readonly Lane[], now: number): Lane[] =>
  lanes.filter((lane) => lane.status?.state === "pending" && lane.status.description.startsWith(CONFLICT_STATUS) && minutes(now, lane.status.at) >= BOUND.handback);
