





import { Console, Effect } from "effect";
import { type Command, UsageFailure, describeCause, flagValues } from "wisp/scripts/wisp/command";
import { PerfFailure } from "wisp/scripts/wisp/commands/perf";
import { parsePerfSamples } from "wisp/scripts/wisp/nativeFit";
import { WARCRAFT_COST, nativeFrameCost } from "wisp/src/headless/nativeCost";

export const BUDGET_P99_MS = 10;
export const BUDGET_WORST_MS = 14;
export const TOP_SHARE = 0.01;
export const BUDGET_ALLOC_P50_KB = 14;
export const BUDGET_ALLOC_P95_KB = 26;
export const BUDGET_CATCH_UP_MS = 10;


function rank(sorted: readonly number[], share: number): number {
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1))] ?? 0;
}

export interface ClientBudget {
  readonly slot: number;
  readonly frames: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly top: number;
  readonly worst: number;
  readonly allocP50: number;
  readonly allocP95: number;
}


export function clientBudgets(samples: string): ClientBudget[] {
  return [...parsePerfSamples(samples)].map(([slot, frames]) => {
    const ms = frames.map((frame) => nativeFrameCost(WARCRAFT_COST, { ...frame, typedCharacters: 0 }).callbacksUs / 1000).sort((a, b) => a - b);
    const worstFrames = ms.slice(ms.length - Math.max(1, Math.ceil(TOP_SHARE * ms.length)));
    const top = worstFrames.reduce((sum, value) => sum + value, 0) / Math.max(1, worstFrames.length);
    const kb = frames.map((frame) => frame.allocatedKb).sort((a, b) => a - b);
    return { slot, frames: ms.length, p50: rank(ms, 0.5), p95: rank(ms, 0.95), p99: rank(ms, 0.99), top, worst: rank(ms, 1), allocP50: rank(kb, 0.5), allocP95: rank(kb, 0.95) };
  });
}

const FRAME_SAMPLE = /^frame (\d+) p(\d+) instructions=(\d+) lua-us=\d+ natives=(\d+) alloc-bytes=(\d+) typed=\d+$/;
const CATCH_UP_SAMPLE = /^journey: catch-up frame (\d+) p(\d+) confirmed=(-?\d+) speculative=(-?\d+)$/;

export interface CatchUpBudget {
  readonly slot: number;
  readonly callbacks: number;
  readonly p50: number;
  readonly p95: number;
  readonly worst: number;
  readonly over: number;
  readonly frames: string;
}


export function catchUpBudgets(samples: string, limit: number): CatchUpBudget[] {
  const cost = new Map<string, number>();
  const caught = new Map<number, { readonly key: string; readonly ran: string }[]>();
  for (const line of samples.split(/\r?\n/)) {
    const frame = FRAME_SAMPLE.exec(line);
    if (frame !== null) {
      const [, at, slot, instructions, natives, bytes] = frame;
      cost.set(`${slot} ${at}`, nativeFrameCost(WARCRAFT_COST, { instructions: Number(instructions), natives: Number(natives), allocatedKb: Number(bytes) / 1024, typedCharacters: 0 }).callbacksUs / 1000);
      continue;
    }
    const catchUp = CATCH_UP_SAMPLE.exec(line);
    if (catchUp === null) continue;
    const [, at, slot, confirmed, speculative] = catchUp;
    const list = caught.get(Number(slot)) ?? [];
    list.push({ key: `${slot} ${at}`, ran: `${confirmed}+${speculative}` });
    caught.set(Number(slot), list);
  }
  return [...caught].map(([slot, list]) => {
    const measured = list.flatMap(({ key, ran }) => {
      const ms = cost.get(key);
      return ms === undefined ? [] : [{ ms, ran }];
    });
    const ms = measured.map((entry) => entry.ms).sort((a, b) => a - b);
    const byRan = new Map<string, number>();
    for (const entry of measured) byRan.set(entry.ran, Math.max(byRan.get(entry.ran) ?? 0, entry.ms));
    const frames = [...byRan].sort(([a], [b]) => (a < b ? -1 : 1)).map(([ran, worst]) => `${ran} ${worst.toFixed(2)}`).join(", ");
    return { slot, callbacks: ms.length, p50: rank(ms, 0.5), p95: rank(ms, 0.95), worst: rank(ms, 1), over: ms.filter((value) => value > limit).length, frames };
  });
}

