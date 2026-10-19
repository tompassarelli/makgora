import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { type Callback, type MatchedFrame, callbacks, joinMarkers, videoFrames } from "./cameraDraw";

class StepEvennessFailure extends Schema.TaggedError<StepEvennessFailure>()("StepEvennessFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const failure = (cause: unknown) => new StepEvennessFailure({ problem: cause instanceof Error ? cause.message : String(cause) });

const BACKGROUND_SAMPLES = 41;
const MARKER_BAND = 0.07;

export interface Blob { readonly x: number; readonly y: number; readonly pixels: number }
export type Projection = readonly [number, number, number, number, number, number];
interface Point { readonly x: number; readonly z: number }


export function medianBackground(samples: readonly Uint8Array[]): Uint8Array {
  const length = samples[0]?.length ?? 0;
  const out = new Uint8Array(length);
  const values = new Uint8Array(samples.length);
  for (let i = 0; i < length; i++) {
    for (let k = 0; k < samples.length; k++) values[k] = samples[k]?.[i] ?? 0;
    values.sort();
    out[i] = values[samples.length >> 1] ?? 0;
  }
  return out;
}


export function foregroundBlobs(rgb: Uint8Array, background: Uint8Array, width: number, height: number, threshold: number, top: number, minPixels: number): Blob[] {
  const mask = new Uint8Array(width * height);
  for (let y = top; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x, o = p * 3;
      const d = Math.abs((rgb[o] ?? 0) - (background[o] ?? 0)) + Math.abs((rgb[o + 1] ?? 0) - (background[o + 1] ?? 0)) + Math.abs((rgb[o + 2] ?? 0) - (background[o + 2] ?? 0));
      if (d >= threshold) mask[p] = 1;
    }
  }
  const blobs: Blob[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1) continue;
    mask[start] = 2;
    stack.push(start);
    let count = 0, sumX = 0, sumY = 0;
    while (stack.length > 0) {
      const p = stack.pop() ?? 0;
      const x = p % width, y = (p - x) / width;
      count++; sumX += x; sumY += y;
      if (x > 0 && mask[p - 1] === 1) { mask[p - 1] = 2; stack.push(p - 1); }
      if (x + 1 < width && mask[p + 1] === 1) { mask[p + 1] = 2; stack.push(p + 1); }
      if (y > 0 && mask[p - width] === 1) { mask[p - width] = 2; stack.push(p - width); }
      if (y + 1 < height && mask[p + width] === 1) { mask[p + width] = 2; stack.push(p + width); }
    }
    if (count >= minPixels) blobs.push({ x: sumX / count, y: sumY / count, pixels: count });
  }
  return blobs;
}


function solve3(m: number[][], r: number[]): [number, number, number] {
  const a = m.map((row, i) => [...row, r[i] ?? 0]);
  for (let c = 0; c < 3; c++) {
    let pivot = c;
    for (let i = c + 1; i < 3; i++) if (Math.abs(a[i]?.[c] ?? 0) > Math.abs(a[pivot]?.[c] ?? 0)) pivot = i;
    [a[c], a[pivot]] = [a[pivot] ?? [], a[c] ?? []];
    const lead = a[c]?.[c] ?? 0;
    if (Math.abs(lead) < 1e-12) throw Error("Projection fit is degenerate: the fighters need to move in x and z or stand apart");
    for (let i = 0; i < 3; i++) {
      if (i === c) continue;
      const f = (a[i]?.[c] ?? 0) / lead;
      for (let j = c; j < 4; j++) (a[i] ?? [])[j] = (a[i]?.[j] ?? 0) - f * (a[c]?.[j] ?? 0);
    }
  }
  return [0, 1, 2].map(i => (a[i]?.[3] ?? 0) / (a[i]?.[i] ?? 1)) as [number, number, number];
}


export function fitProjection(pairs: readonly { readonly world: Point; readonly screen: Blob }[]): Projection {
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const ru = [0, 0, 0], rv = [0, 0, 0];
  for (const { world, screen } of pairs) {
    const basis = [world.x, world.z, 1];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) (m[i] ?? [])[j] = (m[i]?.[j] ?? 0) + (basis[i] ?? 0) * (basis[j] ?? 0);
      ru[i] = (ru[i] ?? 0) + (basis[i] ?? 0) * screen.x;
      rv[i] = (rv[i] ?? 0) + (basis[i] ?? 0) * screen.y;
    }
  }
  const u = Math.abs(m[1]?.[1] ?? 0) < 1e-9 ? solveFlat(m, ru) : solve3(m, ru);
  const v = Math.abs(m[1]?.[1] ?? 0) < 1e-9 ? solveFlat(m, rv) : solve3(m, rv);
  return [u[0], u[1], u[2], v[0], v[1], v[2]];
}

