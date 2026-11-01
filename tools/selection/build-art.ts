



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
import { findExtractor, reforgedStorage } from '../../ts/scripts/wisp/renderAssetStore';
import { gameCursorArt } from './gameCursorArt';
import { RACES } from '../../ts/src/game/roster/races';
import { RACE_COLOURS } from '../../ts/src/game/ui/raceFrame';
import { BAR_STRIP, type BarArtStyle, barArt, barArtName } from '../../ts/src/game/core/selectBarLayout';

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


// The bar's frames are drawn at their own size (one UI unit 1800 pixels, a 1080-pixel-tall display) so no border is stretched.
const BAR_PIXELS = 1800;
const BAR_STYLES: { readonly [style in BarArtStyle]: { readonly fill: readonly [string, string]; readonly opacity: number; readonly edge: readonly [string, string]; readonly stroke: number; readonly corner: number; readonly inner: string; readonly innerOpacity: number } } = {
  Frame: { fill: ['#1a2231', '#0b0f17'], opacity: 0.94, edge: ['#c9a24a', '#7a5a1c'], stroke: 2, corner: 5, inner: '#ffffff', innerOpacity: 0.07 },
  Lit: { fill: ['#3d3115', '#161108'], opacity: 0.96, edge: ['#ffe08a', '#d29a26'], stroke: 2.5, corner: 5, inner: '#ffd75e', innerOpacity: 0.4 },
  Primary: { fill: ['#b8461c', '#5c1307'], opacity: 1, edge: ['#ffe9a0', '#e0a52a'], stroke: 3, corner: 6, inner: '#ffb070', innerOpacity: 0.45 },
  Panel: { fill: ['#151c2a', '#090d14'], opacity: 0.97, edge: ['#d4ab4e', '#8a6420'], stroke: 2.5, corner: 8, inner: '#ffffff', innerOpacity: 0.05 },
  Key: { fill: ['#05070b', '#0e131b'], opacity: 1, edge: ['#a8873d', '#6d5220'], stroke: 1.5, corner: 3, inner: '#ffffff', innerOpacity: 0 },
};

