import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { authoredPhysics, melee } from "../tuning";
import { capsulesIntersect, emptyCapsule, placeCapsule } from "../geometry/contactGeometry";
import { CHEN_SPECIALS } from "./chenSpecials";
import { createFighter } from "../fighter";
import { duelPair, stepDuel } from "../testDuel";
import { controls } from "../testWorld";

test("Chen takes his measured body from Ultimate Ryu [k4 reference ssbu]", () => {
  const body = authoredPhysics(Character.chen);
  assertEquals(body.weight, 103.0);
  assertTrue(Math.abs(body.runSpeed - melee(f32(1.6))) < f32(0.00001));
  assertEquals(body.airSpeed, melee(f32(1.12)));
});

test("Chen's fire cone stays narrow at the mouth and widens through the long tip in either facing [k3 measure docs/design/chen.md]", () => {
  const points = [
    { x: 36.0, z: 88.0, hit: true }, { x: 36.0, z: 92.0, hit: false },
    { x: 256.0, z: 130.0, hit: true }, { x: 256.0, z: 134.0, hit: false },
    { x: 320.0, z: 62.0, hit: true }, { x: 330.0, z: 62.0, hit: false },
  ];
  for (const facing of [-1, 1]) for (const move of [CHEN_SPECIALS.neutral.ground, assertDefined(CHEN_SPECIALS.neutral.air)]) {
    for (const point of points) {
      const probe = { x1: f32(point.x * facing), z1: point.z, x2: f32(point.x * facing), z2: point.z, radius: 0.0 };
      const placed = emptyCapsule();
      let hit = false;
      for (const region of move.regions ?? []) {
        const strike = assertDefined(region.hit.strike);
        placeCapsule(placed, strike, 0.0, 0.0, facing);
        hit = hit || capsulesIntersect(placed, probe);
      }
      assertEquals(hit, point.hit);
    }
  }
});

test("Chen's long fire hits a distant fighter once through the whole attack with normal and EX reach in both facings [k1 scenario]", () => {
  for (const facing of [-1, 1]) for (const ex of [false, true]) for (const gap of [200.0, ex ? 380.0 : 300.0]) {
    const owner = createFighter(Character.chen, 0.0, facing);
    const target = createFighter(Character.rifleman, f32(gap * facing), -facing);
    const { world } = duelPair(owner, target);
    owner.mana.points = 100;
    let hits = 0;
    for (let frame = 1; frame <= 80; frame++) {
      const damage = target.status.damage;
      target.motion.x = f32(gap * facing);
      target.motion.z = owner.motion.z;
      target.motion.vx = 0.0;
      target.motion.vz = 0.0;
      stepDuel(world, frame === 1 ? controls({ specialPressed: true, shield: ex }) : controls());
      if (target.status.damage > damage) {
        hits++;
        assertTrue(owner.special.frame >= 12 && owner.special.frame <= 23);
      }
    }
    assertEquals(hits, 1);
  }
});
