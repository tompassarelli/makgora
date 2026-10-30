import { join } from 'node:path';
import { Effect } from '../../ts/node_modules/effect/dist/index.js';
import { ChildProcess } from '../../ts/node_modules/effect/dist/process/index.js';
import { ProcessFailure, runProcess } from '../../ts/scripts/hostProcess';
import { swingIndexFinger } from './pinch-hand';

const PINCH_SWING = { degrees: 70, foreshorten: 0.62 };
const run = (command: readonly [string, ...string[]]) => runProcess(ChildProcess.make(command[0], command.slice(1)));
const ioFailure = (cause: unknown) => new ProcessFailure({ command: 'pinch art', problem: String(cause) });

export const derivePinch = (pointPng: string, scratch: string, pinchPng: string) => Effect.gen(function*() {
  const raw = join(scratch, 'point.rgba');
  yield* run(['magick', pointPng, '-depth', '8', `RGBA:${raw}`]);
  const [width, height] = (yield* run(['magick', 'identify', '-format', '%w %h', pointPng])).trim().split(' ').map(Number) as [number, number];
  const rgba = yield* Effect.tryPromise({ try: async () => new Uint8Array(await Bun.file(raw).arrayBuffer()), catch: ioFailure });
  const pinch = swingIndexFinger({ width, height, rgba }, PINCH_SWING);
  yield* Effect.tryPromise({ try: () => Bun.write(raw, pinch.rgba), catch: ioFailure });
  yield* run(['magick', '-size', `${width}x${height}`, '-depth', '8', `RGBA:${raw}`, `PNG32:${pinchPng}`]);
});
