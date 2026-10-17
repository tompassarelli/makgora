import { expect, test } from 'bun:test';
import { answerKey, coldReadBatch, coldReadBatches, crouchFrames, doubleJumpFrames, ledgeCorner, ledgeFrames, movementCrop, stageDrawArgs, stageShape, stripId } from '../scripts/wisp/animMovementRows';
import type { CrouchSample, JumpSample, LedgeSample } from '../scripts/wisp/animScoreSample';
import { Character } from '../src/game/sim/codes';
import { createFighter } from '../src/game/sim/fighter';
import { snapToLedge } from '../src/game/sim/ledge';
import { createRoster } from '../src/game/sim/roster';
import { mainDeckRight, mainDeckZ } from '../src/game/sim/stage';

const crouch = { standSeconds: 0.5, crouchSeconds: 2.25 } as CrouchSample;
const ledge = { hangSeconds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } as LedgeSample;
const jumps = { firstSeconds: Array.from({ length: 16 }, (_, index) => index), secondSeconds: Array.from({ length: 16 }, (_, index) => 100 + index), secondHeights: Array.from({ length: 16 }, (_, index) => 200 + 10 * index) } as JumpSample;

test('a movement strip draws the sampler frames: the held crouch, the hang and the second jump [k3 measure docs/animation-scorecard.md]', () => {
  expect(crouchFrames(crouch)).toEqual({ seconds: [0.5, 2.25], heights: [0, 0] });
  expect(ledgeFrames(ledge)).toEqual({ seconds: [1, 4, 7, 10], heights: [0, 0, 0, 0] });
  expect(doubleJumpFrames(jumps)).toEqual({ seconds: [100, 103, 106, 109, 112, 115], heights: [200, 230, 260, 290, 320, 350] });
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

test('a ledge-hang strip draws the stage corner where the sim hangs the fighter from it, and a crouch or jump strip draws the floor under the feet [k2 property]', () => {
  const f = createFighter(Character.grom, 0.0, 1);
  expect(snapToLedge(createRoster(1, [f]), 0, 0, 1)).toBe(true);
  const sim = { x: Math.abs(f.motion.x - mainDeckRight(0)), z: mainDeckZ(0) - f.motion.z };
  expect(ledgeCorner()).toEqual(sim);
  const ppu = 0.5;
  expect(stageShape('ledge-hang', ppu)).toEqual({ kind: 'corner', x: 960 + sim.x * ppu, y: 540 + (90 - sim.z) * ppu });
  expect(stageShape('crouch', ppu)).toEqual({ kind: 'floor', y: 540 + 90 * ppu });
  expect(stageShape('double-jump', ppu)).toEqual(stageShape('crouch', ppu));
  expect(stageDrawArgs(stageShape('ledge-hang', ppu)).join(' ')).toContain(`rectangle ${(960 + sim.x * ppu).toFixed(1)},`);
  expect(movementCrop([0, 0], ppu)).toBe('480x360+0-60');
  expect(movementCrop([200, 350], ppu)).toBe('480x536+0-148');
});
