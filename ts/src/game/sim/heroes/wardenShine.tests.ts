import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../codes";
import { createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { controls } from "../testWorld";
import { duelPair, stepDuel } from "../testDuel";

const shine = controls({ specialPressed: true, specialZ: -1 });

test("Maiev's Fan of Knives works like Falco's shine: a frame-one hit that pops the foe straight up, a jump out from frame 4 and an air hold [k1 scenario]", () => {
  const maiev = createFighter(Character.warden, 0.0, 1);
  maiev.mana.points = 100;
  const target = createFighter(Character.rifleman, f32(HERO_REFERENCE_HEIGHT * f32(0.5)), -1);
  const { world } = duelPair(maiev, target);
  stepDuel(world, shine);
  assertTrue(target.status.damage > 0.0);
  assertTrue(maiev.status.invincible > 0);
  let peak = 0.0;
  while (maiev.special.frame < 3) stepDuel(world);
  stepDuel(world, controls({ jumpPressed: true }));
  assertEquals(maiev.special.action, SpecialAction.heroDown);
  while (maiev.special.frame < 4) stepDuel(world);
  stepDuel(world, controls({ jumpPressed: true }));
  assertEquals(maiev.special.action, SpecialAction.none);
  assertTrue(maiev.jump.squat > 0);
  for (let frame = 0; frame < 20; frame++) {
    stepDuel(world);
    peak = Math.max(peak, target.motion.z);
  }
  assertTrue(peak > f32(HERO_REFERENCE_HEIGHT * f32(0.5)));
  assertTrue(Math.abs(f32(target.motion.x - f32(HERO_REFERENCE_HEIGHT * f32(0.5)))) < peak / 2.0);

  const flier = createFighter(Character.warden, 0.0, 1);
  flier.mana.points = 100;
  const air = duelPair(flier, createFighter(Character.rifleman, 900.0, -1));
  flier.motion.grounded = false;
  flier.motion.z = 400.0;
  flier.motion.vz = -5.0;
  stepDuel(air.world, shine);
  const held = flier.motion.z;
  for (let frame = 2; frame <= 25; frame++) stepDuel(air.world);
  assertEquals(flier.special.action, SpecialAction.heroDown);
  assertEquals(flier.motion.z, held);
});
