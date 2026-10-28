import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, LedgeState, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { type Controls, type Roster } from "./roster";
import { snapToLedge } from "./ledge";
import { fillMeter } from "./meter";
import { CHAOS_STRIKE_AIR_FORM, FEL_RUSH_BRANCH_FIRST, FEL_RUSH_FIRST, FEL_RUSH_FRAMES, FEL_RUSH_LAST, FEL_RUSH_SPEED, FEL_RUSH_TELL_LAST, VENGEFUL_RETREAT_FORM } from "./specials";
import { surfaceRight, surfaceZ } from "./stage";
import { controls } from "./testWorld";
import { duelPair, lift, stepDuel } from "./testDuel";

const HEIGHT = 900.0;
const RUSH_LENGTH = f32(FEL_RUSH_SPEED * (FEL_RUSH_LAST - FEL_RUSH_FIRST + 1));
const sideB = (x: number): Controls => controls({ specialPressed: true, specialX: x, direction: x });
const held = (x: number, z: number): Controls => controls({ direction: x, verticalDirection: z, down: z < 0 });
const DIRECTIONS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;

interface Rush { readonly started: boolean; readonly dx: number; readonly dz: number }

function illidan(z: number): { world: Roster; owner: Fighter; target: Fighter } {
  const pair = duelPair(createFighter(Character.demonHunter, 0.0, 1), createFighter(Character.rifleman, -900.0, 1));
  if (z > 0.0) lift(pair.owner, z);
  return pair;
}

function settle(world: Roster, owner: Fighter, z: number): void {
  for (let frame = 0; frame < 80 && (owner.special.action !== SpecialAction.none || (owner.special.cooldowns[SpecialAction.demonHunterFelRush] ?? 0) > 0); frame++) {
    if (z > 0.0) lift(owner, z);
    stepDuel(world);
  }
  if (z > 0.0) lift(owner, z);
}

function rush(world: Roster, owner: Fighter, side: number, x: number, z: number, onLine?: (startX: number, startZ: number) => void): Rush {
  stepDuel(world, sideB(side));
  if (owner.special.action !== SpecialAction.demonHunterFelRush) return { started: false, dx: 0.0, dz: 0.0 };
  const startX = owner.motion.x, startZ = owner.motion.z;
  while (owner.special.action === SpecialAction.demonHunterFelRush && owner.special.frame < FEL_RUSH_TELL_LAST) stepDuel(world, held(x, z));
  while (owner.special.action === SpecialAction.demonHunterFelRush && owner.special.frame < FEL_RUSH_LAST) {
    onLine?.(startX, startZ);
    stepDuel(world, held(x, z));
  }
  return { started: true, dx: f32(owner.motion.x - startX), dz: f32(owner.motion.z - startZ) };
}

function assertTravels(result: Rush, x: number, z: number): void {
  assertTrue(result.started);
  const length = Math.sqrt(result.dx * result.dx + result.dz * result.dz);
  assertGreaterThan(length, f32(RUSH_LENGTH * f32(0.85)));
  assertLessThan(length, f32(RUSH_LENGTH * f32(1.15)));
  const along = f32(f32(result.dx * x) + f32(result.dz * z));
  assertGreaterThan(along, f32(f32(length * f32(0.95)) * (x !== 0 && z !== 0 ? f32(Math.SQRT2) : 1.0)));
}

function secondRush(x: number, z: number, onLine?: (target: Fighter, startX: number, startZ: number) => void): { first: Rush; second: Rush; third: Rush; target: Fighter } {
  const { world, owner, target } = illidan(HEIGHT);
  const first = rush(world, owner, 1, 0, 1, () => { if (target.status.damage === 0.0) ahead(owner, target, 30.0); });
  settle(world, owner, HEIGHT);
  target.motion.x = -900.0;
  lift(target, 0.0);
  target.status.damage = 0.0;
  const second = rush(world, owner, 1, x, z, onLine === undefined ? undefined : (startX, startZ) => onLine(target, startX, startZ));
  settle(world, owner, HEIGHT);
  const third = rush(world, owner, 1, 0, 0);
  return { first, second, third, target };
}

test("Fel Rush: the first air rush flies level even with the stick held up, the second (earned by the first's hit) goes the way the stick points on its last tell frame in all 8 directions, and a third in the same airtime is refused [k3 measure #520]", () => {
  for (const [x, z] of DIRECTIONS) {
    const { first, second, third } = secondRush(x, z);
    assertTravels(first, 1, 0);
    assertTravels(second, x, z);
    assertEquals(third.started, false);
  }
});

test("Fel Rush: a neutral second air rush flies level in his facing [k3 measure #520]", () => {
  const { second } = secondRush(0, 0);
  assertTravels(second, 1, 0);
});

