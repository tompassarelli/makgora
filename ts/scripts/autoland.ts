import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { parseArgs } from "node:util";
import { JOB_BUDGET, busy, pinFamily, resolveConflicts, type Conflict, forecast, judge, looping, pastMain, plan, stalled, stuckRuns, train, type Job, type Lane, type Run, type Status, type Tree } from "./autolandCore";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isStatus = (value: unknown): value is Status => isRecord(value) && typeof value.state === "string" && typeof value.description === "string" && typeof value.at === "string";
const isLane = (value: unknown): value is Lane => isRecord(value) && typeof value.branch === "string" && typeof value.tip === "string" && (value.status === null || isStatus(value.status)) && (value.since === undefined || typeof value.since === "string") && (value.labels === undefined || (Array.isArray(value.labels) && value.labels.every((label: unknown) => typeof label === "string")));
const isJob = (value: unknown): value is Job => isRecord(value) && (value.name === undefined || typeof value.name === "string") && typeof value.status === "string" && typeof value.created === "string" && (value.started === null || typeof value.started === "string") && Array.isArray(value.labels) && value.labels.every((label: unknown) => typeof label === "string");
const isRun = (value: unknown): value is Run => isRecord(value) && typeof value.title === "string" && typeof value.status === "string" && (value.id === undefined || typeof value.id === "number") && (value.created === undefined || typeof value.created === "string") && (value.jobs === undefined || (Array.isArray(value.jobs) && value.jobs.every(isJob)));
const isText = (value: unknown): value is string => typeof value === "string";

function readList<T>(file: string | undefined, is: (value: unknown) => value is T): T[] {
  if (file === undefined) return [];
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(value) || !value.every(is)) throw new Error(`${file}: expected a list of ${is.name.slice(2).toLowerCase()} records`);
  return value;
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
  const { storeFamily } = await import("./wisp/buildInputs");
  const notes: string[] = [];
  for (const pin of resolution.pins) {
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
    options: { conflicts: { type: "string" }, store: { type: "string" }, rebased: { type: "string" }, lanes: { type: "string" }, runs: { type: "string" }, retry: { type: "string" }, count: { type: "string" }, green: { type: "string" }, now: { type: "string" }, landed: { type: "string" }, statuses: { type: "string" } },
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
  } else if (command === "loop") {
    console.log(looping(readList(values.statuses, isText)));
  } else if (command === "past-main") {
    const [base, tested, ...main] = positionals.slice(1);
    if (base === undefined || tested === undefined) throw new Error("past-main needs the base and tested trees");
    console.log(pastMain(readTree(base), readTree(tested), main.map(readTree), values.rebased === undefined ? undefined : readTree(values.rebased)));
  } else if (command === "resolve") {
    if (values.conflicts === undefined) throw new Error("resolve needs --conflicts FILE");
    await resolveCommand(values.conflicts, values.store ?? join(process.env.HOME ?? "", ".local/share/smashcraft-build-inputs/store"));
  } else if (command === "judge") {
    console.log(judge(Number(values.count), values.green === "true"));
  } else {
    console.error("usage: autoland.ts plan --lanes FILE --runs FILE [--retry BRANCHES] [--now ISO] | busy --runs FILE [--now ISO] | train --lanes FILE [--now ISO] | judge --count N --green true|false | sweep --runs FILE [--now ISO] | stalled --lanes FILE --landed ISO [--now ISO] | loop --statuses FILE | resolve --conflicts FILE [--store DIR] | past-main BASE TESTED MAIN... [--rebased TREE] (git ls-tree -r -z files)");
    process.exit(2);
  }
}
