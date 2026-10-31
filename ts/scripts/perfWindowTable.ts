export const PERF_PRESETS = ["Low", "Medium", "High", "Ultra"] as const;
export type PerfPreset = typeof PERF_PRESETS[number];

export const PERF_STAGES = ["Blackrock", "Tomb of Sargeras", "Stratholme", "Naxxramas"] as const;

interface Spread { readonly p50: number; readonly p95: number }

/** The fields of a native run's `standalone.json` the table reads. */
export interface StandaloneFigures {
  readonly fps?: number;
  readonly frameMs?: Spread;
  readonly stageMs?: Readonly<Record<string, Spread>>;
  readonly encodeMs?: Spread;
  readonly parseMs?: Spread;
  readonly cpuEncodeMs?: Spread;
  readonly gpuPassMs?: Readonly<Record<string, Spread>>;
  readonly gpuPassMsAbsent?: string;
  readonly error?: string;
}

/** The machine's CPU pressure around one run: PSI some avg10 and the one-minute load average, at its start and end. */
export interface Pressure { readonly psiStart: number; readonly psiEnd: number; readonly loadStart: number; readonly loadEnd: number }

export interface StageRun { readonly stage: string; readonly figures: StandaloneFigures; readonly pressure: Pressure }

const cell = (spread: Spread | undefined): string => spread === undefined ? "–" : `${spread.p50.toFixed(2)} / ${spread.p95.toFixed(2)}`;

const SIM_COLUMNS = ["sim", "rollback", "scene"] as const;

/** One preset's markdown table: a row per stage, each cell p50 / p95 milliseconds, the GPU passes any stage timed, then the CPU pressure each run saw. */
export function presetTable(preset: PerfPreset, runs: readonly StageRun[]): string {
  const passes = [...new Set(runs.flatMap(run => Object.keys(run.figures.gpuPassMs ?? {})))];
  const head = ["Stage", "fps", "frame", ...SIM_COLUMNS, "encode", "parse", "cpuEncode", ...passes.map(pass => `gpu ${pass}`), "CPU PSI some avg10", "load 1 min"];
  const rows = runs.map(({ stage, figures, pressure }) => figures.error !== undefined
    ? [stage, `failed: ${figures.error.split("\n", 1)[0]}`, ...head.slice(2).map(() => "")]
    : [
      stage, figures.fps?.toFixed(1) ?? "–", cell(figures.frameMs),
      ...SIM_COLUMNS.map(name => cell(figures.stageMs?.[name])),
      cell(figures.encodeMs), cell(figures.parseMs), cell(figures.cpuEncodeMs),
      ...passes.map(pass => figures.gpuPassMs === undefined ? figures.gpuPassMsAbsent ?? "–" : cell(figures.gpuPassMs[pass])),
      `${pressure.psiStart.toFixed(0)}% → ${pressure.psiEnd.toFixed(0)}%`, `${pressure.loadStart.toFixed(0)} → ${pressure.loadEnd.toFixed(0)}`,
    ]);
  const line = (cells: readonly string[]) => `| ${cells.join(" | ")} |`;
  return [`### ${preset}`, "", line(head), line(head.map(() => "---")), ...rows.map(line), "", "Cells are p50 / p95 milliseconds."].join("\n");
}
