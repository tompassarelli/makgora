import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Deferred, Effect, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { UsageFailure, flagValues } from "wisp/scripts/wisp/command";
import { quietNativeSessionArgs } from "wisp/scripts/wisp/quietNativeCapacity";
import { fighterName, PLAYABLE_CHARACTERS } from "../../src/game/sim/heroes/registry";
import { capacityHelper, admitsThroughHelper } from "../heavyCapacity";
import { stopBunProcess } from "../hostProcess";
import { pairRestartFile } from "./commands/lanPoolUnit";
import { userSessionEnv } from "./commands/nativeUnit";
import { currentPlaytest } from "./currentPlaytest";
import { type SmokeReport, isGreen } from "./greenBuilds";
import { greenMain, greenState, smokeShardFile } from "./installGreen";
import { SMOKE_TABLE_HEADER, type SmokeMatchFailures } from "./smokeJudge";
import { movesShardId, smokePairs, smokeShardLabel, smokeShards, specialsShardId } from "./smokeShards";

export const SHARD_RUN_SECONDS = 280;
const WISP_PROGRAM = join(import.meta.dir, "../wisp.ts");

class NativeSmokeFailure extends Schema.TaggedError<NativeSmokeFailure>()("NativeSmokeFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const Report = Schema.fromJsonString(Schema.Struct({ results: Schema.Array(Schema.Struct({ id: Schema.String, verdict: Schema.String, reason: Schema.String })) }));
const MatchFailures = Schema.fromJsonString(Schema.Struct({ deadBindings: Schema.Array(Schema.String), movesNotStarted: Schema.Array(Schema.String) }));

interface ShardOutcome {
  readonly shard: number;
  readonly code: number | "timeout" | "error";
  readonly problem?: string;
  readonly verdicts: readonly { readonly id: string; readonly verdict: string; readonly reason: string }[];
  readonly rows: readonly string[];
  readonly failures: SmokeMatchFailures | undefined;
  readonly restart?: string;
  readonly seconds: number;
}

const tables = (directory: string): string[] => existsSync(directory)
  ? readdirSync(directory, { recursive: true, encoding: "utf8" }).filter(file => /(^|\/)match-\d+\.tsv$/.test(file)).sort().map(file => join(directory, file))
  : [];

const matchFailures = (directory: string, since: number): SmokeMatchFailures | undefined => {
  const files = existsSync(directory)
    ? readdirSync(directory, { recursive: true, encoding: "utf8" }).filter(file => /(^|\/)match-\d+\.json$/.test(file)).map(file => join(directory, file)).filter(file => statSync(file).mtimeMs >= since)
    : [];
  const decoded = files.map(file => Schema.decodeOption(MatchFailures)(readFileSync(file, "utf8")));
  if (decoded.length === 0 || decoded.some(item => item._tag === "None")) return undefined;
  return {
    deadBindings: decoded.flatMap(item => item._tag === "Some" ? item.value.deadBindings : []),
    movesNotStarted: decoded.flatMap(item => item._tag === "Some" ? item.value.movesNotStarted : []),
  };
};

const outcome = (shard: number, directory: string, code: number | "timeout", seconds: number, since: number): ShardOutcome => {
  const report = join(directory, "report.json");
  const decoded = existsSync(report) ? Schema.decodeOption(Report)(readFileSync(report, "utf8")) : undefined;
  const verdicts = decoded?._tag === "Some" ? decoded.value.results.filter(({ id }) => id === movesShardId(shard) || id === specialsShardId(shard)) : [];
  const rows = tables(directory).flatMap(file => readFileSync(file, "utf8").split("\n").slice(1).filter(line => line !== ""));
  const restart = existsSync(pairRestartFile(directory)) ? readFileSync(pairRestartFile(directory), "utf8").trim() : undefined;
  return { shard, code, verdicts, rows, failures: matchFailures(directory, since), seconds, ...(restart === undefined ? {} : { restart }) };
};

export const shardPassed = ({ code, verdicts, rows }: ShardOutcome): boolean =>
  code === 0 && verdicts.length === 2 && verdicts.every(({ verdict }) => verdict === "pass") && rows.length > 0 && rows.every(row => row.split("\t")[3] === "PASS");

const frozen = ({ rows }: ShardOutcome): boolean => rows.some(row => row.split("\t")[3] === "INVALID");

const managerEnv = () => ({ ...process.env, ...userSessionEnv(process.getuid?.() ?? 0) });

export const LEASE_WAIT_SECONDS = 120;

const quietLease = (owner: string) => Effect.gen(function*() {
  if (!admitsThroughHelper()) return;
  const handle = yield* ChildProcess.make(process.execPath, [...quietNativeSessionArgs(capacityHelper, owner)], { env: userSessionEnv(process.getuid?.() ?? 0), extendEnv: true, stdin: "ignore", stdout: "ignore", stderr: "pipe", forceKillAfter: "5 seconds" });
  const reserved = yield* Deferred.make<void>();
  yield* handle.stderr.pipe(
    Stream.decodeText(), Stream.splitLines,
    Stream.tap(line => Effect.sync(() => console.error(line)).pipe(Effect.andThen(/"decision":"RESERVED"/.test(line) ? Deferred.succeed(reserved, undefined) : Effect.void))),
    Stream.runDrain, Effect.forkScoped,
  );
  const granted = yield* Deferred.await(reserved).pipe(Effect.raceFirst(handle.exitCode.pipe(Effect.as(false))), Effect.map(value => value !== false), Effect.timeoutOption(`${LEASE_WAIT_SECONDS} seconds`));
  if (granted._tag === "None" || !granted.value) return yield* new NativeSmokeFailure({ problem: `quiet native lease for ${owner}: not reserved within ${LEASE_WAIT_SECONDS} s or it exited first` });
}).pipe(Effect.mapError(cause => cause instanceof NativeSmokeFailure ? cause : new NativeSmokeFailure({ problem: `quiet native lease for ${owner}: ${cause.message}` })));

const runShard = (shard: number, pair: string, map: string, directory: string) => Effect.scoped(quietLease(`smashcraft-smoke-${smokeShardLabel(shard)}`).pipe(Effect.andThen(Effect.acquireUseRelease(
  Effect.try({
    try: () => {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      return { child: Bun.spawn([process.execPath, WISP_PROGRAM, "accept", "--only", movesShardId(shard), specialsShardId(shard), "--pair", pair, "--map", map, "--out", directory], { stdout: "inherit", stderr: "inherit", stdin: "ignore" }), started: performance.now(), since: Date.now() };
    },
    catch: cause => new NativeSmokeFailure({ problem: `shard ${smokeShardLabel(shard)} could not start: ${String(cause)}` }),
  }),
  ({ child, started, since }) => Effect.promise(() => child.exited).pipe(
    Effect.timeoutOption(`${SHARD_RUN_SECONDS} seconds`),
    Effect.map(exited => outcome(shard, directory, exited._tag === "Some" ? exited.value : "timeout", Math.round((performance.now() - started) / 1000), since)),
  ),
  ({ child }) => stopBunProcess(child).pipe(Effect.andThen(Effect.promise(() => Bun.spawn(["systemctl", "--user", "stop", `smashcraft-accept-${child.pid}.service`], { env: managerEnv(), stdout: "ignore", stderr: "ignore" }).exited))),
)))).pipe(
  Effect.catchTag("NativeSmokeFailure", ({ problem }) => Effect.succeed<ShardOutcome>({ shard, code: "error", problem, verdicts: [], rows: [], failures: undefined, seconds: 0 })),
);

const runText = ({ code, problem }: ShardOutcome): string => code === "timeout" ? `stopped at ${SHARD_RUN_SECONDS} s` : code === "error" ? `not run: ${problem ?? "unknown"}` : `exit ${code}`;

const runLine = (item: ShardOutcome): string => item.restart === undefined ? runText(item) : `${runText(item)}; ${item.restart}`;

export const shardCrashed = (item: ShardOutcome): boolean => typeof item.code !== "number" || item.failures === undefined || item.verdicts.length !== 2;

export const smokeResult = (sha256: string, outcomes: readonly ShardOutcome[]): SmokeReport => ({
  candidateMapSha256: sha256,
  shards: outcomes.map(item => ({
    shard: smokeShardLabel(item.shard), run: runText(item), crash: shardCrashed(item),
    deadBindings: item.failures?.deadBindings ?? [], movesNotStarted: item.failures?.movesNotStarted ?? [],
    ...(item.restart === undefined ? {} : { restart: item.restart }),
  })),
});

const pairLabel = (shard: number) => (smokePairs()[shard] ?? []).map(choice => fighterName(PLAYABLE_CHARACTERS[choice] ?? 0)).join(" vs ");

export const smokeReport = (map: string, sha256: string, outcomes: readonly ShardOutcome[]): string => [
  `# Native move smoke`, "", `Candidate: ${map}`, `SHA256: ${sha256}`, "",
  "| Shard | Fighters | Run | Seconds | Verdict |", "|---|---|---|---|---|",
  ...outcomes.map(item => `| ${smokeShardLabel(item.shard)} | ${pairLabel(item.shard)} | ${runLine(item).replaceAll("|", "/")} | ${item.seconds} | ${shardPassed(item) ? "PASS" : `FAIL ${item.verdicts.filter(({ verdict }) => verdict !== "pass").map(({ id, verdict, reason }) => `${id} ${verdict}: ${reason}`).join("; ").replaceAll("|", "/")}`} |`),
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

export const runNativeSmoke = (pair: string, map: string, shards: readonly number[] = smokeShards()) => Effect.gen(function*() {
  const sha256 = createHash("sha256").update(readFileSync(map)).digest("hex");
  const root = join(greenState, "accept", sha256, "classic");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const outcomes: ShardOutcome[] = [];
  for (const shard of shards) {
    const directory = join(root, movesShardId(shard));
    rmSync(smokeShardFile(sha256, shard), { force: true });
    rmSync(pairRestartFile(directory), { force: true });
    const first = yield* runShard(shard, pair, map, directory);
    const outcome = !shardPassed(first) && frozen(first) ? yield* runShard(shard, pair, map, directory) : first;
    outcomes.push(outcome);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(smokeShardFile(sha256, shard), `${JSON.stringify(smokeResult(sha256, [outcome]), null, 2)}\n`, { mode: 0o600 });
  }
  const report = smokeReport(map, sha256, outcomes);
  writeFileSync(join(root, "smoke.md"), report, { mode: 0o600 });
  console.log(report);
  console.log(`Smoke table ${join(root, "smoke.md")}`);
  return outcomes;
}).pipe(Effect.provide(BunServices.layer));

export const nativeSmoke = (args: readonly string[]) => Effect.gen(function*() {
  const [pair] = flagValues(args, "pair");
  if (pair === undefined) return yield* new UsageFailure({ problem: "smoke --native needs --pair K, the offline pool pair it runs on" });
  const wanted = flagValues(args, "shard").map(value => Number(value) - 1);
  if (wanted.some(shard => !smokeShards().includes(shard))) return yield* new UsageFailure({ problem: `--shard takes 1-${smokeShards().length}` });
  const map = flagValues(args, "map")[0] ?? (yield* greenCandidate);
  const outcomes = yield* runNativeSmoke(pair, map, wanted.length > 0 ? wanted : smokeShards());
  const failed = outcomes.filter(item => !shardPassed(item));
  if (failed.length > 0) return yield* new NativeSmokeFailure({ problem: `native move smoke failed shards ${failed.map(({ shard }) => smokeShardLabel(shard)).join(", ")}` });
}).pipe(Effect.mapError(cause => cause instanceof UsageFailure || cause instanceof NativeSmokeFailure ? cause : new NativeSmokeFailure({ problem: cause.message })), Effect.provide(BunServices.layer));
