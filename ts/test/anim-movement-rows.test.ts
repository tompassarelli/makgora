import { expect, test } from 'bun:test';
import { crouchSeconds, doubleJumpSeconds, ledgeSeconds } from '../scripts/wisp/animMovementRows';
import type { CrouchSample, JumpSample, LedgeSample } from '../scripts/wisp/animScoreSample';

const crouch = { standSeconds: 0.5, crouchSeconds: 2.25 } as CrouchSample;
const ledge = { hangSeconds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } as LedgeSample;
const jumps = { firstSeconds: Array.from({ length: 16 }, (_, index) => index), secondSeconds: Array.from({ length: 16 }, (_, index) => 100 + index) } as JumpSample;

test('a movement strip draws the sampler frames: the held crouch, the hang and the second jump [k3 measure docs/animation-scorecard.md]', () => {
  expect(crouchSeconds(crouch)).toEqual([0.5, 2.25]);
  expect(ledgeSeconds(ledge)).toEqual([1, 4, 7, 10]);
  expect(doubleJumpSeconds(jumps)).toEqual([100, 103, 106, 109, 112, 115]);
});
