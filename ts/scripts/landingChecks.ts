import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const root = join(import.meta.dir, "../..");

export const GROUPS = ["perf", "rollback", "parity-0", "parity-1", "parity-2", "corpus", "types"] as const;
export type Group = (typeof GROUPS)[number];

export const FULL_SUITE_VARIABLE = "LAND_FULL_SUITE";
export const UNKNOWN_BASE = "unknown";

export function importClosure(entry: string): string[] {
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    for (const { path, kind } of transpiler.scanImports(readFileSync(file, "utf8"))) {
      if (kind === "dynamic-import" || !path.startsWith(".")) continue;
      const base = join(dirname(file), path);
      const found = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((candidate) => existsSync(candidate) && candidate.match(/\.tsx?$/));
      if (found !== undefined) visit(found);
    }
  };
  visit(join(root, entry));
  return [...seen].map((file) => relative(root, file));
}

const SHARED = /^(ts\/(package\.json|bun\.lock|wisp\.lock|bunfig\.toml|tsconfig[^/]*\.json|runner-routing\.json)|typescript-toolchain\.lock|\.github\/workflows\/farm-test\.yml|ts\/scripts\/(landingChecks|landingRun)\.ts)$|^ts\/(plugins|vendor)\//;
const LUA_BUILD = /^(ts\/(src|codegen)\/|build-inputs\/)/;
const TYPES = /^(ts\/|contracts\/|repos\/effect|effect-kit\.json$|typescript-toolchain\.lock$)/;
const TAPES = /^ts\/test\/(tapes|replay|host-natives)/;
const CORPUS = /^ts\/test\/corpus\//;
const REPLAY_HEADER = /^ts\/src\/game\/replay\//;

const WISP_CLI = "ts/scripts/wisp.ts";
const LUA_TESTS = "ts/scripts/lua-tests.ts";
const PARITY_COMMAND = "ts/scripts/wisp/commands/parity.ts";

export interface Rule { readonly why: string; readonly matches: (path: string) => boolean }

const pattern = (expression: RegExp, why: string): Rule => ({ why, matches: (path) => expression.test(path) });

const files = (paths: readonly string[], why: string): Rule => ({ why, matches: (path) => paths.includes(path) });

const imported = (entries: readonly string[]): Rule => {
  let closure: ReadonlySet<string> | undefined;
  return {
    why: `imported by ${entries.join(" or ")}`,
    matches: (path) => (closure ??= new Set(entries.flatMap((entry) => importClosure(entry)))).has(path),
  };
};

const shared = pattern(SHARED, "a shared root, which selects every check");
const luaBuild = pattern(LUA_BUILD, "an input of the Lua build");
const wispCli = imported([WISP_CLI]);
const parity = [shared, luaBuild, pattern(TAPES, "a tape or replay input"), imported([WISP_CLI, PARITY_COMMAND, LUA_TESTS])];

/**
 * One check a landing can need. `farm` names the farm-test.yml jobs that run it
 * (several split it with `shardVariable`); `here` is how the landing gate runs it
 * on this machine: beside the others, or alone because it edits the working tree.
 * A check without `here` is one the pre-push hook already runs as its own local check.
 * `afterLanding` leaves it to main's CI unless a shared root or the full suite reaches it.
 * Checks naming the same `outputs` write the same build files, so they run one after another.
 */
export interface LandingCheck {
  readonly name: string;
  readonly command: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly reaches: readonly Rule[];
  readonly farm: readonly Group[];
  readonly shardVariable?: string;
  readonly here?: "beside" | "alone";
  readonly afterLanding?: boolean;
  readonly outputs?: string;
}

