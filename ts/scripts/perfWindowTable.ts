export const PERF_PRESETS = ["Low", "Medium", "High", "Ultra"] as const;
export type PerfPreset = typeof PERF_PRESETS[number];

export const PERF_STAGES = ["Blackrock", "Tomb of Sargeras", "Stratholme", "Naxxramas"] as const;

export interface Spread { readonly p50: number; readonly p99: number; readonly max: number }

/** The fields of a native run's `standalone.json` the table reads. */
export interface StandaloneFigures {
  readonly fps?: number;
  readonly frameMs?: Spread;
  readonly intervalMs?: Spread;
  readonly stageMs?: Readonly<Record<string, Spread>>;
  readonly encodeMs?: Spread;
  readonly parseMs?: Spread;
  readonly cpuEncodeMs?: Spread;
  readonly gpuPassMs?: Readonly<Record<string, Spread>>;
  readonly gpuPassMsAbsent?: string;
  readonly error?: string;
}

export interface LogFigures {
  readonly lateScenes: readonly number[];
  readonly ticksPerSecond: readonly number[];
  readonly workerGcCycles: number;
  readonly workerGcPausesMs: readonly number[];
}

/** The machine's CPU pressure around one run: PSI some avg10 and the one-minute load average, at its start and end. */
export interface Pressure { readonly psiStart: number; readonly psiEnd: number; readonly loadStart: number; readonly loadEnd: number }

export interface StageRun { readonly stage: string; readonly figures: StandaloneFigures; readonly log: LogFigures; readonly pressure: Pressure }

export const MEASURED_FROM = "makgora-perf frames begin";

