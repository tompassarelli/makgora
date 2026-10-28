import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster, neutralControls } from "../src/game/sim/roster";
import { advanceFighter } from "../src/game/sim/step";
import { advanceFighterPose, createFighterPose } from "../src/game/presentation/fighterPose";
import { FRAME_SECONDS } from "../src/game/presentation/frameClock";
import { IllidanLocomotion } from "../src/game/presentation/illidanMotion";

const STOCK_WALK = 107;
const WALK_SECONDS = 0.875;
const PLANTED_FOOT_SPEED = 890.0;
const LOCOMOTION_RUN = 120;
const RUN_STRIDE = 332.739;

function gait(walking: boolean): { readonly motion: IllidanLocomotion; readonly clip: number | undefined; readonly rate: number; readonly time: number; readonly ground: number }[] {
  const f = createFighter(Character.demonHunter, 0.0, 1);
  const world = createRoster(1, [f]);
  const pose = createFighterPose();
  const input = neutralControls();
  input.direction = 1;
  input.walking = walking;
  const frames = [];
  for (let frame = 1; frame <= 40; frame++) {
    advanceFighter(world, 0, 0, input, 0.0);
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    frames.push({ motion: pose.motion.motion, clip: pose.clipIndex, rate: pose.rate, time: pose.clipTime, ground: Math.abs(f.motion.vx) / FRAME_SECONDS });
  }
  return frames;
}

function expectPlantedStockWalk(frames: ReturnType<typeof gait>): void {
  const moving = frames.filter(frame => frame.motion === IllidanLocomotion.walk && frame.ground > 1.0);
  expect(moving.length).toBeGreaterThan(10);
  let previous: number | undefined;
  for (const frame of moving) {
    expect(frame.clip).toBe(STOCK_WALK);
    expect(Math.abs(frame.rate * PLANTED_FOOT_SPEED - frame.ground) / frame.ground).toBeLessThan(0.02);
    if (previous !== undefined) {
      const advanced = (frame.time - previous + WALK_SECONDS) % WALK_SECONDS;
      expect(advanced).toBeGreaterThan(0.0);
      expect(advanced).toBeLessThan(0.05);
    }
    previous = frame.time;
  }
}

test("Illidan walks on the Demon Hunter's stock Walk with its planted foot sweeping back at his ground speed, and runs on his Locomotion Run at its drawn stride, faster than the walk [k3 measure docs/fighter-animation-work.md]", () => {
  const walk = gait(true);
  const run = gait(false);
  expectPlantedStockWalk(walk);
  const running = run.filter(frame => frame.motion === IllidanLocomotion.run && frame.ground > 1.0);
  expect(running.length).toBeGreaterThan(10);
  for (const frame of running) {
    expect(frame.clip).toBe(LOCOMOTION_RUN);
    expect(Math.abs(frame.rate * RUN_STRIDE - frame.ground) / frame.ground).toBeLessThan(0.02);
  }
  expect(walk.at(-1)!.rate).toBeLessThan(run.at(-1)!.rate);
});
