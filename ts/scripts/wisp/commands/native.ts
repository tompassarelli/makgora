import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { BunServices } from "@effect/platform-bun";
import { Effect, Fiber, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { runProcess } from "../../hostProcess";
import { type Box, Plan, parseBoxes, planBoxes, shardBatch, type Batch } from "../nativePlan";
import { readPairClaim } from "./pairClaim";
const attempt = <A>(f: () => A) => Effect.try({ try: f, catch: cause => new UsageFailure({ problem: String(cause) }) });
const read = (path: string) => attempt(() => readFileSync(path, "utf8"));
const save = (path: string, value: unknown) => attempt(() => { mkdirSync(resolve(path, ".."), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); });
const Config = Schema.Struct({ helper: Schema.optional(Schema.String), desktop: Schema.optional(Schema.String), capacity: Schema.optional(Schema.String), install: Schema.optional(Schema.String), client: Schema.optional(Schema.String) });
const Pool = Schema.Struct({ pairs: Schema.Array(Schema.Struct({ id: Schema.Int })) });
const Manifest = Schema.Struct({ map: Schema.String, mapSha256: Schema.String, sourceRevision: Schema.String, fixtures: Schema.Array(Schema.Struct({ name: Schema.String, frames: Schema.Array(Schema.Finite), silhouette: Schema.optional(Schema.Struct({ slot: Schema.Finite, fighter: Schema.String, move: Schema.String, width: Schema.Finite, height: Schema.Finite })), reel: Schema.optional(Schema.Struct({ fighter: Schema.String, row: Schema.String, slot: Schema.String, facing: Schema.Literals(["right", "left"]) })) })) });
const RunRow = Schema.Struct({ id: Schema.String, identity: Schema.String, start: Schema.String, end: Schema.String, pairs: Schema.Array(Schema.Int), scripts: Schema.Array(Schema.String), verdict: Schema.String, evidence: Schema.Record(Schema.String, Schema.Array(Schema.String)) });
const Run = Schema.Struct({ batches: Schema.Array(RunRow) });
const decodePlan = (text: string) => Schema.decodeEffect(Schema.fromJsonString(Plan))(text);
const state = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "wisp/lan");
const evidenceFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? evidenceFiles(path) : statSync(path).size > 0 ? [path] : [];
});
type NativeOptions = { readonly pairs?: string; readonly pair?: readonly string[]; readonly "dry-run"?: boolean; readonly "executor-config"?: string };
const execute = (command: readonly string[]) => runProcess(ChildProcess.make(process.execPath, ["scripts/wisp.ts", ...command], { cwd: resolve(import.meta.dir, "../../.."), env: { ...process.env, WISP_NATIVE_PLANNER: "1" } })).pipe(Effect.tap(output => Effect.sync(() => console.log(output))));
const selectPairs = (values: NativeOptions, dry: boolean) => Effect.gen(function*() {
  if (values.pairs !== undefined && values.pair !== undefined) return yield* new UsageFailure({ problem: "choose --pairs or --pair" });
  const requested = values.pair?.map(Number);
  const count = values.pairs === undefined ? undefined : Number(values.pairs);
  if (count !== undefined && (!Number.isInteger(count) || count < 1) || requested?.some(n => !Number.isInteger(n) || n < 0)) return yield* new UsageFailure({ problem: "invalid pair selection" });
  let pairs: number[];
  if (dry && (requested !== undefined || count !== undefined)) pairs = requested ?? Array.from({ length: count ?? 0 }, (_, i) => i);
  else {
    const pool = yield* Schema.decodeEffect(Schema.fromJsonString(Pool))(yield* read(join(state, "pool.json")));
    pairs = yield* attempt(() => pool.pairs.filter(pair => {
      const claim = readPairClaim(pair.id);
      if (claim === undefined || claim.session === process.env.NORTH_FLEET_SESSION) return true;
      try { process.kill(claim.pid, 0); return false; } catch { return true; }
    }).map(pair => pair.id));
    if (requested !== undefined && requested.some(id => !pairs.includes(id)) || count !== undefined && pairs.length < count) return yield* new UsageFailure({ problem: "requested pairs are absent or owned by another session" });
    pairs = requested ?? (count === undefined ? pairs : pairs.slice(0, count));
  }
  return pairs;
});
const captureRows = (batch: Batch, out: string, dry: boolean) => Effect.gen(function*() {
  if (batch.executor !== "capture") return batch;
  const scripts: Batch["scripts"][number][] = [];
  for (const [index, script] of batch.scripts.entries()) {
    const source = yield* Schema.decodeEffect(Schema.fromJsonString(Manifest))(yield* read(script.path));
    if (resolve(source.map) !== batch.map) return yield* new UsageFailure({ problem: `${script.path}: capture manifest names a different map` });
    for (const [fixtureIndex, fixture] of source.fixtures.entries()) {
      const path = resolve(out, batch.id, "manifests", `${index}-${fixtureIndex}.json`);
      if (!dry) yield* save(path, { ...source, map: resolve(source.map), fixtures: [fixture] });
      scripts.push({ path, issues: script.issues });
    }
  }
  return { ...batch, scripts };
});
const runShard = (batch: Batch, shard: ReturnType<typeof shardBatch>[number], out: string, config: typeof Config.Type, dry: boolean, evidence: Record<string, string[]>) => Effect.gen(function*() {
  const dir = join(out, batch.id, `pair-${shard.pair}`);
  for (const script of shard.scripts) for (const issue of script.issues) (evidence[issue] ??= []).push(dir);
  let command: string[];
  if (batch.executor === "pad") command = ["pad", ...shard.scripts.map(script => script.path), "--helper", config.helper ?? process.env.WISP_PAD_HELPER ?? "build/tools/wc3-journal", "--map", batch.map, "--out", dir, "--hot", ...(batch.clients === "pool" ? ["--pair", String(shard.pair)] : ["--clients-file", batch.clients])];
  else {
    const subPath = join(dir, "capture-plan.json");
    if (!dry) {
      const rows: { name: string; frames: readonly number[]; map: string; mapSha256: string; manifest: string }[] = [];
      let revision: string | undefined;
      for (const [scriptIndex, script] of shard.scripts.entries()) {
        const source = yield* Schema.decodeEffect(Schema.fromJsonString(Manifest))(yield* read(script.path));
        if (source.map !== batch.map || revision !== undefined && revision !== source.sourceRevision) return yield* new UsageFailure({ problem: "capture manifests disagree with batch map or revision" });
        revision = source.sourceRevision;
        for (const [fixtureIndex, fixture] of source.fixtures.entries()) {
          const name = fixture.name;
          if (rows.some(row => row.name === name)) return yield* new UsageFailure({ problem: `duplicate capture fixture ${name}` });
          const manifest = join(dir, `${scriptIndex}-${fixtureIndex}.json`);
          yield* save(manifest, { ...source, fixtures: [fixture] });
          rows.push({ ...fixture, name, map: source.map, mapSha256: source.mapSha256, manifest });
        }
      }
      yield* save(subPath, { version: 1, sourceRevision: revision, rows });
    }
    command = ["native-capture", "batch", "--plan", subPath, "--out", dir, "--pair", String(shard.pair), "--desktop", config.desktop ?? "", "--capacity", config.capacity ?? "", "--clients-file", batch.clients === "pool" ? join(state, `pair-${shard.pair}`, "clients.json") : batch.clients, "--client", config.client ?? "a", "--install", config.install ?? "", ...(batch.clients === "pool" ? [] : ["--signed-in"])];
    if (!dry && (config.install === undefined || batch.clients === "pool" && (config.desktop === undefined || config.capacity === undefined))) return yield* new UsageFailure({ problem: "capture batch needs --executor-config with install, plus desktop and capacity for offline pools" });
  }
  console.log(`${batch.id} ${batch.kind} pair ${shard.pair}: bun wisp ${command.map(arg => JSON.stringify(arg)).join(" ")}`);
  if (!dry) {
    yield* execute(command);
    const files = yield* attempt(() => evidenceFiles(dir));
    for (const script of shard.scripts) for (const issue of script.issues) evidence[issue] = [...evidence[issue] ?? [], ...files].filter(path => path !== dir);
  }
});
const runNative = (file: string, out: string, values: NativeOptions) => Effect.gen(function*() {
  const plan = yield* decodePlan(yield* read(file));
  if (plan.batches.length === 0) { console.log("no native batches to run"); return; }
  const dry = values["dry-run"] === true;
  const pairs = plan.batches.every(batch => batch.clients !== "pool") ? [0] : yield* selectPairs(values, dry);
  const config: typeof Config.Type = values["executor-config"] === undefined ? {} : yield* Schema.decodeEffect(Schema.fromJsonString(Config))(yield* read(values["executor-config"]));
  const runPath = join(out, "plan-run.json");
  const record = existsSync(runPath) ? yield* Schema.decodeEffect(Schema.fromJsonString(Run))(yield* read(runPath)) : { batches: [] };
  const records = [...record.batches];
  const revision = dry ? "dry-run" : yield* runProcess(ChildProcess.make("git", ["rev-parse", "HEAD"]));
  const builds = new Map<string, Fiber.Fiber<void, unknown>>();
  const build = (batch: Batch) => Effect.gen(function*() {
    if (existsSync(batch.map)) return;
    if (batch.executor === "capture") return yield* new UsageFailure({ problem: `build the manifest's capture map before running: ${batch.map}` });
    const skill = config.capacity === undefined ? yield* runProcess(ChildProcess.make("agents", ["path", "machine-capacity"])) : undefined;
    const capacity = config.capacity ?? join(dirname(skill ?? ""), "scripts/machine-capacity.mjs");
    yield* runProcess(ChildProcess.make(process.execPath, [capacity, "run", "--class", "moderate", "--owner", "native-planner-build", "--timeout-seconds", "1200", "--", process.execPath, "scripts/wisp.ts", "map", "build", "--profile", "integrity", "--out", batch.map, "--edition", batch.look === "classic" ? "classic" : "full"], { cwd: resolve(import.meta.dir, "../../..") }));
  });
  for (const [index, batch] of plan.batches.entries()) {
    const identity = dry ? JSON.stringify(batch) : yield* attempt(() => {
      const hash = createHash("sha256").update(JSON.stringify([batch, config, revision]));
      for (const path of [batch.map, ...batch.scripts.map(script => script.path)]) hash.update(existsSync(path) ? readFileSync(path) : path);
      return hash.digest("hex");
    });
    if (!dry && records.some(row => row.identity === identity && row.verdict === "PASS" && Object.values(row.evidence).flat().length > 0 && Object.values(row.evidence).flat().every(path => existsSync(path) && statSync(path).size > 0))) { console.log(`${batch.id}: complete`); continue; }
    const expanded = yield* captureRows(batch, out, dry);
    const shards = yield* attempt(() => shardBatch(expanded, batch.clients === "pool" ? pairs : pairs.slice(0, 1)));
    if (batch.look !== "classic" && batch.clients === "pool") return yield* new UsageFailure({ problem: `${batch.id}: offline pool is Classic-only` });
    if (!dry) {
      const prepared = builds.get(batch.map);
      if (prepared !== undefined) yield* Fiber.join(prepared); else yield* build(batch);
      const next = plan.batches.slice(index + 1).find(row => row.map !== batch.map);
      if (next !== undefined && !builds.has(next.map)) builds.set(next.map, yield* Effect.forkScoped(build(next)));
    }
    const start = new Date().toISOString();
    const evidence: Record<string, string[]> = {};
    const row = { id: batch.id, identity, start, end: "", pairs: shards.map(shard => shard.pair), scripts: batch.scripts.map(script => script.path), verdict: "RUNNING", evidence };
    if (!dry) { records.push(row); yield* save(runPath, { batches: records }); }
    const result = yield* Effect.forEach(shards, shard => Effect.gen(function*() {
      yield* runShard(batch, shard, out, config, dry, evidence);
    }), { concurrency: pairs.length || 1 }).pipe(Effect.result);
    if (!dry) {
      row.end = new Date().toISOString();
      row.verdict = result._tag === "Success" ? "PASS" : "FAIL";
      yield* save(runPath, { batches: records });
    }
    if (result._tag === "Failure") return yield* Effect.fail(result.failure);
  }
});
export const native: Command = args => Effect.scoped(Effect.gen(function*() {
  const { values, positionals } = yield* attempt(() => parseArgs({ args: [...args], allowPositionals: true, options: { boxes: { type: "string", multiple: true }, row: { type: "string", multiple: true }, out: { type: "string" }, pairs: { type: "string" }, pair: { type: "string", multiple: true }, "dry-run": { type: "boolean" }, "executor-config": { type: "string" } } }));
  const out = values.out;
  if (out === undefined) return yield* new UsageFailure({ problem: "native plan --boxes FILE.tsv --out PLAN.json | native run PLAN.json --out DIR [--pairs N | --pair K ...] [--dry-run] [--executor-config FILE.json]" });
  if (positionals[0] === "plan") {
    const rows: Box[] = [];
    for (const file of values.boxes ?? []) rows.push(...yield* attempt(() => parseBoxes(readFileSync(file, "utf8"))));
    const selected = values.row ?? [];
    const chosen = selected.length === 0 ? rows : rows.filter(row => selected.includes(`${row.issue}:${row.script}`));
    if (selected.some(key => !rows.some(row => `${row.issue}:${row.script}` === key))) return yield* new UsageFailure({ problem: "--row did not match a box" });
    const expanded = yield* attempt(() => chosen.flatMap(row => {
      if (row.class === "wisp-sufficient" || row.script === "none" || row.blockers !== "" && row.blockers !== "none") return [row];
      const scripts = existsSync(row.script) && statSync(row.script).isDirectory() ? readdirSync(row.script).filter(name => name.endsWith(".pad")).sort().map(name => join(row.script, name)) : [row.script];
      if (scripts.length === 0) throw new Error(`no pad scripts in ${row.script}`);
      return scripts.map(script => ({ ...row, map: resolve(row.map), script: resolve(script) }));
    }));
    const plan = planBoxes(expanded);
    yield* save(out, plan);
    console.log(`${plan.batches.length} native batches; ${plan.wisp.length} Wisp rows; ${plan.blocked.length} blocked rows; ${out}`);
    return;
  }
  const file = positionals[1];
  if (positionals[0] !== "run" || file === undefined) return yield* new UsageFailure({ problem: "expected native plan or native run PLAN.json" });
  return yield* runNative(file, out, values);
}).pipe(Effect.mapError(cause => cause instanceof UsageFailure ? cause : new UsageFailure({ problem: String(cause) })), Effect.provide(BunServices.layer)));

export const nativeEntry = { usage: "native plan --boxes FILE.tsv --out PLAN.json | native run PLAN.json --out DIR [--pairs N | --pair K ...] [--dry-run]", load: async () => native };
