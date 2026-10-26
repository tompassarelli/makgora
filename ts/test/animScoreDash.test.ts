import { expect, test } from "bun:test";
import { type MoveClass, type MoveSample, type ScoreFrame, THRESHOLDS, scoreMove } from "../scripts/wisp/animScore";

const pose = (frame: number, shoulder: number, reach: number): ScoreFrame => {
  const hand = shoulder + reach;
  return {
    frame,
    vertices: Float32Array.from([shoulder - 10, 0, shoulder + 10, 0, shoulder, 80, hand - 2, 46, hand - 2, 50, hand, 48]),
    drawn: Uint8Array.from([1, 1, 1, 1, 1, 1]),
    faces: Uint32Array.from([0, 1, 2, 3, 4, 5]),
    nodes: Float32Array.from([shoulder, 48, hand - 1, 48]),
  };
};

const RETURN = [20, 10, 0, 10, 20, 20, 20, 20];
const THRUST = [20, 10, 0, 15, 30, 30, 30, 30];

const sample = (moveClass: MoveClass, shoulders: readonly number[], reach: readonly number[]): MoveSample => ({
  moveClass,
  limbStrike: false,
  frames: shoulders.map((shoulder, frame) => pose(frame, shoulder, reach[frame] ?? 20)),
  moveFrames: shoulders.length,
  ready: pose(0, 0, 20),
  skeleton: { names: ["shoulder", "hand"], pelvis: undefined, chest: undefined, limbs: [{ name: "arm right", root: 0, end: 1 }] },
  firstActive: 4,
  lastActive: 5,
  hits: [4],
  strike: { x: 60, z: 48 },
  pixelsPerUnit: 1,
});

const DRIVEN = [0, -4, -6, 2, 14, 14, 14, 14];
const PLANTED = [0, 0, 0, 0, 0, 0, 0, 0];

test("a dash attack may draw its weapon back past the shoulder in the windup, while a tilt may not [k3 measure docs/animation-scorecard.md]", () => {
  const dash = scoreMove(sample("dash-attack", DRIVEN, RETURN), THRESHOLDS["dash-attack"]).line1;
  const tilt = scoreMove(sample("tilt", DRIVEN, RETURN), THRESHOLDS.tilt).line1;
  expect(dash.bodyShare).toBeCloseTo(1, 5);
  expect(dash.pass).toBe(true);
  expect(tilt.bodyShare).toBeCloseTo(0.5, 5);
  expect(tilt.pass).toBe(false);
});

test("a dash attack whose body does not travel still fails line 1 [k2 property]", () => {
  const line1 = scoreMove(sample("dash-attack", PLANTED, THRUST), THRESHOLDS["dash-attack"]).line1;
  expect(line1.bodyShare).toBe(0);
  expect(line1.pass).toBe(false);
});