function solveFlat(m: number[][], r: number[]): [number, number, number] {
  const n = m[2]?.[2] ?? 0, sx = m[0]?.[2] ?? 0, sxx = m[0]?.[0] ?? 0;
  const det = sxx * n - sx * sx;
  if (Math.abs(det) < 1e-9) throw Error("Projection fit is degenerate: the fighters need to move or stand apart");
  return [((r[0] ?? 0) * n - sx * (r[2] ?? 0)) / det, 0, (sxx * (r[2] ?? 0) - sx * (r[0] ?? 0)) / det];
}

export const project = (p: Projection, w: Point) => ({ x: p[0] * w.x + p[1] * w.z + p[2], y: p[3] * w.x + p[4] * w.z + p[5] });
const projectDelta = (p: Projection, x: number, z: number) => ({ x: p[0] * x + p[1] * z, y: p[3] * x + p[4] * z });


export function centroidNear(blobs: readonly Blob[], at: { readonly x: number; readonly y: number }, radius: number): Blob | undefined {
  let count = 0, sumX = 0, sumY = 0;
  for (const blob of blobs) {
    if ((blob.x - at.x) ** 2 + (blob.y - at.y) ** 2 > radius * radius) continue;
    count += blob.pixels; sumX += blob.x * blob.pixels; sumY += blob.y * blob.pixels;
  }
  return count === 0 ? undefined : { x: sumX / count, y: sumY / count, pixels: count };
}


export function positionsByFrame(rows: ReadonlyMap<number, Callback>): Map<number, Record<number, Point>> {
  const frames = new Map<number, Record<number, Point>>();
  for (const row of [...rows.values()].sort((a, b) => a.row - b.row)) {
    if (row.frame === undefined || row.positions === undefined) continue;
    frames.set(row.frame, { ...frames.get(row.frame), ...row.positions });
  }
  return frames;
}


export function initialPairs(frames: readonly MatchedFrame[], blobs: readonly (readonly Blob[])[], fighters: readonly number[]) {
  const pairs: { world: Point; screen: Blob }[] = [];
  frames.forEach((frame, k) => {
    const positions = frame.callback.positions;
    const largest = [...(blobs[k] ?? [])].sort((a, b) => b.pixels - a.pixels).slice(0, fighters.length);
    const worlds = fighters.map(f => positions?.[f]);
    if (positions === undefined || largest.length !== fighters.length || worlds.some(w => w === undefined)) return;
    const screen = largest.sort((a, b) => a.x - b.x);
    const world = (worlds as Point[]).slice().sort((a, b) => a.x - b.x);
    world.forEach((w, i) => { const s = screen[i]; if (s !== undefined) pairs.push({ world: w, screen: s }); });
  });
  return pairs;
}


export function refinePairs(frames: readonly MatchedFrame[], blobs: readonly (readonly Blob[])[], fighters: readonly number[], projection: Projection, radius: number) {
  const pairs: { world: Point; screen: Blob }[] = [];
  frames.forEach((frame, k) => {
    for (const f of fighters) {
      const world = frame.callback.positions?.[f];
      if (world === undefined) continue;
      const screen = centroidNear(blobs[k] ?? [], project(projection, world), radius);
      if (screen !== undefined) pairs.push({ world, screen });
    }
  });
  return pairs;
}

export interface FighterSample { readonly row: number; readonly frame: number; readonly step: number | undefined; readonly lag: number | undefined; readonly velocityPx: number; readonly rightward: boolean; readonly residual: { readonly x: number; readonly y: number } }
export interface Offsets { readonly right: { readonly x: number; readonly y: number }; readonly left: { readonly x: number; readonly y: number } }
const NO_OFFSETS: Offsets = { right: { x: 0, y: 0 }, left: { x: 0, y: 0 } };


