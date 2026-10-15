import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { meleeCos, meleeSin } from "../core/math/meleeScalarMath";
import { Character, ContactKind, DownState } from "./codes";
import { isTumbling } from "./conditions";
import { queueDamageContact } from "./contacts";
import { DOWN_BOUND_FRAMES, DOWN_DAMAGE_RESET_THRESHOLD, DOWN_WAIT_FRAMES } from "./down";
import { type Fighter, createFighter } from "./fighter";
import { DIAGONAL_UNIT, contactKnockback, damageLevelForKnockback } from "./knockback";
import { type Roster, createRoster } from "./roster";
import { stageBounds } from "./stageBounds";
import { stepDuel } from "./testDuel";
import { contactBatch, controls, hitEffect, seedTechWindow } from "./testWorld";
import { melee } from "./tuning";

const LAUNCH_SCALE = melee(0.029999999329447746);
const FLOOR_REBOUND = 0.800000011920929;
const ROUTE_LIMIT_FRAMES = 600;

function pair(target: Fighter): Roster {
  const world = createRoster(3, [createFighter(Character.blademaster, -400.0, 1), target]);
  stepDuel(world);
  return world;
}

function strike(world: Roster, damage: number, growth: number, base: number, dx: number, dz: number): void {
  contactBatch(world, () => queueDamageContact(world, 0, 1, hitEffect(damage, growth, base, dx, dz), 1, ContactKind.launch, false, undefined));
}

function steepMeteor(degrees: number): [number, number] {
  const radians = f32(degrees * 0.01745329238474369);
  return [meleeCos(radians), -meleeSin(radians)];
}

// Melee bounces a grounded target off the floor for tumble-strength downward hits, with 20% less knockback (SmashWiki "Meteor smash").
test("a tumble-strength downward hit on a grounded target bounces it upward at four-fifths of its vertical launch [k4 reference docs/physics.md#floor-bounces]", () => {
  for (const knockback of [80.0, 120.0, 240.0]) {
    for (const degrees of [15.0, 45.0, 90.0]) {
      const target = createFighter(Character.rifleman, 0.0, -1);
      const world = pair(target);
      const [dx, dz] = steepMeteor(degrees);
      strike(world, 5.0, 0.0, knockback, dx, dz);
      const launchZ = f32(f32(knockback * LAUNCH_SCALE) * dz);
      assertFalse(target.motion.grounded);
      assertTrue(isTumbling(target));
      assertEquals(target.launch.knockbackZ, -f32(launchZ * FLOOR_REBOUND), `${knockback} at ${degrees} rebounds`);
      assertGreaterThan(target.launch.knockbackZ, 0.0);
    }
  }
});

// Below tumble the hit keeps the target on the floor; only tumble-level meteors bounce (SmashWiki "Meteor smash").
test("a downward hit below tumble strength keeps a grounded target on the floor with no bounce [k4 reference docs/physics.md#floor-bounces]", () => {
  for (const knockback of [25.0, 52.5, 79.0]) {
    for (const degrees of [15.0, 45.0, 90.0]) {
      const target = createFighter(Character.rifleman, 0.0, -1);
      const world = pair(target);
      const [dx, dz] = steepMeteor(degrees);
      strike(world, 5.0, 0.0, knockback, dx, dz);
      assertTrue(target.motion.grounded);
      assertEquals(target.launch.knockbackZ, 0.0);
      assertFalse(isTumbling(target));
    }
  }
});

// The bounce happens at contact, so a grounded meteor is untechable in Melee (SmashWiki "Tech") and a high-percent one carries off the top.
test("a high-percent grounded meteor bounces through a held tech and off the top blast zone [k4 reference docs/physics.md#floor-bounces]", () => {
  const target = createFighter(Character.rifleman, 0.0, -1);
  const world = pair(target);
  target.status.damage = 150.0;
  seedTechWindow(target, 15);
  strike(world, 18.0, 100.0, 40.0, 0.0, -1.0);
  assertEquals(damageLevelForKnockback(contactKnockback(168.0, 18.0, target.tuning.physics.weight, 100.0, 40.0, 1.0)), 3);
  assertFalse(target.motion.grounded);
  assertGreaterThan(target.launch.knockbackZ, 0.0);
  let highest = target.motion.z;
  let frames = 0;
  while (!target.status.out && frames < ROUTE_LIMIT_FRAMES) {
    stepDuel(world);
    frames++;
    assertTrue(target.down.state !== DownState.tech && target.down.state !== DownState.techRoll);
    if (!target.status.out) highest = Math.max(highest, target.motion.z);
  }
  assertTrue(target.status.out);
  assertGreaterThan(highest, stageBounds(0).blast.top - 40.0);
});

