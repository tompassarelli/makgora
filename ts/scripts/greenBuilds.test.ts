import { expect, test } from "bun:test";
import { type Verdict, farmVerdict, pickGreen } from "./wisp/greenBuilds";

test("green selection requires successful CI and exact Autoland landing or passed tree, preserving newer installs [k2 property]", () => {
  const sha = "a".repeat(40);
  const newer = "b".repeat(40);
  const tree = "c".repeat(40);
  const other = "d".repeat(40);
  const verdicts: readonly Verdict[] = ["success", "failure", "pending", "missing"];
  for (const ci of verdicts) {
    for (const state of ["SUCCESS", "PENDING", "FAILURE"]) {
      for (const landed of [sha, other]) {
        const farm = farmVerdict(sha, tree, "missing", [{ state, description: `landed as ${landed}` }], []);
        const candidate = { sha, ci, farm };
        const accepted = ci === "success" && state === "SUCCESS" && landed === sha;
        expect(pickGreen([candidate], [])).toEqual(accepted ? candidate : undefined);
        expect(pickGreen([{ sha: newer, ci: "pending", farm: "missing" }, candidate], [newer.slice(0, 7)])).toBeUndefined();
        expect(pickGreen([candidate], [sha.slice(0, 7)])).toBeUndefined();
      }
    }
    for (const passed of [tree, other]) {
      const farm = farmVerdict(sha, tree, "missing", [{ state: "PENDING", description: `passed alone on ${other} as tree ${passed}` }], []);
      const candidate = { sha, ci, farm };
      expect(pickGreen([candidate], [])).toEqual(ci === "success" && passed === tree ? candidate : undefined);
      expect(farmVerdict(sha, tree, "missing", [], [passed])).toBe(passed === tree ? "success" : "missing");
    }
  }
  for (const exact of verdicts.filter((verdict) => verdict !== "missing")) {
    expect(farmVerdict(sha, tree, exact, [{ state: "SUCCESS", description: `landed as ${sha}` }], [tree])).toBe(exact);
  }
  expect(farmVerdict(sha, tree, "missing", [{ state: "FAILURE", description: `passed alone on ${other} as tree ${tree}` }], [])).toBe("missing");
});
