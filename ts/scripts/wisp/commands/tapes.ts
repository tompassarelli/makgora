









import "../../../test/host-natives";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Console, Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { decodeTape } from "../../../src/game/replay/tape";
import { runTape } from "../../../src/game/replay/tapeRunner";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { captureProcess } from "wisp/scripts/wisp/hostProcess";
import { generateTapes } from "../acceptanceTapes";
import { staleTapeCosts, tapeReplayCost, unmeasuredTapes } from "../tapeCosts";
import { luaRuntimes } from "../luaRuntimes";
import { runMeasuredProcess, runProcess } from "../../hostProcess";
import { usableCpus } from "../../usableCpus";

const ts = join(import.meta.dir, "../../..");
const build = join(ts, "build", "tapes");




interface Run {
  readonly records: readonly string[];
  readonly error: string | undefined;
}

// A Bun replay child ends each tape's record lines with one line opening with NUL, then the tape's error if it stopped.
const TAPE_END = "\u0000";

function bunRunsOf(output: string): Run[] {
  const runs: Run[] = [];
  let records: string[] = [];
  for (const line of output.split("\n")) {
    if (line.startsWith(TAPE_END)) {
      runs.push({ records, error: line.length > TAPE_END.length ? line.slice(TAPE_END.length) : undefined });
      records = [];
    } else if (line.length > 0) records.push(line);
  }
  return runs;
}

const recordsOf = (output: string) => output.split("\n").filter(line => line.length > 0);

function runInBun(text: string): Run {
  const decoded = decodeTape(text);
  if (!decoded.ok) return { records: [], error: `line ${decoded.line}: ${decoded.message}` };
  const records: string[] = [];
  const result = runTape(decoded.value, record => records.push(record));
  return { records, error: result.ok ? undefined : `line ${result.line}: ${result.message}` };
}

async function inputsHash(paths: readonly string[], extra: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(extra);
  for (const path of paths) {
    hasher.update(path);
    hasher.update(await Bun.file(path).bytes());
  }
  return hasher.digest("hex");
}


const cachedBuild = <E, R>(output: string, hash: string, buildIt: Effect.Effect<unknown, E, R>) => Effect.gen(function*() {
  const stamp = Bun.file(`${output}.inputs`);
  if (yield* attempt("read the build stamp", async () => await Bun.file(output).exists() && await stamp.exists() && await stamp.text() === hash)) return 0;
  const started = performance.now();
  yield* buildIt;
  yield* attempt("write the build stamp", () => Bun.write(stamp, hash));
  return (performance.now() - started) / 1000;
});

const tapesLua = join(ts, "build", "lua-tapes", "tapes.lua");

const compileTypeScriptLua = Effect.gen(function*() {
  const sources = ["src", "test/tapes"].flatMap(dir => [...new Bun.Glob(`${dir}/**/*.ts`).scanSync(ts)]).sort().map(path => join(ts, path));
  const config = join(ts, "tsconfig.lua-tapes.json");
  const framework = [...new Bun.Glob("src/**/*.{ts,lua}").scanSync(join(ts, "node_modules/wisp"))]
    .map((file) => join(ts, "node_modules/wisp", file));
  const hash = yield* attempt("hash the Lua inputs", () => inputsHash([...sources, ...framework,
    join(ts, "node_modules/wisp/plugins/warcraft-numbers.ts"), join(ts, "node_modules/wisp/plugins/game-api.ts"), config], "tstl"));
  return yield* cachedBuild(tapesLua, hash,
    runProcess(ChildProcess.make(process.execPath, ["--bun", join(ts, "node_modules/typescript-to-lua/dist/tstl.js"), "-p", config], { cwd: ts })).pipe(
      Effect.mapError((failure) => new TapesFailure({ problem: `compile TypeScript Lua: ${failure.message}` }))));
});


