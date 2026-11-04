import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname, loadavg } from "node:os";
import { dirname, join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema, Stream } from "effect";
import { ChildProcess, type ChildProcessSpawner } from "effect/process";
import { ProcessFailure, runProcess } from "./hostProcess";
import { captureRoute, runOnCaptureHost } from "./nativeCaptureHost";
import { type OnlineRun, PERF_PRESETS, PERF_STAGES, type PerfPreset, type Pressure, type StageRun, type StandaloneFigures, logFigures, onlineFigures, onlineTable, presetTable } from "./perfWindowTable";

const USAGE = "usage: bun scripts/perf-window.ts [--preset Low|Medium|High|Ultra]... [--stage NAME]... [--frames N] [--warmup N] [--rollback N | --online RTT_MS,... [--jitter MS] [--input-delay FRAMES]] [--resolution WIDTHxHEIGHT] [--here] [--out DIR]";
const PLAYER = "perf-window";
const RUN_SECONDS = 600;
const DRAIN_PSI = 5;
const DRAIN_SECONDS = 600;
const RUN_ESTIMATE_SECONDS = 240;
const project = resolve(import.meta.dir, "..");

class PerfWindowFailure extends Schema.TaggedError<PerfWindowFailure, { readonly brand: unique symbol }>()("PerfWindowFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

function argumentsOf(args: readonly string[]) {
  const presets: PerfPreset[] = [], stages: string[] = [];
  let frames = 3600, warmup = 900, rollback: number | undefined, online: number[] | undefined, inputDelay: number | undefined, jitter = 10, resolution = "1920x1080", here = false, inside = false, out = join(project, "build/perf-window", new Date().toISOString().replace(/[:.]/g, "-"));
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--here") { here = true; continue; }
    if (flag === "--inside") { inside = true; continue; }
    const value = args[++index];
    if (value === undefined) throw new Error(`${flag} needs a value\n${USAGE}`);
    if (flag === "--preset") {
      const preset = PERF_PRESETS.find(name => name.toLowerCase() === value.toLowerCase());
      if (preset === undefined) throw new Error(`--preset needs one of ${PERF_PRESETS.join(", ")}`);
      presets.push(preset);
    } else if (flag === "--stage") stages.push(value);
    else if (flag === "--frames" && /^\d+$/.test(value)) frames = Number(value);
    else if (flag === "--warmup" && /^\d+$/.test(value)) warmup = Number(value);
    else if (flag === "--rollback" && /^\d+$/.test(value) && Number(value) > 0) rollback = Number(value);
    else if (flag === "--online" && /^\d+(,\d+)*$/.test(value)) online = value.split(",").map(Number);
    else if (flag === "--jitter" && /^\d+$/.test(value)) jitter = Number(value);
    else if (flag === "--input-delay" && /^\d+$/.test(value)) inputDelay = Number(value);
    else if (flag === "--out") out = resolve(value);
    else if (flag === "--resolution" && /^\d+x\d+$/.test(value)) resolution = value;
    else throw new Error(USAGE);
  }
  if (online !== undefined && rollback !== undefined) throw new Error("--online plays real rollbacks; drop --rollback");
  if (inputDelay !== undefined && online === undefined) throw new Error("--input-delay sets the host's delay for --online; add --online");
  return { presets: presets.length === 0 ? [...PERF_PRESETS] : presets, stages: stages.length === 0 ? [...PERF_STAGES] : stages, frames, warmup, rollback, online, inputDelay, jitter, resolution, here, inside, out };
}

const skillScript = (skill: string, script: string) => runProcess(ChildProcess.make("agents", ["path", skill])).pipe(Effect.map((path) => join(dirname(path), script)));

const Probe = Schema.Struct({ decision: Schema.String, reason: Schema.String, cpuSomeAvg10: Schema.optional(Schema.Finite) });

const GAME_LEASE = ["--class", "gpu", "--memory-gib", "4", "--cpus", "4"];
const ONLINE_LEASE = ["--class", "gpu", "--memory-gib", "8", "--cpus", "8"];
const ONLINE_WINDOWS = ["host", "join"] as const;

const probeGpu = (helper: string) => runProcess(ChildProcess.make(process.execPath, [helper, "probe", ...GAME_LEASE, "--owner", PLAYER])).pipe(
  Effect.flatMap((text) => Schema.decodeEffect(Schema.fromJsonString(Probe))(text.split("\n").at(-1) ?? "")),
  Effect.mapError((cause) => new PerfWindowFailure({ problem: `machine-capacity probe gave no decision: ${cause.message}` })),
  Effect.filterOrFail((probe) => probe.reason !== "DEFER_GAMING", () => new PerfWindowFailure({ problem: "DEFER_GAMING: the gpu lease is held for gaming; perf-window starts when `north capacity gaming status` reads off" })),
);

