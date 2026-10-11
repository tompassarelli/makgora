import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { relative, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";
import { ImportGraph } from "wisp/scripts/wisp/importGraph";

class ReceiptFailure extends Schema.TaggedError<ReceiptFailure>()("ReceiptFailure", { problem: Schema.String }) {}
const Files = Schema.Record(Schema.String, Schema.String);
const Receipt = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literals(["lua", "census"]),
  shard: Schema.String,
  candidate: Schema.String,
  base: Schema.String,
  testedTree: Schema.String,
  inputHash: Schema.String,
  inputs: Files,
  emitted: Files,
  runtime: Files,
  pins: Files,
  oracleHash: Schema.String,
  environment: Files,
  key: Schema.String,
  run: Schema.String,
  attempt: Schema.String,
  reuseEnabled: Schema.Literal(false),
});
const Pin = Schema.Struct({ revision: Schema.String, archive: Schema.String });
const root = resolve(import.meta.dir, "../..");
const ts = resolve(root, "ts");
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const digest = (value: unknown) => hash(JSON.stringify(value));
const attempt = <A>(action: () => A) => Effect.try({ try: action, catch: cause => new ReceiptFailure({ problem: String(cause) }) });
const fileHash = (path: string) => hash(readFileSync(path));
const files = (paths: readonly string[], directory: string) => Object.fromEntries([...paths].sort().map(path => [path, fileHash(resolve(directory, path))]));
const censusInputs = () => {
  const entry = resolve(ts, "scripts/wisp/commands/perf.ts");
  const graph = new ImportGraph(ts);
  graph.add([entry]);
  const computed = graph.computedImport(entry);
  if (computed !== undefined) throw new Error(`census host has an undeclared computed import: ${computed}`);
  return [...graph.dependencies(entry)].map(path => relative(root, path)).concat([
    "ts/scripts/wisp.ts", "ts/scripts/hostProcess.ts", "ts/scripts/farmReceipt.ts",
    "ts/test/fixtures/perf/census-pairs.txt", ".github/workflows/farm-test.yml",
    "ts/node_modules/wisp/src/natives/warcraft.d.ts",
  ]);
};
const git = (...args: string[]) => runProcess(ChildProcess.make("git", args, { cwd: root }));
const decode = <S extends Schema.Top>(schema: S, path: string) => Effect.tryPromise({
  try: () => Bun.file(path).text(), catch: cause => new ReceiptFailure({ problem: String(cause) }),
}).pipe(Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(schema))));
const write = (path: string, value: unknown) => Effect.tryPromise({
  try: () => Bun.write(path, `${JSON.stringify(value, null, 2)}\n`), catch: cause => new ReceiptFailure({ problem: String(cause) }),
});