export const replayInLua = (files: readonly string[], executable: string, concurrency: number) =>
  Effect.forEach(files, (file) =>
    captureProcess("replay in 32-bit Lua", file, [executable, tapesLua], { env: { ...process.env, TAPE_FILE: file } }).pipe(
      Effect.map(({ stdout, stderr, exitCode }): Run => ({
        records: recordsOf(stdout), error: exitCode === 0 ? undefined : stderr.trim() || `exit ${exitCode}`,
      })),
      Effect.mapError((cause) => new TapesFailure({ problem: describeCause(cause) })),
    ), { concurrency });

const replayInBun = (tapes: readonly Tape[], parts: number) =>
  Effect.forEach(Array.from({ length: parts }, (_, index) => tapeShard(tapes, { index, count: parts })), (part) =>
    captureProcess("replay in Bun", part.map(({ file }) => file).join(" "), [process.execPath, import.meta.path, ...part.map(({ file }) => file)]).pipe(
      Effect.mapError((cause) => new TapesFailure({ problem: describeCause(cause) })),
      Effect.flatMap(({ stdout, stderr, exitCode }) => exitCode === 0
        ? Effect.succeed(bunRunsOf(stdout))
        : Effect.fail(new TapesFailure({ problem: `replay in Bun: ${stderr.trim() || `exit ${exitCode}`}` }))),
      Effect.map((runs) => part.map(({ file }, index): [string, Run] => [file, runs[index] ?? { records: [], error: "no run" }])),
    ), { concurrency: parts }).pipe(Effect.map((parts) => new Map(parts.flat())));

const longestFirst = (tapes: readonly Tape[]) => tapes.toSorted((a, b) => tapeReplayCost(b.name) - tapeReplayCost(a.name)).map(({ file }) => file);

const inOrder = (files: readonly string[], runs: readonly Run[]) => new Map(files.map((file, index): [string, Run] => [file, runs[index] ?? { records: [], error: "no run" }]));



interface Tape { readonly name: string; readonly text: string; readonly file: string }

export interface TapeShard { readonly index: number; readonly count: number }

export function parseTapeShard(text: string | undefined): TapeShard | undefined | string {
  if (text === undefined || text === "") return undefined;
  const match = /^(\d+)\/(\d+)$/.exec(text);
  const index = Number(match?.[1]);
  const count = Number(match?.[2]);
  return match !== null && count >= 1 && index < count ? { index, count } : `TAPES_SHARD is INDEX/COUNT with INDEX below COUNT, such as 0/3, not ${text}`;
}

export function tapeShard<T extends { readonly name: string }>(tapes: readonly T[], shard: TapeShard | undefined): readonly T[] {
  if (shard === undefined) return tapes;
  const loads = Array.from({ length: shard.count }, () => 0);
  const owner = new Map<T, number>();
  for (const tape of tapes.toSorted((a, b) => tapeReplayCost(b.name) - tapeReplayCost(a.name))) {
    const lightest = loads.indexOf(Math.min(...loads));
    owner.set(tape, lightest);
    loads[lightest] = (loads[lightest] ?? 0) + tapeReplayCost(tape.name);
  }
  return tapes.filter((tape) => owner.get(tape) === shard.index);
}

type RuntimeName = "bun" | "ts-lua32" | "ts-lua32-toward-zero";
const RUNTIMES: readonly RuntimeName[] = ["bun", "ts-lua32", "ts-lua32-toward-zero"];
const PAIRS: readonly (readonly [RuntimeName, RuntimeName])[] = [["bun", "ts-lua32"], ["bun", "ts-lua32-toward-zero"]];


function parseRecord(record: string | undefined): { label: string; fields: string[] } {
  const words = (record ?? "").split(" ");
  return { label: words.slice(0, 3).join(" "), fields: words.slice(3).join(" ").split("|") };
}