export function fighterSamples(frames: readonly MatchedFrame[], blobs: readonly (readonly Blob[] | undefined)[], byFrame: ReadonlyMap<number, Record<number, Point>>,
  fighter: number, projection: Projection, radius: number, minVelocityPx: number, offsets: Offsets = NO_OFFSETS): FighterSample[] {
  const samples: FighterSample[] = [];
  let previous: Blob | undefined;
  frames.forEach((frame, k) => {
    const frameBlobs = blobs[k];
    if (frameBlobs === undefined) return;
    const f = frame.matchFrame;
    const now = f === undefined ? undefined : byFrame.get(f)?.[fighter];
    const before = f === undefined ? undefined : byFrame.get(f - 1)?.[fighter];
    if (f === undefined || now === undefined) { previous = undefined; return; }
    const velocity = before === undefined ? { x: 0, y: 0 } : projectDelta(projection, now.x - before.x, now.z - before.z);
    const offset = velocity.x >= 0 ? offsets.right : offsets.left;
    const projected = project(projection, now);
    const target = { x: projected.x + offset.x, y: projected.y + offset.y };
    const centroid = centroidNear(frameBlobs, target, radius);
    const speed2 = velocity.x ** 2 + velocity.y ** 2;
    if (centroid === undefined || speed2 < minVelocityPx * minVelocityPx) { previous = centroid; return; }
    const along = (dx: number, dy: number) => (dx * velocity.x + dy * velocity.y) / speed2;
    const step = previous === undefined ? undefined : along(centroid.x - previous.x, centroid.y - previous.y);
    samples.push({ row: frame.row, frame: f, step, lag: along(target.x - centroid.x, target.y - centroid.y), velocityPx: Math.sqrt(speed2), rightward: velocity.x >= 0,
      residual: { x: centroid.x - projected.x, y: centroid.y - projected.y } });
    previous = centroid;
  });
  return samples;
}


export function directionOffsets(samples: readonly FighterSample[]): Offsets {
  const mean = (list: readonly FighterSample[]) => {
    const xs = list.map(s => s.residual.x).sort((p, q) => p - q), ys = list.map(s => s.residual.y).sort((p, q) => p - q);
    return { x: xs[xs.length >> 1] ?? 0, y: ys[ys.length >> 1] ?? 0 };
  };
  return { right: mean(samples.filter(s => s.rightward)), left: mean(samples.filter(s => !s.rightward)) };
}

export function spread(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))] ?? null;
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, values.length));
  const histogram: Record<string, number> = {};
  for (const value of values) {
    const bin = (Math.round(value * 4) / 4).toFixed(2);
    histogram[bin] = (histogram[bin] ?? 0) + 1;
  }
  return { samples: values.length, mean, sd, p10: at(0.1), p50: at(0.5), p90: at(0.9), iqr: (at(0.75) ?? 0) - (at(0.25) ?? 0), histogram };
}


function profiles(rgb: Uint8Array, width: number, top: number, bottom: number) {
  const columns = new Float64Array(width), rows = new Float64Array(bottom - top);
  for (let y = top; y < bottom; y++) for (let x = 0; x < width; x++) {
    const o = (y * width + x) * 3, luma = (rgb[o] ?? 0) + 2 * (rgb[o + 1] ?? 0) + (rgb[o + 2] ?? 0);
    columns[x] = (columns[x] ?? 0) + luma; rows[y - top] = (rows[y - top] ?? 0) + luma;
  }
  return { columns, rows };
}

function profileShift(previous: Float64Array, current: Float64Array, range: number): number {
  const cost = (d: number) => {
    let total = 0;
    for (let i = range; i < previous.length - range; i++) total += Math.abs((current[i + d] ?? 0) - (previous[i] ?? 0));
    return total;
  };
  let best = 0, bestCost = Infinity;
  for (let d = -range; d <= range; d++) { const c = cost(d); if (c < bestCost) { best = d; bestCost = c; } }
  if (Math.abs(best) === range) return best;
  const minus = cost(best - 1), plus = cost(best + 1), curve = minus - 2 * bestCost + plus;
  return best + (curve > 0 ? 0.5 * (minus - plus) / curve : 0);
}


export function backgroundShift(previous: Uint8Array, current: Uint8Array, width: number, height: number, top: number, range: number): { x: number; y: number } {
  const bottom = Math.floor(height * 0.78);
  const p = profiles(previous, width, top, bottom), c = profiles(current, width, top, bottom);
  return { x: profileShift(p.columns, c.columns, range), y: profileShift(p.rows, c.rows, range) };
}

export function cameraByFrame(rows: ReadonlyMap<number, Callback>): Map<number, readonly number[]> {
  const frames = new Map<number, readonly number[]>();
  for (const row of [...rows.values()].sort((p, q) => p.row - q.row)) if (row.frame !== undefined && row.camera !== undefined) frames.set(row.frame, row.camera);
  return frames;
}