const PULSE = /wisp-window: [\d.]+ frames\/s .*?, ([\d.]+) ticks\/s, .*?, (\d+) late scenes, \d+ dropped samples over/g;
const GC_PAUSE = /\[GC<(0x[0-9a-f]+)>: (START )?[^[]*? p=([\d.]+)ms/g;

export function logFigures(log: string): LogFigures {
  const mainHeap = /\[GC<(0x[0-9a-f]+)>/.exec(log)?.[1];
  const marked = log.indexOf(MEASURED_FROM);
  const measured = marked < 0 ? "" : log.slice(marked);
  const pulses = [...measured.matchAll(PULSE)].slice(1);
  const pauses = [...measured.matchAll(GC_PAUSE)].filter(pause => pause[1] !== mainHeap);
  return {
    lateScenes: pulses.map(pulse => Number(pulse[2])),
    ticksPerSecond: pulses.map(pulse => Number(pulse[1])),
    workerGcCycles: pauses.filter(pause => pause[2] !== undefined).length,
    workerGcPausesMs: pauses.map(pause => Number(pause[3])),
  };
}

export function spreadOf(values: readonly number[]): Spread | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (fraction: number) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  return { p50: rank(0.5), p99: rank(0.99), max: sorted.at(-1) ?? 0 };
}

const cell = (spread: Spread | undefined, digits = 2): string => spread === undefined ? "–" : `${spread.p50.toFixed(digits)} / ${spread.p99.toFixed(digits)} / ${spread.max.toFixed(digits)}`;

const SIM_COLUMNS = ["sim", "rollback", "scene"] as const;

/** One preset's markdown table: a row per stage, each timing cell p50 / p99 / max milliseconds, the GPU passes any stage timed, the window's pacing, the step worker's collector, then the CPU pressure each run saw. */
export function presetTable(preset: PerfPreset, runs: readonly StageRun[]): string {
  const passes = [...new Set(runs.flatMap(run => Object.keys(run.figures.gpuPassMs ?? {})))];
  const head = ["Stage", "fps", "step+encode", ...SIM_COLUMNS, "encode", "parse", "cpuEncode", ...passes.map(pass => `gpu ${pass}`), "interval", "late / 300 ticks", "ticks/s min", "worker GC cycles", "worker GC pauses", "worker GC pause", "CPU PSI some avg10", "load 1 min"];
  const rows = runs.map(({ stage, figures, log, pressure }) => figures.error !== undefined
    ? [stage, `failed: ${figures.error.split("\n", 1)[0]}`, ...head.slice(2).map(() => "")]
    : [
      stage, figures.fps?.toFixed(1) ?? "–", cell(figures.frameMs),
      ...SIM_COLUMNS.map(name => cell(figures.stageMs?.[name])),
      cell(figures.encodeMs), cell(figures.parseMs), cell(figures.cpuEncodeMs),
      ...passes.map(pass => figures.gpuPassMs === undefined ? figures.gpuPassMsAbsent ?? "–" : cell(figures.gpuPassMs[pass])),
      cell(figures.intervalMs), cell(spreadOf(log.lateScenes), 0),
      log.ticksPerSecond.length === 0 ? "–" : Math.min(...log.ticksPerSecond).toFixed(1),
      String(log.workerGcCycles), String(log.workerGcPausesMs.length), cell(spreadOf(log.workerGcPausesMs)),
      `${pressure.psiStart.toFixed(0)}% → ${pressure.psiEnd.toFixed(0)}%`, `${pressure.loadStart.toFixed(0)} → ${pressure.loadEnd.toFixed(0)}`,
    ]);
  const line = (cells: readonly string[]) => `| ${cells.join(" | ")} |`;
  return [`### ${preset}`, "", line(head), line(head.map(() => "---")), ...rows.map(line), "", "Timing cells are p50 / p99 / max milliseconds; late scenes are per five-second pulse (300 ticks), first pulse left out."].join("\n");
}

/** One window of an online run (wisp#229): its rollback line, `net: rollback {...}` from the map's own playback, and the peer's report from the window's summary line. */
export interface OnlineFigures {
  readonly depth?: { readonly n: number; readonly p50: number; readonly p99: number; readonly max: number };
  readonly checksumsCompared?: number;
  readonly mismatches?: number;
  readonly rttMs?: number;
  /** The map's input delay and rollback window, in frames. */
  readonly delay?: number;
  readonly window?: number;
  readonly stalls?: number;
  readonly pops?: { readonly over: number; readonly max: number };
}

export function onlineFigures(log: string): OnlineFigures {
  const rollback = /^net: rollback (\{.*\})$/m.exec(log)?.[1];
  const summary = log.split("\n").reverse().find(line => line.startsWith("{") && line.includes("\"net\":"));
  const map = rollback === undefined ? undefined : JSON.parse(rollback) as { depth: NonNullable<OnlineFigures["depth"]>; delay: number; window: number; stalls: number; pops?: NonNullable<OnlineFigures["pops"]> };
  const net = summary === undefined ? undefined : (JSON.parse(summary) as { net?: { checksumsCompared: number; mismatches: number; rttMs: number } }).net;
  return { ...(map === undefined ? {} : { depth: map.depth, delay: map.delay, window: map.window, stalls: map.stalls, ...(map.pops === undefined ? {} : { pops: map.pops }) }), ...(net === undefined ? {} : { checksumsCompared: net.checksumsCompared, mismatches: net.mismatches, rttMs: net.rttMs }) };
}

export interface OnlineRun { readonly label: string; readonly matchFrames: number; readonly online: OnlineFigures; readonly log: LogFigures }

/** The netcode beside the timing table: per window, the round trip and delay the peers agreed, rollback depth, rollbacks per second of match, late scenes and the checksums the peers compared. */
export function onlineTable(runs: readonly OnlineRun[]): string {
  const head = ["Window", "measured round trip ms", "input delay / rollback window", "rollback depth p50 / p99 / max", "rollbacks/s", "held at window edge", "corrections over 20 units / largest", "late / 300 ticks p50 / p99 / max", "checksums compared", "mismatches"];
  const rows = runs.map(({ label, matchFrames, online, log }) => [
    label, online.rttMs?.toFixed(0) ?? "–", online.delay === undefined ? "–" : `${online.delay} / ${online.window ?? "–"}`,
    online.depth === undefined ? "–" : `${online.depth.p50} / ${online.depth.p99} / ${online.depth.max}`,
    online.depth === undefined ? "–" : (online.depth.n / (matchFrames / 60)).toFixed(2),
    online.stalls?.toFixed(0) ?? "–", online.pops === undefined ? "–" : `${online.pops.over} / ${online.pops.max}`,
    cell(spreadOf(log.lateScenes), 0), online.checksumsCompared?.toFixed(0) ?? "–", online.mismatches?.toFixed(0) ?? "–",
  ]);
  const line = (cells: readonly string[]) => `| ${cells.join(" | ")} |`;
  return [line(head), line(head.map(() => "---")), ...rows.map(line), "", "Rollback depth and rollbacks/s count every correction of the whole match, warmup included; held counts the steps whose prediction stopped at the window edge; a correction over 20 units is a rollback that moved a fighter more than 20 world units; late scenes are per five-second pulse after the warmup."].join("\n");
}
