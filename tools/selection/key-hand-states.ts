import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Effect } from '../../ts/node_modules/effect/dist/index.js';
import { ChildProcess } from '../../ts/node_modules/effect/dist/process/index.js';
import { BunRuntime, BunServices } from '../../ts/node_modules/@effect/platform-bun/dist/index.js';
import { ProcessFailure, runProcess } from '../../ts/scripts/hostProcess';

const POSES = [
  { name: 'point', file: 'smashcraft-hand-default.jpeg' },
  { name: 'fan', file: 'smashcraft-hand-over-character-not-pinching.jpeg' },
  { name: 'pinch', file: 'smashcraft-hand-pinching.jpeg' },
] as const;
const REFERENCE = 'fan';
const BACKGROUND_TOLERANCE = 14;
const OUTLINE_BLUE_LEAD = 8;
const FRINGE_TOLERANCE = 26;
const FRINGE_PASSES = 2;
const CUFF_BAND_ROWS = 90;
const CUFF_WIDTH_DRIFT = 0.03;

const [inputs, output = resolve(import.meta.dir, 'art')] = process.argv.slice(2);
if (inputs === undefined) throw new Error('usage: bun tools/selection/key-hand-states.ts <folder of the three JPEGs> [output folder]');

const ioFailure = (cause: unknown) => new ProcessFailure({ command: 'key hand states', problem: String(cause) });
const run = (command: readonly [string, ...string[]]) => runProcess(ChildProcess.make(command[0], command.slice(1)));

interface Mask { readonly width: number; readonly height: number; readonly rgb: Uint8Array; readonly solid: Uint8Array }
interface Cuff { readonly bottom: number; readonly centre: number; readonly width: number }

const backgroundOf = ({ width, height, rgb }: Pick<Mask, 'width' | 'height' | 'rgb'>) => {
  const sum = [0, 0, 0];
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += y < 8 || y >= height - 8 ? 1 : width - 1) {
      for (let c = 0; c < 3; c++) sum[c]! += rgb[(y * width + x) * 3 + c]!;
      count++;
    }
  }
  return sum.map((value) => value / count);
};

const keyed = (width: number, height: number, rgb: Uint8Array): Mask => {
  const bg = backgroundOf({ width, height, rgb });
  const distance = (i: number) => Math.max(Math.abs(rgb[i * 3]! - bg[0]!), Math.abs(rgb[i * 3 + 1]! - bg[1]!), Math.abs(rgb[i * 3 + 2]! - bg[2]!));
  const blueLead = (i: number) => rgb[i * 3 + 2]! - rgb[i * 3]!;
  const backgroundLike = (i: number) => distance(i) <= BACKGROUND_TOLERANCE && blueLead(i) < OUTLINE_BLUE_LEAD;
  const solid = new Uint8Array(width * height).fill(1);
  const stack: number[] = [];
  const drop = (i: number) => { if (solid[i] === 1 && backgroundLike(i)) { solid[i] = 0; stack.push(i); } };
  for (let x = 0; x < width; x++) { drop(x); drop((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { drop(y * width); drop(y * width + width - 1); }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) drop(i - 1);
    if (x < width - 1) drop(i + 1);
    if (y > 0) drop(i - width);
    if (y < height - 1) drop(i + width);
  }
  const touchesBackground = (i: number) => {
    const x = i % width;
    const y = (i - x) / width;
    return x === 0 || y === 0 || x === width - 1 || y === height - 1 || solid[i - 1] === 0 || solid[i + 1] === 0 || solid[i - width] === 0 || solid[i + width] === 0;
  };
  for (let pass = 0; pass < FRINGE_PASSES; pass++) {
    const peeled: number[] = [];
    for (let i = 0; i < solid.length; i++) if (solid[i] === 1 && distance(i) <= FRINGE_TOLERANCE && blueLead(i) < 2 * OUTLINE_BLUE_LEAD && touchesBackground(i)) peeled.push(i);
    for (const i of peeled) solid[i] = 0;
  }
  const label = new Int32Array(width * height);
  const sizes: number[] = [0];
  for (let start = 0; start < solid.length; start++) {
    if (solid[start] !== 1 || label[start] !== 0) continue;
    const id = sizes.length;
    sizes.push(0);
    label[start] = id;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop()!;
      sizes[id]!++;
      const x = i % width;
      const y = (i - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
          const next = (y + dy) * width + x + dx;
          if (solid[next] === 1 && label[next] === 0) { label[next] = id; stack.push(next); }
        }
      }
    }
  }
  const largest = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < solid.length; i++) solid[i] = label[i] === largest ? 1 : 0;
  return { width, height, rgb, solid };
};