const runLogged = (command: readonly string[], env: Record<string, string>) => Effect.scoped(Effect.gen(function*() {
  const handle = yield* ChildProcess.make(command[0] ?? "", command.slice(1), { cwd: project, env, extendEnv: true });
  const [stdout, stderr, code] = yield* Effect.all([Stream.mkString(Stream.decodeText(handle.stdout)), Stream.mkString(Stream.decodeText(handle.stderr)), handle.exitCode], { concurrency: "unbounded" });
  return { code: Number(code), log: stdout + stderr };
})).pipe(Effect.catchTag("PlatformError", (cause) => Effect.fail(new ProcessFailure({ command: command[0] ?? "", problem: cause.message }))));

const hostPsi = (): number => Number(/^some avg10=([\d.]+)/.exec(readFileSync("/proc/pressure/cpu", "utf8"))?.[1] ?? 0);

const drained = (began: number): Effect.Effect<number> => Effect.suspend(() => {
  const psi = hostPsi();
  return psi < DRAIN_PSI || Date.now() - began > DRAIN_SECONDS * 1000 ? Effect.succeed(psi) : Effect.sleep("10 seconds").pipe(Effect.andThen(drained(began)));
});

const runInherited = (command: readonly string[]) => Effect.scoped(ChildProcess.make(command[0] ?? "", command.slice(1), { cwd: project, stdin: "inherit", stdout: "inherit", stderr: "inherit" }).pipe(Effect.flatMap((handle) => handle.exitCode), Effect.map(Number)))
    .pipe(Effect.mapError((cause) => new PerfWindowFailure({ problem: `${command[0]}: ${cause.message}` })));

function readFigures(file: string, problem: string | undefined): StandaloneFigures {
  try { return JSON.parse(readFileSync(file, "utf8")) as StandaloneFigures; } catch { return { error: problem ?? `no ${file}` }; }
}

