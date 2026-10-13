import { expect, test } from "bun:test";
import { classify, trueSegments, planMatches, runPlaytest } from "../scripts/playtestCore";
import { playReal, ROSTER } from "../scripts/playtest";
import { sweep } from "./sweep";
import { LAVA_HIT } from "../src/game/sim/lava";

test("seeds 6 and 277 separate tech reads while retaining the real grab into forward-tilt combo [k1 scenario]", () => {
  const spec = [...planMatches(ROSTER, 6, 1), ...planMatches(ROSTER, 277, 1)];
  const runs = runPlaytest(spec, playReal, 1056, true, () => 0);
  expect(classify(runs).filter((finding) => finding.kind === "infinite-combo" || finding.kind === "desync")).toEqual([]);
  expect(runs[1]?.first.combos.flatMap(trueSegments).some((segment) => segment.moves.join(",") === "grab,forward-tilt")).toBe(true);
});

sweep("the seven recorded #424 seeds and #461 seed 799 distinguish terrain hits, tech reads and missed techs from guaranteed fighter chains [k1 scenario]", () => {
  for (const [seed, cap] of [[6, 6765], [14, 4264], [19, 1348], [24, 686], [31, 3564], [43, 3347], [47, 5688], [799, 683]]) {
    const runs = runPlaytest(planMatches(ROSTER, seed ?? 0, 1), playReal, cap ?? 0, true, () => 0);
    expect(classify(runs).filter((finding) => finding.kind === "infinite-combo" || finding.kind === "desync")).toEqual([]);
    if (seed === 19) expect(runs[0]?.first.combos.flatMap((combo) => combo.damages).includes(LAVA_HIT.damage)).toBe(false);
  }
}, 60000);