test("Fel Rush: the aimed second rush strikes a foe placed on its line in each of the 8 directions [k3 measure #520]", () => {
  for (const [x, z] of DIRECTIONS) {
    const scale = x !== 0 && z !== 0 ? f32(Math.SQRT1_2) : 1.0;
    const { target } = secondRush(x, z, (foe, startX, startZ) => {
      foe.motion.x = f32(startX + f32(f32(x * f32(RUSH_LENGTH * 0.5)) * scale));
      lift(foe, f32(startZ + f32(f32(z * f32(RUSH_LENGTH * 0.5)) * scale)));
    });
    assertGreaterThan(target.status.damage, 0.0);
  }
});

test("Fel Rush: grounded rushes stay level with the stick picking the side, whatever the stick holds on the tell's last frame [k3 measure #520]", () => {
  for (const side of [1, -1]) {
    for (const [x, z] of [[0, 0], [0, 1], [side, 1], [-side, 0]] as const) {
      const { world, owner } = illidan(0.0);
      const result = rush(world, owner, side, x, z);
      assertTravels(result, side, 0);
      assertEquals(owner.facing, side);
      assertTrue(owner.motion.grounded);
      assertEquals(owner.special.airtimeUses, 0);
    }
  }
});

const EDGE = surfaceRight(0, 0, 0);
const TOP = surfaceZ(0, 0, 0);

function ahead(owner: Readonly<Fighter>, foe: Fighter, gap: number): void {
  foe.motion.x = f32(owner.motion.x + f32(owner.facing * gap));
  lift(foe, owner.motion.z);
}

/** Steps until the Fel Rush action ends, passing each frame's input from `input`; returns the frames it took. */
function runOut(world: Roster, owner: Fighter, input: (owner: Fighter) => Readonly<Controls> = () => controls()): number {
  let frames = 0;
  while (owner.special.action === SpecialAction.demonHunterFelRush && frames < 80) {
    stepDuel(world, input(owner));
    frames++;
  }
  return frames;
}

const pressed = (owner: Readonly<Fighter>): boolean => owner.special.action === SpecialAction.demonHunterFelRush && owner.special.frame <= 1;

function pressAgain(world: Roster, owner: Fighter): boolean {
  stepDuel(world, sideB(owner.facing));
  return pressed(owner);
}

/** A neutral air rush that strikes `target` placed on its line, run to its end. */
function hittingAirRush(world: Roster, owner: Fighter, target: Fighter): void {
  const before = target.status.damage;
  stepDuel(world, sideB(owner.facing));
  assertTrue(pressed(owner));
  runOut(world, owner, () => {
    if (target.status.damage === before) ahead(owner, target, 30.0);
    return controls();
  });
  assertGreaterThan(target.status.damage, before);
}

const branchPress = (attack: boolean) => (owner: Readonly<Fighter>): Controls =>
  owner.special.form === 0 && owner.special.frame + 1 === FEL_RUSH_BRANCH_FIRST ? controls(attack ? { attackPressed: true } : { specialPressed: true }) : controls();

test("Fel Rush: an air rush that hits nobody, plain or EX, ends in helpless fall, and no second press before landing starts another [k3 measure #554]", () => {
  for (const ex of [false, true]) {
    const { world, owner } = illidan(HEIGHT);
    fillMeter(owner);
    stepDuel(world, controls({ specialPressed: true, specialX: 1, direction: 1, exPressed: ex }));
    assertTrue(pressed(owner));
    assertEquals(owner.special.ex, ex);
    runOut(world, owner);
    assertFalse(owner.motion.grounded);
    assertTrue(owner.special.fall);
    assertEquals(owner.jump.remaining, 0);
    settle(world, owner, HEIGHT);
    assertFalse(pressAgain(world, owner));
    owner.special.fall = false;
    settle(world, owner, HEIGHT);
    assertFalse(pressAgain(world, owner));
  }
});

test("Fel Rush: an air rush whose Vengeful Retreat or Chaos Strike branch hits nobody ends in helpless fall with no second rush [k3 measure #554]", () => {
  for (const attack of [false, true]) {
    const { world, owner } = illidan(HEIGHT);
    stepDuel(world, sideB(1));
    assertTrue(pressed(owner));
    runOut(world, owner, branchPress(attack));
    assertFalse(owner.motion.grounded);
    assertTrue(owner.special.fall);
    owner.special.fall = false;
    settle(world, owner, HEIGHT);
    assertFalse(pressAgain(world, owner));
  }
});

