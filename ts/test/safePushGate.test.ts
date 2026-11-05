import { expect, test } from "bun:test";
import { join } from "node:path";

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
  expect(after).toContain("bun scripts/landingFarm.ts");
  expect(after).toContain("north code-health habits");
  expect(after.match(/cargo clippy --all-targets/g)?.length).toBe(2);
});