export const budget: Command = (args) => Effect.gen(function*() {
  const [p99Text = String(BUDGET_P99_MS)] = flagValues(args, "p99");
  const [allocP50Text = String(BUDGET_ALLOC_P50_KB)] = flagValues(args, "alloc-p50");
  const [allocP95Text = String(BUDGET_ALLOC_P95_KB)] = flagValues(args, "alloc-p95");
  const [catchUpText = String(BUDGET_CATCH_UP_MS)] = flagValues(args, "catch-up");
  const files = args.filter((arg, index) => !arg.startsWith("--") && !["--p99", "--alloc-p50", "--alloc-p95", "--catch-up"].includes(args[index - 1] ?? ""));
  const p99 = Number(p99Text);
  const allocP50 = Number(allocP50Text);
  const allocP95 = Number(allocP95Text);
  const catchUp = Number(catchUpText);
  const [file] = files;
  if (file === undefined || files.length !== 1 || !(p99 > 0) || !(allocP50 > 0) || !(allocP95 > 0) || !(catchUp > 0)) return yield* new UsageFailure({ problem: "perf budget takes a run written with --samples, and optional --p99 MS, --alloc-p50 KB, --alloc-p95 KB and --catch-up MS" });
  const text = yield* Effect.tryPromise({ try: () => Bun.file(file).text(), catch: (cause) => new PerfFailure({ problem: `${file}: ${describeCause(cause)}` }) });
  const clients = clientBudgets(text);
  if (clients.length === 0) return yield* new PerfFailure({ problem: `${file} has no frame samples: write it with perf RUN --samples --out FILE` });
  const over: string[] = [];
  for (const client of clients) {
    yield* Console.log(`p${client.slot} predicted ms per frame over ${client.frames} frames: ${client.p50.toFixed(2)} p50, ${client.p95.toFixed(2)} p95, ${client.p99.toFixed(2)} p99, ${client.top.toFixed(2)} top 1% mean, ${client.worst.toFixed(2)} worst (budget ${p99} p99, ${BUDGET_WORST_MS} worst)`);
    yield* Console.log(`p${client.slot} map KB allocated per frame: ${client.allocP50.toFixed(1)} p50, ${client.allocP95.toFixed(1)} p95 (budget ${allocP50} p50, ${allocP95} p95)`);
    if (client.p99 > p99) over.push(`p${client.slot} p99 ${client.p99.toFixed(2)} ms > ${p99}`);
    if (client.worst > BUDGET_WORST_MS) over.push(`p${client.slot} worst ${client.worst.toFixed(2)} ms > ${BUDGET_WORST_MS}`);
    if (client.allocP50 > allocP50) over.push(`p${client.slot} p50 allocation ${client.allocP50.toFixed(1)} KB > ${allocP50}`);
    if (client.allocP95 > allocP95) over.push(`p${client.slot} p95 allocation ${client.allocP95.toFixed(1)} KB > ${allocP95}`);
  }
  for (const client of catchUpBudgets(text, catchUp)) {
    yield* Console.log(`p${client.slot} predicted ms per catch-up callback over ${client.callbacks} callbacks: ${client.p50.toFixed(2)} p50, ${client.p95.toFixed(2)} p95, ${client.worst.toFixed(2)} worst (budget ${catchUp}); worst by confirmed+speculative frames: ${client.frames}`);
    if (client.over > 0) over.push(`p${client.slot} ${client.over} catch-up callbacks over ${catchUp} ms, worst ${client.worst.toFixed(2)}`);
  }
  if (over.length > 0) return yield* new PerfFailure({ problem: `over the frame budget: ${over.join("; ")}` });
});
