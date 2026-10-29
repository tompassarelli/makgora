import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { Effect, Schema } from "effect";

/** One process a sampled command started: its CPU seconds as last read, and what it had reaped from children by then. */
export interface Sampled { readonly pid: number; readonly ppid: number; readonly argv: string; readonly self: number; readonly reaped: number; readonly first: number; readonly last: number }
export interface Sample { readonly command: readonly string[]; readonly exit: number | null; readonly wall: number; readonly total: number; readonly processes: readonly Sampled[] }

export type Stage = "mutant verification" | "dependency sync" | "gates and scans" | "local checks" | "landingFarm.ts process" | "farm dispatch and poll" | "git" | "safe-push shell";

const STAGES: ReadonlyArray<readonly [RegExp, Stage]> = [
  [/\bnorth mutant verify\b|scripts\/mutantTests\.ts/, "mutant verification"],
  [/\bbun install\b|effect-tsgo|\.githooks\/post-/, "dependency sync"],
  [/(^|\/)gh /, "farm dispatch and poll"],
  [/\bnorth (language-gate|dep-gate|review-gate|stale-revert|denylist|landed-tree|provenance)\b|code-health|gitleaks|python3 -|agent-instruction/, "gates and scans"],
  [/^git\b|\/git(-[a-z-]+)? /, "git"],
];
const LANDING_FARM = /scripts\/landingFarm\.ts/;

/** The stage a process counts toward: the innermost named stage on its chain from the root, else the shell's own; the landing gate's other children are its local checks. */
export function stageOf(chain: readonly string[]): Stage {
  for (let index = chain.length - 1; index >= 0; index--) {
    const command = chain[index] ?? "";
    if (LANDING_FARM.test(command)) return index === chain.length - 1 ? "landingFarm.ts process" : "local checks";
    const found = STAGES.find(([rule]) => rule.test(command));
    if (found !== undefined) return found[1];
  }
  return "safe-push shell";
}

class LandingCpuFailure extends Schema.TaggedError<LandingCpuFailure, { readonly brand: unique symbol }>()("LandingCpuFailure", { problem: Schema.String }) {}

const TICK = 100;
const POLL = "15 millis";

const stat = (pid: number) => {
  try {
    const text = readFileSync(`/proc/${pid}/stat`, "latin1");
    const field = text.slice(text.lastIndexOf(")") + 2).split(" ");
    return { ppid: Number(field[1]), self: (Number(field[11]) + Number(field[12])) / TICK, reaped: (Number(field[13]) + Number(field[14])) / TICK };
  } catch { return undefined; }
};
const cmdline = (pid: number) => { try { return readFileSync(`/proc/${pid}/cmdline`, "latin1").split("\0").filter(Boolean).join(" ").slice(0, 400); } catch { return ""; } };

/** Runs a command and samples /proc for every process it starts, so its CPU seconds split by process. */
export const sample = (command: readonly string[]) => Effect.gen(function*() {
  const started = performance.now();
  const seconds = () => (performance.now() - started) / 1000;
  const seen = new Set<number>();
  const live = new Map<number, { -readonly [key in keyof Sampled]: Sampled[key] } & { gone: boolean }>();
  const child = yield* Effect.try({
    try: () => Bun.spawn([...command], { stdio: ["inherit", "inherit", "inherit"] }),
    catch: (cause) => new LandingCpuFailure({ problem: `landing cpu: cannot start ${command.join(" ")}: ${String(cause)}` }),
  });
  while (child.exitCode === null && child.signalCode === null) {
    const now = seconds();
    for (const name of readdirSync("/proc")) {
      const pid = Number(name);
      if (!Number.isInteger(pid) || seen.has(pid)) continue;
      seen.add(pid);
      const read = stat(pid);
      if (read !== undefined && (pid === child.pid || live.has(read.ppid))) live.set(pid, { pid, ...read, argv: cmdline(pid), first: now, last: now, gone: false });
    }
    for (const row of live.values()) {
      if (row.gone) continue;
      const read = stat(row.pid);
      if (read === undefined || (read.ppid !== row.ppid && row.pid !== child.pid)) { row.gone = true; continue; }
      row.self = read.self; row.reaped = read.reaped; row.last = now;
      if (now - row.first < 0.1) row.argv = cmdline(row.pid) || row.argv;
    }
    yield* Effect.sleep(POLL);
  }
  const usage = child.resourceUsage();
  const total = usage === undefined ? Number.NaN : (Number(usage.cpuTime.user) + Number(usage.cpuTime.system)) / 1e6;
  const processes = [...live.values()].map(({ gone: _gone, ...row }) => row.pid === child.pid ? { ...row, reaped: Math.max(0, total - row.self) } : row);
  return { command, exit: child.exitCode, wall: seconds(), total, processes } satisfies Sample;
});