export function cameraSteps(frames: readonly MatchedFrame[], shifts: readonly ({ readonly x: number; readonly y: number } | undefined)[],
  byFrame: ReadonlyMap<number, readonly number[]>, minVelocity: number) {
  const LOCAL_X = 4, NATIVE_X = 8;
  const moves = frames.flatMap(frame => {
    const f = frame.matchFrame, shift = shifts[frame.index];
    const now = f === undefined ? undefined : byFrame.get(f), before = f === undefined ? undefined : byFrame.get(f - 1);
    if (shift === undefined || now === undefined || before === undefined) return [];
    const velocity = (now[LOCAL_X] ?? 0) - (before[LOCAL_X] ?? 0);
    return [{ row: frame.row, frame: f, shift: shift.x, velocity, engineLag: Math.abs(velocity) < minVelocity ? undefined : ((now[LOCAL_X] ?? 0) - (now[NATIVE_X] ?? 0)) / velocity }];
  });
  const moving = moves.filter(m => Math.abs(m.velocity) >= minVelocity);
  const pixelsPerUnit = moving.reduce((sum, m) => sum + m.shift * m.velocity, 0) / Math.max(1e-9, moving.reduce((sum, m) => sum + m.velocity * m.velocity, 0));
  const samples = moving.map(m => ({ ...m, step: m.shift / (pixelsPerUnit * m.velocity) }));
  return { capturedFrames: frames.length, renderedFrames: shifts.filter(x => x !== undefined).length, pixelsPerUnit,
    stepsInSimFrames: spread(samples.map(m => m.step)), engineLagInSimFrames: spread(samples.flatMap(m => m.engineLag === undefined ? [] : [m.engineLag])), samples };
}

