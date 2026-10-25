import { expect, test } from "bun:test";
import { checkRadii, meleeBands } from "../scripts/moveRadius";

const jab = meleeBands().find((b) => b.move === "jab")!;
const row = (relative: number) => ({ fighter: "rifleman", move: "jab", radius: relative * 88, shield: 88, relative, band: jab, pass: relative >= jab.low && relative <= jab.high }) as const;

test("Melee's jab band sits around the 3.9-unit median radius with an ordered interquartile range [k4 reference references/melee-frame-data/libmelee.jsonl]", () => {
  expect(jab.radius).toBeCloseTo(3.9, 1);
  expect(jab.low).toBeLessThan(jab.median);
  expect(jab.median).toBeLessThan(jab.high);
});

test("an out-of-band move fails unless an exception names its fighter and move [k2 property]", () => {
  const thin = row(jab.low / 2);
  expect(checkRadii([thin], []).failures).toEqual([thin]);
  expect(checkRadii([thin], [{ fighter: "rifleman", moves: ["forward tilt"], issue: "#320", reason: "test" }]).failures).toEqual([thin]);
  expect(checkRadii([thin], [{ fighter: "rifleman", moves: ["jab"], issue: "#320", reason: "test" }]).excused).toEqual([thin]);
});

test("an exception for an in-band move is stale [k2 property]", () => {
  expect(checkRadii([row(jab.median)], [{ fighter: "rifleman", moves: ["jab"], issue: "#320", reason: "test" }]).stale).toEqual([{ fighter: "rifleman", move: "jab" }]);
});
