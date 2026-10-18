import { readFileSync } from "node:fs";
import { Effect } from "effect";
import { captureProcess } from "wisp/scripts/wisp/hostProcess";
import { heldLanes, issueRefs, parseList, supersededLanes, type PushedLane, type RunSummary } from "./autolandCore";

const isRunSummary = (value: unknown): value is RunSummary => typeof value === "object" && value !== null && "title" in value && "status" in value && "head_branch" in value
  && typeof value.title === "string" && typeof value.status === "string" && (value.head_branch === null || typeof value.head_branch === "string");

const git = (...args: string[]) => captureProcess("git", args[0] ?? "", ["git", ...args]).pipe(
  Effect.map(({ exitCode, stdout }) => exitCode === 0 ? stdout.trim() : undefined),
);

const superseded = (main: string, lanesFile: string, runsFile: string) => Effect.gen(function*() {
  const held = heldLanes(parseList(readFileSync(runsFile, "utf8"), runsFile, isRunSummary));
  if (held === "all") return;
  const tree = yield* git("rev-parse", `${main}^{tree}`);
  if (tree === undefined) return yield* Effect.die(new Error(`${main} names no tree`));
  const lanes: PushedLane[] = [];
  for (const line of readFileSync(lanesFile, "utf8").split("\n").filter(Boolean)) {
    const [branch = "", tip = "", state = "", failed = "", pushed = ""] = line.split("\t");
    if ((yield* git("cat-file", "-e", tip)) === undefined) continue;
    const base = (yield* git("merge-base", main, tip)) ?? "";
    lanes.push({ branch, tip, state, failed, pushed, issues: issueRefs((yield* git("log", "--format=%B", `${base}..${tip}`)) ?? "") });
  }
  const unchanged = new Set<string>();
  for (const lane of lanes.filter(({ branch }) => !held.has(branch)))
    if ((yield* git("merge-tree", "--write-tree", main, lane.tip)) === tree) unchanged.add(lane.branch);
  for (const lane of supersededLanes(lanes, held, ({ branch }) => unchanged.has(branch))) console.log([lane.branch, lane.tip, lane.why, lane.issues.join(" ")].join("\t"));
});

if (import.meta.main) {
  const [main, lanes, runs] = process.argv.slice(2);
  if (main === undefined || lanes === undefined || runs === undefined) {
    console.error("usage: autolandSuperseded.ts MAIN LANES_TSV RUNS_JSON");
    process.exit(2);
  }
  await Effect.runPromise(superseded(main, lanes, runs));
}