/**
 * CPU seconds by stage. A process's inclusive CPU is the larger of what it and its reaped
 * children read at its last sample and its own plus its seen children's inclusive CPU, since
 * either reading can be stale; each process counts the part its seen children do not explain.
 */
export function stages(run: Sample): Map<Stage, number> {
  const byPid = new Map(run.processes.map((row) => [row.pid, row] as const));
  const children = new Map<number, Sampled[]>();
  for (const row of run.processes) if (byPid.has(row.ppid)) children.set(row.ppid, [...(children.get(row.ppid) ?? []), row]);
  const inclusive = new Map<number, number>();
  const kidsOf = (row: Sampled) => (children.get(row.pid) ?? []).reduce((sum, kid) => sum + inclusiveOf(kid), 0);
  const inclusiveOf = (row: Sampled): number => {
    const known = inclusive.get(row.pid);
    if (known !== undefined) return known;
    const value = Math.max(row.self + row.reaped, row.self + kidsOf(row));
    inclusive.set(row.pid, value);
    return value;
  };
  const chain = (row: Sampled): string[] => {
    const names: string[] = [];
    for (let at: Sampled | undefined = row; at !== undefined; at = byPid.get(at.ppid)) names.unshift(at.argv);
    return names;
  };
  const totals = new Map<Stage, number>();
  for (const row of run.processes) {
    const stage = stageOf(chain(row));
    totals.set(stage, (totals.get(stage) ?? 0) + inclusiveOf(row) - kidsOf(row));
  }
  return totals;
}

export function report(run: Sample, top = 0): string {
  const rows = [...stages(run)].sort(([, a], [, b]) => b - a);
  const heaviest = [...run.processes].sort((a, b) => b.self + b.reaped - a.self - a.reaped).slice(0, top);
  return [
    `${run.command.join(" ")}: exit ${run.exit}, ${run.wall.toFixed(1)} s wall, ${run.total.toFixed(1)} CPU s over ${run.processes.length} processes`,
    ...rows.map(([stage, cpu]) => `  ${cpu.toFixed(1).padStart(6)} s  ${(100 * cpu / run.total).toFixed(0).padStart(3)}%  ${stage}`),
    ...heaviest.map((row) => `  ${row.self.toFixed(1).padStart(6)} s self ${row.reaped.toFixed(1).padStart(6)} s reaped  ${row.first.toFixed(0).padStart(4)}-${row.last.toFixed(0).padEnd(4)} ${row.argv.slice(0, 160)}`),
  ].join("\n");
}

if (import.meta.main) {
  const [verb, file, separator, ...command] = process.argv.slice(2);
  if (verb === "run" && file !== undefined && separator === "--" && command.length > 0) {
    const run = await Effect.runPromise(sample(command));
    writeFileSync(file, JSON.stringify(run));
    console.error(report(run));
    process.exit(run.exit ?? 1);
  } else if (verb === "report" && file !== undefined) {
    console.log(report(JSON.parse(readFileSync(file, "utf8")) as Sample, Number(separator ?? 0)));
  } else {
    throw new Error("usage: bun scripts/landingCpu.ts run OUT.json -- COMMAND... | report OUT.json");
  }
}
