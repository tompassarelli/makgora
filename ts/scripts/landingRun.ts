import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Console, Data, Effect, Exit } from "effect";
import { CHECKS, GROUPS, type Group, type LandingCheck, UNKNOWN_BASE } from "./landingChecks";
import { groupChecks } from "./landingInputs";
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
const chainsOf = (checks: readonly LandingCheck[]) => {
  const chains = new Map<string, LandingCheck[]>();
  for (const check of checks) chains.set(check.outputs ?? check.name, [...(chains.get(check.outputs ?? check.name) ?? []), check]);
  return [...chains.values()];
};

export const runHere = (checks: readonly LandingCheck[]) =>
  Effect.forEach(chainsOf(checks), (chain) => Effect.forEach(chain, (check) => runCheck(check).pipe(
    Effect.tap(({ finished, seconds: took }) => finished.exitCode === 0
      ? Console.error(`landing check: ${check.name} passed (${seconds(took)})`)
      : Effect.fail(new CheckFailed({ check, finished, seconds: took }))),
  )), { concurrency: "unbounded", discard: true });

export function failureReport({ check, finished, seconds: took }: Ran): string {
  const tail = plain(outputOf(finished)).split("\n").filter((line) => line.trim() !== "").slice(-TAIL_LINES).join("\n");
  return `${tail}\nlanding check: ${check.name} exited ${finished.exitCode} (${seconds(took)})`;
}

const farmName = (check: LandingCheck, group: Group) => check.shardVariable === undefined ? check.name : `${check.name} ${check.farm.indexOf(group)}/${check.farm.length}`;

const shardOf = (check: LandingCheck, group: Group) =>
  check.shardVariable === undefined ? {} : { [check.shardVariable]: `${check.farm.indexOf(group)}/${check.farm.length}` };

/**
 * One farm-test.yml job: its group's checks at once as the landing machine runs
 * them (an `alone` check afterwards, by itself), each printed as its own log
 * group, with the result rows and failing lines the merge job reads.
 */
const runFarmGroup = (group: Group, changed: readonly string[]) => Effect.gen(function*() {
  const checks = groupChecks(group, changed);
  mkdirSync(join(ts, "build"), { recursive: true });
  appendFileSync(join(ts, "build/checks.tsv"), "");
  const beside = yield* Effect.forEach(chainsOf(checks.filter(({ here }) => here !== "alone")),
    (chain) => Effect.forEach(chain, (check) => runCheck(check, shardOf(check, group))), { concurrency: "unbounded" });
  const alone = yield* Effect.forEach(checks.filter(({ here }) => here === "alone"), (check) => runCheck(check, shardOf(check, group)));
  let failed = false;
  for (const ran of [...beside.flat(), ...alone]) {
    const name = farmName(ran.check, group);
    yield* Console.log(`::group::${name} (${seconds(ran.seconds)})`);
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

const usage = "usage: bun scripts/landingRun.ts farm GROUP CHANGED-PATHS-FILE | here CHECK-NAME...";

if (import.meta.main) {
  const [mode, ...rest] = process.argv.slice(2);
  const program = Effect.gen(function*() {
    if (mode === "farm") {
      const [group, changedFile] = rest;
      const known = GROUPS.find((candidate) => candidate === group);
      if (known === undefined || changedFile === undefined) return yield* Effect.die(usage);
      const changed = readFileSync(changedFile, "utf8").split("\n").map((line) => line.trim()).filter((line) => line !== "");
      return yield* runFarmGroup(known, changed.length === 0 ? [UNKNOWN_BASE] : changed);
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