function diveIntoFloor(tech: boolean): Fighter {
  const target = createFighter(Character.rifleman, 0.0, -1);
  const world = pair(target);
  target.status.damage = 150.0;
  target.motion.grounded = false;
  target.motion.surface = undefined;
  target.motion.z = 40.0;
  strike(world, 18.0, 100.0, 40.0, 0.0, -1.0);
  assertTrue(isTumbling(target));
  assertTrue(target.launch.knockbackZ < 0.0);
  for (let frames = 0; frames < ROUTE_LIMIT_FRAMES && !target.motion.grounded; frames++) {
    if (tech && target.launch.hitlag === 1) seedTechWindow(target, 15);
    stepDuel(world);
  }
  return target;
}

// Before Smash 4 a midair target driven into the floor stops its fall and can tech; it never rebounds (SmashWiki "Meteor smash", "Floor").
test("an airborne tumbling fighter driven into the floor techs in the window, else lands in the bound without rebounding [k4 reference docs/physics.md#floor-bounces]", () => {
  const teched = diveIntoFloor(true);
  assertTrue(teched.motion.grounded);
  assertEquals(teched.down.state, DownState.tech);
  const missed = diveIntoFloor(false);
  assertTrue(missed.motion.grounded);
  assertEquals(missed.down.state, DownState.bound);
  assertEquals(missed.launch.knockbackZ, 0.0);
});

function downed(state: DownState): { world: Roster; target: Fighter } {
  const target = createFighter(Character.rifleman, 0.0, -1);
  const world = pair(target);
  target.down.state = state;
  target.down.frame = state === DownState.bound ? 4 : 0;
  target.down.waitRemaining = DOWN_WAIT_FRAMES;
  return { world, target };
}

// Melee's reset: a weak hit without tumble knockback in the missed-tech bound or lying down forces a getup; 13+ hitstun half-resets first (SmashWiki "Lock").
test("a hit under 7% on a bound or lying fighter forces a getup, after any half-reset wait; 7% launches [k4 reference docs/physics.md#grounded-knockdown-and-jab-resets]", () => {
  assertEquals(DOWN_DAMAGE_RESET_THRESHOLD, 7.0);
  for (const state of [DownState.bound, DownState.wait]) {
    for (const [damage, growth] of [[1.0, 0.0], [3.0, 100.0], [6.5, 100.0]] as const) {
      const { world, target } = downed(state);
      strike(world, damage, growth, 20.0, DIAGONAL_UNIT, DIAGONAL_UNIT);
      assertEquals(target.down.state, DownState.damage, `${damage}% resets from ${state}`);
      let frames = 0;
      while ((target.down.state === DownState.damage || target.down.state === DownState.wait) && frames < DOWN_BOUND_FRAMES * 4) {
        stepDuel(world, controls(), controls());
        frames++;
      }
      assertEquals(target.down.state, DownState.stand, `${damage}% from ${state} forces the stand`);
    }
    const { world, target } = downed(state);
    strike(world, DOWN_DAMAGE_RESET_THRESHOLD, 100.0, 20.0, DIAGONAL_UNIT, DIAGONAL_UNIT);
    assertEquals(target.down.state, DownState.none, `7% launches from ${state}`);
    assertFalse(target.motion.grounded);
  }
});

// The reset also needs knockback below tumble (<80 units, SmashWiki "Lock"); a weak but tumbling hit launches.
test("a weak hit with tumble knockback on a downed fighter launches instead of resetting [k4 reference docs/physics.md#grounded-knockdown-and-jab-resets]", () => {
  for (const state of [DownState.bound, DownState.wait]) {
    const { world, target } = downed(state);
    strike(world, 3.0, 0.0, 90.0, DIAGONAL_UNIT, DIAGONAL_UNIT);
    assertEquals(target.down.state, DownState.tumble, `tumble from ${state}`);
    assertFalse(target.motion.grounded);
  }
});
