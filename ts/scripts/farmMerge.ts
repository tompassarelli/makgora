import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { Schema } from "effect";
import { Plan, ShardResult, type Summary, Timings, merge } from "../node_modules/wisp/host/farm/farmShards";
import { GROUPS, type Group } from "./landingChecks";

/** Every check group reports into this Lua shard (farm-test.yml's `farmShards.ts lua --shard 0`), so a group skipped on a passing input hash or a changed-path filter fills it with a pass. */
export const CHECK_SHARD: ShardResult = { suite: "lua", shard: 0, exitCode: 0, tests: [] };

export interface CheckArtifacts {
  readonly results: ReadonlyMap<string, ShardResult>;
  readonly skipped: ReadonlySet<Group>;
  readonly notes: readonly string[];
}

export interface MergeInput {
  readonly plan: Plan;
  readonly artifacts: CheckArtifacts;
  readonly expected: readonly Group[];
  readonly planResult: string;
  readonly timings: Timings;
}

const ZERO = { passed: 0, failed: 0, skipped: 0, shards: 0, slowestShardSeconds: 0 };

const planProblems = (planResult: string) => planResult === "success" ? [] : [`the plan job ended ${planResult}, so no shard ran: see its log`];

const ran = (artifacts: CheckArtifacts, group: Group) => artifacts.results.has(`result-check-${group}.json`);

export function expectedGroups(checks: string): Group[] {
  if (checks === "") return [...GROUPS];
  const named = new Set(Schema.decodeSync(Schema.fromJsonString(Schema.Array(Schema.String)))(checks));
  return GROUPS.filter((group) => named.has(group));
}

export function mergeChecks({ plan, artifacts, expected, planResult, timings }: MergeInput): { readonly summary: Summary; readonly timings: Timings } {
  const missing = expected.filter((group) => !ran(artifacts, group) && !artifacts.skipped.has(group))
    .map((group) => `check group ${group} neither ran nor was filtered out: it left no result`);
  const passes = [...artifacts.skipped].map(() => CHECK_SHARD);
  const merged = merge(plan, [...artifacts.results.values(), ...passes], timings);
  return { summary: { ...merged.summary, problems: [...missing, ...planProblems(planResult), ...artifacts.notes, ...merged.summary.problems] }, timings: merged.timings };
}

const SKIP_MARKER = /^skipped-check-(.+)\.txt$/;

const decodeFile = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string): S["Type"] =>
  Schema.decodeSync(Schema.fromJsonString(schema))(readFileSync(path, "utf8"));

export function readArtifacts(folder: string): CheckArtifacts {
  const files = existsSync(folder) ? readdirSync(folder, { recursive: true, encoding: "utf8" }).sort() : [];
  const results = new Map<string, ShardResult>();
  const skipped = new Set<Group>();
  const notes: string[] = [];
  for (const file of files) {
    const name = basename(file);
    const marker = SKIP_MARKER.exec(name)?.[1];
    if (/^result.*\.json$/.test(name)) results.set(name, decodeFile(ShardResult, join(folder, file)));
    else if (marker !== undefined && (GROUPS as readonly string[]).includes(marker)) skipped.add(marker as Group);
    else if (/^problems-.*\.txt$/.test(name)) notes.push(...readFileSync(join(folder, file), "utf8").split("\n").filter((line) => /\S/.test(line)));
  }
  return { results, skipped, notes };
}

if (import.meta.main) {
  const { values } = parseArgs({ args: process.argv.slice(2), options: {
    folder: { type: "string" }, plan: { type: "string" }, timings: { type: "string" }, out: { type: "string" }, checks: { type: "string" }, "plan-result": { type: "string" },
  } });
  const timingsPath = values.timings ?? "farm-timings.json";
  const out = values.out ?? "summary.json";
  const planResult = values["plan-result"] ?? "";
  try {
    const { summary, timings } = mergeChecks({
      plan: decodeFile(Plan, values.plan ?? ""),
      artifacts: readArtifacts(values.folder ?? "farm"),
      expected: expectedGroups(values.checks ?? ""),
      planResult,
      timings: existsSync(timingsPath) ? decodeFile(Timings, timingsPath) : { bun: {}, lua: {} },
    });
    writeFileSync(timingsPath, `${JSON.stringify(timings)}\n`);
    writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (cause) {
    const summary: Summary = { bun: ZERO, lua: ZERO, failures: [], problems: [...planProblems(planResult), `merging the shard results failed: ${String(cause).split("\n").slice(0, 3).join(" ")}`] };
    writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);
    console.error(String(cause));
    process.exit(1);
  }
}
