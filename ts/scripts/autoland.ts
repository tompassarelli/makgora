import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { parseArgs } from "node:util";
import { JOB_BUDGET, autoclose, issueRefs, pendingChecks, busy, laneRerun, type CiJob, flaggedLanes, pinFamily, resolveConflicts, type Conflict, forecast, judge, landing, parseList, lateLane, looping, handbackDue, pastMain, plan, stalled, stuckRuns, train, trainStep, type Job, type Lane, type Run, type Status, type Tree } from "./autolandCore";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isStatus = (value: unknown): value is Status => isRecord(value) && typeof value.state === "string" && typeof value.description === "string" && typeof value.at === "string";
const isLane = (value: unknown): value is Lane => isRecord(value) && typeof value.branch === "string" && typeof value.tip === "string" && (value.status === null || isStatus(value.status)) && (value.since === undefined || typeof value.since === "string") && (value.labels === undefined || (Array.isArray(value.labels) && value.labels.every((label: unknown) => typeof label === "string"))) && (value.milestones === undefined || (Array.isArray(value.milestones) && value.milestones.every((title: unknown) => typeof title === "string")));
const isJob = (value: unknown): value is Job => isRecord(value) && (value.name === undefined || typeof value.name === "string") && typeof value.status === "string" && typeof value.created === "string" && (value.started === null || typeof value.started === "string") && Array.isArray(value.labels) && value.labels.every((label: unknown) => typeof label === "string");
const isRun = (value: unknown): value is Run => isRecord(value) && typeof value.title === "string" && typeof value.status === "string" && (value.id === undefined || typeof value.id === "number") && (value.created === undefined || typeof value.created === "string") && (value.jobs === undefined || (Array.isArray(value.jobs) && value.jobs.every(isJob)));
const isResult = (value: unknown): value is { check: string; passed: boolean } => isRecord(value) && typeof value.check === "string" && typeof value.passed === "boolean";
const isCiJob = (value: unknown): value is CiJob => isRecord(value) && typeof value.name === "string" && typeof value.conclusion === "string" && Array.isArray(value.steps) && value.steps.every((step: unknown) => isRecord(step) && typeof step.name === "string" && typeof step.conclusion === "string") && (value.failures === undefined || (Array.isArray(value.failures) && value.failures.every((line: unknown) => typeof line === "string")));
const isText = (value: unknown): value is string => typeof value === "string";

function readList<T>(file: string | undefined, is: (value: unknown) => value is T): T[] {
  if (file === undefined) return [];
  return parseList(readFileSync(file, "utf8"), file, is);
}

const isStages = (value: unknown): value is { path: string; base: string; ours: string; theirs: string } => isRecord(value) && ["path", "base", "ours", "theirs"].every((key) => typeof value[key] === "string");

const familyTree = (directory: string): Tree => {
  const files: string[] = [];
  const walk = (at: string) => { for (const entry of readdirSync(at)) { const path = join(at, entry); if (statSync(path).isDirectory()) walk(path); else files.push(relative(directory, path)); } };
  walk(directory);
  return new Map(files.map((file) => [file, new Bun.CryptoHasher("sha256").update(readFileSync(join(directory, file))).digest("hex")]));
};

