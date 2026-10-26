import { expect, test } from "bun:test";
import { type ScoreFrame, type StrikeSegment, strikingVertex } from "../scripts/wisp/animScore";

const pose = (frame: number, hood: readonly [number, number], tip: readonly [number, number]): ScoreFrame => ({
  frame,
  vertices: Float32Array.from([...hood, ...tip]),
  drawn: Uint8Array.from([1, 1]),
  faces: Uint32Array.from([0, 1, 0]),
  nodes: new Float32Array(0),
});

const frames = [pose(0, [56, 125], [13, 149]), pose(1, [59, 122], [78, 82]), pose(2, [59, 119], [18, -6])];
const arc: readonly (readonly StrikeSegment[])[] = [
  [{ x1: 38, z1: 147, x2: 58, z2: 135, radius: 6 }, { x1: 58, z1: 135, x2: 90, z2: 61, radius: 6 }],
  [{ x1: 90, z1: 61, x2: 57, z2: 7, radius: 6 }],
  [{ x1: 57, z1: 7, x2: 0, z2: -9, radius: 6 }],
];
const strike = { x: 58, z: 135 };

test("a swept strike's tip is the drawn vertex its regions cover through the whole active window, not the vertex nearest the first region's end [k2 property]", () => {
  expect(strikingVertex({ frames, regions: arc, strike }, frames[0] ?? pose(0, [0, 0], [0, 0]))).toBe(1);
  expect(strikingVertex({ frames, regions: [], strike }, frames[0] ?? pose(0, [0, 0], [0, 0]))).toBe(0);
});

const reach = (frame: number, tip: number): ScoreFrame => ({
  frame,
  vertices: Float32Array.from([10, 50, 40, 55, tip, 50]),
  drawn: Uint8Array.from([1, 1, 1]),
  faces: Uint32Array.from([0, 1, 2]),
  nodes: new Float32Array(0),
});

const retracting = [reach(0, 60), reach(1, 80), reach(2, 100)];
const held: readonly (readonly StrikeSegment[])[] = retracting.map(() => [{ x1: 0, z1: 50, x2: 60, z2: 50, radius: 10 }]);

test("a held region's tip is the vertex nearest its far end among those it covers on every active frame, not the deepest covered vertex [k2 property]", () => {
  expect(strikingVertex({ frames: retracting, regions: held, strike: { x: 60, z: 50 } }, retracting[0] ?? reach(0, 0))).toBe(1);
});

const sides = (frame: number): ScoreFrame => ({
  frame,
  vertices: Float32Array.from([0, 20, -60, 20, 60, 20]),
  drawn: Uint8Array.from([1, 1, 1]),
  faces: Uint32Array.from([0, 1, 2]),
  nodes: new Float32Array(0),
});

const twoSided = [sides(0), sides(1), sides(2), sides(3)];
const frontThenBack: readonly (readonly StrikeSegment[])[] = [0, 1, 2, 3].map((frame) => frame < 2 ? [{ x1: 40, z1: 20, x2: 70, z2: 20, radius: 10 }] : [{ x1: -70, z1: 20, x2: -40, z2: 20, radius: 10 }]);

test("when no vertex stays inside every region, the tip is the vertex the regions hold on the most active frames, not the body vertex that strays least [k2 property]", () => {
  expect(strikingVertex({ frames: twoSided, regions: frontThenBack, strike: { x: 70, z: 20 } }, twoSided[0] ?? sides(0))).toBe(2);
});
