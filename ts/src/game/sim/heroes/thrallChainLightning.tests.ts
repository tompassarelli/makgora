import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { type Fighter, createFighter } from "../fighter";
import { setWorldMotionValue } from "../motion";
import { controls } from "../testWorld";
import { duelPair, stepDuel } from "../testDuel";

const strike = { frame: 0, damage: 0.0 };

function struckAt(gap: number, ex = false): number {
  const thrall = createFighter(Character.thrall, -320.0, 1);
  thrall.mana.points = 100;
  const target = createFighter(Character.rifleman, f32(-320.0 + gap), -1);
  const { world } = duelPair(thrall, target);
  stepDuel(world, controls({ specialPressed: true, exPressed: ex }));
  strike.frame = 0;
  strike.damage = 0.0;
  for (let frame = 2; frame <= 60; frame++) {
    if (target.status.damage > 0.0) {
      strike.frame = frame - 1;
      strike.damage = target.status.damage;
      return strike.frame;
    }
    assertTrue(thrall.projectiles.every(projectile => projectile.life <= 0));
    stepDuel(world);
  }
  return 0;
}

test("Thrall's Chain Lightning is a slow-cast beam: it strikes a foe 450 units away only after its long cast, and a foe 640 units away goes free [k1 scenario]", () => {
  const near = struckAt(450.0);
  assertTrue(near >= 25);
  assertEquals(struckAt(640.0), 0);
});

test("EX Chain Lightning strikes the same foe a quarter harder than the plain cast [k3 measure #329]", () => {
  assertTrue(struckAt(450.0) > 0);
  const plain = strike.damage;
  assertTrue(struckAt(450.0, true) > 0);
  assertNear(strike.damage, f32(plain * 1.25), f32(0.01));
});

function place(fighter: Fighter, x: number, z: number): void {
  fighter.motion.grounded = z <= 0.0;
  fighter.motion.x = x;
  fighter.motion.z = z;
  fighter.motion.vx = 0.0;
  fighter.motion.vz = 0.0;
  setWorldMotionValue(fighter.motion.meleeX, x);
  setWorldMotionValue(fighter.motion.meleeZ, z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, 0.0);
}

function struckWhileMoving(vx: number, vz: number): boolean {
  const thrall = createFighter(Character.thrall, -320.0, 1);
  thrall.mana.points = 100;
  const target = createFighter(Character.rifleman, -20.0, -1);
  const { world } = duelPair(thrall, target);
  for (let frame = 1; frame <= 40; frame++) {
    if (frame > 1) place(target, f32(-20.0 + f32(vx * (frame - 1))), f32(vz * (frame - 1)));
    stepDuel(world, frame === 1 ? controls({ specialPressed: true }) : controls());
    if (target.status.damage > 0.0) return true;
  }
  return false;
}

test("Chain Lightning aims where the foe stood when Thrall began: it covers the line through that spot but never turns to follow a foe who leaves it [k2 property]", () => {
  assertTrue(struckWhileMoving(0.0, 0.0));
  assertTrue(struckWhileMoving(6.0, 0.0));
  assertTrue(!struckWhileMoving(0.0, 6.0));
});
