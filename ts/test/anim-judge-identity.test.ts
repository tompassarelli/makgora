import { expect, test } from 'bun:test';
import { clipIdentity, currentJudgements } from '../scripts/wisp/animJudgeIdentity';
import type { ScoreFrame } from '../scripts/wisp/animScore';

const frame = (...vertices: number[]): ScoreFrame => ({ frame: 0, vertices: new Float32Array(vertices), drawn: new Uint8Array(0) } as unknown as ScoreFrame);

test("line 5 counts only judgements of the clip the scorecard samples now: a replaced clip's judgements drop out once any judgement names a clip, and unnamed ones count until then [k2 property]", () => {
  const before = clipIdentity([frame(0, 0, 10, 20), frame(5, 5, 30, 40)]);
  const after = clipIdentity([frame(0, 0, 10, 20), frame(5, 5, 60, 40)]);
  expect(clipIdentity([frame(0, 0, 10.001, 20), frame(5, 5, 30, 40)])).toBe(before);
  expect(after).not.toBe(before);
  const legacy = { judge: 'old', clip: undefined }, stale = { judge: 'stale', clip: before }, fresh = { judge: 'fresh', clip: after };
  expect(currentJudgements([legacy], after)).toEqual([legacy]);
  expect(currentJudgements([legacy, stale, fresh], after)).toEqual([fresh]);
  expect(currentJudgements([legacy, stale], after)).toEqual([]);
});
