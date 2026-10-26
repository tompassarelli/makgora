import { expect, test } from "bun:test";
import { JUDGE_MAX_GAP, hitStarts, judgeKeyFrames } from "../scripts/wisp/animJudgeFrames";

const keys = { windup: 4, contact: 9, lastActive: 33, recovery: 39, end: 45, hitWindups: [] };

test("a hit starts on each frame that opens a hit window, and a held window starts none [k2 property]", () => {
  const open = (first: number, last: number, window: number) => (frame: number) => frame >= first && frame <= last ? [window] : [];
  const windows = [open(9, 10, 1), open(12, 13, 2), open(15, 16, 3), open(24, 33, 4)];
  const frames = Array.from({ length: 46 }, (_, frame) => windows.flatMap((window) => window(frame)));
  expect(hitStarts(frames)).toEqual([9, 12, 15, 24]);
  expect(hitStarts(Array.from({ length: 20 }, (_, frame) => frame >= 6 && frame <= 12 ? [1, 2] : []))).toEqual([6]);
  expect(hitStarts([[1], [1, 2], [2], [2]])).toEqual([0, 1]);
});

test("a judge strip adds every hit's contact frame and each later hit's windup for a multi-hit move, and fills the frames from contact to end at most JUDGE_MAX_GAP apart [k2 property]", () => {
  const filled = [0, 4, 9, 15, 21, 27, 33, 39, 45];
  expect(judgeKeyFrames({ ...keys, hits: [] })).toEqual(filled);
  expect(judgeKeyFrames({ ...keys, hits: [9] })).toEqual(filled);
  const hits = [9, 12, 15, 18, 21, 24];
  const strip = judgeKeyFrames({ ...keys, hits });
  expect(strip).toEqual([0, 4, 9, 12, 15, 18, 21, 24, 29, 33, 39, 45]);
  for (const hit of hits) expect(strip).toContain(hit);
  expect(judgeKeyFrames({ windup: 0, contact: 2, lastActive: 2, recovery: 5, end: 5, hits: [2, 2], hitWindups: [] })).toEqual([0, 2, 5]);
  const windups = judgeKeyFrames({ ...keys, hits: [9, 24], hitWindups: [17] });
  expect(windups).toEqual([0, 4, 9, 13, 17, 21, 24, 29, 33, 39, 45]);
  expect(judgeKeyFrames({ ...keys, hits: [9], hitWindups: [17] })).toEqual(filled);
  for (const frames of [filled, strip, windups]) frames.slice(frames.indexOf(keys.contact)).forEach((frame, index, after) => expect((after[index + 1] ?? frame) - frame).toBeLessThanOrEqual(JUDGE_MAX_GAP));
});
