import { expect, test } from "bun:test";
import { depthRanks } from "../scripts/wisp/rollbackSpike";

test("a rollback depth histogram ranks its p50, p99 and deepest correction, and an empty one ranks 0 [k1 scenario]", () => {
  expect(depthRanks([0, 0, 0, 0, 0, 0, 0, 0, 0])).toEqual({ rollbacks: 0, p50: 0, p99: 0, max: 0 });
  expect(depthRanks([0, 60, 30, 0, 9, 0, 0, 1, 0])).toEqual({ rollbacks: 100, p50: 1, p99: 4, max: 7 });
  expect(depthRanks([0, 0, 0, 0, 5])).toEqual({ rollbacks: 5, p50: 4, p99: 4, max: 4 });
});
