import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { AttackStyle, Character, LedgeState, SpecialAction } from "../codes";
import { canAttack } from "../conditions";
import { clearDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { applyAttackHit } from "../hits";
import { type Controls, type Roster } from "../roster";
import { becomeEgg, steeredFlightLeft } from "../specials/engine";
import { mainDeckRight, mainDeckZ } from "../stage";
import { duelPair, lift, stepDuel } from "../testDuel";
import { controls } from "../testWorld";
import { Action, bit } from "../../input/actions";
import { HEIGHT_PROBE_OUT, RECOVERY_BANDS, SPECIAL, TOWARD, UP, playKeys, recovered, recoveryRun } from "../../match/recoveryEnvelope";
import { PHOENIX_BURN_FRAMES, PHOENIX_EGG_FALL_SPEED, PHOENIX_EGG_HATCH_FRAMES, PHOENIX_STARTUP_FRAMES } from "./kaelthasSpecials";
import { kaelHit } from "./kaelthasMoves";

const TURN_COS = f32(0.996);
const upB = (ex = false): Controls => controls({ specialPressed: true, specialZ: 1, verticalDirection: 1, exPressed: ex });
const hold = (x: number, z: number): Controls => controls({ direction: x, verticalDirection: z });

function flight(z: number, ex = false): { world: Roster; kael: Fighter; foe: Fighter } {
  const pair = duelPair(createFighter(Character.kaelthas, 0.0, 1), createFighter(Character.rifleman, -500.0, 1));
  const kael = pair.owner;
  kael.mana.points = 100;
  lift(kael, z);
  stepDuel(pair.world, upB(ex));
  while (kael.special.frame < PHOENIX_STARTUP_FRAMES) stepDuel(pair.world, hold(0, 1));
  return { world: pair.world, kael, foe: pair.target };
}

function heading(f: Fighter): { x: number; z: number } {
  const length = Math.sqrt(f.motion.vx * f.motion.vx + f.motion.vz * f.motion.vz);
  return { x: f32(f.motion.vx / length), z: f32(f.motion.vz / length) };
}

function strike(world: Roster): void {
  clearDamageContacts();
  applyAttackHit(world, 1, 0, AttackStyle.jab, 1, kaelHit(4.0, 55, 30.0, 30.0), true, false);
  finishDamageContacts(world);
}

test("Phoenix: holding a direction turns the flight a few degrees a frame toward it instead of snapping, and a neutral stick keeps the line [k3 measure #360]", () => {
  const steered = flight(300.0);
  stepDuel(steered.world, hold(1, 0));
  let last = heading(steered.kael);
  assertLessThan(Math.abs(last.x), f32(0.1));
  let frames = 1;
  while (last.x < f32(0.99) && steered.kael.special.action === SpecialAction.heroUp) {
    stepDuel(steered.world, hold(1, 0));
    const next = heading(steered.kael);
    assertGreaterThan(f32(f32(last.x * next.x) + f32(last.z * next.z)), TURN_COS);
    assertGreaterThan(next.x, last.x);
    last = next;
    frames++;
  }
  assertGreaterThan(frames, 12);
  assertLessThan(frames, 24);
  const straight = flight(300.0);
  const startX = straight.kael.motion.x;
  while (straight.kael.special.action === SpecialAction.heroUp) stepDuel(straight.world, hold(0, 0));
  assertEquals(straight.kael.motion.x, startX);
  assertGreaterThan(f32(steered.kael.motion.x - startX), 100.0);
});

test("Phoenix: the flames burn down over a fixed flight, then he falls helpless and can neither jump nor cast again before landing [k3 measure #360]", () => {
  const { world, kael } = flight(300.0);
  assertEquals(steeredFlightLeft(kael), 1.0);
  let left = 1.0;
  let flown = 0;
  while (kael.special.action === SpecialAction.heroUp) {
    stepDuel(world, hold(0, 0));
    const now = steeredFlightLeft(kael);
    assertTrue(now <= left);
    left = now;
    flown++;
  }
  assertTrue(Math.abs(flown - PHOENIX_BURN_FRAMES) <= 1);
  assertEquals(steeredFlightLeft(kael), 0.0);
  assertTrue(kael.special.fall);
  assertFalse(kael.motion.grounded);
  for (let frame = 0; frame < 20; frame++) {
    stepDuel(world, controls({ jumpPressed: frame === 0, specialPressed: frame === 4, verticalDirection: frame === 4 ? 1 : 0, attackRequested: frame === 8 }));
    assertEquals(kael.special.action, SpecialAction.none);
    assertEquals(kael.jump.remaining, 0);
  }
});

test("Phoenix: struck mid-flight he becomes an egg that falls faster than his fall, ignores every input, misses the ledge and hatches on landing [k3 measure #360]", () => {
  const early = duelPair(createFighter(Character.kaelthas, 0.0, 1), createFighter(Character.rifleman, -500.0, 1));
  lift(early.owner, 250.0);
  stepDuel(early.world, upB());
  stepDuel(early.world, hold(0, 1));
  strike(early.world);
  stepDuel(early.world);
  assertGreaterThan(early.owner.status.damage, 0.0);
  assertFalse(early.owner.special.egg);

  const drop = (direction: number): { world: Roster; kael: Fighter; fastest: number } => {
    const { world, kael } = flight(250.0);
    for (let frame = 0; frame < 4; frame++) stepDuel(world, hold(0, 1));
    strike(world);
    stepDuel(world);
    assertTrue(kael.special.egg);
    assertTrue(kael.special.fall);
    assertEquals(kael.special.action, SpecialAction.none);
    let fastest = 0.0;
    let frames = 0;
    while (!kael.motion.grounded && frames < 200) {
      stepDuel(world, controls({ jumpPressed: imod(frames, 3) === 0, specialPressed: imod(frames, 3) === 1, airDodgePressed: imod(frames, 3) === 2, direction: kael.launch.hitstun > 0 || kael.launch.hitlag > 0 ? 0 : direction, verticalDirection: 1 }));
      assertEquals(kael.special.action, SpecialAction.none);
      assertFalse(kael.dodge.airDodging);
      if (!kael.motion.grounded) fastest = Math.min(fastest, kael.motion.vz);
      frames++;
    }
    assertTrue(kael.motion.grounded);
    return { world, kael, fastest };
  };
  const { world, kael, fastest } = drop(1);
  assertEquals(drop(-1).kael.motion.x, kael.motion.x);
  assertEquals(fastest, -PHOENIX_EGG_FALL_SPEED);
  assertLessThan(fastest, -kael.tuning.physics.fastFallSpeed);
  assertFalse(kael.special.egg);
  assertFalse(canAttack(kael));
  let hatch = 0;
  while (!canAttack(kael) && hatch < 120) { stepDuel(world); hatch++; }
  assertTrue(Math.abs(hatch - PHOENIX_EGG_HATCH_FRAMES) <= 2);

  const edge = mainDeckRight(0);
  for (const egg of [false, true]) {
    const pair = duelPair(createFighter(Character.kaelthas, f32(edge + 30.0), -1), createFighter(Character.rifleman, -500.0, 1));
    lift(pair.owner, f32(mainDeckZ(0) + 40.0));
    pair.owner.special.fall = true;
    pair.owner.jump.remaining = 0;
    if (egg) becomeEgg(pair.owner);
    let caught = false;
    for (let frame = 0; frame < 40; frame++) { stepDuel(pair.world); caught ||= pair.owner.ledge.state !== LedgeState.none; }
    assertEquals(caught, !egg);
  }
});

test("Phoenix: from the long band's depth, a jump and a Phoenix held up still reach the ledge, and EX flies a quarter farther [k3 measure #360]", () => {
  const band = RECOVERY_BANDS[0];
  if (band === undefined || band.name !== "long") throw new Error("long band");
  const run = recoveryRun(Character.kaelthas, 0, f32(mainDeckRight(0) + HEIGHT_PROBE_OUT), -band.heightMin);
  const f = run.fighter;
  playKeys(run, TOWARD | bit(Action.jump));
  let frame = 0;
  while (frame < 6 || f.motion.vz > 0) { playKeys(run, TOWARD); frame++; }
  playKeys(run, TOWARD | UP | SPECIAL);
  for (frame = 0; frame < 240 && !recovered(f) && !f.status.out; frame++) playKeys(run, UP);
  assertTrue(recovered(f));

  const rise = (ex: boolean): number => {
    const { world, kael } = flight(300.0, ex);
    const startZ = kael.motion.z;
    while (kael.special.action === SpecialAction.heroUp) stepDuel(world, hold(0, 0));
    return f32(kael.motion.z - startZ);
  };
  const ratio = f32(rise(true) / rise(false));
  assertGreaterThan(ratio, f32(1.2));
  assertLessThan(ratio, f32(1.3));
});
