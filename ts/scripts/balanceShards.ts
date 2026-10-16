export const JOB_SECONDS = 15 * 60;
export const RUNNER_CORES = 4;

export interface Work { readonly name: string; readonly seconds: number }

export function shardWork(work: readonly Work[]): string[][] {
  const bins: { names: string[]; cores: number[] }[] = [];
  for (const unit of [...work].sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name))) {
    if (!(unit.seconds > 0 && unit.seconds <= JOB_SECONDS)) throw new Error(`${unit.name}: ${unit.seconds}s needs splitting below ${JOB_SECONDS}s`);
    let target = bins.find((bin) => Math.min(...bin.cores) + unit.seconds <= JOB_SECONDS);
    if (target === undefined) { target = { names: [], cores: Array.from({ length: RUNNER_CORES }, () => 0) }; bins.push(target); }
    const core = target.cores.indexOf(Math.min(...target.cores));
    target.cores[core] = (target.cores[core] ?? 0) + unit.seconds;
    target.names.push(unit.name);
  }
  if (bins.length > 256) throw new Error(`Balance needs ${bins.length} jobs, exceeding GitHub's 256-job matrix`);
  return bins.map((bin) => bin.names);
}

export function partitionWork(given: string | undefined): () => boolean {
  const [part, count] = (given ?? "0/1").split("/").map(Number);
  if (part === undefined || count === undefined || !Number.isInteger(part) || !Number.isInteger(count) || part < 0 || count < 1 || part >= count) throw new Error("--partition takes INDEX/COUNT with 0 <= INDEX < COUNT");
  let index = 0;
  return () => index++ % count === part;
}

export function measuredSeconds(units: readonly string[], samples: readonly Readonly<Record<string, number>>[]): Record<string, number> | undefined {
  const all = samples.flatMap((sample) => Object.values(sample));
  if (all.length === 0) return undefined;
  const slowest = Math.max(...all);
  return Object.fromEntries(units.map((unit) => [unit, samples.find((sample) => sample[unit] !== undefined)?.[unit] ?? slowest]));
}
