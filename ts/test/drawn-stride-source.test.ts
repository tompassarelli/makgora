import { expect, test } from 'bun:test';
import { drawnStrideSource, type DrawnStride } from '../scripts/wisp/drawnMotion';
import { Character } from '../src/game/sim/codes';

const row = (character: Character, motion: 'walk' | 'run', speed: number): DrawnStride => ({ character, motion, clip: 1, model: 'm.mdl', speed });
const ids = (source: string) => [...source.matchAll(/^ {2}(\d+): \{/gm)].map((match) => Number(match[1]));
const appended = (rows: readonly DrawnStride[]) => [...new Set(rows.map((entry) => entry.character))];

test('rewriting an existing stride entry after a later one keeps the generated file in character-id order [k2 property]', () => {
  const rows = [row(Character.grom, 'walk', 1), row(Character.grom, 'run', 2), row(Character.thrall, 'walk', 3), row(Character.thrall, 'run', 4), row(Character.grom, 'walk', 5)];
  const written = ids(drawnStrideSource(rows));
  expect(written).toEqual([...written].sort((a, b) => a - b));
  expect(appended(rows)).not.toEqual([...appended(rows)].sort((a, b) => a - b));
});
