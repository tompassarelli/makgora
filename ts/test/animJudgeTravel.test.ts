import { expect, test } from "bun:test";
import { clipIdentity } from "../scripts/wisp/animJudgeIdentity";
import type { ScoreFrame } from "../scripts/wisp/animScore";

const pose = (frame: number): ScoreFrame => ({ frame, vertices: Float32Array.from([-10, 0, 10, 0, 0, 80]), drawn: Uint8Array.from([1, 1, 1]), faces: Uint32Array.from([0, 1, 2]) });
const poses = [pose(0), pose(1), pose(2)];

test("a clip drawn in place keeps its identity, and a travelling clip gets a new one per distance [k2 property]", () => {
  const still = clipIdentity(poses, [0, 0, 0], "framing");
  expect(clipIdentity(poses, [0, 0.01, 0], "framing")).toBe(still);
  const slide = clipIdentity(poses, [0, 24, 48], "framing");
  expect(slide).not.toBe(still);
  expect(clipIdentity(poses, [0, 24, 60], "framing")).not.toBe(slide);
});
