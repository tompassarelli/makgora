import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Exit, Fiber, Schema, Scope } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";
import { resolveTools, withRuntimeTools } from "./wisp/nativeTools";
import { attachedPoolReady, attachExistingPool, pairClientCount } from "./wisp/nativePool";
import { processIsAlive } from "./wisp/commands/pairClaim";
import { pollUntil } from "./hostPoll";

class CaptureBatchFailure extends Schema.TaggedError<CaptureBatchFailure>()("CaptureBatchFailure", { problem: Schema.String }) {
  override get message(): string { return this.problem; }
}

const option = (args: readonly string[], name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};

const rowManifest = Schema.fromJsonString(Schema.Struct({ map: Schema.String, mapSha256: Schema.String, sourceRevision: Schema.String, fixtures: Schema.Array(Schema.Struct({ name: Schema.String, frames: Schema.Array(Schema.Finite), silhouette: Schema.optional(Schema.Struct({ slot: Schema.Finite, fighter: Schema.String, move: Schema.String, width: Schema.Finite, height: Schema.Finite })) })) }));
const planSchema = Schema.fromJsonString(Schema.Struct({ version: Schema.Literals([1]), sourceRevision: Schema.String, rows: Schema.Array(Schema.Struct({ name: Schema.String, map: Schema.String, manifest: Schema.String, mapSha256: Schema.String, frames: Schema.Array(Schema.Finite) })) }));
const checkpointSchema = Schema.Struct({ version: Schema.Literals([1]), mapSha256: Schema.String, sourceRevision: Schema.String, captures: Schema.Array(Schema.Struct({ fixture: Schema.String, frame: Schema.Finite, phase: Schema.String, file: Schema.String, width: Schema.Finite, height: Schema.Finite })) });
const poolRecord = Schema.fromJsonString(Schema.Struct({ pairs: Schema.Array(Schema.Struct({ id: Schema.Int, runs: Schema.Struct({ a: Schema.String, b: Schema.optionalKey(Schema.String) }) })) }));
const lanState = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "wisp/lan");
const pairStatusSchema = Schema.Struct({
  network: Schema.optionalKey(Schema.Boolean),
  clients: Schema.Array(Schema.Struct({ name: Schema.String, pid: Schema.optionalKey(Schema.Finite) })),
  game: Schema.optional(Schema.Struct({ phase: Schema.String, players: Schema.Array(Schema.Struct({ label: Schema.String, connected: Schema.Boolean })) })),
});
type PairStatus = typeof pairStatusSchema.Type;
type PairPool = { readonly scope: Scope.Closeable; readonly child: Bun.Subprocess | undefined; readonly signedClients?: string };

const tsDirectory = join(import.meta.dir, "..");
const wispCommand = (args: readonly string[]) => runProcess(ChildProcess.make(process.execPath, ["scripts/wisp.ts", ...args], { cwd: tsDirectory }));

const pairStatus = (pair: number) => wispCommand(["lan", "status", "--pair", String(pair)]).pipe(
  Effect.flatMap(output => Schema.decodeEffect(Schema.fromJsonString(pairStatusSchema))(output)),
  Effect.mapError(cause => new CaptureBatchFailure({ problem: String(cause) })),
);

const clientWindowExists = (xdotool: string, run: string) => Effect.gen(function*() {
  const [display, authority] = yield* Effect.try({
    try: () => [readFileSync(join(run, "display"), "utf8").trim(), readFileSync(join(run, "xauthority"), "utf8").trim()] as const,
    catch: cause => new CaptureBatchFailure({ problem: `read private desktop for ${run}: ${String(cause)}` }),
  });
  return yield* runProcess(ChildProcess.make(xdotool, ["search", "--name", "^Warcraft III$"], { env: { ...process.env, DISPLAY: display, XAUTHORITY: authority } })).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false),
  );
});

const stopPool = (child: Bun.Subprocess) => Effect.gen(function*() {
  if (child.exitCode !== null) return;
  child.kill("SIGINT");
  const stopped = yield* Effect.promise(() => child.exited).pipe(Effect.timeoutOption("45 seconds"));
  if (stopped._tag !== "None") return;
  child.kill("SIGTERM");
  const terminated = yield* Effect.promise(() => child.exited).pipe(Effect.timeoutOption("5 seconds"));
  if (terminated._tag === "None") {
    child.kill("SIGKILL");
    yield* Effect.promise(() => child.exited);
  }
});