const chamfered = (width: number, height: number, corner: number, inset: number) => {
  const c = Math.max(0, corner - inset * 0.4);
  const [l, t, r, b] = [inset, inset, width - inset, height - inset];
  return `M${l + c} ${t}H${r - c}L${r} ${t + c}V${b - c}L${r - c} ${b}H${l + c}L${l} ${b - c}V${t + c}Z`;
};

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
    yield* render(`SelectionHandLabelP${slot + 1}`, 'SelectionHandLabel.svg', { LABEL_COLOR: hex(color.rgb), LABEL_TEXT: `P${slot + 1}` }, true);
    yield* render(`SelectionChipCPUP${slot + 1}`, 'SelectionChip.svg', { CHIP_COLOR: '#626977', CHIP_LABEL: `P${slot + 1}` }, true);
    yield* render(`SelectionCard${color.name}`, 'SelectionCard.svg', { CARD_COLOR: hex(mix(color.rgb, 0x000000, 0.4)), CARD_EDGE: hex(mix(color.rgb, 0xffffff, 0.35)), CARD_METAL: '#bbc6cf' }, false);
    yield* render(`MarkerArrow${slot}`, 'MarkerArrow.svg', { ARROW_COLOR: hex(color.rgb) }, false);
  }
  for (const [pose, art] of [['Point', 'point'], ['Fan', 'fan'], ['Pinch', 'pinch']] as const) {
    yield* run(['magick', join(source, `wc3-hand-${art}.png`), '-filter', 'point', '-resize', `${HAND_ART_COLUMNS}x${HAND_ART_ROWS}!`, '-background', 'none', '-gravity', 'northwest', '-splice', `${HAND_MARGIN}x${HAND_MARGIN}`, '-extent', `${HAND_TEXELS}x${HAND_TEXELS}`, '-depth', '8', `TGA:${join(output, `SelectionHand${pose}.tga`)}`]);
  }
  for (const race of RACES) {
    const colours = RACE_COLOURS[race];
    yield* render(`RaceBacking${race}`, 'RaceBacking.svg', { BACKING_LIGHT: hex(colours.light), BACKING_MID: hex(colours.mid), BACKING_DARK: hex(colours.dark) }, false);
    yield* render(`NamePlate${race}`, 'NamePlate.svg', { RACE_TINT: hex(colours.tint) }, false);
    yield* run(['magick', join(output, `NamePlate${race}.tga`), '-flop', '-depth', '8', `TGA:${join(output, `NamePlateMirror${race}.tga`)}`]);
  }
  for (let bars = 1; bars <= 4; bars++) {
    const fills = Object.fromEntries([1, 2, 3, 4].map(bar => [`BAR${bar}`, bar <= bars ? '#dbe8f2' : '#262a31']));
    yield* render(`PingSignal${bars}`, 'PingSignal.svg', fills, false);
  }
  for (const name of ['StockStrip', 'StockRing']) yield* run(['magick', '-background', 'none', join(source, `${name}.svg`), '-depth', '8', `TGA:${join(output, `${name}.tga`)}`]);
  yield* run(['magick', join(output, 'StockStrip.tga'), '-flop', '-depth', '8', `TGA:${join(output, 'StockStripMirror.tga')}`]);
  yield* gameCursorArt(source, output, run);
  yield* render('SelectionCardGray', 'SelectionCard.svg', { CARD_COLOR: '#30353b', CARD_EDGE: '#555d65', CARD_METAL: '#687078' }, false);
  for (const item of barArt()) {
    const style = BAR_STYLES[item.style];
    const width = Math.round(item.width * BAR_PIXELS), height = Math.round(item.height * BAR_PIXELS);
    yield* render(barArtName(item.style, item), 'SelectBarFrame.svg', {
      OUTER_PATH: chamfered(width, height, style.corner, style.stroke / 2), INNER_PATH: chamfered(width, height, style.corner, style.stroke + 1.2),
      FILL_TOP: style.fill[0], FILL_BOTTOM: style.fill[1], FILL_OPACITY: String(style.opacity), EDGE_TOP: style.edge[0], EDGE_BOTTOM: style.edge[1], STROKE: String(style.stroke),
      INNER_COLOR: style.inner, INNER_OPACITY: String(style.innerOpacity), WIDTH: String(width), HEIGHT: String(height),
    }, false);
  }
  const stripHeight = Math.round(BAR_STRIP.height * BAR_PIXELS);
  yield* render('SelectBarStrip', 'SelectBarStrip.svg', { LINE_Y: String(stripHeight - 3), WIDTH: String(Math.round(BAR_STRIP.width * BAR_PIXELS)), HEIGHT: String(stripHeight) }, false);
  for (const name of ['SelectBarChevron', 'SelectBarGear', 'SelectBarCheck']) yield* run(['magick', '-background', 'none', join(source, `${name}.svg`), '-depth', '8', `TGA:${join(output, `${name}.tga`)}`]);
  yield* run(['magick', join(output, 'SelectBarChevron.tga'), '-flip', '-depth', '8', `TGA:${join(output, 'SelectBarChevronUp.tga')}`]);
  for (const name of ['SelectionBackdrop', 'SelectionTileFrame', 'SelectionAction', 'StageBackdrop', 'StageChip', 'SelectionBullseye', 'SelectionThreeBridges']) {
    yield* run(['magick', '-background', 'none', join(source, `${name}.svg`), '-depth', '8', `TGA:${join(output, `${name}.tga`)}`]);
  }
  const extractor = findExtractor();
  if (extractor === undefined || extractor === null) return yield* Effect.fail(ioFailure('SelectionRandom needs CASC_EXTRACTOR (smashcraft-tools extract-animation-assets builds it)'));
  const randomIcon = join(output, 'BTNSelectHeroOn.dds');
  yield* run([extractor, process.env.WC3_STORAGE ?? reforgedStorage(), 'war3.w3mod:replaceabletextures/commandbuttons/btnselectheroon.dds', randomIcon]);
  // The stock 64 px icon bevels its outer 4 px; the tile keeps only the "?" inside it, inset on the backdrop behind every fighter tile.
  yield* run(['magick', ...TILE_BACKGROUND, '(', randomIcon, '-crop', '55x56+5+4', '+repage', '-resize', `${RANDOM_ICON_PX}x${RANDOM_ICON_PX}`, '(', '+clone', '-channel', 'RGB', '-separate', '-evaluate-sequence', 'max', '+channel', '-level', '0,20%', ')', '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', ')', '-compose', 'over', '-gravity', 'center', '-composite', '-alpha', 'off', '-depth', '8', `TGA:${join(output, 'SelectionRandom.tga')}`]);
  yield* Effect.try({ try: () => rmSync(randomIcon), catch: ioFailure });
  const files = yield* Effect.try({ try: () => [...new Bun.Glob('*.tga').scanSync(output)].sort().map((file) => join(output, file)), catch: ioFailure });
  console.log(yield* run(['magick', 'identify', ...files]));
}).pipe(Effect.provide(BunServices.layer)));