const main = Effect.gen(function*() {
  const { values } = yield* Effect.try({
    try: () => parseArgs({ options: {
      video: { type: "string" }, pages: { type: "string" }, out: { type: "string" },
      slot: { type: "string", default: "0" }, run: { type: "string", default: "1" }, viewport: { type: "string" },
      fighters: { type: "string", default: "0,1" }, projection: { type: "string" }, radius: { type: "string", default: "60" },
      threshold: { type: "string", default: "60" }, "min-pixels": { type: "string", default: "12" }, "min-velocity": { type: "string", default: "0.5" },
      camera: { type: "boolean", default: false }, "camera-range": { type: "string", default: "24" },
    } }),
    catch: failure,
  });
  if (values.video === undefined || values.pages === undefined || values.out === undefined || !isAbsolute(values.out)) {
    return yield* new StepEvennessFailure({ problem: "stepEvenness requires --video PRIVATE.mkv --pages DATA_DIR --out PRIVATE_DIR [--slot 0 --run 1 --viewport X,Y,W,H --fighters 0,1 --projection FILE --camera]" });
  }
  const out = values.out, video = values.video;
  const viewport = values.viewport?.split(",").map(Number) ?? [];
  const rows = yield* callbacks(values.pages, Number(values.slot), Number(values.run));
  const radius = Number(values.radius);
  if (values.camera) {
    let previous: Uint8Array | undefined;
    const shifts: ({ x: number; y: number } | undefined)[] = [];
    const decoded = yield* videoFrames(video, viewport, (rgb, index, width, height) => {
      if (previous !== undefined && Buffer.compare(previous, rgb) === 0) return;
      shifts[index] = previous === undefined ? undefined : backgroundShift(previous, rgb, width, height, Math.ceil(MARKER_BAND * height / 0.6), Number(values["camera-range"]));
      previous = rgb.slice();
    });
    const matched = yield* Effect.try({ try: () => joinMarkers(decoded.frames, rows, decoded.height), catch: failure });
    const report = { video, mode: "camera", ...cameraSteps(matched, shifts, cameraByFrame(rows), Number(values["min-velocity"])) };
    const perFrame = report.samples;
    yield* Effect.try({ try: () => { mkdirSync(out, { recursive: true }); writeFileSync(join(out, "camera-frames.jsonl"), perFrame.map(f => JSON.stringify(f)).join("\n") + "\n"); writeFileSync(join(out, "camera-report.json"), JSON.stringify({ ...report, samples: undefined }, null, 2) + "\n"); }, catch: failure });
    console.log(JSON.stringify({ capturedFrames: report.capturedFrames, renderedFrames: report.renderedFrames, pixelsPerUnit: report.pixelsPerUnit,
      steps: { ...report.stepsInSimFrames, histogram: undefined }, engineLag: { ...report.engineLagInSimFrames, histogram: undefined } }));
    return;
  }
  const samples: Uint8Array[] = [];
  const first = yield* videoFrames(video, viewport);
  const every = Math.max(1, Math.floor(first.frames.length / BACKGROUND_SAMPLES));
  yield* videoFrames(video, viewport, (rgb, index) => { if (index % every === 0 && samples.length < BACKGROUND_SAMPLES) samples.push(rgb.slice()); });
  const background = medianBackground(samples);
  const top = Math.ceil(MARKER_BAND * first.height / 0.6);
  const blobsByIndex: (Blob[] | undefined)[] = [];
  let shown: Uint8Array | undefined;
  yield* videoFrames(video, viewport, (rgb, index) => {
    const repeated = shown !== undefined && Buffer.compare(shown, rgb) === 0;
    shown = rgb.slice();
    blobsByIndex[index] = repeated ? undefined : foregroundBlobs(rgb, background, first.width, first.height, Number(values.threshold), top, Number(values["min-pixels"]));
  });
  const matched = yield* Effect.try({ try: () => joinMarkers(first.frames, rows, first.height), catch: failure });
  const blobs = matched.map(frame => blobsByIndex[frame.index]);
  const rendered = blobs.filter(b => b !== undefined).length;
  const fitBlobs = blobs.map(b => b ?? []);
  const fighters = values.fighters.split(",").map(Number);
  const calibration = yield* Effect.try({
    try: (): { projection: Projection; offsets: Record<number, Offsets> | undefined } => {
      if (values.projection !== undefined) return JSON.parse(readFileSync(values.projection, "utf8")) as { projection: Projection; offsets: Record<number, Offsets> };
      let fit = fitProjection(initialPairs(matched, fitBlobs, fighters));
      for (let i = 0; i < 3; i++) fit = fitProjection(refinePairs(matched, fitBlobs, fighters, fit, radius));
      return { projection: fit, offsets: undefined };
    },
    catch: failure,
  });
  const { projection } = calibration;
  const byFrame = positionsByFrame(rows);
  const minVelocity = Number(values["min-velocity"]);
  const offsets: Record<number, Offsets> = calibration.offsets ?? Object.fromEntries(fighters.map(fighter =>
    [fighter, directionOffsets(fighterSamples(matched, blobs, byFrame, fighter, projection, radius, minVelocity))]));
  const perFighter = fighters.map(fighter => {
    const list = fighterSamples(matched, blobs, byFrame, fighter, projection, radius, minVelocity, offsets[fighter]);
    const steps = list.flatMap(s => s.step === undefined ? [] : [s.step]);
    const lags = list.flatMap(s => s.lag === undefined ? [] : [s.lag]);
    return { fighter, movingFrames: list.length, stepsInSimFrames: spread(steps), lagInSimFrames: spread(lags), samples: list };
  });
  const report = {
    video, pages: values.pages, slot: Number(values.slot), run: Number(values.run), viewport: values.viewport, capturedFrames: matched.length, renderedFrames: rendered,
    durationSeconds: matched.at(-1)?.seconds ?? 0, projection, offsets, projectionFitted: values.projection === undefined, backgroundSamples: samples.length,
    fighters: perFighter.map(({ samples: _, ...rest }) => rest),
    scope: "Steps and lag along each fighter's projected per-frame velocity, in simulation frames; lag is (P[f] - drawn)/(P[f] - P[f-1]) at the marker's frame. Repeated (pixel-identical) captured frames are not rendered frames and are skipped. The fit also records each fighter's centroid offset per facing direction; lag is meaningful only with a projection fitted where drawn equals P (smooth-draw off).",
  };
  yield* Effect.try({
    try: () => {
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, "projection.json"), JSON.stringify({ projection, offsets }, null, 2) + "\n");
      writeFileSync(join(out, "step-samples.jsonl"), perFighter.flatMap(f => f.samples.map(s => JSON.stringify({ fighter: f.fighter, ...s }))).join("\n") + "\n");
      writeFileSync(join(out, "step-report.json"), JSON.stringify(report, null, 2) + "\n");
    },
    catch: failure,
  });
  console.log(JSON.stringify({ capturedFrames: report.capturedFrames, renderedFrames: rendered, durationSeconds: report.durationSeconds,
    fighters: report.fighters.map(f => ({ fighter: f.fighter, movingFrames: f.movingFrames, steps: { ...f.stepsInSimFrames, histogram: undefined }, lag: { ...f.lagInSimFrames, histogram: undefined } })) }));
});


if (import.meta.main) BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)));