const poolScope = (pair: number, desktop: string, capacity: string, solo: boolean, network: boolean) => Effect.gen(function*() {
  const scope = yield* Scope.fork(yield* Effect.scope);
  const existing = yield* pairStatus(pair).pipe(Effect.orElseSucceed(() => undefined));
  const holder = yield* Effect.try({ try: () => {
    const path = join(lanState, `pair-${pair}`, "pool.pid");
    return existsSync(path) ? Number(readFileSync(path, "utf8").trim()) : 0;
  }, catch: cause => new CaptureBatchFailure({ problem: String(cause) }) });
  const attach = attachExistingPool(existing, Number.isInteger(holder) && holder > 1 && processIsAlive(holder));
  if (attach && solo) return yield* new CaptureBatchFailure({ problem: `pair ${pair} is already running; a --solo batch restarts its pair between rows, so stop it first (\`bun wisp lan stop --pair ${pair}\` for a pool unit, Ctrl-C for a foreground \`lan pool\`)` });
  const child = attach ? undefined : yield* Effect.acquireRelease(
    Effect.try({
      try: () => Bun.spawn([process.execPath, "scripts/wisp.ts", "lan", "pool", "--foreground", "--pair", String(pair), "--pool-profile", "visual", "--desktop", desktop, "--capacity", capacity, ...(network ? ["--network"] : [])], { cwd: tsDirectory, stdin: "ignore", stdout: "inherit", stderr: "inherit" }),
      catch: cause => new CaptureBatchFailure({ problem: `start pair ${pair} pool: ${String(cause)}` }),
    }),
    stopPool,
  ).pipe(Scope.provide(scope));
  const ready = yield* pollUntil(Effect.gen(function*() {
    if (child !== undefined && child.exitCode !== null) return yield* new CaptureBatchFailure({ problem: `pair ${pair} pool exited` });
    const status = yield* pairStatus(pair).pipe(Effect.orElseSucceed(() => undefined));
    return attachedPoolReady(status) ? status : undefined;
  }), { every: "2 seconds", within: "150 seconds", orElse: () => Effect.fail(new CaptureBatchFailure({ problem: `pair ${pair} did not recover its running clients` })) });
  const tools = yield* resolveTools(["xdotool"]);
  const poolText = yield* Effect.try({ try: () => readFileSync(join(lanState, "pool.json"), "utf8"), catch: cause => new CaptureBatchFailure({ problem: String(cause) }) });
  const record = yield* Schema.decodeEffect(poolRecord)(poolText).pipe(Effect.mapError(cause => new CaptureBatchFailure({ problem: String(cause) })));
  const entry = record.pairs.find(entry => entry.id === pair);
  if (entry === undefined) return yield* new CaptureBatchFailure({ problem: "pair missing from pool.json" });
  const desktops = entry.runs.b === undefined ? [entry.runs.a] : [entry.runs.a, entry.runs.b];
  yield* pollUntil(Effect.gen(function*() {
    if (child !== undefined && child.exitCode !== null) return yield* new CaptureBatchFailure({ problem: `pair ${pair} pool exited` });
    const checks = yield* Effect.forEach(desktops, run => clientWindowExists(tools.xdotool ?? "xdotool", run), { concurrency: "unbounded" });
    return checks.every(Boolean) ? true : undefined;
  }), { every: "2 seconds", within: "120 seconds", orElse: () => Effect.fail(new CaptureBatchFailure({ problem: `pair ${pair} clients did not expose Warcraft windows` })) });
  console.log(`pair ${pair}: ${ready.clients.map(client => client.name).join(" and ")} running`);
  return { scope, child } satisfies PairPool;
});

const closePool = (pool: PairPool) => Scope.close(pool.scope, Exit.void);

const checkpointComplete = (out: string, row: { readonly name: string; readonly mapSha256: string; readonly frames: readonly number[] }, sourceRevision: string, double: boolean) => {
  const path = join(out, row.name, "checkpoint.json");
  if (!existsSync(path)) return false;
  const decoded = Schema.decodeSync(Schema.fromJsonString(checkpointSchema))(readFileSync(path, "utf8"));
  const expected = row.frames.length * (double ? 2 : 1);
  return decoded.mapSha256 === row.mapSha256 && decoded.sourceRevision === sourceRevision && decoded.captures.filter(capture => existsSync(join(out, row.name, capture.file)) && statSync(join(out, row.name, capture.file)).size > 0).length === expected;
};

