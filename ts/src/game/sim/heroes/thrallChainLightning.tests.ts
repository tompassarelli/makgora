import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { createFighter } from "../fighter";
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
