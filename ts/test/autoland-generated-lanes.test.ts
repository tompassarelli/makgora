import { expect, test } from "bun:test";
import { generatedCode, resolveConflicts } from "../scripts/autolandCore";

for (const role of ["AUTHOR", "COMMITTER"]) {
  process.env[`GIT_${role}_NAME`] = "lane";
  process.env[`GIT_${role}_EMAIL`] = "lane@example.invalid";
}

const GENERATED = "ts/src/generated/state/fighterState.ts";





test("a conflict in the state or fighter-art tables resolves only when no source file conflicts beside it [k2 property]", () => {
  const tables = [GENERATED, "ts/src/generated/state/fighterDifference.ts", "ts/src/generated/fighterArtData.ts", "ts/src/generated/fighter-art/chen.ts", "ts/src/generated/strikes/heroStrikeMomentInfo.ts"];
  for (const path of tables) expect(generatedCode(path)).toBe(true);
  for (const path of ["ts/src/generated/assets/white-facts/chen.ts", "ts/src/generated/clips/chen.ts", "ts/src/game/sim/state/fighterSchema.ts"]) expect(generatedCode(path)).toBe(false);
  expect(resolveConflicts(tables.map((path) => ({ path })))).toMatchObject({ resolve: true, code: tables });
  const beside = resolveConflicts([{ path: GENERATED }, { path: "ts/src/game/sim/state/fighterSchema.ts" }]);
  expect(beside).toEqual({ resolve: false, why: "ts/src/game/sim/state/fighterSchema.ts is not generated; Autoland never resolves source" });
});
