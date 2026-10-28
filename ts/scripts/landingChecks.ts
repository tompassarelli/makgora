import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const root = join(import.meta.dir, "../..");

export const GROUPS = ["perf", "rollback", "parity-0", "parity-1", "parity-2", "corpus", "types"] as const;
export type Group = (typeof GROUPS)[number];
export const PARITY_SHARDS = 3;

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

const SHARED = /^(ts\/(package\.json|bun\.lock|wisp\.lock|bunfig\.toml|tsconfig[^/]*\.json|runner-routing\.json)|typescript-toolchain\.lock|\.github\/workflows\/farm-test\.yml|ts\/scripts\/landingChecks\.ts)$|^ts\/(plugins|vendor)\//;
const LUA_BUILD = /^(ts\/(src|codegen)\/|build-inputs\/)/;
const TYPES = /^(ts\/|contracts\/|repos\/effect|effect-kit\.json$|typescript-toolchain\.lock$)/;
const TAPES = /^ts\/test\/(tapes|replay|host-natives)/;
const CORPUS = /^ts\/test\/corpus\//;

const WISP_CLI = "ts/scripts/wisp.ts";
const LUA_TESTS = "ts/scripts/lua-tests.ts";
const PARITY_COMMAND = "ts/scripts/wisp/commands/parity.ts";

interface Rule { readonly why: string; readonly matches: (path: string) => boolean }

const pattern = (expression: RegExp, why: string): Rule => ({ why, matches: (path) => expression.test(path) });

const imported = (entries: readonly string[]): Rule => {
  let closure: ReadonlySet<string> | undefined;
  return {
    why: `imported by ${entries.join(" or ")}`,
    matches: (path) => (closure ??= new Set(entries.flatMap((entry) => importClosure(entry)))).has(path),
  };
};

const shared = pattern(SHARED, "a shared root, which selects every group");
const luaBuild = pattern(LUA_BUILD, "an input of the Lua build");
const wispCli = imported([WISP_CLI]);

const RULES: Readonly<Record<Group, readonly Rule[]>> = (() => {
  const budget = [shared, luaBuild, wispCli];
  const parity = [shared, luaBuild, pattern(TAPES, "a tape or replay input"), imported([WISP_CLI, PARITY_COMMAND, LUA_TESTS])];
  return {
    perf: budget,
    rollback: budget,
    "parity-0": parity,
    "parity-1": parity,
    "parity-2": parity,
    corpus: [shared, luaBuild, pattern(CORPUS, "a native recording"), pattern(TYPES, "read by effect-kit, the cue models or computer coverage")],
    types: [shared, pattern(TYPES, "type-checked")],
  };
})();

export interface Selected { readonly group: Group; readonly path: string; readonly why: string }

export function selectGroups(paths: readonly string[], full = false): Selected[] {
  if (full) return GROUPS.map((group) => ({ group, path: "", why: `${FULL_SUITE_VARIABLE}=1 forces the full suite` }));
  if (paths.includes(UNKNOWN_BASE)) return GROUPS.map((group) => ({ group, path: "", why: "no known base commit, so every group runs" }));
  return GROUPS.flatMap((group) => {
    for (const path of paths) {
      const rule = RULES[group].find((candidate) => candidate.matches(path));
      if (rule !== undefined) return [{ group, path, why: rule.why }];
    }
    return [];
  });
}

export function selectionLines(paths: readonly string[], selected: readonly Selected[]): string[] {
  const skipped = GROUPS.filter((group) => !selected.some((entry) => entry.group === group));
  return [
    `landing checks: ${paths.length} changed path${paths.length === 1 ? "" : "s"}; ${selected.length} of ${GROUPS.length} farm check groups selected`,
    ...selected.map(({ group, path, why }) => `  run  ${group}: ${path === "" ? why : `${path} is ${why}`}`),
    ...(skipped.length === 0 ? [] : [`  skip ${skipped.join(", ")}: no changed path reaches them (main's CI runs every group after landing; ${FULL_SUITE_VARIABLE}=1 forces them)`]),
  ];
}

if (import.meta.main) {
  const [command] = process.argv.slice(2);
  if (command !== "groups") throw new Error("usage: bun scripts/landingChecks.ts groups < changed-paths");
  const paths = (await Bun.stdin.text()).split("\n").map((line) => line.trim()).filter((line) => line !== "");
  const selected = selectGroups(paths, process.env[FULL_SUITE_VARIABLE] === "1");
  for (const line of selectionLines(paths, selected)) console.error(line);
  for (const { group } of selected) console.log(group);
}
