import { expect, test } from "bun:test";
import { presetTable } from "../scripts/perfWindowTable";

const spread = (p50: number, p95: number) => ({ p50, p95 });
const pressure = { psiStart: 31, psiEnd: 44, loadStart: 85, loadEnd: 97 };

test("a preset's table has a row per stage, a column per GPU pass any stage timed, and the CPU pressure of each run [k2 property]", () => {
  const table = presetTable("High", [
    { stage: "Blackrock", pressure, figures: { fps: 59.94, frameMs: spread(9.5, 14.25), stageMs: { sim: spread(3, 5), rollback: spread(0, 0), scene: spread(1.5, 2) }, encodeMs: spread(0.4, 0.6), parseMs: spread(0.2, 0.3), cpuEncodeMs: spread(1, 1.5), gpuPassMs: { frame: spread(4, 6), shadow: spread(1, 2) } } },
    { stage: "Naxxramas", pressure, figures: { error: "window closed\nmore" } },
  ]);
  const lines = table.split("\n");
  expect(lines[0]).toBe("### High");
  expect(lines[2]).toBe("| Stage | fps | frame | sim | rollback | scene | encode | parse | cpuEncode | gpu frame | gpu shadow | CPU PSI some avg10 | load 1 min |");
  expect(lines[4]).toBe("| Blackrock | 59.9 | 9.50 / 14.25 | 3.00 / 5.00 | 0.00 / 0.00 | 1.50 / 2.00 | 0.40 / 0.60 | 0.20 / 0.30 | 1.00 / 1.50 | 4.00 / 6.00 | 1.00 / 2.00 | 31% → 44% | 85 → 97 |");
  expect(lines[5]?.startsWith("| Naxxramas | failed: window closed |")).toBe(true);
  expect(lines[5]?.split("|").length).toBe(lines[2]?.split("|").length);
});