function describeDivergence(a: string | undefined, b: string | undefined, names: readonly [RuntimeName, RuntimeName]): string {
  const left = parseRecord(a);
  const right = parseRecord(b);
  if (a === undefined || b === undefined || left.label !== right.label) return `records differ: "${left.label || "none"}" in ${names[0]}, "${right.label || "none"}" in ${names[1]}`;
  let first: string | undefined;
  let count = 0;
  for (let index = 0; index < Math.max(left.fields.length, right.fields.length); index++) {
    if (left.fields[index] === right.fields[index]) continue;
    count++;
    first ??= `${left.fields[index] ?? "(missing)"} in ${names[0]}, ${right.fields[index] ?? "(missing)"} in ${names[1]}`;
  }
  return `${first ?? "no field"} (${count} fields differ)`;
}




class TapesFailure extends Schema.TaggedError<TapesFailure, { readonly brand: unique symbol }>()("TapesFailure", {
  problem: Schema.String,
}) {
  override get message(): string {
    return this.problem;
  }
}

const attempt = <A>(what: string, run: () => A | PromiseLike<A>) =>
  Effect.tryPromise({ try: async () => run(), catch: (cause) => new TapesFailure({ problem: `${what}: ${describeCause(cause)}` }) });


const isFrame = (operation: string | undefined) => operation === "frame" || operation === "predict";
const frameCount = (run: Run) => run.records.filter(record => isFrame(record.split(" ", 2)[1])).length;

const recordTapes = attempt("record tapes", async () => {
  await Bun.$`mkdir -p ${build}`;
  const recorded = [...generateTapes()].map(([name, text]) => ({ name, text, file: join(build, `${name}.tape`) }));
  for (const { file, text } of recorded) await Bun.write(file, text);
  return recorded;
});

const cpuMillis = (name: string, executable: string, file: string) =>
  runMeasuredProcess([executable, tapesLua], ts, { ...process.env, TAPE_FILE: file }, "ignore").pipe(
    Effect.mapError((failure) => new TapesFailure({ problem: `replay ${name} in 32-bit Lua: ${failure.message}` })),
    Effect.flatMap(({ code, cpu }) => code === 0 ? Effect.succeed(cpu * 1000) : Effect.fail(new TapesFailure({ problem: `replay ${name} in 32-bit Lua: exit ${code}` }))),
  );

export const tapeCosts: Command = (args) => Effect.gen(function*() {
  if (args.length > 0) return yield* new UsageFailure({ problem: "parity tapes costs takes no arguments; it replays each tape alone in 32-bit Lua, counts its CPU time and rewrites scripts/wisp/tapeCosts.json" });
  const luas = yield* luaRuntimes.pipe(Effect.mapError((problem) => new TapesFailure({ problem })));
  const recorded = yield* recordTapes;
  yield* compileTypeScriptLua.pipe(Effect.provide(BunServices.layer));
  const costs: Record<string, number> = {};
  for (const { name, file } of recorded.toSorted((a, b) => a.name.localeCompare(b.name))) {
    costs[name] = Math.round(yield* cpuMillis(name, luas.nearest, file));
  }
  yield* attempt("write the tape costs", () => Bun.write(join(import.meta.dir, "../tapeCosts.json"), `${JSON.stringify(costs, null, 2)}\n`));
  yield* Console.log(`${recorded.length} tapes, ${Object.values(costs).reduce((sum, ms) => sum + ms, 0)} ms of 32-bit Lua replay in all`);
});