export const CHECKS: readonly LandingCheck[] = [
  {
    name: "four-fighter p99 <= 10 ms and worst <= 14 ms in Classic",
    command: ["sh", "-c", "bun wisp perf playable-bot-four --samples --out build/playable-bot-four.perf && bun wisp perf budget build/playable-bot-four.perf"],
    reaches: [shared, luaBuild, wispCli], farm: ["perf"], here: "beside", afterLanding: true, outputs: "playable",
  },
  {
    name: "four-fighter 7-frame rollback p99 <= 10 ms and worst <= 14 ms",
    command: ["sh", "-c", "bun wisp perf rollback-four --samples --out build/rollback-four.perf && bun wisp perf budget build/rollback-four.perf"],
    reaches: [shared, luaBuild, wispCli], farm: ["rollback"], here: "beside", afterLanding: true, outputs: "playable",
  },
  // Tapes and the numeric corpus in stock Lua32 and in one whose raw float + - * round toward zero must equal Bun (wisp:docs/headless.md#raw-float-rounding).
  {
    name: "parity tapes",
    command: ["bun", "wisp", "parity", "tapes"],
    reaches: parity, farm: ["parity-0", "parity-1", "parity-2"], shardVariable: "TAPES_SHARD", here: "beside",
  },
  { name: "parity numeric", command: ["bun", "wisp", "parity", "numeric"], reaches: parity, farm: ["parity-0"], here: "beside" },
  {
    name: "stack-trace profile TypeScript frames",
    command: ["bun", "scripts/lua-tests.ts"], env: { LUA_TESTS_STEP: "stack" },
    reaches: parity, farm: ["parity-0"], here: "beside",
  },
  // Each native recording replays on the source that recorded it (wisp#69), so only the replay command and its header parse reach it from this tree.
  {
    name: "parity corpus: every native recording replays headless with 0 divergent frames",
    command: ["bun", "wisp", "parity", "corpus", "test/corpus"],
    reaches: [shared, pattern(CORPUS, "a native recording"), pattern(REPLAY_HEADER, "read by the corpus replay's header parse"),
      files([WISP_CLI, PARITY_COMMAND, "ts/scripts/wisp/corpus.ts", "ts/scripts/wisp/replayFiles.ts", "ts/scripts/wisp/commands/replay.ts", "ts/scripts/sourceVersion.ts"], "the corpus replay command")],
    farm: ["corpus"], here: "beside",
  },
  {
    name: "compiler affected-module and output-equivalence checks",
    command: ["bun", "scripts/compiler-benchmark.ts"], env: { COMPILER_TIMINGS: "1" },
    reaches: [shared, imported(["ts/scripts/compiler-benchmark.ts"]), files(["ts/src/host/loop/diagnostics.ts"], "the source the compiler benchmark edits")],
    farm: ["corpus"], here: "alone",
  },
  {
    name: "cue models and Classic effect record current for this tree",
    command: ["bun", "scripts/cueModels.ts"],
    reaches: [shared, luaBuild, pattern(TYPES, "read by the cue models")], farm: ["corpus"],
  },
  {
    name: "effect-kit check",
    command: ["sh", "-c", "git clone -q --depth 1 https://github.com/tompassarelli/north \"$RUNNER_TEMP/north\" && cd .. && bun \"$RUNNER_TEMP/north/agent-machinery/scripts/effect-kit.mjs\" check"],
    reaches: [shared, pattern(TYPES, "read by effect-kit")], farm: ["corpus"],
  },
  {
    name: "every selectable computer fighter is active",
    command: ["bun", "scripts/cpuCoverage.ts"],
    reaches: [shared, imported(["ts/scripts/cpuCoverage.ts"])], farm: ["corpus"], here: "beside",
  },
  {
    name: "type-check edit loop and dependency validation",
    command: ["bun", "scripts/typecheck-benchmark.ts"],
    reaches: [shared, imported(["ts/scripts/typecheck-benchmark.ts"]),
      files(["ts/src/game/core/gameFiles.ts", "ts/scripts/wisp/commands/fresh.ts", "ts/src/game/session/journalFiles.ts"], "a source the type-check benchmark edits or expects to fail")],
    farm: ["types"], here: "alone",
  },
];

