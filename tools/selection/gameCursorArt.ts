import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { Effect } from '../../ts/node_modules/effect/dist/index.js';
import type { runProcess } from '../../ts/scripts/hostProcess';

export const CURSOR_CELL = 32;
export const CURSOR_COLUMNS = 8;
export const CURSOR_ROWS = 4;
export const CURSOR_TEXTURE = 'GameCursor';

// Warcraft's cursor model samples the pointer cells so the click point sits 8 px right of and 1 px below a cell's corner.
const POINTER_HOTSPOT = { x: 8, y: 1 };
const POINTER_ART = { width: 24, height: 31, tipFromLeft: 5 };

const POINTER_CELLS = [
  ...Array.from({ length: CURSOR_COLUMNS }, (_, column) => [column, 0] as const),
  [0, 3], [3, 3], [4, 3],
] as const;
const RETICLE_CELLS = Array.from({ length: CURSOR_COLUMNS }, (_, column) => [column, 2] as const);
const ARROW_CELLS = [[5, 3], [6, 3], [7, 3]] as const;
const TARGET_CELL = [1, 3] as const;
const INVALID_CELL = [2, 3] as const;

type Run = (command: readonly [string, ...string[]]) => ReturnType<typeof runProcess>;
type Cell = readonly [column: number, row: number];

const place = (art: string, [column, row]: Cell) => ['(', art, ')', '-geometry', `+${column * CURSOR_CELL}+${row * CURSOR_CELL}`, '-composite'];

export const gameCursorArt = (source: string, output: string, run: Run) => Effect.gen(function*() {
  const cell = `${CURSOR_CELL}x${CURSOR_CELL}`;
  const pointer = join(output, 'GameCursorPointer.png');
  const reticle = join(output, 'GameCursorReticle.png');
  const target = join(output, 'GameCursorTarget.png');
  const invalid = join(output, 'GameCursorInvalid.png');
  const arrow = join(output, 'GameCursorArrow.png');
  const offset = `${POINTER_HOTSPOT.x - POINTER_ART.tipFromLeft}x${POINTER_HOTSPOT.y}`;
  yield* run(['magick', join(source, 'wc3-hand-point.png'), '-filter', 'point', '-resize', `${POINTER_ART.width}x${POINTER_ART.height}!`, '-flop', '-background', 'none', '-gravity', 'northwest', '-splice', offset, '-extent', cell, pointer]);
  yield* run(['magick', '-background', 'none', join(source, 'SelectionBullseye.svg'), '-resize', '30x30', '-gravity', 'center', '-extent', cell, reticle]);
  yield* run(['magick', reticle, '-fill', '#19e6ff', '-colorize', '70', target]);
  yield* run(['magick', reticle, '-fill', '#ff2a2a', '-colorize', '75', '-stroke', '#ff2a2a', '-strokewidth', '3', '-draw', 'line 8,24 24,8', invalid]);
  yield* run(['magick', '-size', cell, 'xc:none', '-fill', '#bfe6ff', '-stroke', '#16324a', '-strokewidth', '1', '-draw', 'polygon 9,6 25,16 9,26 14,16', arrow]);
  const cells = [...POINTER_CELLS.flatMap((at) => place(pointer, at)), ...RETICLE_CELLS.flatMap((at) => place(reticle, at)), ...ARROW_CELLS.flatMap((at) => place(arrow, at)), ...place(target, TARGET_CELL), ...place(invalid, INVALID_CELL)];
  yield* run(['magick', '-size', `${CURSOR_COLUMNS * CURSOR_CELL}x${CURSOR_ROWS * CURSOR_CELL}`, 'xc:none', ...cells, '-depth', '8', `TGA:${join(output, `${CURSOR_TEXTURE}.tga`)}`]);
  yield* Effect.try({ try: () => [pointer, reticle, target, invalid, arrow].forEach((file) => rmSync(file)), catch: String });
});