export const tapes: Command = (args) => Effect.gen(function*() {
  if (args.length > 0) return yield* new UsageFailure({ problem: "tapes takes no arguments; LUA and TOWARD_ZERO_LUA name optional 32-bit Luas, and TAPES_SHARD=INDEX/COUNT replays one of COUNT parts of equal measured replay cost (tapeCosts.json); `tapes costs` re-measures them" });
  const shard = parseTapeShard(process.env.TAPES_SHARD);
  if (typeof shard === "string") return yield* new UsageFailure({ problem: shard });
  const luas = yield* luaRuntimes.pipe(Effect.mapError((problem) => new TapesFailure({ problem })));
  const recorded = yield* recordTapes.pipe(step("record tapes"));
  const names = recorded.map(({ name }) => name);
  const drift = [...unmeasuredTapes(names), ...staleTapeCosts(names)];
  if (drift.length > 0) return yield* new TapesFailure({ problem: `tapeCosts.json does not match the recorded tapes (${drift.join(", ")}); run bun wisp parity tapes costs` });
  const tapes = tapeShard(recorded, shard);
  const cpus = usableCpus();
  const bunParts = Math.max(1, Math.min(4, Math.floor(cpus / 4)));
  const luaSlots = Math.max(2, Math.floor((cpus - bunParts) / 2));
  const files = longestFirst(tapes);
  const inLua = compileTypeScriptLua.pipe(Effect.provide(BunServices.layer), step("compile TypeScript Lua"), Effect.andThen(Effect.all({
    "ts-lua32": replayInLua(files, luas.nearest, luaSlots).pipe(Effect.map((runs) => inOrder(files, runs)), step("replay in ts-lua32")),
    "ts-lua32-toward-zero": replayInLua(files, luas.towardZero, luaSlots).pipe(Effect.map((runs) => inOrder(files, runs)), step("replay in ts-lua32-toward-zero")),
  }, { concurrency: 2 })));
  const { lua, bun } = yield* Effect.all({ lua: inLua, bun: replayInBun(tapes, bunParts).pipe(step("replay in bun")) }, { concurrency: 2 });
  const replays = { ...lua, bun };
  const runs = new Map(tapes.map(({ name, file }): [string, Record<RuntimeName, Run>] => {
    const byRuntime = (runtime: RuntimeName): Run => replays[runtime].get(file) ?? { records: [], error: "no run" };
    return [name, { bun: byRuntime("bun"), "ts-lua32": byRuntime("ts-lua32"), "ts-lua32-toward-zero": byRuntime("ts-lua32-toward-zero") }];
  }));

  const perTape = [...runs].map(([name, byRuntime]) => `${name} ${frameCount(byRuntime.bun)}`);
  const totalFrames = [...runs.values()].reduce((sum, byRuntime) => sum + frameCount(byRuntime.bun), 0);
  yield* Console.log(`${runs.size} tapes, ${totalFrames} frames (${perTape.join(", ")})`);

  let failed = false;
  for (const [name, byRuntime] of runs) {
    for (const runtime of RUNTIMES) {
      const { error } = byRuntime[runtime];
      if (error === undefined) continue;
      failed = true;
      yield* Console.log(`${runtime} stopped on ${name}: ${error.split("\n").slice(0, 3).join(" | ")}`);
    }
  }
  for (const pair of PAIRS) {
    let divergentFrames = 0;
    let divergentOther = 0;
    let first: string | undefined;
    for (const [name, byRuntime] of runs) {
      const a = byRuntime[pair[0]].records;
      const b = byRuntime[pair[1]].records;
      for (let index = 0; index < Math.max(a.length, b.length); index++) {
        if (a[index] === b[index]) continue;
        const { label } = parseRecord(a[index] ?? b[index]);
        if (isFrame(label.split(" ")[1])) divergentFrames++;
        else divergentOther++;
        first ??= `${name} line ${label}: ${describeDivergence(a[index], b[index], pair)}`;
      }
    }
    if (first !== undefined) failed = true;
    const other = divergentOther > 0 ? ` and ${divergentOther} other records` : "";
    yield* Console.log(`${pair.join("/")}: ${divergentFrames} divergent frames${other}${first === undefined ? "" : `; first at ${first}`}`);
  }
  if (failed) return yield* new TapesFailure({ problem: "the runtimes disagree or one stopped" });
});

if (import.meta.main) {
  const out = Bun.stdout.writer();
  for (const file of process.argv.slice(2)) {
    const { records, error } = runInBun(await Bun.file(file).text());
    for (const record of records) out.write(`${record}\n`);
    out.write(`${TAPE_END}${(error ?? "").replaceAll("\n", " ")}\n`);
    await out.flush();
  }
  await out.end();
}
