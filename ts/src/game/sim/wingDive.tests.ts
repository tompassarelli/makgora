import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { ROSTER_MANA } from "./mana";
import { type Controls, type Roster } from "./roster";
import {
  DEMONHUNTER_BACKFLIP_FORM, DEMONHUNTER_BACKFLIP_FRAMES, DEMONHUNTER_DIVE_FORM, DEMONHUNTER_DIVE_FRAME, DEMONHUNTER_DIVE_FRAMES, DEMONHUNTER_DIVE_LANDING_LAG, DEMONHUNTER_DIVE_SPEED,
  DEMONHUNTER_WING_DURATION, DEMONHUNTER_WING_STARTUP, wingAscentReach,
} from "./specials";
import { controls } from "./testWorld";
import { duelPair, lift, stepDuel } from "./testDuel";

const upB = (ex: boolean): Controls => controls({ specialPressed: true, specialZ: 1, verticalDirection: 1, exPressed: ex });
const held = (x: number, z: number): Controls => controls({ direction: x, verticalDirection: z, down: z < 0 });
const DIVE_LENGTH = f32(DEMONHUNTER_DIVE_SPEED * DEMONHUNTER_DIVE_FRAMES);
const ZONES = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;

function ascending(z: number, ex = false): { world: Roster; owner: Fighter; target: Fighter } {
  const pair = duelPair(createFighter(Character.demonHunter, 0.0, 1), createFighter(Character.rifleman, -500.0, 1));
  if (z > 0.0) lift(pair.owner, z);
  if (ex) pair.owner.mana.points = ROSTER_MANA.max;
  stepDuel(pair.world, upB(ex));
  return pair;
}

function runTo(world: Roster, owner: Fighter, frame: number, stick: Readonly<Controls>): void {
  while (owner.special.action === SpecialAction.demonHunterWingAscent && owner.special.frame < frame) stepDuel(world, stick);
}

function fireAt(world: Roster, owner: Fighter, stick: Readonly<Controls>): void {
  runTo(world, owner, DEMONHUNTER_WING_STARTUP, controls());
  runTo(world, owner, DEMONHUNTER_DIVE_FRAME, stick);
  assertEquals(owner.special.form, 0);
  stepDuel(world, stick);
}

function dive(x: number, z: number, ex = false): { started: boolean; flip: number; dx: number; dz: number; helpless: boolean; owner: Fighter } {
  const { world, owner } = ascending(900.0, ex);
  fireAt(world, owner, held(x, z));
  const started = owner.special.form === DEMONHUNTER_BACKFLIP_FORM;
  let flip = 0;
  while (owner.special.form === DEMONHUNTER_BACKFLIP_FORM) { flip++; stepDuel(world); }
  const startX = owner.motion.x, startZ = owner.motion.z;
  while (owner.special.form === DEMONHUNTER_DIVE_FORM && owner.special.action !== SpecialAction.none) stepDuel(world);
  return { started, flip, dx: f32(owner.motion.x - startX), dz: f32(owner.motion.z - startZ), helpless: owner.special.fall, owner };
}

test("Wing Dive: with no special press, a stick in any zone but the launch's on frame 19 of Wing Ascent backflips him about 6 frames and then dives that way a fixed distance, plain or EX, ending helpless; held on frames 8-18 it starts nothing [k1 scenario]", () => {
  for (const ex of [false, true]) {
    for (const [x, z] of ZONES) {
      if (x === 0 && z === 1) continue;
      const result = dive(x, z, ex);
      assertTrue(result.started);
      assertEquals(result.owner.special.ex, ex);
      assertTrue(Math.abs(result.flip - DEMONHUNTER_BACKFLIP_FRAMES) <= 1);
      assertTrue(result.helpless);
      const length = Math.sqrt(result.dx * result.dx + result.dz * result.dz);
      assertGreaterThan(length, f32(DIVE_LENGTH * f32(0.85)));
      assertLessThan(length, f32(DIVE_LENGTH * f32(1.15)));
      assertGreaterThan(f32(f32(result.dx * x) + f32(result.dz * z)), f32(f32(length * f32(0.95)) * (x !== 0 && z !== 0 ? f32(Math.SQRT2) : 1.0)));
      if (x !== 0) assertEquals(result.owner.facing, x);
    }
  }
});

