import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { UsageFailure, flagValues } from "wisp/scripts/wisp/command";
import { withQuietNativeCapacity } from "wisp/scripts/wisp/quietNativeCapacity";
import { fighterName, PLAYABLE_CHARACTERS } from "../../src/game/sim/heroes/registry";
import { stopBunProcess } from "../hostProcess";
import { currentPlaytest } from "./currentPlaytest";
import { isGreen } from "./greenBuilds";
import { greenMain, greenState } from "./installGreen";
import { SMOKE_TABLE_HEADER } from "./smokeJudge";
import { movesShardId, smokePairs, smokeShardLabel, smokeShards, specialsShardId } from "./smokeShards";

export const SHARD_RUN_SECONDS = 300;
const WISP_PROGRAM = join(import.meta.dir, "../wisp.ts");

class NativeSmokeFailure extends Schema.TaggedError<NativeSmokeFailure>()("NativeSmokeFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const Report = Schema.fromJsonString(Schema.Struct({ results: Schema.Array(Schema.Struct({ id: Schema.String, verdict: Schema.String, reason: Schema.String })) }));

interface ShardOutcome {
  readonly shard: number;
  readonly code: number | "timeout";
  readonly verdicts: readonly { readonly id: string; readonly verdict: string; readonly reason: string }[];
  readonly rows: readonly string[];
  readonly seconds: number;
}

const tables = (directory: string): string[] => existsSync(directory)
  ? readdirSync(directory, { recursive: true, encoding: "utf8" }).filter(file => /(^|\/)match-\d+\.tsv$/.test(file)).sort().map(file => join(directory, file))
  : [];

const outcome = (shard: number, directory: string, code: number | "timeout", seconds: number): ShardOutcome => {
  const report = join(directory, "report.json");
  const decoded = existsSync(report) ? Schema.decodeOption(Report)(readFileSync(report, "utf8")) : undefined;
  const verdicts = decoded?._tag === "Some" ? decoded.value.results.filter(({ id }) => id === movesShardId(shard) || id === specialsShardId(shard)) : [];
  const rows = tables(directory).flatMap(file => readFileSync(file, "utf8").split("\n").slice(1).filter(line => line !== ""));
  return { shard, code, verdicts, rows, seconds };
};

export const shardPassed = ({ code, verdicts, rows }: ShardOutcome): boolean =>
  code === 0 && verdicts.length === 2 && verdicts.every(({ verdict }) => verdict === "pass") && rows.length > 0 && rows.every(row => row.split("\t")[3] === "PASS");

const frozen = ({ rows }: ShardOutcome): boolean => rows.some(row => row.split("\t")[3] === "INVALID");

const runShard = (shard: number, pair: string, map: string, directory: string) => withQuietNativeCapacity(`smashcraft-smoke-${smokeShardLabel(shard)}`, Effect.acquireUseRelease(
  Effect.try({
    try: () => {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      return { child: Bun.spawn([process.execPath, WISP_PROGRAM, "accept", "--only", movesShardId(shard), specialsShardId(shard), "--pair", pair, "--map", map, "--out", directory], { stdout: "inherit", stderr: "inherit", stdin: "ignore" }), started: performance.now() };
    },
    catch: cause => new NativeSmokeFailure({ problem: `shard ${smokeShardLabel(shard)} could not start: ${String(cause)}` }),
  }),
  ({ child, started }) => Effect.promise(() => child.exited).pipe(
    Effect.timeoutOption(`${SHARD_RUN_SECONDS} seconds`),
    Effect.map(exited => outcome(shard, directory, exited._tag === "Some" ? exited.value : "timeout", Math.round((performance.now() - started) / 1000))),
  ),
  ({ child }) => stopBunProcess(child).pipe(Effect.andThen(Effect.promise(() => Bun.spawn(["systemctl", "--user", "stop", `smashcraft-accept-${child.pid}.service`], { stdout: "ignore", stderr: "ignore" }).exited))),
));

const pairLabel = (shard: number) => (smokePairs()[shard] ?? []).map(choice => fighterName(PLAYABLE_CHARACTERS[choice] ?? 0)).join(" vs ");

export const smokeReport = (map: string, sha256: string, outcomes: readonly ShardOutcome[]): string => [
  `# Native move smoke`, "", `Candidate: ${map}`, `SHA256: ${sha256}`, "",
  "| Shard | Fighters | Run | Seconds | Verdict |", "|---|---|---|---|---|",
  ...outcomes.map(item => `| ${smokeShardLabel(item.shard)} | ${pairLabel(item.shard)} | ${item.code === "timeout" ? `stopped at ${SHARD_RUN_SECONDS} s` : `exit ${item.code}`} | ${item.seconds} | ${shardPassed(item) ? "PASS" : `FAIL ${item.verdicts.filter(({ verdict }) => verdict !== "pass").map(({ id, verdict, reason }) => `${id} ${verdict}: ${reason}`).join("; ").replaceAll("|", "/")}`} |`),
  "", `| Shard | ${SMOKE_TABLE_HEADER.split("\t").join(" | ")} |`, "|---|---|---|---|---|---|",
  ...outcomes.flatMap(item => item.rows.map(row => `| ${smokeShardLabel(item.shard)} | ${row.replaceAll("|", "/").split("\t").join(" | ")} |`)),
  "",
].join("\n");

const greenCandidate = Effect.gen(function*() {
  const green = (yield* greenMain).find(isGreen);
  if (green === undefined) return yield* new NativeSmokeFailure({ problem: "no green commit on main to smoke" });
  const { map } = yield* currentPlaytest({ revision: green.sha, helper: false });
  return map.source;
});

export const nativeSmoke = (args: readonly string[]) => Effect.gen(function*() {
  const [pair] = flagValues(args, "pair");
  if (pair === undefined) return yield* new UsageFailure({ problem: "smoke --native needs --pair K, the offline pool pair it runs on" });
  const wanted = flagValues(args, "shard").map(value => Number(value) - 1);
  if (wanted.some(shard => !smokeShards().includes(shard))) return yield* new UsageFailure({ problem: `--shard takes 1-${smokeShards().length}` });
  const map = flagValues(args, "map")[0] ?? (yield* greenCandidate);
  const sha256 = createHash("sha256").update(readFileSync(map)).digest("hex");
  const root = join(greenState, "accept", sha256, "classic");
  const outcomes: ShardOutcome[] = [];
  for (const shard of wanted.length > 0 ? wanted : smokeShards()) {
    const directory = join(root, movesShardId(shard));
    const first = yield* runShard(shard, pair, map, directory);
    outcomes.push(!shardPassed(first) && frozen(first) ? yield* runShard(shard, pair, map, directory) : first);
  }
  const report = smokeReport(map, sha256, outcomes);
  writeFileSync(join(root, "smoke.md"), report, { mode: 0o600 });
  console.log(report);
  console.log(`Smoke table ${join(root, "smoke.md")}`);
  const failed = outcomes.filter(item => !shardPassed(item));
  if (failed.length > 0) return yield* new NativeSmokeFailure({ problem: `native move smoke failed shards ${failed.map(({ shard }) => smokeShardLabel(shard)).join(", ")}` });
}).pipe(Effect.mapError(cause => cause instanceof UsageFailure || cause instanceof NativeSmokeFailure ? cause : new NativeSmokeFailure({ problem: cause.message })), Effect.provide(BunServices.layer));