test("Fel Rush: a grounded rush carried off a ledge counts as the airtime's rush, so a whiff leaves no air rush but no helpless either [k3 measure #554]", () => {
  const { world, owner } = illidan(0.0);
  owner.motion.x = f32(EDGE - 40.0);
  stepDuel(world);
  assertTrue(owner.motion.grounded);
  stepDuel(world, sideB(1));
  assertTrue(pressed(owner));
  runOut(world, owner);
  assertFalse(owner.motion.grounded);
  assertFalse(owner.special.fall);
  lift(owner, HEIGHT);
  settle(world, owner, HEIGHT);
  assertFalse(pressAgain(world, owner));
});

test("Fel Rush: an air rush that hits earns exactly one more, usable at once and aimed, and a hit with that one earns no third [k3 measure #554]", () => {
  const { world, owner, target } = illidan(HEIGHT);
  hittingAirRush(world, owner, target);
  assertFalse(owner.special.fall);
  assertEquals(owner.special.cooldowns[SpecialAction.demonHunterFelRush] ?? 0, 0);
  hittingAirRush(world, owner, target);
  assertFalse(owner.special.fall);
  settle(world, owner, HEIGHT);
  assertFalse(pressAgain(world, owner));
});

test("Fel Rush: a hit by the air rush's Chaos Strike branch earns the second rush [k3 measure #554]", () => {
  const { world, owner, target } = illidan(HEIGHT);
  stepDuel(world, sideB(1));
  runOut(world, owner, (f) => {
    if (target.status.damage === 0.0) {
      target.motion.x = f.motion.x;
      lift(target, f32(f.motion.z + 600.0));
      if (f.special.form === CHAOS_STRIKE_AIR_FORM) ahead(f, target, 60.0);
    }
    return branchPress(true)(f);
  });
  assertGreaterThan(target.status.damage, 0.0);
  assertFalse(owner.special.fall);
  lift(owner, HEIGHT);
  assertTrue(pressAgain(world, owner));
});

test("Fel Rush: a hit by the ledge-carried grounded rush earns one more air rush [k3 measure #554]", () => {
  const { world, owner, target } = illidan(0.0);
  owner.motion.x = f32(EDGE - 40.0);
  stepDuel(world);
  stepDuel(world, sideB(1));
  runOut(world, owner, (f) => {
    if (f.special.frame >= FEL_RUSH_FIRST && target.status.damage === 0.0) ahead(f, target, 30.0);
    return controls();
  });
  assertGreaterThan(target.status.damage, 0.0);
  assertFalse(owner.motion.grounded);
  lift(owner, HEIGHT);
  assertTrue(pressAgain(world, owner));
  runOut(world, owner);
  settle(world, owner, HEIGHT);
  assertFalse(pressAgain(world, owner));
});

test("Fel Rush: a grounded rush that hits nobody ends as before, grounded on frame 29 with no helpless and no airtime use [k3 measure #554]", () => {
  const { world, owner } = illidan(0.0);
  stepDuel(world, sideB(1));
  assertTrue(pressed(owner));
  assertEquals(runOut(world, owner) + 1, FEL_RUSH_FRAMES);
  assertTrue(owner.motion.grounded);
  assertFalse(owner.special.fall);
  assertEquals(owner.special.airtimeUses, 0);
});

test("Fel Rush: landing or a ledge grab after a whiffed air rush gives the air rush back [k3 measure #554]", () => {
  for (const ledge of [false, true]) {
    const { world, owner } = illidan(HEIGHT);
    stepDuel(world, sideB(1));
    runOut(world, owner);
    assertTrue(owner.special.fall);
    if (ledge) assertTrue(snapToLedge(world, 0, 0, 1));
    else for (let frame = 0; frame < 300 && !owner.motion.grounded; frame++) stepDuel(world);
    assertFalse(owner.special.fall);
    assertEquals(owner.special.airtimeUses, 0);
    if (ledge) for (let frame = 0; frame < 60 && owner.ledge.state !== LedgeState.none; frame++) stepDuel(world, controls({ jumpPressed: owner.ledge.frame > 0 }));
    for (let frame = 0; frame < 60 && owner.landing.lag > 0; frame++) stepDuel(world);
    lift(owner, HEIGHT);
    settle(world, owner, HEIGHT);
    assertTrue(pressAgain(world, owner));
  }
});

test("Fel Rush: a Vengeful Retreat branched from a grounded rush still ends without helpless [k3 measure #554]", () => {
  const { world, owner } = illidan(0.0);
  stepDuel(world, sideB(1));
  let retreated = false;
  runOut(world, owner, (f) => {
    retreated ||= f.special.form === VENGEFUL_RETREAT_FORM;
    return branchPress(false)(f);
  });
  assertTrue(retreated);
  assertFalse(owner.special.fall);
});