interface Climb {
  readonly owner: Fighter;
  readonly trail: readonly number[];
  readonly dived: boolean;
}

function climb(launch: Readonly<Controls>, later: (frame: number) => Readonly<Controls>): Climb {
  const { world, owner } = ascending(900.0);
  runTo(world, owner, DEMONHUNTER_WING_STARTUP - 1, controls());
  stepDuel(world, launch);
  const trail: number[] = [];
  let dived = false;
  while (owner.special.action === SpecialAction.demonHunterWingAscent) {
    stepDuel(world, later(owner.special.frame));
    dived ||= owner.special.form !== 0;
    trail.push(owner.motion.x, owner.motion.z);
  }
  return { owner, trail, dived };
}

function sameTrail(first: Climb, second: Climb): boolean {
  return first.trail.length === second.trail.length && first.trail.every((value, index) => value === second.trail[index]);
}

test("Wing Dive: at rest or in the launch's own zone on frame 19 no dive starts, and he climbs on through all 32 frames and falls helpless, whatever zone the launch had [k1 scenario]", () => {
  const rest = climb(held(0, 0), () => held(0, 0));
  assertTrue(!rest.dived);
  assertTrue(rest.owner.special.fall);
  assertEquals(rest.trail.length, (DEMONHUNTER_WING_DURATION - DEMONHUNTER_WING_STARTUP) * 2);
  for (const [x, z] of ZONES) {
    const same = climb(held(x, z), () => held(x, z));
    assertTrue(!same.dived);
    assertTrue(same.owner.special.fall);
    const released = climb(held(x, z), () => held(0, 0));
    assertTrue(!released.dived);
    assertTrue(sameTrail(same, released));
  }
});

test("Wing Dive: a launch aimed off up dives on the up zone, since only the launch's own zone is excluded [k1 scenario]", () => {
  const climbed = climb(held(1, 0), frame => frame === DEMONHUNTER_DIVE_FRAME ? held(0, 1) : held(1, 0));
  assertTrue(climbed.dived);
});

test("Wing Dive: a different zone held only on frame 18 or only on frames 20-31 starts no dive, since the chosen frame is 19 alone [k1 scenario]", () => {
  const control = climb(held(0, 1), () => held(0, 1));
  const before = climb(held(0, 1), frame => frame === DEMONHUNTER_DIVE_FRAME - 1 ? held(1, -1) : held(0, 1));
  const after = climb(held(0, 1), frame => frame > DEMONHUNTER_DIVE_FRAME ? held(1, -1) : held(0, 1));
  assertTrue(!before.dived);
  assertTrue(!after.dived);
  assertTrue(sameTrail(control, before));
  assertTrue(sameTrail(control, after));
});

test("Wing Dive: a special press on every frame from 19 to 31, pointing every way, changes nothing while the stick stays at rest or in the launch zone [k1 scenario]", () => {
  const control = climb(held(0, 1), () => held(0, 1));
  for (const [x, z] of ZONES) {
    const pressed = climb(held(0, 1), frame => frame >= DEMONHUNTER_DIVE_FRAME ? controls({ specialPressed: true, specialX: x, specialZ: z, direction: 0, verticalDirection: 1 }) : held(0, 1));
    assertTrue(!pressed.dived);
    assertTrue(sameTrail(control, pressed));
  }
  const rest = climb(held(0, 0), () => held(0, 0));
  const restPressed = climb(held(0, 0), frame => frame >= DEMONHUNTER_DIVE_FRAME ? controls({ specialPressed: true, specialX: 1, specialZ: -1 }) : held(0, 0));
  assertTrue(!restPressed.dived);
  assertTrue(sameTrail(rest, restPressed));
});

test("Wing Dive: the dive hits a foe on its line, and touchdown during it keeps landing lag [k3 measure #279]", () => {
  const { world, owner, target } = ascending(900.0);
  fireAt(world, owner, held(1, 0));
  while (owner.special.form === DEMONHUNTER_BACKFLIP_FORM) stepDuel(world);
  target.motion.x = f32(owner.motion.x + f32(DIVE_LENGTH * 0.5));
  for (let frame = 0; frame < DEMONHUNTER_DIVE_FRAMES && target.status.damage === 0; frame++) { lift(target, owner.motion.z); stepDuel(world); }
  assertGreaterThan(target.status.damage, 0.0);
  const low = ascending(0.0);
  fireAt(low.world, low.owner, held(0, -1));
  let dived = false;
  for (let frame = 0; frame < 60 && !low.owner.motion.grounded; frame++) { dived ||= low.owner.special.form === DEMONHUNTER_DIVE_FORM; stepDuel(low.world); }
  assertTrue(dived);
  assertTrue(low.owner.motion.grounded);
  assertEquals(low.owner.special.action, SpecialAction.none);
  assertTrue(low.owner.landing.lag >= DEMONHUNTER_DIVE_LANDING_LAG - 1);
});

