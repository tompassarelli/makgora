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
  [{ x1: 38, z1: 147, x2: 58, z2: 135 }, { x1: 58, z1: 135, x2: 90, z2: 61 }],
  [{ x1: 90, z1: 61, x2: 57, z2: 7 }],
  [{ x1: 57, z1: 7, x2: 0, z2: -9 }],
];
const strike = { x: 58, z: 135 };

test("a swept strike's tip is the drawn vertex its regions cover through the whole active window, not the vertex nearest the first region's end [k2 property]", () => {
  expect(strikingVertex({ frames, regions: arc, strike }, frames[0] ?? pose(0, [0, 0], [0, 0]))).toBe(1);
  expect(strikingVertex({ frames, regions: [], strike }, frames[0] ?? pose(0, [0, 0], [0, 0]))).toBe(0);
});
