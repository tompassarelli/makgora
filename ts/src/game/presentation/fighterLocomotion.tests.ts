import { assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { groundLocomotionClip, groundLocomotionRate } from "./fighterLocomotion";
import { IllidanLocomotion } from "./illidanMotion";

function stepsPerSecond(motion: IllidanLocomotion, speed: (physics: { readonly walkSpeed: number; readonly runSpeed: number }) => number): number {
  const fighter = createFighter(Character.demonHunter, 0.0, 1);
  const clip = groundLocomotionClip(Character.demonHunter, motion);
  assertTrue(clip !== undefined);
  fighter.motion.vx = speed(fighter.tuning.physics);
  return f32(2.0 * f32(groundLocomotionRate(fighter, motion, clip) / clip!.seconds));
}

test("Illidan's full walk plays about 4.8 steps a second and at most three quarters of his run's cadence, so the walk reads slower than the run [k3 measure docs/fighter-animation-work.md]", () => {
  const walk = stepsPerSecond(IllidanLocomotion.walk, (physics) => physics.walkSpeed);
  const run = stepsPerSecond(IllidanLocomotion.run, (physics) => physics.runSpeed);
  assertTrue(walk > f32(4.4) && walk < f32(5.2));
  assertTrue(walk <= f32(run * 0.75));
});
