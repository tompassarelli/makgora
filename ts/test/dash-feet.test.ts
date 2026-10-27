import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster, neutralControls } from "../src/game/sim/roster";
import { advanceFighter } from "../src/game/sim/step";
import { advanceFighterPose, createFighterPose } from "../src/game/presentation/fighterPose";
import { FRAME_SECONDS } from "../src/game/presentation/frameClock";

const WALK_SECONDS = 1.0;
const PLANTED_HEEL_SPEED = 225.0;
const STANCES: readonly (readonly [number, number])[] = [[0.175, 0.45], [0.65, 0.95]];

test("the Dreadlord's feet track the ground from his first dash frame: frame 1 shows a planted stance of his Walk, the planted foot sweeps back at his ground speed through dash frames 1-10, and the stride runs on into run without restarting [k3 measure #171]", () => {
  const f = createFighter(Character.dreadlord, 0.0, 1);
  const world = createRoster(1, [f]);
  const pose = createFighterPose();
  const input = neutralControls();
  input.direction = 1;
  let previous: number | undefined;
  for (let frame = 1; frame <= 20; frame++) {
    advanceFighter(world, 0, 0, input, 0.0);
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    expect(pose.clipIndex).toBe(5);
    if (frame === 1) expect(STANCES.some(([from, to]) => pose.clipTime >= from && pose.clipTime <= to)).toBe(true);
    if (frame <= 10) {
      const ground = Math.abs(f.motion.vx) / FRAME_SECONDS;
      expect(Math.abs(pose.rate * PLANTED_HEEL_SPEED - ground) / ground).toBeLessThan(0.05);
    }
    if (previous !== undefined) {
      const advanced = (pose.clipTime - previous + WALK_SECONDS) % WALK_SECONDS;
      expect(advanced).toBeGreaterThan(0.0);
      expect(advanced).toBeLessThan(0.1);
    }
    previous = pose.clipTime;
  }
});
