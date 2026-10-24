import { expect, test } from "bun:test";
import { ATTESTED, type Lane, attestation, passedDescription, plan, train } from "../scripts/autolandCore";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const BASE = "a".repeat(40);
const TREE = "b".repeat(40);
const lane = (name: string, denylist: string | null | undefined, description = "queued"): Lane => ({
  branch: `claude/${name}`,
  tip: name.padEnd(40, "0").replace(/[^0-9a-f]/g, "0"),
  status: { state: "pending", description, at: "2026-10-24T11:58:00Z" },
  ...(denylist === undefined ? {} : { denylist }),
});

test("a claude/ tip is tested only on a denylist success, refused on failure and held while missing or pending [k2 property]", () => {
  expect(attestation("success")).toBe("test");
  expect(attestation("failure")).toBe("refuse");
  for (const state of [null, undefined, "", "pending", "error"]) expect(attestation(state)).toBe("hold");
  expect(ATTESTED.refuse).toEqual({ state: "failure", description: "deny-list refused: reword and push again" });
  expect(ATTESTED.hold).toEqual({ state: "pending", description: "waiting for the deny-list attestation" });

  const lanes = [lane("clean", "success"), lane("refused", "failure"), lane("pending", "pending"), lane("missing", undefined), lane("unset", null)];
  const result = plan(lanes, [], NOW);
  expect(result.test.map((order) => order.branch)).toEqual(["claude/clean"]);
  expect(Object.fromEntries(result.attest.map((order) => [order.branch, order.verdict]))).toEqual({
    "claude/refused": "refuse",
    "claude/pending": "hold",
    "claude/missing": "hold",
    "claude/unset": "hold",
  });

  const waiting = plan([lane("pending", "pending", ATTESTED.hold.description)], [], NOW);
  expect(waiting).toEqual({ test: [], attest: [], train: false });
});

test("a train and its plan take only passed-alone tips that carry a denylist success [k2 property]", () => {
  const passed = passedDescription(BASE, TREE);
  const lanes = [lane("clean", "success", passed), lane("stale", "pending", passed), lane("refused", "failure", passed)];
  expect(train(lanes, NOW).map((entry) => entry.branch)).toEqual(["claude/clean"]);
  expect(plan(lanes, [], NOW).train).toBe(true);
  expect(plan(lanes.slice(1), [], NOW)).toMatchObject({ train: false, attest: [{ branch: "claude/refused", verdict: "refuse" }, { branch: "claude/stale", verdict: "hold" }] });
});
