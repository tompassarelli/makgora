import { expect, test } from "bun:test";
import { judgementsNeeded } from "../scripts/wisp/animJudgeIdentity";

const clear = [5, 5, 5, 3, 5], borderline = [5, 4, 5, 5, 5];

test("a first judgement clear of the 4/5 bar on every line decides the clip alone [k3 measure docs/animation-scorecard.md]", () => {
  expect(judgementsNeeded([clear], 4)).toBe(1);
  expect(judgementsNeeded([[5, 5, 5, 5, 5]], 4)).toBe(1);
  expect(judgementsNeeded([[2, 3, 3, 2, 3]], 4)).toBe(1);
});

test("a first judgement within half a point of the bar on any line asks for three, and an old three-judge panel stays at three [k3 measure docs/animation-scorecard.md]", () => {
  expect(judgementsNeeded([borderline], 4)).toBe(3);
  expect(judgementsNeeded([borderline, clear], 4)).toBe(3);
  expect(judgementsNeeded([clear, clear, clear], 4)).toBe(3);
});

test("a clip with no judgement needs one [k3 measure docs/animation-scorecard.md]", () => {
  expect(judgementsNeeded([], 4)).toBe(1);
});