export interface Reached { readonly check: LandingCheck; readonly path: string; readonly why: string; readonly shared: boolean }

export function reachedChecks(paths: readonly string[], full = false): Reached[] {
  if (full) return CHECKS.map((check) => ({ check, path: "", why: `${FULL_SUITE_VARIABLE}=1 forces the full suite`, shared: true }));
  if (paths.includes(UNKNOWN_BASE)) return CHECKS.map((check) => ({ check, path: "", why: "no known base commit, so every check runs", shared: true }));
  return CHECKS.flatMap((check) => {
    for (const path of paths) {
      const rule = check.reaches.find((candidate) => candidate.matches(path));
      if (rule !== undefined) return [{ check, path, why: rule.why, shared: rule === shared }];
    }
    return [];
  });
}

export interface Selected { readonly group: Group; readonly path: string; readonly why: string }

export function selectGroups(paths: readonly string[], full = false): Selected[] {
  const reached = reachedChecks(paths, full);
  return GROUPS.flatMap((group) => {
    const first = reached.find(({ check }) => check.farm.includes(group));
    return first === undefined ? [] : [{ group, path: first.path, why: first.why }];
  });
}

export interface Landing { readonly run: readonly Reached[]; readonly afterLanding: readonly Reached[] }

export function landingSelection(paths: readonly string[], full = false): Landing {
  const reached = reachedChecks(paths, full).filter(({ check }) => check.here !== undefined);
  const deferred = ({ check, shared }: Reached) => check.afterLanding === true && !shared;
  return { run: reached.filter((entry) => !deferred(entry)), afterLanding: reached.filter(deferred) };
}

const located = ({ path, why }: { readonly path: string; readonly why: string }) => (path === "" ? why : `${path} is ${why}`);

export function selectionLines(paths: readonly string[], landing: Landing): string[] {
  const reached = new Set([...landing.run, ...landing.afterLanding].map(({ check }) => check));
  const skipped = CHECKS.filter((check) => check.here !== undefined && !reached.has(check));
  return [
    `landing checks: ${paths.length} changed path${paths.length === 1 ? "" : "s"}; ${landing.run.length} of ${CHECKS.filter((check) => check.here !== undefined).length} checks run before landing`,
    ...landing.run.map((entry) => `  run   ${entry.check.name}: ${located(entry)}`),
    ...landing.afterLanding.map((entry) => `  after ${entry.check.name}: ${located(entry)}, and it runs on main's CI after landing`),
    ...(skipped.length === 0 ? [] : [`  skip  ${skipped.map(({ name }) => name).join("; ")}: no changed path reaches them (main's CI runs every check after landing; ${FULL_SUITE_VARIABLE}=1 forces them)`]),
  ];
}

export function farmGroupLines(paths: readonly string[], selected: readonly Selected[]): string[] {
  const skipped = GROUPS.filter((group) => !selected.some((entry) => entry.group === group));
  return [
    `farm check groups: ${paths.length} changed path${paths.length === 1 ? "" : "s"}; ${selected.length} of ${GROUPS.length} selected`,
    ...selected.map((entry) => `  run  ${entry.group}: ${located(entry)}`),
    ...(skipped.length === 0 ? [] : [`  skip ${skipped.join(", ")}: no changed path reaches them`]),
  ];
}

if (import.meta.main) {
  const [command] = process.argv.slice(2);
  if (command !== "groups") throw new Error("usage: bun scripts/landingChecks.ts groups < changed-paths");
  const paths = (await Bun.stdin.text()).split("\n").map((line) => line.trim()).filter((line) => line !== "");
  const selected = selectGroups(paths, process.env[FULL_SUITE_VARIABLE] === "1");
  for (const line of farmGroupLines(paths, selected)) console.error(line);
  for (const { group } of selected) console.log(group);
}
