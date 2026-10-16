import { expect, test } from 'bun:test';
import { answerKey, coldReadBatch, coldReadBatches, crouchSeconds, doubleJumpSeconds, ledgeSeconds, stripId } from '../scripts/wisp/animMovementRows';
import type { CrouchSample, JumpSample, LedgeSample } from '../scripts/wisp/animScoreSample';

const crouch = { standSeconds: 0.5, crouchSeconds: 2.25 } as CrouchSample;
const ledge = { hangSeconds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } as LedgeSample;
const jumps = { firstSeconds: Array.from({ length: 16 }, (_, index) => index), secondSeconds: Array.from({ length: 16 }, (_, index) => 100 + index) } as JumpSample;

test('a movement strip draws the sampler frames: the held crouch, the hang and the second jump [k3 measure docs/animation-scorecard.md]', () => {
  expect(crouchSeconds(crouch)).toEqual([0.5, 2.25]);
  expect(ledgeSeconds(ledge)).toEqual([1, 4, 7, 10]);
  expect(doubleJumpSeconds(jumps)).toEqual([100, 103, 106, 109, 112, 115]);
});

test('a cold-read batch names no fighter or pose, and the answer key alone maps strip ids back to them [k2 property]', () => {
  const strips = (['crouch', 'ledge-hang', 'double-jump'] as const).map((move) => ({ id: stripId('classic', 'grom-hellscream', move), fighter: 'grom-hellscream', move, path: `/private/strip-${stripId('classic', 'grom-hellscream', move)}.png` }));
  const text = coldReadBatches(strips).map((batch) => coldReadBatch('brief', 'classic', batch, '/private/cold-answers-1.jsonl')).join('\n');
  for (const word of ['grom', 'hellscream', 'crouch', 'ledge-hang', 'double-jump']) expect(text).not.toContain(word);
  expect(new Set(strips.map((strip) => strip.id)).size).toBe(3);
  const key = answerKey('classic', strips).split('\n');
  expect(key[0]).toBe('look\tstrip\tfighter\tmove\texpected');
  for (const strip of strips) expect(key.some((line) => line.startsWith(`classic\t${strip.id}\tgrom-hellscream\t${strip.move}\t`))).toBe(true);
});
