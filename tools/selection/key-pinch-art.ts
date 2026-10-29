import { resolve } from 'node:path';
import { Effect } from '../../ts/node_modules/effect/dist/index.js';
import { ChildProcess } from '../../ts/node_modules/effect/dist/process/index.js';
import { BunRuntime, BunServices } from '../../ts/node_modules/@effect/platform-bun/dist/index.js';
import { runProcess } from '../../ts/scripts/hostProcess';

const [input, output = resolve(import.meta.dir, 'art/wc3-pinching-hand.png')] = process.argv.slice(2);
if (input === undefined) throw new Error('usage: bun tools/selection/key-pinch-art.ts <source.jpeg> [output.png]');

const KEY_TOLERANCE = '6%';
const run = (command: readonly [string, ...string[]]) => runProcess(ChildProcess.make(command[0], command.slice(1)));

BunRuntime.runMain(Effect.gen(function*() {
  yield* run([
    'magick', resolve(input),
    '-fuzz', KEY_TOLERANCE, '-fill', 'none', '-draw', 'color 0,0 floodfill',
    '-channel', 'A', '-threshold', '50%', '+channel',
    '-trim', '+repage', '-depth', '8', `PNG32:${resolve(output)}`,
  ]);
  console.log(yield* run(['magick', 'identify', resolve(output)]));
}).pipe(Effect.provide(BunServices.layer)));
