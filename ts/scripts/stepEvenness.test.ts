import { expect, test } from "bun:test";
import type { Callback, MatchedFrame } from "./cameraDraw";
import { fighterSamples, fitProjection, foregroundBlobs, initialPairs, medianBackground, positionsByFrame, refinePairs, spread } from "./stepEvenness";

const WIDTH = 96, HEIGHT = 40;

function picture(squares: readonly number[]): Uint8Array {
  const rgb = new Uint8Array(WIDTH * HEIGHT * 3).fill(40);
  squares.forEach((left, i) => {
    for (let y = 20; y < 28; y++) for (let x = Math.round(left); x < Math.round(left) + 6; x++) {
      const o = (y * WIDTH + x) * 3;
      rgb[o] = 200; rgb[o + 1] = i === 0 ? 200 : 90; rgb[o + 2] = 30;
    }
  });
  return rgb;
}

test("rendered steps of a fighter drawn 0, 1 and 2 simulation frames apart read back as those frame counts, and its lag as zero [k1 fixture]", () => {
  const drawnFrames = [0, 1, 1, 3, 4, 4, 6, 7, 7, 9, 10, 10, 12, 13, 13, 15];
  const world = (f: number) => ({ 0: { x: 100 + 40 * f, z: 0 }, 1: { x: 1400, z: 0 } });
  const toScreen = (x: number) => 4 + x / 20;
  const rows = new Map<number, Callback>();
  const frames: MatchedFrame[] = [];
  const pictures: Uint8Array[] = [];
  drawnFrames.forEach((f, row) => {
    const callback: Callback = { row, frame: f, positions: world(f) };
    rows.set(row, callback);
    frames.push({ index: row, seconds: row / 60, marker: undefined, row, matchFrame: f, advance: undefined, callback });
    pictures.push(picture([toScreen(world(f)[0].x), toScreen(world(f)[1].x)]));
  });
  for (let f = 0; f <= 15; f++) rows.set(100 + f, { row: 100 + f, frame: f, positions: world(f) });
  const background = medianBackground([picture([]), picture([]), picture([]), pictures[0] ?? picture([]), pictures[8] ?? picture([])]);
  const blobs = pictures.map(rgb => foregroundBlobs(rgb, background, WIDTH, HEIGHT, 60, 0, 4));
  let projection = fitProjection(initialPairs(frames, blobs, [0, 1]));
  projection = fitProjection(refinePairs(frames, blobs, [0, 1], projection, 8));
  const samples = fighterSamples(frames, blobs, positionsByFrame(rows), 0, projection, 8, 0.5);
  const steps = samples.flatMap(s => s.step === undefined ? [] : [Math.round(s.step * 4) / 4]);
  expect(steps).toEqual(drawnFrames.slice(1).map((f, i) => f - (drawnFrames[i] ?? 0)));
  expect(Math.max(...samples.map(s => Math.abs(s.lag ?? 1)))).toBeLessThan(0.25);
  expect(spread(steps).histogram).toEqual({ "0.00": 5, "1.00": 5, "2.00": 5 });
});
