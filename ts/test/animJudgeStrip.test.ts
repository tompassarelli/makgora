import { expect, test } from "bun:test";
import { JUDGE_PART_TILES, judgeParts } from "../scripts/wisp/animJudgeStrip";

test("a judge strip splits into images of at most JUDGE_PART_TILES panels, so a long move's panels reach the judge at the same size [k2 property]", () => {
  for (let count = 1; count <= 20; count++) {
    const parts = judgeParts(count);
    expect(parts.flat()).toEqual(Array.from({ length: count }, (_, index) => index));
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(JUDGE_PART_TILES);
    }
  }
  expect(judgeParts(6)).toEqual([[0, 1, 2, 3, 4, 5]]);
  expect(judgeParts(11)).toEqual([[0, 1, 2, 3, 4, 5], [6, 7, 8, 9, 10]]);
});
