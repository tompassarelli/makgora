import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Console, Data, Effect, Exit } from "effect";
import { CHECKS, GROUPS, type Group, type LandingCheck, UNKNOWN_BASE, reachedChecks } from "./landingChecks";
import { type Finished, runGroup } from "./processGroups";

const ts = join(import.meta.dir, "..");
const TAIL_LINES = 40;
// Edit-loop timings are reported, not gated, wherever a landing check runs, as on main's CI (smashcraft:docs/ci.md).
const CHECK_ENVIRONMENT = { CI_TIMING: "report" };

const outputOf = ({ stdout, stderr }: Finished) => `${stdout}${stderr}`;
const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

export interface Ran { readonly check: LandingCheck; readonly finished: Finished; readonly seconds: number }

export class CheckFailed extends Data.TaggedError("CheckFailed")<Ran> {}

const runCheck = (check: LandingCheck, env: Readonly<Record<string, string>> = {}) => Effect.gen(function*() {
  const started = performance.now();
  const finished = yield* runGroup(check.command, { cwd: ts, env: { ...process.env, ...CHECK_ENVIRONMENT, ...check.env, ...env } });
  return { check, finished, seconds: (performance.now() - started) / 1000 };
});

const seconds = (value: number) => `${value.toFixed(1)} s`;

/**
 * The landing gate's checks on this machine: each `beside` check at once (checks
 * sharing outputs one after another), refusing on the first failure and stopping
 * the rest; an `alone` check runs by itself, since it edits the working tree.
 */
export const runHere = (checks: readonly LandingCheck[]) => {
  const chains = new Map<string, LandingCheck[]>();
  for (const check of checks) chains.set(check.outputs ?? check.name, [...(chains.get(check.outputs ?? check.name) ?? []), check]);
  return Effect.forEach([...chains.values()], (chain) => Effect.forEach(chain, (check) => runCheck(check).pipe(
    Effect.tap(({ finished, seconds: took }) => finished.exitCode === 0
      ? Console.error(`landing check: ${check.name} passed (${seconds(took)})`)
      : Effect.fail(new CheckFailed({ check, finished, seconds: took }))),
  )), { concurrency: "unbounded", discard: true });
};

export function failureReport({ check, finished, seconds: took }: Ran): string {
  const tail = plain(outputOf(finished)).split("\n").filter((line) => line.trim() !== "").slice(-TAIL_LINES).join("\n");
  return `${tail}\nlanding check: ${check.name} exited ${finished.exitCode} (${seconds(took)})`;
}

const farmName = (check: LandingCheck, group: Group) => check.shardVariable === undefined ? check.name : `${check.name} ${check.farm.indexOf(group)}/${check.farm.length}`;

/**
 * One farm-test.yml job: its group's checks one after another, as main's CI log
 * groups, with the result rows and failing lines the merge job reads.
 */
const runFarmGroup = (group: Group, changed: readonly string[], named: boolean) => Effect.gen(function*() {
  const inGroup = CHECKS.filter((check) => check.farm.includes(group));
  const reached = new Set(reachedChecks(changed).map(({ check }) => check));
  const checks = named ? inGroup : inGroup.filter((check) => reached.has(check));
  mkdirSync(join(ts, "build"), { recursive: true });
  appendFileSync(join(ts, "build/checks.tsv"), "");
  let failed = false;
  for (const check of checks) {
    const name = farmName(check, group);
    const shard = check.shardVariable === undefined ? {} : { [check.shardVariable]: `${check.farm.indexOf(group)}/${check.farm.length}` };
    yield* Console.log(`::group::${name}`);
    const ran = yield* runCheck(check, shard);
    yield* Console.log(outputOf(ran.finished));
    yield* Console.log("::endgroup::");
    const passed = ran.finished.exitCode === 0;
    appendFileSync(join(ts, "build/checks.tsv"), `${passed ? "pass" : "fail"}\t${Math.round(ran.seconds)}\tcheck: ${name}\n`);
    if (passed) continue;
    failed = true;
    const last = plain(outputOf(ran.finished)).split("\n").filter((line) => line.trim() !== "").slice(-6).join(" ").slice(0, 700);
    appendFileSync(join(ts, `problems-check-${group}.txt`), `check: ${name} exited ${ran.finished.exitCode}: ${last}\n`);
  }
  return failed ? 1 : 0;
});

const usage = "usage: bun scripts/landingRun.ts farm GROUP CHANGED-PATHS-FILE [CHECKS] | here CHECK-NAME...";

if (import.meta.main) {
  const [mode, ...rest] = process.argv.slice(2);
  const program = Effect.gen(function*() {
    if (mode === "farm") {
      const [group, changedFile, named = ""] = rest;
      const known = GROUPS.find((candidate) => candidate === group);
      if (known === undefined || changedFile === undefined) return yield* Effect.die(usage);
      const changed = readFileSync(changedFile, "utf8").split("\n").map((line) => line.trim()).filter((line) => line !== "");
      return yield* runFarmGroup(known, changed.length === 0 ? [UNKNOWN_BASE] : changed, named.split(",").includes(known));
    }
    if (mode !== "here" || rest.length === 0) return yield* Effect.die(usage);
    const checks = rest.map((name) => CHECKS.find((check) => check.name === name) ?? name);
    const unknown = checks.filter((check) => typeof check === "string");
    if (unknown.length > 0) return yield* Effect.die(`no landing check named ${unknown.join(", ")}`);
    return yield* runHere(checks.filter((check) => typeof check !== "string")).pipe(
      Effect.as(0),
      Effect.catchTag("CheckFailed", (failed) => Console.error(failureReport(failed)).pipe(Effect.as(1))),
    );
  });
  const exit = await Effect.runPromiseExit(program);
  if (Exit.isFailure(exit)) console.error(String(exit.cause));
  process.exit(Exit.isSuccess(exit) ? exit.value : 2);
}
