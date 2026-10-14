import { expect, test } from "bun:test";
import { classify, trueSegments, planMatches, runPlaytest, type Observation } from "../scripts/playtestCore";
import { playReal, ROSTER } from "../scripts/playtest";
import { sweep } from "./sweep";
import { LAVA_HIT } from "../src/game/sim/lava";

test("direct tech reads retain the grab into forward-tilt true combo [k1 scenario]", () => {
  const spec = [
    { index: 0, seed: 0, a: "blademaster", b: "peon", stage: "arena", tier: "expert" },
    { index: 1, seed: 0, a: "peon", b: "blademaster", stage: "arena", tier: "expert" },
  ];
  const observations: Observation[] = [
    {
      frames: 120, ended: true, winner: null, timedOut: false, stockLosses: 0,
      strings: [], checksums: [[120, "tech-read"]], kos: [], uses: [], quiet: { from: 0, frames: 0 },
      combos: [{ victim: 1, frame: 120, start: 0, moves: ["forward-tilt", "up-tilt", "jab", "forward-tilt"], instances: [1, 2, 3, 4], damages: [12, 12, 12, 12], gaps: [1, 8, 1] }],
    },
    {
      frames: 120, ended: true, winner: null, timedOut: false, stockLosses: 0,
      strings: [], checksums: [[120, "grab-chain"]], kos: [], uses: [], quiet: { from: 0, frames: 0 },
      combos: [{ victim: 1, frame: 120, start: 0, moves: ["grab", "grab", "forward-tilt", "up-tilt"], instances: [1, 1, 2, 3], damages: [3, 7, 12, 12], gaps: [0, 0, 1] }],
    },
  ];
  const runs = runPlaytest(spec, (match) => observations[match.index] ?? (() => { throw new Error("missing direct fight log"); })(), 120, true, () => 0);
  expect(classify(runs).filter((finding) => finding.kind === "infinite-combo" || finding.kind === "desync")).toEqual([]);
  expect(runs[1]?.first.combos.flatMap(trueSegments).some((segment) => segment.moves.join(",") === "grab,forward-tilt")).toBe(true);
  expect(runs[0]?.first.combos.flatMap(trueSegments).map((segment) => segment.moves)).toEqual([["forward-tilt"], ["up-tilt"], ["jab"], ["forward-tilt"]]);
  expect(runs[1]?.first.combos.flatMap(trueSegments)).toEqual([
    { moves: ["grab", "forward-tilt"], damage: 22, percent: 0 },
    { moves: ["up-tilt"], damage: 12, percent: 22 },
  ]);
});

sweep("the seven recorded #424 seeds and #461 seed 799 distinguish terrain hits, tech reads and missed techs from guaranteed fighter chains [k1 scenario]", () => {
  for (const [seed, cap] of [[6, 6765], [14, 4264], [19, 1348], [24, 686], [31, 3564], [43, 3347], [47, 5688], [799, 683]]) {
    const runs = runPlaytest(planMatches(ROSTER, seed ?? 0, 1), playReal, cap ?? 0, true, () => 0);
    expect(classify(runs).filter((finding) => finding.kind === "infinite-combo" || finding.kind === "desync")).toEqual([]);
    if (seed === 19) expect(runs[0]?.first.combos.flatMap((combo) => combo.damages).includes(LAVA_HIT.damage)).toBe(false);
  }
}, 60000);