async function resolveCommand(file: string, store: string): Promise<void> {
  const stages = readList(file, isStages);
  const located = (family: string, hash: string): string | undefined => { const directory = join(store, family, hash); return hash !== "" && existsSync(directory) ? directory : undefined; };
  const conflicts: Conflict[] = stages.map(({ path, base, ours, theirs }) => {
    const family = pinFamily(path);
    const folders = family === undefined ? [] : [base, ours, theirs].map((hash) => located(family, hash));
    if (family === undefined || folders.some((folder) => folder === undefined)) return { path };
    const [b, o, t] = folders.map((folder) => familyTree(folder ?? ""));
    return { path, sides: { base: b ?? new Map(), ours: o ?? new Map(), theirs: t ?? new Map() } };
  });
  const resolution = resolveConflicts(conflicts);
  if (!resolution.resolve) { console.log(`flag\t${resolution.why}`); return; }
  const notes: string[] = [];
  for (const pin of resolution.pins) {
    const { storeFamily } = await import("./wisp/buildInputs");
    const family = pinFamily(pin.path) ?? "";
    const { ours, theirs } = stages.find((stage) => stage.path === pin.path) ?? { ours: "", theirs: "" };
    const [mine, other] = [join(store, family, ours), join(store, family, theirs)];
    const mineTree = conflicts.find((conflict) => conflict.path === pin.path)?.sides?.ours ?? new Map<string, string>();
    const staging = mkdtempSync(join(store, ".autoland-merge-"));
    try {
      for (const [path, hash] of pin.tree) {
        const from = mineTree.get(path) === hash ? join(mine, path) : join(other, path);
        mkdirSync(dirname(join(staging, path)), { recursive: true });
        copyFileSync(from, join(staging, path));
      }
      const stored = await storeFamily(family as Parameters<typeof storeFamily>[0], staging, store);
      if (stored !== pin.hash) throw new Error(`${family}: stored ${stored}, expected ${pin.hash}`);
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
    writeFileSync(pin.path, `${pin.hash}\n`);
    notes.push(`${pin.path} merged to ${pin.hash.slice(0, 12)}`);
  }
  console.log(["resolve", [...notes, ...resolution.reports.map((path) => `${path} regenerated`)].join("; "), ...resolution.reports].join("\t"));
}

const readTree = (file: string): Tree => new Map(readFileSync(file, "utf8").split("\0").filter(Boolean).map((entry) => {
  const tab = entry.indexOf("\t");
  return [entry.slice(tab + 1), entry.slice(0, tab)];
}));

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: { conflicts: { type: "string" }, bodies: { type: "string" }, store: { type: "string" }, rebased: { type: "string" }, lanes: { type: "string" }, runs: { type: "string" }, retry: { type: "string" }, count: { type: "string" }, green: { type: "string" }, now: { type: "string" }, landed: { type: "string" }, statuses: { type: "string" }, messages: { type: "string" }, body: { type: "string" }, results: { type: "string" }, sha: { type: "string" }, jobs: { type: "string" }, attempt: { type: "string" }, solo: { type: "string" } },
  });
  const command = positionals[0];
  const now = Date.parse(values.now ?? new Date().toISOString());
  if (command === "plan") {
    const result = plan(readList(values.lanes, isLane), readList(values.runs, isRun), now, (values.retry ?? "").split(/\s+/).filter(Boolean));
    for (const order of result.test) console.log(["test", order.branch, order.tip, order.slot].join("\t"));
    if (result.train) console.log("train");
  } else if (command === "busy") {
    const runs = readList(values.runs, isRun);
    console.log(`${busy(runs)}/${JOB_BUDGET} now, ${forecast(runs, now)} at the next peak`);
  } else if (command === "train") {
    for (const lane of train(readList(values.lanes, isLane), now)) console.log([lane.branch, lane.tip, lane.base, lane.tree].join("\t"));
  } else if (command === "sweep") {
    for (const cancel of stuckRuns(readList(values.runs, isRun), now)) console.log([cancel.id, cancel.force, cancel.replan, cancel.reason, cancel.title].join("\t"));
  } else if (command === "stalled") {
    console.log(stalled(readList(values.lanes, isLane), values.landed ?? "", now));
  } else if (command === "flagged") {
    for (const lane of flaggedLanes(readList(values.bodies, isText), readList(values.lanes, isLane))) console.log([lane.branch, lane.tip].join("\t"));
  } else if (command === "handback") {
    for (const lane of handbackDue(readList(values.lanes, isLane), now)) console.log([lane.branch, lane.tip].join("\t"));
  } else if (command === "loop") {
    console.log(looping(readList(values.statuses, isText)));
  } else if (command === "past-main") {
    const [base, tested, ...main] = positionals.slice(1);
    if (base === undefined || tested === undefined) throw new Error("past-main needs the base and tested trees");
    console.log(pastMain(readTree(base), readTree(tested), main.map(readTree), values.rebased === undefined ? undefined : readTree(values.rebased)));
  } else if (command === "landing") {
    const [base, tested, ...main] = positionals.slice(1);
    if (base === undefined || tested === undefined) throw new Error("landing needs the base and tested trees");
    console.log(landing(values.solo === "true", readTree(base), readTree(tested), main.map(readTree), values.rebased === undefined ? undefined : readTree(values.rebased)));
  } else if (command === "late") {
    const [branch, actual, base, tested, ...main] = positionals.slice(1);
    if (branch === undefined || actual === undefined || base === undefined || tested === undefined) throw new Error("late needs branch, actual tree, base and tested trees");
    console.log(lateLane(readList(values.lanes, isLane), now, branch, (values.retry ?? "").split(/\s+/).filter(Boolean), actual, readTree(base), readTree(tested), main.map(readTree), values.rebased === undefined ? undefined : readTree(values.rebased), values.green === undefined ? undefined : values.green === "true"));
  } else if (command === "resolve") {
    if (values.conflicts === undefined) throw new Error("resolve needs --conflicts FILE");
    await resolveCommand(values.conflicts, values.store ?? join(process.env.HOME ?? "", ".local/share/smashcraft-build-inputs/store"));
  } else if (command === "train-step") {
    console.log(trainStep(positionals.slice(1).map((flag) => flag === "land")));
  } else if (command === "refs") {
    for (const issue of issueRefs(readFileSync(values.messages ?? "/dev/stdin", "utf8"))) console.log(issue);
  } else if (command === "checks") {
    for (const check of pendingChecks(readFileSync(values.body ?? "/dev/stdin", "utf8"))) console.log(check);
  } else if (command === "autoclose") {
    if (values.body === undefined || values.sha === undefined) throw new Error("autoclose needs --body FILE --sha SHA");
    const results = readList(values.results, isResult);
    console.log(JSON.stringify(autoclose(readFileSync(values.body, "utf8"), new Map(results.map(({ check, passed }) => [check, passed])), values.sha)));
  } else if (command === "rerun") {
    console.log(laneRerun(readList(values.jobs, isCiJob), Number(values.attempt), Number(values.count ?? 0)) ?? "");
  } else if (command === "judge") {
    console.log(judge(Number(values.count), values.green === "true"));
  } else {
    console.error("usage: autoland.ts plan --lanes FILE --runs FILE [--retry BRANCHES] [--now ISO] | busy --runs FILE [--now ISO] | train --lanes FILE [--now ISO] | judge --count N --green true|false | rerun --jobs FILE --attempt N --count TEST_FAILURES | sweep --runs FILE [--now ISO] | stalled --lanes FILE --landed ISO [--now ISO] | handback --lanes FILE [--now ISO] | loop --statuses FILE | flagged --bodies FILE --lanes FILE | resolve --conflicts FILE [--store DIR] | refs --messages FILE | checks --body FILE | autoclose --body FILE --sha SHA [--results FILE] | train-step land|retest... | late BRANCH ACTUAL BASE TESTED MAIN... --lanes FILE --retry BRANCHES [--rebased TREE] [--green true|false] | past-main BASE TESTED MAIN... [--rebased TREE] | landing --solo true|false BASE TESTED MAIN... [--rebased TREE] (git ls-tree -r -z files)");
    process.exit(2);
  }
}
