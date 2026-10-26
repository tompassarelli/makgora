import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { type Controls, type Roster } from "./roster";
import {
  DEMONHUNTER_BACKFLIP_FORM, DEMONHUNTER_BACKFLIP_FRAMES, DEMONHUNTER_DIVE_FIRST, DEMONHUNTER_DIVE_FORM, DEMONHUNTER_DIVE_FRAMES, DEMONHUNTER_DIVE_LANDING_LAG, DEMONHUNTER_DIVE_LAST, DEMONHUNTER_DIVE_SPEED,
  DEMONHUNTER_WING_STARTUP, wingAscentReach,
} from "./specials";
import { controls } from "./testWorld";
import { duelPair, lift, stepDuel } from "./testDuel";

const upB = controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 });
const DIVE_LENGTH = f32(DEMONHUNTER_DIVE_SPEED * DEMONHUNTER_DIVE_FRAMES);

function ascending(z: number): { world: Roster; owner: Fighter; target: Fighter } {
  const pair = duelPair(createFighter(Character.demonHunter, 0.0, 1), createFighter(Character.rifleman, -500.0, 1));
  if (z > 0.0) lift(pair.owner, z);
  stepDuel(pair.world, upB);
  return pair;
}

function pressAt(world: Roster, owner: Fighter, frame: number, press: Readonly<Controls>): void {
  while (owner.special.action === SpecialAction.demonHunterWingAscent && owner.special.frame < frame) stepDuel(world);
  stepDuel(world, press);
}

const stick = (x: number, z: number): Controls => controls({ specialPressed: true, direction: x, verticalDirection: z, down: z < 0 });

function dive(x: number, z: number): { flip: number; dx: number; dz: number; helpless: boolean } {
  const { world, owner } = ascending(900.0);
  pressAt(world, owner, DEMONHUNTER_DIVE_FIRST, stick(x, z));
  let flip = 0;
  while (owner.special.form === DEMONHUNTER_BACKFLIP_FORM) { flip++; stepDuel(world); }
  const startX = owner.motion.x, startZ = owner.motion.z;
  while (owner.special.form === DEMONHUNTER_DIVE_FORM && owner.special.action !== SpecialAction.none) stepDuel(world);
  return { flip, dx: f32(owner.motion.x - startX), dz: f32(owner.motion.z - startZ), helpless: owner.special.fall };
}

test("Wing Dive: a second special in Wing Ascent's frames 19-31 backflips about 6 frames, then dives a fixed distance the way the stick held at the press points, forward and down with none, and ends helpless [k3 measure #279]", () => {
  for (const frame of [DEMONHUNTER_DIVE_FIRST - 1, DEMONHUNTER_DIVE_FIRST, DEMONHUNTER_DIVE_LAST]) {
    const { world, owner } = ascending(900.0);
    pressAt(world, owner, frame, stick(0, 0));
    assertEquals(owner.special.form === DEMONHUNTER_BACKFLIP_FORM, frame >= DEMONHUNTER_DIVE_FIRST);
  }
  for (const [x, z] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [0, 0]] as const) {
    const aimX = x === 0 && z === 0 ? 1 : x, aimZ = x === 0 && z === 0 ? -1 : z;
    const result = dive(x, z);
    assertTrue(Math.abs(result.flip - DEMONHUNTER_BACKFLIP_FRAMES) <= 1);
    assertTrue(result.helpless);
    const length = Math.sqrt(result.dx * result.dx + result.dz * result.dz);
    assertGreaterThan(length, f32(DIVE_LENGTH * f32(0.85)));
    assertLessThan(length, f32(DIVE_LENGTH * f32(1.15)));
    assertGreaterThan(f32(f32(result.dx * aimX) + f32(result.dz * aimZ)), f32(f32(length * f32(0.95)) * (aimX !== 0 && aimZ !== 0 ? f32(Math.SQRT2) : 1.0)));
  }
});

test("Wing Dive: the dive hits a foe on its line, and touchdown during it keeps landing lag [k3 measure #279]", () => {
  const { world, owner, target } = ascending(900.0);
  pressAt(world, owner, DEMONHUNTER_DIVE_FIRST, stick(1, 0));
  while (owner.special.form === DEMONHUNTER_BACKFLIP_FORM) stepDuel(world);
  target.motion.x = f32(owner.motion.x + f32(DIVE_LENGTH * 0.5));
  for (let frame = 0; frame < DEMONHUNTER_DIVE_FRAMES && target.status.damage === 0; frame++) { lift(target, owner.motion.z); stepDuel(world); }
  assertGreaterThan(target.status.damage, 0.0);
  const low = ascending(0.0);
  pressAt(low.world, low.owner, DEMONHUNTER_DIVE_FIRST, stick(0, -1));
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

const held = (x: number, z: number): Controls => controls({ direction: x, verticalDirection: z, down: z < 0 });

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
