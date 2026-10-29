import { expect, test } from "bun:test";
import { CACHE_RECORDS, GENERATED_REPORTS, type Tree, landing, pastMain } from "../scripts/autolandCore";

const SOURCE = ["ts/src/sim/fighter.ts", "ts/scripts/wisp/cues.ts", "docs/gameplay-design.md"];
const GENERATED = [...GENERATED_REPORTS, ...CACHE_RECORDS];
const BASE: Tree = new Map([...SOURCE, ...GENERATED].map((path) => [path, `base ${path}`]));
const edit = (tree: Tree, paths: readonly string[], side: string): Tree => new Map([...tree, ...paths.map((path): [string, string] => [path, `${side} ${path}`])]);

function round(lane: readonly string[], moved: readonly string[], merges: boolean) {
  const tested = edit(BASE, lane, "lane");
  const main = edit(BASE, moved, "main");
  const shared = lane.filter((path) => moved.includes(path));
  const landed = edit(edit(main, lane.filter((path) => !shared.includes(path)), "lane"), shared, merges ? "merged" : "main");
  return { tested, main, landed, shared };
}

test("a passed-alone tip whose only overlap with main is generated reports or cache records lands on their merged rows, while any shared source path retests [k2 property]", () => {
  const paths = [...SOURCE, ...GENERATED];
  let cases = 0;
  for (let laneMask = 1; laneMask < 1 << paths.length; laneMask += 7) {
    for (let mainMask = 1; mainMask < 1 << paths.length; mainMask += 11) {
      const lane = paths.filter((_, bit) => laneMask & (1 << bit));
      const moved = paths.filter((_, bit) => mainMask & (1 << bit));
      const { tested, main, landed, shared } = round(lane, moved, true);
      const sourceShared = shared.some((path) => SOURCE.includes(path));
      const expected = sourceShared ? "retest" : "land";
      expect(pastMain(BASE, tested, [main], landed)).toBe(expected);
      expect(landing(true, BASE, tested, [main], landed)).toBe(sourceShared ? "passed" : "land");
      expect(landing(false, BASE, tested, [main], landed)).toBe(sourceShared ? "wait" : "land");
      cases++;
    }
  }
  expect(cases).toBeGreaterThan(100);

  const cue = round(["ts/src/sim/fighter.ts", ...CACHE_RECORDS], ["docs/gameplay-design.md", ...CACHE_RECORDS], true);
  expect(pastMain(BASE, cue.tested, [cue.main], cue.landed)).toBe("land");
  const dropped = new Map(cue.landed);
  dropped.set("ts/src/sim/fighter.ts", "base ts/src/sim/fighter.ts");
  expect(pastMain(BASE, cue.tested, [cue.main], dropped)).toBe("retest");
  expect(pastMain(BASE, cue.tested, [cue.main], undefined)).toBe("retest");
  const autoland = round(["ts/scripts/wisp/cue-models.tsv"], ["ts/scripts/autolandCore.ts"], true);
  expect(pastMain(BASE, autoland.tested, [edit(BASE, ["ts/scripts/autolandCore.ts"], "main")], autoland.landed)).toBe("retest");
});
