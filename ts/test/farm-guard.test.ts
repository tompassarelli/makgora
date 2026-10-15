import { expect, test } from "bun:test";
import { admit, liveness, type Facts } from "../scripts/farmGuard";

test("a memory soak runs on main, on its claude/ lane or on a farm/ scratch branch, and nowhere else [k2 property]", () => {
  const sha = "3468c669f770c1b560ab8af56b59e2880a79e8dc";
  const lanes = [undefined, "claude/leak-168", "farm/3468c669f770", "feature/leak-168", "farm/", "claude/"];
  for (const lane of lanes) {
    for (const bits of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const facts: Facts = { workflow: "memory", sha, onMain: (bits & 1) !== 0, revertedBy: (bits & 2) !== 0 ? "d9c32fc5b6d2" : undefined, lane, onLane: (bits & 4) !== 0 };
      const named = lane !== undefined && /^(claude|farm)\/[^/]/.test(lane);
      const live = (facts.onMain && facts.revertedBy === undefined) || (named && facts.onLane);
      expect(liveness(facts).live).toBe(live);
      const admission = admit({ ...facts, autoland: undefined });
      const scratch = lane === undefined && !facts.onMain;
      expect(admission.kind).toBe(live ? "dispatch" : scratch ? "scratch" : "refuse");
    }
  }
});