const monitorDrop = (pair: number, pool: PairPool, row: { readonly name: string; readonly mapSha256: string; readonly frames: readonly number[] }, sourceRevision: string, out: string, double: boolean) => Effect.gen(function*() {
  while (true) {
    yield* Effect.sleep("2 seconds");
    if (pool.child !== undefined && pool.child.exitCode !== null) return `pair ${pair} pool exited`;
    const status = yield* pairStatus(pair).pipe(Effect.result);
    if (status._tag === "Failure") return `pair ${pair} status failed: ${String(status.failure)}`;
    if (status.success.clients.length !== pairClientCount(status.success) || status.success.clients.some(client => client.pid === undefined)) return `pair ${pair} has a dropped client process`;
    if (status.success.game?.phase === "playing" && status.success.game.players.some(player => !player.connected)) return `pair ${pair} has a disconnected match client`;
    if (status.success.game?.phase === "over" && !checkpointComplete(out, row, sourceRevision, double)) return `pair ${pair} match ended before row ${row.name} completed`;
  }
});

const chunkComplete = (out: string, row: { readonly name: string; readonly mapSha256: string; readonly frames: readonly number[] }, sourceRevision: string, double: boolean) => Effect.try({
  try: () => checkpointComplete(out, row, sourceRevision, double),
  catch: cause => new CaptureBatchFailure({ problem: `read ${row.name} checkpoint: ${String(cause)}` }),
});

const runChunk = (args: { readonly pair: number; readonly pool: PairPool; readonly row: { readonly name: string; readonly map: string; readonly manifest: string; readonly mapSha256: string; readonly frames: readonly number[] }; readonly out: string; readonly sourceRevision: string; readonly clientsFile: string; readonly client: string; readonly install: string; readonly build: string; readonly minutes: number; readonly solo: boolean }) => Effect.gen(function*() {
  const rowOut = join(args.out, args.row.name);
  yield* Effect.try({ try: () => mkdirSync(rowOut, { recursive: true }), catch: cause => new CaptureBatchFailure({ problem: `create ${rowOut}: ${String(cause)}` }) });
  const run = Effect.acquireUseRelease(
    Effect.try({
      try: () => Bun.spawn([process.execPath, "scripts/nativeCapture.ts", "run", "--clients-file", args.clientsFile, "--client", args.client, "--install", args.install, "--offline-build", args.build, "--manifest", args.row.manifest, "--out", rowOut, "--no-audio", "--minutes", String(args.minutes)], { cwd: tsDirectory, stdin: "ignore", stdout: "inherit", stderr: "inherit" }),
      catch: cause => new CaptureBatchFailure({ problem: `start collector: ${String(cause)}` }),
    }),
    child => Effect.promise(() => child.exited).pipe(Effect.flatMap(code => code === 0 ? Effect.succeed({ kind: "complete" as const }) : Effect.fail(new CaptureBatchFailure({ problem: `collector exited ${code}` })))),
    stopPool,
  ).pipe(
    Effect.catch(failure => Effect.succeed({ kind: "failed" as const, reason: failure.message })),
  );
  const monitor = args.pool.signedClients === undefined ? monitorDrop(args.pair, args.pool, args.row, args.sourceRevision, args.out, false).pipe(Effect.map(reason => ({ kind: "dropped" as const, reason }))) : Effect.never;
  const collector = yield* Effect.forkChild(run);
  yield* Effect.sleep("3 seconds");
  const fresh = yield* wispCommand(args.pool.signedClients === undefined ? (args.solo ? ["lan", "solo", args.row.map, "--pair", String(args.pair)] : ["lan", "fresh", args.row.map, "--pair", String(args.pair), "--turn-ms", "60"]) : ["fresh", args.row.map, "--profile", "native-capture", "--no-quick", "--clients-file", args.pool.signedClients]).pipe(Effect.result);
  if (fresh._tag === "Failure") {
    yield* Fiber.interrupt(collector);
    return { kind: "failed" as const, reason: fresh.failure.message };
  }
  return yield* Effect.raceFirst(Fiber.join(collector), monitor);
});