export const record = (kind: "lua" | "census", shard: string, lua: string) => Effect.gen(function*() {
  const candidate = yield* git("rev-parse", "HEAD");
  const testedTree = yield* git("rev-parse", "HEAD^{tree}");
  const tracked = (yield* git("ls-files")).split("\n");
  const pin = yield* decode(Pin, resolve(ts, "wisp.lock"));
  const inputs = yield* attempt(() => files(kind === "census" ? censusInputs() : tracked, root));
  const emitted = yield* attempt(() => files(kind === "lua" ? ["build/lua-tests/tests.lua", "build/lua-plan.tsv", "plan.json"] : ["build/census.lua", "build/census-perf.lua"], ts));
  const dependencies = yield* runProcess(ChildProcess.make("ldd", [process.execPath, lua]));
  const libraries = [...dependencies.matchAll(/(?:=>\s+|^\s*)(\/\S+)\s+\(/gm)].map(match => match[1] ?? "");
  const runtime = yield* attempt(() => ({
    bun: fileHash(process.execPath), lua: fileHash(lua),
    libraries: digest(files(libraries, "/")),
    os: fileHash("/etc/os-release"), abi: digest({ platform: platform(), arch: arch(), release: release() }),
    image: process.env.ImageVersion ?? "unknown",
  }));
  const pins = yield* attempt(() => ({
    ...files(["bun.lock", "package.json", "wisp.lock", pin.archive], ts),
    wisp: pin.revision, toolchain: fileHash(resolve(root, "typescript-toolchain.lock")),
  }));
  const oracleHash = yield* attempt(() => digest({
    tracked: Object.fromEntries(Object.entries(inputs).filter(([path]) => path.startsWith("ts/test/") || /\.(tests|soak)\.ts$/.test(path) || path.startsWith("ts/scripts/") || path.startsWith(".github/workflows/"))),
    farmShards: fileHash(resolve(ts, "node_modules/wisp/scripts/wisp/farmShards.ts")),
  }));
  const environment = Object.fromEntries(Object.entries(process.env).filter(([name, value]) =>
    value !== undefined && /^(GAME_|LUA$|LUA_|PERF_|SWEEP|CENSUS_|BUN_SHARDS$|CI_TIMING$|TZ$|LANG$|LC_)/.test(name)
    && !/(TOKEN|SECRET|PASSWORD|KEY)/.test(name)).map(([name, value]) => [name, value ?? ""]));
  const identity = { kind, shard, inputHash: digest(kind === "census" ? { inputs, emitted } : inputs), inputs, emitted, runtime, pins, oracleHash, environment };
  const receipt = { version: 1, ...identity, key: digest(identity), candidate, base: process.env.FARM_BASE ?? "unknown", testedTree,
    run: process.env.GITHUB_RUN_ID ?? "local", attempt: process.env.GITHUB_RUN_ATTEMPT ?? "local", reuseEnabled: false };
  yield* write(resolve(ts, `input-${kind}-${shard}.json`), receipt);
});

export const merge = (exitCodes: readonly string[]) => Effect.gen(function*() {
  const summaryPath = resolve(ts, "summary.json");
  const summary = yield* decode(Schema.Record(Schema.String, Schema.Unknown), summaryPath);
  const receiptPaths = [...new Bun.Glob("**/input-*.json").scanSync({ cwd: resolve(ts, "farm"), absolute: true })].sort();
  const receipts = yield* Effect.forEach(receiptPaths, path => decode(Receipt, path));
  const green = exitCodes.length === 3 && exitCodes.every(code => code === "0");
  const candidate = yield* git("rev-parse", "HEAD");
  const testedTree = yield* git("rev-parse", "HEAD^{tree}");
  const expectedLua = Number(process.env.LUA_JOBS);
  const expectedCensus = Number(process.env.CENSUS_SHARDS);
  const complete = (["lua", "census"] as const).every(kind => {
    const shards = receipts.filter(receipt => receipt.kind === kind);
    const expected = kind === "lua" ? expectedLua : expectedCensus;
    return shards.length === expected && Array.from({ length: expected }, (_, index) => String(index)).every(shard => shards.some(receipt => receipt.shard === shard))
      && shards.every(receipt => receipt.candidate === candidate && receipt.testedTree === testedTree
        && receipt.run === (process.env.GITHUB_RUN_ID ?? "local") && receipt.attempt === (process.env.GITHUB_RUN_ATTEMPT ?? "local"));
  });
  yield* write(summaryPath, { ...summary, greenReceipts: green && complete ? receipts : [] });
  if (green && !complete) return yield* new ReceiptFailure({ problem: "green farm result is missing exact-candidate input receipts" });
});

if (import.meta.main) BunRuntime.runMain(Effect.gen(function*() {
  const [command, kind = "", shard = "", lua = ""] = process.argv.slice(2);
  if (command === "merge") return yield* merge(process.argv.slice(3));
  if (command === "record" && (kind === "lua" || kind === "census") && /^\d+$/.test(shard) && lua !== "") return yield* record(kind, shard, lua);
  return yield* new ReceiptFailure({ problem: "usage: farmReceipt.ts record lua|census SHARD LUA | merge MERGED BUDGET CENSUS" });
}).pipe(Effect.provide(BunServices.layer)));
