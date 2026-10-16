import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../codes";
import { CAIRNE_MOVES } from "./cairneMoves";

test("Cairne's down smash stomps in front on frames 19-22 for 18% with an upward pop-up, then behind on 29-32 for 16%, interruptible by frame 45 [k1 scenario]", () => {
  const move = CAIRNE_MOVES.normals[AttackStyle.downSmash]!;
  assertEquals(move.regions.length, 2);
  assertEquals(move.totalFrames, 45);
  const [front, rear] = move.regions.map(region => region.hit);
  const [frontFrames, rearFrames] = move.regions;
  assertEquals(frontFrames!.firstFrame + 1, 19);
  assertEquals(frontFrames!.lastFrame + 1, 22);
  assertEquals(rearFrames!.firstFrame + 1, 29);
  assertEquals(rearFrames!.lastFrame + 1, 32);
  assertEquals(front!.effect.damage, 18.0);
  assertEquals(front!.effect.base, 30.0);
  assertEquals(front!.effect.growth, 100.0);
  assertGreaterThan(front!.effect.launchZ, f32(0.95));
  assertGreaterThan(front!.effect.launchX, 0.0);
  assertEquals(rear!.effect.damage, 16.0);
  assertEquals(rear!.effect.base, 20.0);
  assertEquals(rear!.effect.growth, 100.0);
  assertLessThan(rear!.effect.launchX, 0.0);
  assertGreaterThan(front!.strike!.x2, 0.0);
  assertLessThan(rear!.strike!.x2, 0.0);
});
