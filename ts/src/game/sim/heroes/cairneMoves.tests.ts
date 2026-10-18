import { assertDefined, assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack } from "../attacks";
import { AttackStyle, Character } from "../codes";
import { createFighter } from "../fighter";
import { hurtCapsule } from "../geometry/contactGeometry";
import { duelPair, lift, stepDuel } from "../testDuel";
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

function stomp(arrival: number) {
  const owner = createFighter(Character.cairne, 0.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  const { world } = duelPair(owner, target);
  const top = hurtCapsule(Character.rifleman).z2, z = 600.0;
  lift(owner, z);
  beginFighterAttack(world, 0, AttackStyle.downAir, false);
  for (let step = 1; step <= 40; step++) {
    const frame = step + 1;
    lift(owner, z);
    lift(target, f32(z - top + 10.0));
    target.motion.x = frame >= arrival ? 0.0 : 600.0;
    const before = target.status.damage;
    stepDuel(world);
    if (target.status.damage > before) {
      return { frame, damage: f32(target.status.damage - before), x: target.launch.knockbackX, z: target.launch.knockbackZ, grounded: target.motion.grounded };
    }
  }
  return undefined;
}

test("Cairne's down air stomp meteors an airborne foe for 18% on frames 21-23, then its late hooves pop him up and away for 12% on 24-27 [k1 scenario]", () => {
  assertEquals(assertDefined(stomp(1)).frame, 21);
  for (let frame = 21; frame <= 27; frame++) {
    const hit = assertDefined(stomp(frame));
    assertEquals(hit.frame, frame);
    assertEquals(hit.grounded, false);
    if (frame <= 23) {
      assertEquals(hit.damage, 18.0);
      assertEquals(hit.x, 0.0);
      assertLessThan(hit.z, 0.0);
    } else {
      assertEquals(hit.damage, 12.0);
      assertGreaterThan(hit.x, 0.0);
      assertGreaterThan(hit.z, 0.0);
    }
  }
  assertEquals(stomp(28), undefined);
});
