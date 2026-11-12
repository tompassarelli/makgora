import { expect, test } from "bun:test";
import { join } from "node:path";
import { GROUPS } from "../scripts/landingChecks";

const root = join(import.meta.dir, "../..");
const values = (key: string): string[] => {
  const read = Bun.spawnSync(["git", "config", "-f", join(root, ".safe-push"), "--get-all", key]);
  return new TextDecoder().decode(read.stdout).split("\n").filter((line) => line !== "");
};
const commands = (key: string) => values(key).map((entry) => entry.split(" :: ").slice(1).join(" :: "));

test("the lander pushes after only the seconds-long checks and runs the farm, code-health and clippy checks after the push [k5 boundary safe-push-landing]", () => {
  expect(values("land.check-local")).toEqual(["true"]);
  expect(commands("land.check")).toEqual(["cd ts && bun scripts/suiteParity.ts"]);
  const after = commands("land.after").join("\n");
  expect(after).toContain("north land dispatch farm");
  expect(values("dispatch.farm.command")).toEqual(["cd ts && bun scripts/landingFarm.ts"]);
  expect(values("dispatch.farm.workflow")).toEqual(["farm-test.yml"]);
  const allowed = values("dispatch.farm.input").find((input) => input.startsWith("checks "))?.slice("checks ".length) ?? "";
  expect(JSON.stringify(GROUPS)).toMatch(new RegExp("^(?:" + allowed + ")$"));
  expect(after).toContain("north code-health habits");
  expect(after.match(/cargo clippy --all-targets/g)?.length).toBe(2);
});
