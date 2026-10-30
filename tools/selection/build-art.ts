



import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PLAYER_COLORS } from '../../ts/src/game/ui/slotColors';
import { HAND_ART_COLUMNS, HAND_ART_ROWS, HAND_MARGIN, HAND_TEXELS } from '../../ts/src/game/core/handArt';
import { PARTICIPANT_CAPACITY } from '../../ts/src/game/input/participants';
import { RANDOM_ICON_PX, TILE_BACKGROUND } from '../../ts/scripts/tileArt';
import { Effect } from '../../ts/node_modules/effect/dist/index.js';
import { ChildProcess } from '../../ts/node_modules/effect/dist/process/index.js';
import { BunRuntime, BunServices } from '../../ts/node_modules/@effect/platform-bun/dist/index.js';
import { ProcessFailure, runProcess } from '../../ts/scripts/hostProcess';
import { findExtractor, stockStorage } from '../../ts/scripts/wisp/renderAssetStore';
import { gameCursorArt } from './gameCursorArt';

const project = resolve(import.meta.dir, '../..');
const source = join(project, 'tools/selection/art');
const index = process.argv.indexOf('--out');
const output = index < 0 ? join(project, 'build/selection-assets') : resolve(process.argv[index + 1]!);
const ioFailure = (cause: unknown) => new ProcessFailure({ command: 'selection art', problem: String(cause) });
const run = (command: readonly [string, ...string[]]) => runProcess(ChildProcess.make(command[0], command.slice(1)));

const hex = (rgb: number) => `#${rgb.toString(16).padStart(6, '0')}`;

const mix = (rgb: number, target: number, amount: number) => [16, 8, 0].reduce((sum, shift) => {
  const from = (rgb >> shift) & 255;
  return sum + (Math.round(from + (((target >> shift) & 255) - from) * amount) << shift);
}, 0);


const render = (name: string, svg: string, replacements: { readonly [placeholder: string]: string }, keep: boolean) => Effect.gen(function*() {
  let text = yield* Effect.tryPromise({ try: () => Bun.file(join(source, svg)).text(), catch: ioFailure });
  for (const [placeholder, value] of Object.entries(replacements)) text = text.replaceAll(placeholder, value);
  const file = join(output, `${name}.svg`);
  yield* Effect.tryPromise({ try: () => Bun.write(file, text), catch: ioFailure });
  yield* run(['magick', '-background', 'none', file, '-depth', '8', `TGA:${join(output, `${name}.tga`)}`]);
  if (!keep) yield* Effect.try({ try: () => rmSync(file), catch: ioFailure });
});

BunRuntime.runMain(Effect.gen(function*() {
  yield* Effect.try({ try: () => mkdirSync(output, { recursive: true }), catch: ioFailure });
  for (const [fighter, label] of [['Rifleman', 'RIFLEMAN'], ['DemonHunter', 'ILLIDAN']] as const) {
    yield* render(`${fighter}Name`, 'FighterName.svg', { FIGHTER_NAME: label }, true);
  }
  const slots = PLAYER_COLORS.slice(0, PARTICIPANT_CAPACITY);
  for (const [slot, color] of slots.entries()) {
    yield* render(`SelectionChipP${slot + 1}`, 'SelectionChip.svg', { CHIP_COLOR: hex(mix(color.rgb, 0x000000, 0.2)), CHIP_LABEL: `P${slot + 1}` }, true);
    yield* render(`SelectionChipCPUP${slot + 1}`, 'SelectionChip.svg', { CHIP_COLOR: '#626977', CHIP_LABEL: `P${slot + 1}` }, true);
    yield* render(`SelectionCard${color.name}`, 'SelectionCard.svg', { CARD_COLOR: hex(mix(color.rgb, 0x000000, 0.4)), CARD_EDGE: hex(mix(color.rgb, 0xffffff, 0.35)), CARD_METAL: '#bbc6cf' }, false);
    yield* render(`HudPlate${slot}`, 'HudPlate.svg', { PLAYER_COLOR: hex(color.rgb) }, true);
    yield* render(`MarkerArrow${slot}`, 'MarkerArrow.svg', { ARROW_COLOR: hex(color.rgb) }, false);
    yield* run(['magick', join(output, `HudPlate${slot}.tga`), '-flop', '-depth', '8', `TGA:${join(output, `HudPlateMirror${slot}.tga`)}`]);
  }
  for (const [pose, art] of [['Point', 'point'], ['Fan', 'fan'], ['Pinch', 'pinch']] as const) {
    yield* run(['magick', join(source, `wc3-hand-${art}.png`), '-filter', 'point', '-resize', `${HAND_ART_COLUMNS}x${HAND_ART_ROWS}!`, '-background', 'none', '-gravity', 'northwest', '-splice', `${HAND_MARGIN}x${HAND_MARGIN}`, '-extent', `${HAND_TEXELS}x${HAND_TEXELS}`, '-depth', '8', `TGA:${join(output, `SelectionHand${pose}.tga`)}`]);
  }
  yield* gameCursorArt(source, output, run);
  yield* render('SelectionCardGray', 'SelectionCard.svg', { CARD_COLOR: '#30353b', CARD_EDGE: '#555d65', CARD_METAL: '#687078' }, false);
  for (const name of ['SelectionBackdrop', 'SelectionTileFrame', 'SelectionAction', 'StageBackdrop', 'StageChip', 'SelectionBullseye', 'SelectionThreeBridges']) {
    yield* run(['magick', '-background', 'none', join(source, `${name}.svg`), '-depth', '8', `TGA:${join(output, `${name}.tga`)}`]);
  }
  const extractor = findExtractor();
  if (extractor === undefined || extractor === null) return yield* Effect.fail(ioFailure('SelectionRandom needs CASC_EXTRACTOR (smashcraft-tools extract-animation-assets builds it)'));
  const randomIcon = join(output, 'BTNSelectHeroOn.dds');
  yield* run([extractor, stockStorage(), 'war3.w3mod:replaceabletextures/commandbuttons/btnselectheroon.dds', randomIcon]);
  // The stock 64 px icon bevels its outer 4 px; the tile keeps only the "?" inside it, inset on the backdrop behind every fighter tile.
  yield* run(['magick', ...TILE_BACKGROUND, '(', randomIcon, '-crop', '55x56+5+4', '+repage', '-resize', `${RANDOM_ICON_PX}x${RANDOM_ICON_PX}`, '(', '+clone', '-channel', 'RGB', '-separate', '-evaluate-sequence', 'max', '+channel', '-level', '0,20%', ')', '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', ')', '-compose', 'over', '-gravity', 'center', '-composite', '-alpha', 'off', '-depth', '8', `TGA:${join(output, 'SelectionRandom.tga')}`]);
  yield* Effect.try({ try: () => rmSync(randomIcon), catch: ioFailure });
  const files = yield* Effect.try({ try: () => [...new Bun.Glob('*.tga').scanSync(output)].sort().map((file) => join(output, file)), catch: ioFailure });
  console.log(yield* run(['magick', 'identify', ...files]));
}).pipe(Effect.provide(BunServices.layer)));