function launch(early: Readonly<Controls>, last: Readonly<Controls>): { owner: Fighter; frames: number; dx: number; dz: number } {
  const { world, owner } = ascending(900.0);
  const x = owner.motion.x, z = owner.motion.z;
  let frames = 0;
  while (owner.special.frame < DEMONHUNTER_WING_STARTUP - 1) {
    stepDuel(world, early);
    if (owner.motion.x === x && owner.motion.z === z) frames = owner.special.frame;
  }
  stepDuel(world, last);
  if (owner.motion.x === x && owner.motion.z === z) frames = owner.special.frame;
  while (owner.special.action === SpecialAction.demonHunterWingAscent) {
    stepDuel(world);
    if (owner.motion.x === x && owner.motion.z === z) frames = owner.special.frame;
  }
  return { owner, frames, dx: f32(owner.motion.x - x), dz: f32(owner.motion.z - z) };
}

test("Wing Ascent: he holds still through startup and first moves on the frame after the launch frame, 4 frames later than before [k3 measure #519]", () => {
  const { world, owner } = ascending(900.0);
  const x = owner.motion.x, z = owner.motion.z;
  while (owner.special.frame < DEMONHUNTER_WING_STARTUP) {
    assertEquals(owner.motion.z, z);
    assertEquals(owner.motion.x, x);
    assertEquals(owner.status.invincible, 0);
    stepDuel(world);
  }
  assertTrue(owner.status.invincible > 0);
  assertEquals(owner.motion.z, z);
  stepDuel(world);
  assertGreaterThan(owner.motion.z, z);
});

test("Wing Ascent: the stick held on the launch frame aims the whole ascent in each of the 8 keyboard directions, straight up with none held, over the same distance [k3 measure #519]", () => {
  const neutral = launch(held(-1, -1), held(0, 0));
  const reach = wingAscentReach(neutral.owner);
  assertEquals(neutral.frames, DEMONHUNTER_WING_STARTUP);
  assertEquals(neutral.dx, 0.0);
  assertGreaterThan(neutral.dz, f32(reach * f32(0.99)));
  assertLessThan(neutral.dz, f32(reach * f32(1.01)));
  for (const [x, z] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const) {
    const result = launch(held(-x, -z), held(x, z));
    const length = Math.sqrt(result.dx * result.dx + result.dz * result.dz);
    const unit = x !== 0 && z !== 0 ? f32(1.0 / Math.SQRT2) : 1.0;
    assertGreaterThan(length, f32(reach * f32(0.99)));
    assertLessThan(length, f32(reach * f32(1.01)));
    assertGreaterThan(f32(f32(f32(result.dx * x) + f32(result.dz * z)) * unit), f32(length * f32(0.99)));
    if (x !== 0) assertEquals(result.owner.facing, x);
  }
});

test("Wing Ascent: an analog stick aims the launch at its own angle, not the nearest of 8 [k3 measure #519]", () => {
  const pad = (x: number, z: number): Controls => controls({ diStickValid: true, diStickX: x, diStickZ: z, direction: x < 0 ? -1 : x > 0 ? 1 : 0, verticalDirection: z < 0 ? -1 : z > 0 ? 1 : 0 });
  const result = launch(pad(f32(-0.8), 0.0), pad(f32(0.3), f32(0.9)));
  const length = Math.sqrt(result.dx * result.dx + result.dz * result.dz);
  const stick = Math.sqrt(f32(0.3) * f32(0.3) + f32(0.9) * f32(0.9));
  assertGreaterThan(f32(f32(f32(result.dx * f32(0.3)) + f32(result.dz * f32(0.9))) / stick), f32(length * f32(0.999)));
  assertGreaterThan(length, f32(wingAscentReach(result.owner) * f32(0.99)));
});
