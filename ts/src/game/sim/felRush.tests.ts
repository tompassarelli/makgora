import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT } from "./heroMoves";
import { Character, LedgeState, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { type Controls, type Roster } from "./roster";
import { snapToLedge } from "./ledge";
import { canAttack } from "./conditions";
import { fillMeter } from "./meter";
import { FEL_RUSH_DISTANCE, FEL_RUSH_FIRST, FEL_RUSH_FRAMES, FEL_RUSH_LAST, FEL_RUSH_SPEED, FEL_RUSH_TELL_LAST } from "./specials";
import { PHANTASM_TRAVEL_FRAMES } from "./specials/phantasmDash";
import { copyFighterState } from "../../generated/state/fighterState";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { controls } from "./testWorld";
import { duelPair, lift, specialToEnd, stepDuel } from "./testDuel";

const HEIGHT = 900.0;
const RUSH_LENGTH = f32(FEL_RUSH_SPEED * (FEL_RUSH_LAST - FEL_RUSH_FIRST + 1));
const sideB = (x: number): Controls => controls({ specialPressed: true, specialX: x, direction: x });
const holdShield = controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const held = (x: number, z: number): Controls => controls({ direction: x, verticalDirection: z, down: z < 0 });
const DIRECTIONS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;

interface Rush { readonly started: boolean; readonly dx: number; readonly dz: number }

const PARK = f32(surfaceLeft(0, 0, 0) + 60.0);

function illidan(z: number, ownerX = 0.0, targetX = PARK): { world: Roster; owner: Fighter; target: Fighter } {
  const pair = duelPair(createFighter(Character.demonHunter, ownerX, 1), createFighter(Character.rifleman, targetX, -1));
  if (z > 0.0) lift(pair.owner, z);
  return pair;
}

function settle(world: Roster, owner: Fighter, z: number): void {
  for (let frame = 0; frame < 120 && owner.special.action !== SpecialAction.none; frame++) {
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
  copyFighterState(target, createFighter(Character.rifleman, PARK, -1), 3);
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
  while (owner.special.action === SpecialAction.demonHunterFelRush && frames < 120) {
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

test("Fel Rush: an air rush that hits nobody ends in helpless fall, and no second press before landing starts another [k3 measure #554]", () => {
  const { world, owner } = illidan(HEIGHT);
  stepDuel(world, controls({ specialPressed: true, specialX: 1, direction: 1 }));
  assertTrue(pressed(owner));
  runOut(world, owner);
  assertFalse(owner.motion.grounded);
  assertTrue(owner.special.fall);
  assertEquals(owner.jump.remaining, 0);
  settle(world, owner, HEIGHT);
  assertFalse(pressAgain(world, owner));
  owner.special.fall = false;
  settle(world, owner, HEIGHT);
  assertFalse(pressAgain(world, owner));
});

test("Fel Rush: a grounded rush carried off a ledge counts as the airtime's rush and ends in helpless fall, so a whiff leaves no air rush [k3 measure #554]", () => {
  const { world, owner } = illidan(0.0);
  owner.motion.x = f32(EDGE - 40.0);
  stepDuel(world);
  assertTrue(owner.motion.grounded);
  stepDuel(world, sideB(1));
  assertTrue(pressed(owner));
  runOut(world, owner);
  assertFalse(owner.motion.grounded);
  assertTrue(owner.special.fall);
  assertEquals(owner.jump.remaining, 0);
  lift(owner, HEIGHT);
  settle(world, owner, HEIGHT);
  assertFalse(pressAgain(world, owner));
});

test("Fel Rush: an air rush that hits earns exactly one more, usable at once and aimed, and a hit with that one earns no third [k3 measure #554]", () => {
  const { world, owner, target } = illidan(HEIGHT);
  hittingAirRush(world, owner, target);
  assertFalse(owner.special.fall);
  hittingAirRush(world, owner, target);
  assertTrue(owner.special.fall);
  settle(world, owner, HEIGHT);
  assertFalse(pressAgain(world, owner));
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
  assertFalse(owner.special.fall);
  owner.motion.x = 0.0;
  lift(owner, HEIGHT);
  assertTrue(pressAgain(world, owner));
  runOut(world, owner);
  assertTrue(owner.special.fall);
  settle(world, owner, HEIGHT);
  assertFalse(pressAgain(world, owner));
});

test("Fel Rush: a grounded rush that hits nobody ends grounded on its last frame with no helpless and no airtime use [k3 measure #554]", () => {
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
const STEP = f32(FEL_RUSH_DISTANCE / PHANTASM_TRAVEL_FRAMES);
const shortenOn = (travelFrame: number) => (owner: Readonly<Fighter>): Controls =>
  owner.special.frame + 1 === travelFrame ? controls({ specialPressed: true }) : controls();

function groundedRun(shorten?: number): { owner: Fighter; target: Fighter; travelled: number; frames: number } {
  const { world, owner, target } = illidan(0.0);
  owner.motion.x = -400.0;
  stepDuel(world);
  const startX = owner.motion.x;
  stepDuel(world, sideB(1));
  assertTrue(pressed(owner));
  const frames = runOut(world, owner, shorten === undefined ? () => controls() : shortenOn(shorten)) + 1;
  return { owner, target, travelled: f32(owner.motion.x - startX), frames };
}

test("Fel Rush: an unshortened rush travels 3.5H over Falco's 4 Phantasm travel frames, 18 to 21, and ends on frame 59 [k3 measure docs/design/illidan.md]", () => {
  const { travelled, frames } = groundedRun();
  assertEquals(FEL_RUSH_TELL_LAST, 17);
  assertEquals(FEL_RUSH_FIRST, 18);
  assertEquals(FEL_RUSH_LAST, 21);
  assertEquals(FEL_RUSH_FRAMES, 59);
  assertEquals(FEL_RUSH_LAST - FEL_RUSH_FIRST + 1, PHANTASM_TRAVEL_FRAMES);
  assertEquals(FEL_RUSH_SPEED, f32(FEL_RUSH_DISTANCE / 4));
  assertGreaterThan(travelled, f32(FEL_RUSH_DISTANCE - 1.0));
  assertLessThan(travelled, f32(FEL_RUSH_DISTANCE + 1.0));
  assertEquals(frames, FEL_RUSH_FRAMES);
});

test("Fel Rush: a special press on travel frame k stops him after k minus the tell of the 4 steps, and ends the move as many frames sooner as steps it skipped [k3 measure docs/design/illidan.md]", () => {
  for (let travelFrame = FEL_RUSH_FIRST; travelFrame < FEL_RUSH_LAST; travelFrame++) {
    const steps = travelFrame - FEL_RUSH_TELL_LAST;
    const { owner, travelled, frames } = groundedRun(travelFrame);
    assertEquals(owner.attack.cooldown, groundedRun().owner.attack.cooldown);
    assertGreaterThan(travelled, f32(f32(steps * STEP) - 1.0));
    assertLessThan(travelled, f32(f32(steps * STEP) + 1.0));
    assertEquals(frames, FEL_RUSH_FRAMES - (FEL_RUSH_LAST - travelFrame));
  }
});

test("Fel Rush: a special press during the tell or on the last travel frame does not shorten the rush [k3 measure docs/design/illidan.md]", () => {
  for (const travelFrame of [2, FEL_RUSH_TELL_LAST, FEL_RUSH_LAST]) {
    const { travelled, frames } = groundedRun(travelFrame);
    assertGreaterThan(travelled, f32(FEL_RUSH_DISTANCE - 1.0));
    assertEquals(frames, FEL_RUSH_FRAMES);
  }
});

function struckBy(z: number, shorten: number | undefined, gap: number, startAhead?: number): { world: Roster; owner: Fighter; target: Fighter } {
  const { world, owner, target } = illidan(z, -400.0, f32(-400.0 + gap));
  if (z > 0.0) lift(target, z);
  stepDuel(world);
  stepDuel(world, sideB(1));
  while (owner.special.action === SpecialAction.demonHunterFelRush && target.status.damage === 0.0) {
    if (startAhead !== undefined && owner.special.frame === FEL_RUSH_TELL_LAST) target.motion.x = f32(owner.motion.x + startAhead);
    if (z > 0.0) lift(target, z);
    stepDuel(world, shorten === undefined ? controls() : shortenOn(shorten)(owner));
  }
  return { world, owner, target };
}

test("Fel Rush: a rush shortened after its first step still strikes a foe standing in the stretch it crossed, once [k3 measure docs/design/illidan.md]", () => {
  const { world, owner, target } = struckBy(0.0, FEL_RUSH_FIRST, 300.0, 20.0);
  assertEquals(target.status.damage, 7.0);
  runOut(world, owner);
  assertEquals(target.status.damage, 7.0);
});

test("Fel Rush: a grounded foe is sent low and away, and an airborne foe is spiked straight down, both for 7% fire [k3 measure docs/design/illidan.md]", () => {
  const ground = struckBy(0.0, undefined, f32(STEP * f32(2.5))).target;
  assertEquals(ground.status.damage, 7.0);
  assertGreaterThan(ground.launch.knockbackX, 0.0);
  assertGreaterThan(ground.launch.knockbackZ, 0.0);
  assertLessThan(ground.launch.knockbackZ, f32(ground.launch.knockbackX * f32(0.5)));
  const air = struckBy(HEIGHT, undefined, f32(STEP * f32(2.5))).target;
  assertEquals(air.status.damage, 7.0);
  assertLessThan(air.launch.knockbackZ, 0.0);
  assertLessThan(Math.abs(air.launch.knockbackX), f32(Math.abs(air.launch.knockbackZ) * f32(0.05)));
});

test("Fel Rush: a rush shortened mid-travel replays identically from a rollback copy of both fighters [k3 measure docs/design/illidan.md]", () => {
  const live = illidan(0.0, -400.0, -100.0);
  stepDuel(live.world);
  stepDuel(live.world, sideB(1));
  while (live.owner.special.frame < FEL_RUSH_TELL_LAST) stepDuel(live.world, shortenOn(FEL_RUSH_FIRST + 1)(live.owner));
  live.target.motion.x = f32(live.owner.motion.x + 20.0);
  const copy = illidan(0.0, -400.0, -100.0);
  copyFighterState(copy.owner, live.owner, 3);
  copyFighterState(copy.target, live.target, 3);
  for (let frame = 0; frame < 80; frame++) {
    stepDuel(live.world, shortenOn(FEL_RUSH_FIRST + 1)(live.owner));
    stepDuel(copy.world, shortenOn(FEL_RUSH_FIRST + 1)(copy.owner));
  }
  assertEquals(copy.owner.motion.x, live.owner.motion.x);
  assertEquals(copy.target.motion.x, live.target.motion.x);
  assertEquals(copy.target.motion.z, live.target.motion.z);
  assertEquals(copy.target.status.damage, live.target.status.damage);
  assertGreaterThan(live.target.status.damage, 0.0);
});

test("Fel Rush: a rush that strikes a grounded foe runs every frame to its end, skipping none [k3 measure docs/design/illidan.md]", () => {
  const { world, owner, target } = struckBy(0.0, undefined, 300.0);
  assertEquals(target.status.damage, 7.0);
  assertEquals(specialToEnd(world, owner).jump, 1);
  assertEquals(owner.attack.cooldown, groundedRun().owner.attack.cooldown);
  assertEquals(owner.special.lockFrames, 0);
  assertFalse(canAttack(target));
});

function shieldRun(gap: number, shielded: boolean): { last: number; jump: number } {
  const { world, owner, target } = duelPair(createFighter(Character.demonHunter, 0.0, 1), createFighter(Character.rifleman, gap, -1));
  target.shield.raised = shielded;
  const hold = shielded ? holdShield : controls();
  stepDuel(world, sideB(1), hold);
  return specialToEnd(world, owner, hold);
}

test("Fel Rush into a shield runs every frame to the whiff's end, skipping none of its end lag [k3 measure docs/design/illidan.md]", () => {
  const whiff = shieldRun(f32(HERO_REFERENCE_HEIGHT * 6.0), false);
  const shielded = shieldRun(f32(HERO_REFERENCE_HEIGHT * f32(0.3)), true);
  assertEquals(whiff.jump, 1);
  assertEquals(shielded.jump, 1);
  assertEquals(shielded.last, whiff.last);
});
