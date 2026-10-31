import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { RECOVERY_CLIPS } from "../src/game/presentation/recoveryClipInfo";
import { actions, phaseAt, quaternion } from "../../tools/animations/recovery-actions";

const DEGREES = 180 / Math.PI;

function bodyAxes(roll: number, yaw: number): { readonly tilt: number; readonly heading: number } {
  const [x = 0, y = 0, z = 0, w = 1] = quaternion(roll, yaw);
  const up = 1 - 2 * (x * x + y * y);
  const forwardX = 1 - 2 * (y * y + z * z), forwardY = 2 * (x * y + w * z);
  return { tilt: Math.acos(Math.min(1, up)) * DEGREES, heading: Math.abs(Math.atan2(forwardY, forwardX) * DEGREES) };
}

test("every recovery fighter's turn sweeps its body from the old facing to the new one while staying upright: the root's up axis stays within a degree of vertical on every frame, so a tall back piece such as Blademaster's banner never tips backward mid-turn [k2 property]", () => {
  const fighters = Object.keys(RECOVERY_CLIPS).map(Number) as Character[];
  expect(fighters).toContain(Character.blademaster);
  for (const character of fighters) {
    const turn = actions(character).find(action => action.pose === "turn");
    expect(turn, `fighter ${character}: a turn action`).toBeDefined();
    if (turn === undefined) continue;
    const frames = Array.from({ length: turn.frames + 1 }, (_, frame) => {
      const p = phaseAt(turn.phases, frame / turn.frames);
      return bodyAxes(p.roll + p.lean, p.yaw);
    });
    expect(frames[0]?.heading).toBeCloseTo(180, 3);
    expect(frames.at(-1)?.heading).toBeCloseTo(0, 3);
    for (const [frame, axes] of frames.entries()) expect(axes.tilt, `fighter ${character} turn frame ${frame}`).toBeLessThan(1);
  }
});
