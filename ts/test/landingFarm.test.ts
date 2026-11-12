import { expect, test } from "bun:test";
import { GROUPS } from "../scripts/landingChecks";
import { farmInputs, selectionPaths } from "../scripts/landingFarm";

test("the lander's rerun of a base commit, whose diff is empty, runs every check of every farm group instead of passing on none (north#1148) [k2 property]", () => {
  expect(farmInputs(selectionPaths([]), false)).toEqual({ checks: JSON.stringify(GROUPS), full: "1" });
  expect(farmInputs(selectionPaths(["docs/ci.md"]), false)).toEqual({ checks: JSON.stringify(["clean-room"]) });
});
