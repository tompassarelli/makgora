import { assertDefined, assertEquals, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../codes";
import { createFighter } from "../fighter";
import { SpecialForm, specialForm } from "../specials/schema";
import { ROSTER_MANA } from "../mana";
import { duelPair, stepDuel } from "../testDuel";
import { controls } from "../testWorld";
import { authoredPhysics, melee } from "../tuning";
import { heroBody } from "./heroBodies";

test("Cairne takes King K. Rool's weight and speeds and has a larger body than Pit Lord [k4 reference ssbu]", () => {
  const physics = authoredPhysics(Character.cairne);
  assertNear(physics.weight, 143.0, f32(0.0001));
  assertNear(physics.runSpeed, melee(f32(1.485)), f32(0.0001));
  assertNear(physics.airSpeed, melee(f32(0.945)), f32(0.0001));
  assertGreaterThan(heroBody(Character.cairne)?.width ?? 0, heroBody(Character.pitLord)?.width ?? 0);
  assertGreaterThan(heroBody(Character.cairne)?.height ?? 0, heroBody(Character.pitLord)?.height ?? 0);
});

test("Cairne short-hop Shockwave lands during startup and keeps grounded spawn and recovery in both facings [k1 scenario]", () => {
  for (const facing of [-1, 1]) {
    for (const ex of [false, true]) {
      const air = duelPair(createFighter(Character.cairne, 0.0, facing), createFighter(Character.rifleman, -500.0 * facing, -facing));
      const grounded = duelPair(createFighter(Character.cairne, 0.0, facing), createFighter(Character.rifleman, -500.0 * facing, -facing));
      air.owner.mana.points = ROSTER_MANA.max;
      grounded.owner.mana.points = ROSTER_MANA.max;
      const specials = assertDefined(air.owner.tuning.specials);
      const ground = specialForm(specials.neutral, SpecialForm.ground, ex);
      const wave = assertDefined(ground.projectiles?.[0]);
      stepDuel(air.world, controls({ jumpPressed: true, shortHopPressed: true }));
      for (let tick = 1; tick < 11; tick++) stepDuel(air.world);
      assertEquals(air.owner.motion.grounded, false);
      const press = controls({ specialPressed: true, exPressed: ex });
      stepDuel(air.world, press);
      stepDuel(grounded.world, press);
      assertEquals(air.owner.special.form, SpecialForm.air);
      assertEquals(air.owner.special.ex, ex);
      let landedAt = 0;
      for (let frame = 1; frame <= ground.endFrame; frame++) {
        if (frame > 1) {
          stepDuel(air.world);
          stepDuel(grounded.world);
        }
        if (landedAt === 0 && air.owner.motion.grounded) {
          landedAt = frame;
          assertTrue(frame < wave.spawnFrame);
          assertEquals(air.owner.special.form, SpecialForm.ground);
        }
        assertEquals(air.owner.special.action, grounded.owner.special.action);
        assertEquals(air.owner.special.frame, grounded.owner.special.frame);
        assertEquals(air.owner.special.duration, ground.endFrame);
        assertEquals(air.owner.special.lockFrames, grounded.owner.special.lockFrames);
        assertEquals(air.owner.attack.cooldown, grounded.owner.attack.cooldown);
        if (landedAt > 0) assertEquals(air.owner.landing.lag, grounded.owner.special.lockFrames);
        const waves = air.owner.projectiles.filter(projectile => projectile.life > 0);
        assertEquals(waves.length, frame >= wave.spawnFrame ? 1 : 0);
        if (frame === wave.spawnFrame) {
          const projectile = assertDefined(waves[0]);
          assertEquals(projectile.spec, wave);
          assertEquals(projectile.velocityX, f32(wave.velocityX * facing));
          assertEquals(projectile.z, f32(air.owner.motion.z + wave.offsetZ));
        }
      }
      assertGreaterThan(landedAt, 0);
      assertEquals(air.owner.special.action, SpecialAction.none);
      assertEquals(air.owner.landing.lag, grounded.owner.special.lockFrames);
      stepDuel(air.world, controls({ jumpPressed: true, shortHopPressed: true }));
      stepDuel(grounded.world, controls({ jumpPressed: true, shortHopPressed: true }));
      assertGreaterThan(air.owner.jump.squat, 0);
      assertEquals(air.owner.jump.squat, grounded.owner.jump.squat);
      assertEquals(air.owner.landing.lag, 0);
    }
  }
});
