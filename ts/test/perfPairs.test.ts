import { expect, test } from "bun:test";
import { PAIR_MARGIN, comparePairs } from "../scripts/wisp/perfPairs";

const prior = [
  { pair: "peon vs rifleman", instructions: 200_000, allocatedKb: 25 },
  { pair: "warden vs rifleman", instructions: 250_000, allocatedKb: 30 },
];
const edge = (costliest: number) => costliest * (1 + PAIR_MARGIN);

test("a fighter added since the prior passes within the margin of the prior's costliest pair [k3 measure #682]", () => {
  expect(comparePairs(prior, [{ pair: "archimonde vs rifleman", instructions: Math.floor(edge(250_000)), allocatedKb: edge(30) - 0.1 }])).toEqual([]);
});

test("a fighter added since the prior fails over the margin of the prior's costliest pair [k3 measure #682]", () => {
  const problems = comparePairs(prior, [{ pair: "archimonde vs rifleman", instructions: Math.ceil(edge(250_000)) + 1, allocatedKb: edge(30) + 0.1 }]);
  expect(problems).toHaveLength(2);
  expect(problems[0]).toStartWith("archimonde vs rifleman worst-frame instructions 250000 -> ");
  expect(problems[1]).toStartWith("archimonde vs rifleman worst-frame allocation 30.0 -> ");
  for (const problem of problems) expect(problem).toEndWith("over the fixture's costliest pair)");
});
