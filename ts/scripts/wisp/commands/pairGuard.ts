import { readFileSync, readdirSync } from "node:fs";

export interface ProcessRow {
  readonly pid: number;
  readonly ppid: number;
  readonly args: readonly string[];
}

export const ACCEPT_OUTER_PID = "SMASHCRAFT_ACCEPT_OUTER_PID";

const pairsOf = (args: readonly string[]): readonly string[] => args.flatMap((arg, index) =>
  arg === "--pair" ? [args[index + 1] ?? ""] : arg.startsWith("--pair=") ? [arg.slice("--pair=".length)] : []);

const isAccept = (args: readonly string[]) => args.includes("accept") && args.some((arg) => arg.endsWith("wisp.ts"));

/** The pids of other accept runs on this pair, excluding this run and the callers that started it. */
export const pairHolders = (pair: number, rows: readonly ProcessRow[], own: readonly number[]): readonly number[] => {
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const ignored = new Set<number>();
  for (const start of own) {
    for (let pid: number | undefined = start; pid !== undefined && pid > 1 && !ignored.has(pid); pid = byPid.get(pid)?.ppid) ignored.add(pid);
  }
  return rows.filter((row) => !ignored.has(row.pid) && isAccept(row.args) && pairsOf(row.args).includes(String(pair))).map(({ pid }) => pid);
};

export const liveProcesses = (): readonly ProcessRow[] => readdirSync("/proc").flatMap((entry) => {
  if (!/^\d+$/.test(entry)) return [];
  try {
    const args = readFileSync(`/proc/${entry}/cmdline`, "utf8").split("\0").filter((word) => word !== "");
    const ppid = Number(readFileSync(`/proc/${entry}/stat`, "utf8").split(") ")[1]?.split(" ")[1]);
    return [{ pid: Number(entry), ppid, args }];
  } catch {
    return [];
  }
});

export const ownPids = (env: Readonly<Record<string, string | undefined>>): readonly number[] =>
  [process.pid, Number(env[ACCEPT_OUTER_PID] ?? "")].filter((pid) => Number.isInteger(pid) && pid > 0);
