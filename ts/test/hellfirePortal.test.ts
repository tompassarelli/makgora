import { expect, test } from "bun:test";
import { stageScenery } from "../src/game/presentation/stageScenery";
import { HELLFIRE_STAGE } from "../src/game/sim/stage";
import { REFORGED_BOUNDS, clearingProblems } from "../scripts/stageViewRules";

const SPIRES = "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx";

test("Hellfire's Dark Portal stands at the centre behind the deck and no piece in front of it, measured at its Reforged size, covers it at either camera extreme [k2 property]", () => {
  const { pieces } = stageScenery(HELLFIRE_STAGE);
  const gate = pieces.find(piece => piece.model in REFORGED_BOUNDS && piece.model.toLowerCase().startsWith("buildings\\"));
  expect(gate?.x).toBe(0);
  expect(clearingProblems(HELLFIRE_STAGE, "Hellfire", pieces)).toEqual([]);
});

test("a Reforged-sized spire in front of the portal is reported at both camera extremes, so the clearing rule is not vacuous [k2 property]", () => {
  const { pieces } = stageScenery(HELLFIRE_STAGE);
  const covering = { model: SPIRES, x: -200.0, y: 4700.0, z: -1387.0, scale: 5.25, yaw: 185.0, matrixScale: [1.75, 1.0, 0.75] as const };
  const problems = clearingProblems(HELLFIRE_STAGE, "Hellfire", [...pieces, covering]);
  expect(problems.map(problem => problem.split(":")[0])).toEqual(["Hellfire near", "Hellfire far"]);
});