const main = Effect.gen(function*() {
  const { presets, stages, frames, warmup, rollback, online, inputDelay, jitter, resolution, here, inside, out } = yield* Effect.try({ try: () => argumentsOf(process.argv.slice(2)), catch: (cause) => new PerfWindowFailure({ problem: String(cause) }) });
  if (!here && captureRoute(hostname()) === "ship") {
    yield* runOnCaptureHost({
      project, script: "scripts/perf-window.ts",
      args: folders => [...presets.flatMap(preset => ["--preset", preset]), ...stages.flatMap(stage => ["--stage", stage]), "--frames", String(frames), "--warmup", String(warmup), ...(rollback === undefined ? [] : ["--rollback", String(rollback)]), ...(online === undefined ? [] : ["--online", online.join(","), "--jitter", String(jitter)]), ...(inputDelay === undefined ? [] : ["--input-delay", String(inputDelay)]), "--resolution", resolution, "--out", folders.out],
      send: [],
      fetchInto: out,
    }).pipe(Effect.mapError(cause => new PerfWindowFailure({ problem: cause.message })));
    console.log(readFileSync(join(out, "perf-window.md"), "utf8"));
    return;
  }
  const helper = yield* skillScript("machine-capacity", "scripts/machine-capacity.mjs");
  const desktop = yield* skillScript("private-desktop-development", "scripts/private-desktop.sh");
  if (!inside) {
    yield* probeGpu(helper);
    const seconds = presets.length * stages.length * (online?.length ?? 1) * RUN_ESTIMATE_SECONDS + DRAIN_SECONDS;
    process.exitCode = yield* runInherited([process.execPath, helper, "session", "--class", "native", "--new-clients", "0", "--quiet", "--quiet-seconds", String(seconds), "--latency", "--owner", PLAYER, "--", process.execPath, "scripts/perf-window.ts", "--inside", ...process.argv.slice(2)]);
    return;
  }
  const began = Date.now();
  const drainedTo = yield* drained(began);
  const drainedAfter = Math.round((Date.now() - began) / 1000);
  console.error(`perf-window: batch drained, CPU PSI some avg10 ${drainedTo}% after ${drainedAfter} s`);
  mkdirSync(out, { recursive: true });
  const tables: string[] = [];
  for (const preset of presets) {
    const config = join(out, `config-${preset}`);
    mkdirSync(join(config, "wisp/players"), { recursive: true });
    writeFileSync(join(config, "wisp/players", `${PLAYER}.graphics.json`), JSON.stringify({ preset: preset.toLowerCase() }) + "\n");
    const runs: StageRun[] = [];
    const onlineRuns: OnlineRun[] = [];
    if (online !== undefined) for (const stage of stages) for (const rtt of online) {
      const psiStart = hostPsi();
      const dir = join(out, preset, stage.replace(/[^A-Za-z0-9]+/g, "-"), `online-${rtt}ms${inputDelay === undefined ? "" : `-delay${inputDelay}`}`);
      const path = rtt === 0 ? [] : ["--rtt", String(rtt), "--jitter", String(jitter)];
      const pair = ["env", "BUN_JSC_logGC=1", `WISP_WINDOW_WARMUP_FRAMES=${warmup}`, ...(inputDelay === undefined ? [] : [`MAKGORA_ONLINE_INPUT_DELAY=${inputDelay}`]), process.execPath, "scripts/wisp.ts", "net", "pair", "--relay", "local", "--humans", "2", "--window", "native", "--out", dir, "--four-fighters", "--stage", stage, "--frames", String(frames + warmup), ...path];
      const command = ["bash", desktop, "start", "--resolution", resolution, "--seconds", String(RUN_SECONDS + 30), "--", process.execPath, helper, "run", ...ONLINE_LEASE, "--beside-native", PLAYER, "--owner", PLAYER, "--timeout-seconds", String(RUN_SECONDS), "--", ...pair];
      const loadStart = loadavg()[0] ?? 0;
      console.error(`perf-window: ${preset} ${stage} online ${rtt} ms → ${dir}`);
      const ran = yield* runLogged(command, { XDG_CONFIG_HOME: config, WISP_PLAYER: PLAYER });
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "run.log"), ran.log);
      const pressure: Pressure = { psiStart, psiEnd: hostPsi(), loadStart, loadEnd: loadavg()[0] ?? 0 };
      for (const window of ONLINE_WINDOWS) {
        const log = (() => { try { return readFileSync(join(dir, `${window}.log`), "utf8"); } catch { return ""; } })();
        const label = `${stage} ${rtt} ms${inputDelay === undefined ? "" : ` delay ${inputDelay}`} ${window}`;
        runs.push({ stage: label, figures: readFigures(join(dir, window, "standalone.json"), ran.code === 0 ? undefined : `exit ${ran.code}, see ${join(dir, "run.log")}`), log: logFigures(log), pressure });
        onlineRuns.push({ label, matchFrames: frames + warmup, online: onlineFigures(log), log: logFigures(log) });
      }
    }
    else for (const stage of stages) {
      const psiStart = hostPsi();
      const dir = join(out, preset, stage.replace(/[^A-Za-z0-9]+/g, "-"));
      const play = ["env", "BUN_JSC_logGC=1", `WISP_WINDOW_WARMUP_FRAMES=${warmup}`, process.execPath, "scripts/wisp.ts", "play", "--standalone", "--window", "native", "--four-fighters", "--stage", stage, "--frames", String(frames + warmup), "--out", dir, "--emulated-calls", join(dir, "emulated-calls.json"), ...(rollback === undefined ? [] : ["--rollback", String(rollback)])];
      const command = ["bash", desktop, "start", "--resolution", resolution, "--seconds", String(RUN_SECONDS + 30), "--", process.execPath, helper, "run", ...GAME_LEASE, "--beside-native", PLAYER, "--owner", PLAYER, "--timeout-seconds", String(RUN_SECONDS), "--", ...play];
      const loadStart = loadavg()[0] ?? 0;
      console.error(`perf-window: ${preset} ${stage} → ${dir}`);
      const ran = yield* runLogged(command, { XDG_CONFIG_HOME: config, WISP_PLAYER: PLAYER });
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "run.log"), ran.log);
      const pressure: Pressure = { psiStart, psiEnd: hostPsi(), loadStart, loadEnd: loadavg()[0] ?? 0 };
      runs.push({ stage, figures: readFigures(join(dir, "standalone.json"), ran.code === 0 ? undefined : `exit ${ran.code}, see ${join(dir, "run.log")}`), log: logFigures(ran.log), pressure });
    }
    tables.push(presetTable(preset, runs), ...(onlineRuns.length === 0 ? [] : [onlineTable(onlineRuns)]));
  }
  const markdown = [`Four-fighter native window, ${frames} frames per stage after ${warmup} warmup frames${rollback === undefined ? "" : `, --rollback ${rollback}`}${online === undefined ? "" : `, online: two native windows through a local relay, the joiner behind a delay proxy at each round trip with ${jitter} ms jitter (none at 0 ms)${inputDelay === undefined ? ", input delay the lobby's Auto" : `, input delay set by the host to ${inputDelay}`}`}, ${resolution} private desktop on ${hostname()}, under one quiet native lease that drained batch work to CPU PSI some avg10 ${drainedTo}% (${drainedAfter} s) before the first run.`, "", ...tables].join("\n\n") + "\n";
  writeFileSync(join(out, "perf-window.md"), markdown);
  console.log(markdown);
});

BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)));