export const nativeCaptureBatch = (args: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const planPath = option(args, "--plan");
  const out = option(args, "--out");
  const pair = Number(option(args, "--pair") ?? "0");
  const desktop = option(args, "--desktop");
  const capacity = option(args, "--capacity");
  const clientsFile = option(args, "--clients-file");
  const client = option(args, "--client");
  const install = option(args, "--install");
  const build = option(args, "--offline-build") ?? "3.0.0.24268";
  const minutes = Number(option(args, "--minutes") ?? "20");
  const solo = args.includes("--solo");
  const network = args.includes("--network");
  if (planPath === undefined || out === undefined || desktop === undefined || capacity === undefined || clientsFile === undefined || client === undefined || install === undefined || !Number.isInteger(pair) || !Number.isFinite(minutes) || minutes < 1 || (solo && args.includes("--signed-in")) || (network && !solo)) return yield* new CaptureBatchFailure({ problem: "usage: batch --plan capture-batch.json --out DIR --pair K --desktop PRIVATE_DESKTOP_SH --capacity MACHINE_CAPACITY_HELPER --clients-file FILE --client NAME --install DIR [--offline-build 3.0.0.24268|3.0.1.24371] [--minutes N] [--solo [--network] | --signed-in]" });
  const planText = yield* Effect.try({ try: () => readFileSync(planPath, "utf8"), catch: cause => new CaptureBatchFailure({ problem: `read ${planPath}: ${String(cause)}` }) });
  const plan = yield* Schema.decodeEffect(planSchema)(planText).pipe(Effect.mapError(cause => new CaptureBatchFailure({ problem: `decode ${planPath}: ${String(cause)}` })));
  yield* Effect.try({ try: () => mkdirSync(out, { recursive: true }), catch: cause => new CaptureBatchFailure({ problem: `create ${out}: ${String(cause)}` }) });
  const tools = yield* resolveTools();
  const runtimeClients = join(out, "runtime-clients.json");
  const writeRuntimeClients = Effect.try({ try: () => writeFileSync(runtimeClients, withRuntimeTools(readFileSync(clientsFile, "utf8"), tools)), catch: cause => new CaptureBatchFailure({ problem: String(cause) }) });
  const currentScope = yield* Effect.scope;
  const acquirePool = () => (args.includes("--signed-in") ? Scope.fork(currentScope).pipe(Effect.map(scope => ({ scope, child: undefined, signedClients: runtimeClients } satisfies PairPool))) : poolScope(pair, desktop, capacity, solo, network)).pipe(Effect.tap(() => writeRuntimeClients));
  let pool: PairPool = yield* acquirePool();
  let stale = false;
  let completed = 0;
  for (const row of plan.rows) {
    const manifestText = yield* Effect.try({ try: () => readFileSync(row.manifest, "utf8"), catch: cause => new CaptureBatchFailure({ problem: `read ${row.manifest}: ${String(cause)}` }) });
    const manifest = yield* Schema.decodeEffect(rowManifest)(manifestText).pipe(Effect.mapError(cause => new CaptureBatchFailure({ problem: `decode ${row.manifest}: ${String(cause)}` })));
    if (manifest.sourceRevision !== plan.sourceRevision || manifest.mapSha256 !== row.mapSha256 || manifest.map !== row.map || manifest.fixtures.length !== 1 || manifest.fixtures[0]?.name !== row.name) return yield* new CaptureBatchFailure({ problem: `${row.name}: row map identity differs from the batch plan` });
    const double = manifest.fixtures[0]?.silhouette !== undefined;
    if (yield* chunkComplete(out, row, plan.sourceRevision, double)) {
      completed++;
      console.log(`row ${row.name}: already complete (${completed}/${plan.rows.length})`);
      continue;
    }
    let finished = false;
    let lastReason = "capture incomplete";
    for (let attempt = 1; attempt <= 4 && !finished; attempt++) {
      if (stale) {
        yield* closePool(pool);
        pool = yield* acquirePool();
      }
      const result = yield* runChunk({ pair, pool, row, out, sourceRevision: plan.sourceRevision, clientsFile: runtimeClients, client, install, build, minutes, solo }).pipe(Effect.result);
      stale = solo;
      if (result._tag === "Success" && result.success.kind === "complete" && (yield* chunkComplete(out, row, plan.sourceRevision, double))) {
        finished = true;
        completed++;
        console.log(`row ${row.name}: complete (${completed}/${plan.rows.length})`);
      } else {
        lastReason = result._tag === "Failure" ? String(result.failure) : result.success.kind === "complete" ? "capture process returned without a complete row" : result.success.reason;
        console.log(`row ${row.name}: ${lastReason} (attempt ${attempt}/4)`);
        stale = true;
      }
    }
    if (!finished) return yield* new CaptureBatchFailure({ problem: `${row.name}: exhausted four capture attempts: ${lastReason}` });
  }
  if (pool.child !== undefined && !solo) yield* wispCommand(["lan", "end", "--pair", String(pair)]).pipe(Effect.ignore);
  yield* closePool(pool);
  console.log(`batch complete: ${completed}/${plan.rows.length} rows`);
}));
