import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { JOB_BUDGET, busy, judge, looping, pastMain, plan, stalled, stuckRuns, train, type Job, type Lane, type Run, type Status, type Tree } from "./autolandCore";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isStatus = (value: unknown): value is Status => isRecord(value) && typeof value.state === "string" && typeof value.description === "string" && typeof value.at === "string";
const isLane = (value: unknown): value is Lane => isRecord(value) && typeof value.branch === "string" && typeof value.tip === "string" && (value.status === null || isStatus(value.status)) && (value.labels === undefined || (Array.isArray(value.labels) && value.labels.every((label: unknown) => typeof label === "string")));
const isJob = (value: unknown): value is Job => isRecord(value) && (value.name === undefined || typeof value.name === "string") && typeof value.status === "string" && typeof value.created === "string" && (value.started === null || typeof value.started === "string") && Array.isArray(value.labels) && value.labels.every((label: unknown) => typeof label === "string");
const isRun = (value: unknown): value is Run => isRecord(value) && typeof value.title === "string" && typeof value.status === "string" && (value.id === undefined || typeof value.id === "number") && (value.created === undefined || typeof value.created === "string") && (value.jobs === undefined || (Array.isArray(value.jobs) && value.jobs.every(isJob)));
const isText = (value: unknown): value is string => typeof value === "string";

function readList<T>(file: string | undefined, is: (value: unknown) => value is T): T[] {
  if (file === undefined) return [];
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(value) || !value.every(is)) throw new Error(`${file}: expected a list of ${is.name.slice(2).toLowerCase()} records`);
  return value;
}

const readTree = (file: string): Tree => new Map(readFileSync(file, "utf8").split("\0").filter(Boolean).map((entry) => {
  const tab = entry.indexOf("\t");
  return [entry.slice(tab + 1), entry.slice(0, tab)];
}));

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: { rebased: { type: "string" }, lanes: { type: "string" }, runs: { type: "string" }, retry: { type: "string" }, count: { type: "string" }, green: { type: "string" }, now: { type: "string" }, landed: { type: "string" }, statuses: { type: "string" } },
  });
  const command = positionals[0];
  if (command === "plan") {
    const result = plan(readList(values.lanes, isLane), readList(values.runs, isRun), (values.retry ?? "").split(/\s+/).filter(Boolean));
    for (const order of result.test) console.log(["test", order.branch, order.tip, order.slot].join("\t"));
    if (result.train) console.log("train");
  } else if (command === "busy") {
    console.log(`${busy(readList(values.runs, isRun))}/${JOB_BUDGET}`);
  } else if (command === "train") {
    for (const lane of train(readList(values.lanes, isLane))) console.log([lane.branch, lane.tip, lane.base, lane.tree].join("\t"));
  } else if (command === "sweep") {
    for (const cancel of stuckRuns(readList(values.runs, isRun), Date.parse(values.now ?? new Date().toISOString()))) console.log([cancel.id, cancel.force, cancel.replan, cancel.reason, cancel.title].join("\t"));
  } else if (command === "stalled") {
    console.log(stalled(readList(values.lanes, isLane), values.landed ?? "", Date.parse(values.now ?? new Date().toISOString())));
  } else if (command === "loop") {
    console.log(looping(readList(values.statuses, isText)));
  } else if (command === "past-main") {
    const [base, tested, ...main] = positionals.slice(1);
    if (base === undefined || tested === undefined) throw new Error("past-main needs the base and tested trees");
    console.log(pastMain(readTree(base), readTree(tested), main.map(readTree), values.rebased === undefined ? undefined : readTree(values.rebased)));
  } else if (command === "judge") {
    console.log(judge(Number(values.count), values.green === "true"));
  } else {
    console.error("usage: autoland.ts plan --lanes FILE --runs FILE [--retry BRANCHES] | busy --runs FILE | train --lanes FILE | judge --count N --green true|false | sweep --runs FILE [--now ISO] | stalled --lanes FILE --landed ISO [--now ISO] | loop --statuses FILE | past-main BASE TESTED MAIN... [--rebased TREE] (git ls-tree -r -z files)");
    process.exit(2);
  }
}
