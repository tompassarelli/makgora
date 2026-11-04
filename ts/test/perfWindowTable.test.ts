import { expect, test } from "bun:test";
import { MEASURED_FROM, logFigures, onlineFigures, onlineTable, presetTable, spreadOf } from "../scripts/perfWindowTable";

const spread = (p50: number, p99: number, max: number) => ({ p50, p99, max });
const pressure = { psiStart: 31, psiEnd: 44, loadStart: 85, loadEnd: 97 };
const log = { lateScenes: [0, 2, 5], ticksPerSecond: [60, 59.8, 60], workerGcCycles: 1, workerGcPausesMs: [0.5, 1.5] };

test("a preset's table has a row per stage, a column per GPU pass any stage timed, the pacing, the worker's collector and the CPU pressure of each run [k2 property]", () => {
  const table = presetTable("High", [
    { stage: "Blackrock", pressure, log, figures: { fps: 59.94, frameMs: spread(9.5, 14.25, 20), intervalMs: spread(16.6, 17, 33), stageMs: { sim: spread(3, 5, 6), rollback: spread(0, 0, 0), scene: spread(1.5, 2, 3) }, encodeMs: spread(0.4, 0.6, 1), parseMs: spread(0.2, 0.3, 0.5), cpuEncodeMs: spread(1, 1.5, 2), gpuPassMs: { frame: spread(4, 6, 7), shadow: spread(1, 2, 3) } } },
    { stage: "Naxxramas", pressure, log, figures: { error: "window closed\nmore" } },
  ]);
  const lines = table.split("\n");
  expect(lines[0]).toBe("### High");
  expect(lines[2]).toBe("| Stage | fps | step+encode | sim | rollback | scene | encode | parse | cpuEncode | gpu frame | gpu shadow | interval | late / 300 ticks | ticks/s min | worker GC cycles | worker GC pauses | worker GC pause | CPU PSI some avg10 | load 1 min |");
  expect(lines[4]).toBe("| Blackrock | 59.9 | 9.50 / 14.25 / 20.00 | 3.00 / 5.00 / 6.00 | 0.00 / 0.00 / 0.00 | 1.50 / 2.00 / 3.00 | 0.40 / 0.60 / 1.00 | 0.20 / 0.30 / 0.50 | 1.00 / 1.50 / 2.00 | 4.00 / 6.00 / 7.00 | 1.00 / 2.00 / 3.00 | 16.60 / 17.00 / 33.00 | 2 / 5 / 5 | 59.8 | 1 | 2 | 0.50 / 1.50 / 1.50 | 31% → 44% | 85 → 97 |");
  expect(lines[5]?.startsWith("| Naxxramas | failed: window closed |")).toBe(true);
  expect(lines[5]?.split("|").length).toBe(lines[2]?.split("|").length);
});

test("a run's log gives late scenes and ticks/s from every pulse but the first, and only the step worker's collector cycles and pauses, after the warmup marker [k2 property]", () => {
  const pulse = (ticks: number, late: number) => `wisp-window: 118.2 frames/s (frame p50 8.3 ms, p99 9.1 ms, worst 12.0 ms), ${ticks} ticks/s, acquire p99 0.1 ms, draw p99 4.0 ms, gpu p99 3.2 ms, ${late} late scenes, 0 dropped samples over 5.0 s`;
  const start = (heap: string, pause: number) => `[GC<${heap}>: START M 256216kb => EdenCollection, a=0kb hf=0.000 o=119 b=3960 i#1:N<CsMsrShDMsm(3960)> 3171+3960 p=${pause}ms (max 71.7)...]`;
  const more = (heap: string, pause: number) => `[GC<${heap}>: M a=122kb hf=0.002 mu=0.599 v=286kb (C:194 M:92) o=119 b=0 0+0 p=${pause}ms (max 71.7)...]`;
  const text = [start("0xa", 9), start("0xb", 7), pulse(40, 300), MEASURED_FROM, start("0xa", 4), pulse(10, 90), `${start("0xb", 1.25)}${pulse(60, 3)}`, more("0xb", 0.5), "[GC<0xb>: finalize ", more("0xb", 2.5), pulse(59.9, 0)].join("\n");
  expect(logFigures(text)).toEqual({ lateScenes: [3, 0], ticksPerSecond: [60, 59.9], workerGcCycles: 1, workerGcPausesMs: [1.25, 0.5, 2.5] });
  expect(logFigures("").workerGcPausesMs).toEqual([]);
  expect(spreadOf([3, 1, 2])).toEqual(spread(2, 3, 3));
  expect(spreadOf([])).toBeUndefined();
});

test("an online window's log gives its rollback depth from the map's playback line and the agreed round trip, delay and checksums from its summary line, and the table counts rollbacks per second of match, mispredicted frames, steps held at the window edge, corrections that moved a fighter past 20 units and drawn jumps past 20 units [k2 property]", () => {
  const text = [
    "net: fighter selection with 2 players at frame 30",
    `net: rollback ${JSON.stringify({ window: 12, delay: 2, depth: { n: 900, p50: 7, p95: 9, p99: 10, max: 12 }, lead: { n: 1, p50: 0, p95: 0, p99: 0, max: 0 }, leadInsideWindow: 1, stalls: 31, pops: { over: 4, max: 57 }, visible: { over: 1, max: 24 }, mispredicted: 225 })}`,
    JSON.stringify({ fps: 59, net: { checksumsCompared: 44, mismatches: 0, rttMs: 301, delay: 10 } }),
  ].join("\n");
  const online = onlineFigures(text);
  expect(online).toEqual({ depth: { n: 900, p50: 7, p95: 9, p99: 10, max: 12 } as never, delay: 2, window: 12, stalls: 31, pops: { over: 4, max: 57 }, visible: { over: 1, max: 24 }, mispredicted: 225, checksumsCompared: 44, mismatches: 0, rttMs: 301 });
  const lines = onlineTable([{ label: "Blackrock 300 ms join", matchFrames: 4500, online, log }, { label: "Blackrock 0 ms host", matchFrames: 4500, online: onlineFigures(""), log }]).split("\n");
  expect(lines[2]).toBe("| Blackrock 300 ms join | 301 | 2 / 12 | 7 / 10 / 12 | 12.00 | 3.00 | 31 | 4 / 57 | 1 / 24 | 2 / 5 / 5 | 44 | 0 |");
  expect(lines[3]).toBe("| Blackrock 0 ms host | – | – | – | – | – | – | – | – | 2 / 5 / 5 | – | – |");
});