const cuffOf = ({ width, height, solid }: Mask): Cuff => {
  let bottom = 0;
  for (let i = solid.length - 1; i >= 0 && bottom === 0; i--) if (solid[i] === 1) bottom = Math.floor(i / width);
  let left = width;
  let right = 0;
  for (let y = bottom - CUFF_BAND_ROWS; y <= bottom && y < height; y++) {
    for (let x = 0; x < width; x++) if (solid[y * width + x] === 1) { left = Math.min(left, x); right = Math.max(right, x); }
  }
  return { bottom, centre: (left + right) / 2, width: right - left + 1 };
};

BunRuntime.runMain(Effect.gen(function*() {
  yield* Effect.try({ try: () => mkdirSync(output, { recursive: true }), catch: ioFailure });
  const scratch = join(output, '.key-scratch');
  yield* Effect.try({ try: () => mkdirSync(scratch, { recursive: true }), catch: ioFailure });
  const masks = new Map<string, Mask>();
  for (const { name, file } of POSES) {
    const ppm = join(scratch, `${name}.ppm`);
    yield* run(['magick', join(resolve(inputs), file), '-depth', '8', `PPM:${ppm}`]);
    const bytes = yield* Effect.tryPromise({ try: async () => new Uint8Array(await Bun.file(ppm).arrayBuffer()), catch: ioFailure });
    const [, w, h] = new TextDecoder().decode(bytes.subarray(0, 20)).match(/^P6\s+(\d+)\s+(\d+)\s+255\s/)!.map(Number) as [number, number, number];
    masks.set(name, keyed(w, h, bytes.subarray(bytes.length - w * h * 3)));
  }
  const cuffs = new Map([...masks].map(([name, mask]) => [name, cuffOf(mask)]));
  const reference = cuffs.get(REFERENCE)!;
  const shifts = new Map<string, { readonly dx: number; readonly dy: number }>();
  for (const [name, cuff] of cuffs) {
    if (Math.abs(cuff.width / reference.width - 1) > CUFF_WIDTH_DRIFT) return yield* Effect.fail(ioFailure(`${name} cuff is ${cuff.width} px wide against ${reference.width}; the three gauntlets are not drawn at one scale`));
    shifts.set(name, { dx: Math.round(reference.centre - cuff.centre), dy: reference.bottom - cuff.bottom });
  }
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const [name, { width, solid }] of masks) {
    const { dx, dy } = shifts.get(name)!;
    for (let i = 0; i < solid.length; i++) {
      if (solid[i] !== 1) continue;
      const x = (i % width) + dx;
      const y = Math.floor(i / width) + dy;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  const canvasWidth = right - left + 1;
  const canvasHeight = bottom - top + 1;
  for (const [name, { width, rgb, solid }] of masks) {
    const { dx, dy } = shifts.get(name)!;
    const rgba = new Uint8Array(canvasWidth * canvasHeight * 4);
    for (let i = 0; i < solid.length; i++) {
      if (solid[i] !== 1) continue;
      const x = (i % width) + dx - left;
      const y = Math.floor(i / width) + dy - top;
      rgba.set([rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!, 255], (y * canvasWidth + x) * 4);
    }
    const raw = join(scratch, `${name}.rgba`);
    yield* Effect.tryPromise({ try: () => Bun.write(raw, rgba), catch: ioFailure });
    yield* run(['magick', '-size', `${canvasWidth}x${canvasHeight}`, '-depth', '8', `RGBA:${raw}`, `PNG32:${join(output, `wc3-hand-${name}.png`)}`]);
  }
  console.log(yield* run(['magick', 'identify', ...POSES.map(({ name }) => join(output, `wc3-hand-${name}.png`))]));
  yield* Effect.try({ try: () => rmSync(scratch, { recursive: true }), catch: ioFailure });
}).pipe(Effect.provide(BunServices.layer)));
