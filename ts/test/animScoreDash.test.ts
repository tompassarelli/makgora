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
  regions: [],
  pixelsPerUnit: 1,
});

const DRIVEN = [0, -4, -6, 2, 14, 14, 14, 14];
const PLANTED = [0, 0, 0, 0, 0, 0, 0, 0];

test("a dash attack measured from its windup passes with its weapon drawn back past the shoulder, while a tilt does not [k3 measure docs/animation-scorecard.md]", () => {
  const dash = scoreMove(sample("dash-attack", DRIVEN, RETURN), THRESHOLDS["dash-attack"]).line1;
  const tilt = scoreMove(sample("tilt", DRIVEN, RETURN), THRESHOLDS.tilt).line1;
  expect(dash.bodyShare).toBeCloseTo(0.5, 5);
  expect(dash.pass).toBe(true);
  expect(tilt.bodyShare).toBeCloseTo(0.5, 5);
  expect(tilt.pass).toBe(false);
});

test("a dash attack whose body does not travel still fails line 1 [k2 property]", () => {
  const line1 = scoreMove(sample("dash-attack", PLANTED, THRUST), THRESHOLDS["dash-attack"]).line1;
  expect(line1.bodyShare).toBe(0);
  expect(line1.pass).toBe(false);
});

const span = (length: number, from: number, to: number) => Array.from({ length }, (_, step) => from + ((to - from) * (step + 1)) / length);
const held = (moveClass: MoveClass, shoulders: readonly number[], reach: readonly number[]): MoveSample => ({ ...sample(moveClass, shoulders, reach), lastActive: 15 });
const CARRIED = { shoulders: [0, -4, -6, -2, ...span(12, 2, 26), ...span(16, 26, 0)], reach: [20, 10, 0, 10, ...span(12, 30, 30), ...span(16, 30, 20)] };
const FROZEN = { shoulders: [0, -4, -6, -2, ...span(17, 13, 13), ...span(11, 13, 0)], reach: [20, 10, 0, 10, ...span(17, 30, 30), ...span(11, 30, 20)] };
const SNAPPED = { shoulders: [...CARRIED.shoulders.slice(0, 16), ...span(3, 26, 0), ...span(13, 0, 0)], reach: [...CARRIED.reach.slice(0, 16), ...span(3, 30, 20), ...span(13, 20, 20)] };

test("a dash attack passes line 3 when it carries through its active window and returns evenly, and fails when it freezes or snaps back [k3 measure docs/animation-scorecard.md]", () => {
  const carried = scoreMove(held("dash-attack", CARRIED.shoulders, CARRIED.reach), THRESHOLDS["dash-attack"]).line3;
  expect(carried.peak).toBe(15);
  expect(carried.pass).toBe(true);
  const frozen = scoreMove(held("dash-attack", FROZEN.shoulders, FROZEN.reach), THRESHOLDS["dash-attack"]).line3;
  expect(frozen.held).toBeGreaterThan(9);
  expect(frozen.pass).toBe(false);
  const snapped = scoreMove(held("dash-attack", SNAPPED.shoulders, SNAPPED.reach), THRESHOLDS["dash-attack"]).line3;
  expect(snapped.returnPeak).toBeGreaterThan(1.4);
  expect(snapped.pass).toBe(false);
  expect(scoreMove(held("tilt", CARRIED.shoulders, CARRIED.reach), THRESHOLDS.tilt).line3.pass).toBe(false);
});
