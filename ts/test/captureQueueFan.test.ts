import { expect, test } from "bun:test";
import { fanGroups } from "../scripts/captureQueueFan";

test("eight clips folded into one group fan out over as many groups as there are pairs, splitting the widest group first [k2 property]", () => {
  const jobs = [1, 2, 3, 4, 5, 6, 7, 8];
  expect(fanGroups([{ commit: "a", jobs }], 3).map(group => group.jobs.length)).toEqual([2, 2, 4]);
  expect(fanGroups([{ commit: "a", jobs }], 8).map(group => group.jobs.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  expect(fanGroups([{ commit: "a", jobs: [1] }, { commit: "b", jobs: [2] }], 5).length).toBe(2);
  expect(fanGroups([{ commit: "a", jobs }], 1).map(group => group.jobs)).toEqual([jobs]);
  expect(fanGroups([{ commit: "a", jobs }], 2).every(group => group.commit === "a")).toBe(true);
});
