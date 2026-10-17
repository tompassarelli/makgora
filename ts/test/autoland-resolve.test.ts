import { expect, test } from "bun:test";
import { CACHE_RECORDS, GENERATED_REPORTS, resolveConflicts } from "../scripts/autolandCore";

const RECORD = "ts/scripts/wisp/cue-models.tsv";

test("a Classic effect record conflict refuses the lane with the re-record command and never keeps a side [k1 scenario]", () => {
  expect(CACHE_RECORDS).toContain(RECORD);
  for (const others of [[], ["tools/move-data/advantage-state.md"], ["build-inputs/models"], ["ts/src/game/a.ts"]]) {
    const resolution = resolveConflicts([{ path: RECORD }, ...others.map((path) => ({ path }))]);
    expect(resolution.resolve).toBe(false);
    if (resolution.resolve) continue;
    expect(resolution.why).toContain(RECORD);
    expect(resolution.why).toContain("bun scripts/cueModels.ts --record from ts/");
  }
  const reports = resolveConflicts(GENERATED_REPORTS.map((path) => ({ path })));
  expect(reports.resolve && reports.reports).toEqual(GENERATED_REPORTS);
});
