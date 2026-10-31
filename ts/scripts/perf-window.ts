import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { dirname, join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { ProcessFailure, runProcess } from "./hostProcess";
import { PERF_PRESETS, PERF_STAGES, type PerfPreset, type Pressure, type StageRun, type StandaloneFigures, presetTable } from "./perfWindowTable";

const USAGE = "usage: bun scripts/perf-window.ts [--preset Low|Medium|High|Ultra]... [--stage NAME]... [--frames N] [--rollback N] [--out DIR]";
const PLAYER = "perf-window";
const RUN_SECONDS = 900;
const project = resolve(import.meta.dir, "..");

class PerfWindowFailure extends Schema.TaggedError<PerfWindowFailure, { readonly brand: unique symbol }>()("PerfWindowFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

function argumentsOf(args: readonly string[]) {
  const presets: PerfPreset[] = [], stages: string[] = [];
  let frames = 3600, rollback: number | undefined, out = join(project, "build/perf-window", new Date().toISOString().replace(/[:.]/g, "-"));
  for (let index = 0; index < args.length; index++) {
    const flag = args[index], value = args[++index];
    if (value === undefined) throw new Error(`${flag} needs a value\n${USAGE}`);
    if (flag === "--preset") {
      const preset = PERF_PRESETS.find(name => name.toLowerCase() === value.toLowerCase());
      if (preset === undefined) throw new Error(`--preset needs one of ${PERF_PRESETS.join(", ")}`);
      presets.push(preset);
    } else if (flag === "--stage") stages.push(value);
    else if (flag === "--frames" && /^\d+$/.test(value)) frames = Number(value);
    else if (flag === "--rollback" && /^\d+$/.test(value) && Number(value) > 0) rollback = Number(value);
    else if (flag === "--out") out = resolve(value);
    else throw new Error(USAGE);
  }
  return { presets: presets.length === 0 ? [...PERF_PRESETS] : presets, stages: stages.length === 0 ? [...PERF_STAGES] : stages, frames, rollback, out };
}

const skillScript = (skill: string, script: string) => runProcess(ChildProcess.make("agents", ["path", skill])).pipe(Effect.map((path) => join(dirname(path), script)));

const Probe = Schema.Struct({ decision: Schema.String, reason: Schema.String, cpuSomeAvg10: Schema.optional(Schema.Finite) });

const probeGpu = (helper: string) => runProcess(ChildProcess.make(process.execPath, [helper, "probe", "--class", "gpu", "--owner", PLAYER])).pipe(
  Effect.flatMap((text) => Schema.decodeEffect(Schema.fromJsonString(Probe))(text.split("\n").at(-1) ?? "")),
  Effect.mapError((cause) => new PerfWindowFailure({ problem: `machine-capacity probe gave no decision: ${cause.message}` })),
  Effect.filterOrFail((probe) => probe.reason !== "DEFER_GAMING", () => new PerfWindowFailure({ problem: "DEFER_GAMING: the gpu lease is held for gaming; perf-window starts when `north capacity gaming status` reads off" })),
);

const runLogged = (command: readonly string[], env: Record<string, string>) => Effect.scoped(Effect.gen(function*() {
  const handle = yield* ChildProcess.make(command[0] ?? "", command.slice(1), { cwd: project, env, extendEnv: true });
  const [stdout, stderr, code] = yield* Effect.all([Stream.mkString(Stream.decodeText(handle.stdout)), Stream.mkString(Stream.decodeText(handle.stderr)), handle.exitCode], { concurrency: "unbounded" });
  return { code: Number(code), log: stdout + stderr };
})).pipe(Effect.catchTag("PlatformError", (cause) => Effect.fail(new ProcessFailure({ command: command[0] ?? "", problem: cause.message }))));

function readFigures(file: string, problem: string | undefined): StandaloneFigures {
  try { return JSON.parse(readFileSync(file, "utf8")) as StandaloneFigures; } catch { return { error: problem ?? `no ${file}` }; }
}

const main = Effect.gen(function*() {
  const { presets, stages, frames, rollback, out } = yield* Effect.try({ try: () => argumentsOf(process.argv.slice(2)), catch: (cause) => new PerfWindowFailure({ problem: String(cause) }) });
  const helper = yield* skillScript("machine-capacity", "scripts/machine-capacity.mjs");
  const desktop = yield* skillScript("private-desktop-development", "scripts/private-desktop.sh");
  yield* probeGpu(helper);
  mkdirSync(out, { recursive: true });
  const tables: string[] = [];
  for (const preset of presets) {
    const config = join(out, `config-${preset}`);
    mkdirSync(join(config, "wisp/players"), { recursive: true });
    writeFileSync(join(config, "wisp/players", `${PLAYER}.graphics.json`), JSON.stringify({ preset: preset.toLowerCase() }) + "\n");
    const runs: StageRun[] = [];
    for (const stage of stages) {
      const before = yield* probeGpu(helper);
      const dir = join(out, preset, stage.replace(/[^A-Za-z0-9]+/g, "-"));
      const play = [process.execPath, "scripts/wisp.ts", "play", "--standalone", "--window", "native", "--four-fighters", "--stage", stage, "--frames", String(frames), "--out", dir, ...(rollback === undefined ? [] : ["--rollback", String(rollback)])];
      const command = ["bash", desktop, "start", "--resolution", "1920x1080", "--seconds", String(RUN_SECONDS + 30), "--", process.execPath, helper, "run", "--class", "gpu", "--owner", PLAYER, "--timeout-seconds", String(RUN_SECONDS), "--", ...play];
      const loadStart = loadavg()[0] ?? 0;
      console.error(`perf-window: ${preset} ${stage} → ${dir}`);
      const ran = yield* runLogged(command, { XDG_CONFIG_HOME: config, WISP_PLAYER: PLAYER });
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "run.log"), ran.log);
      const after = yield* probeGpu(helper);
      const pressure: Pressure = { psiStart: before.cpuSomeAvg10 ?? 0, psiEnd: after.cpuSomeAvg10 ?? 0, loadStart, loadEnd: loadavg()[0] ?? 0 };
      runs.push({ stage, figures: readFigures(join(dir, "standalone.json"), ran.code === 0 ? undefined : `exit ${ran.code}, see ${join(dir, "run.log")}`), pressure });
    }
    tables.push(presetTable(preset, runs));
  }
  const markdown = [`Four-fighter native window, ${frames} frames per stage${rollback === undefined ? "" : `, --rollback ${rollback}`}, 1920x1080 private desktop.`, "", ...tables].join("\n\n") + "\n";
  writeFileSync(join(out, "perf-window.md"), markdown);
  console.log(markdown);
});

BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)));
