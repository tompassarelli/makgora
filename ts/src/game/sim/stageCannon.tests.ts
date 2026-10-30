import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { setWorldMotionValue } from "./motion";
import { CANNON_TEST_STAGE, mainDeckLeft, mainDeckRight, mainDeckZ } from "./stage";
import { CANNON_BEAT_FRAMES, CANNON_HOLD_FRAMES, CANNON_PEAK_HEIGHT, CANNON_RISE_FRAMES, CANNON_SHOT_FRAMES, CANNON_Z, cannonX } from "./stageHazards";
import { controls } from "./testWorld";
import { duelPair, stepDuel } from "./testDuel";
import type { Controls } from "./roster";

const STAGE = CANNON_TEST_STAGE;
const FAR = 2000.0;
const NEUTRAL = controls();
const ATTACK = controls({ attackPressed: true });

function caught(x = cannonX(2)): { world: ReturnType<typeof duelPair>["world"]; f: Fighter } {
  const { world, owner } = duelPair(createFighter(Character.rifleman, x, 1), createFighter(Character.rifleman, FAR, -1), 0, STAGE);
  owner.motion.grounded = false;
  owner.motion.z = CANNON_Z;
  setWorldMotionValue(owner.motion.meleeZ, CANNON_Z);
  stepDuel(world, NEUTRAL, NEUTRAL, STAGE);
  return { world, f: owner };
}

function step(world: ReturnType<typeof duelPair>["world"], input: Readonly<Controls> = NEUTRAL): void {
  stepDuel(world, input, NEUTRAL, STAGE);
}

test("Blackrock's cannon: a fighter touching the barrel is caught below the underside and fired straight up on Attack [k1 scenario]", () => {
  const { world, f } = caught();
  assertTrue(f.cannon.held !== undefined);
  assertTrue(f.motion.z < -300.0 - 100.0);
  step(world, ATTACK);
  let x = Number.NaN;
  let peak = f.motion.z;
  let flames = 0;
  for (let i = 0; i < 80 && (f.cannon.held !== undefined || f.launch.hitstun > 0); i++) {
    if (f.cannon.held !== undefined && f.cannon.firing !== undefined && f.cannon.firing >= CANNON_SHOT_FRAMES) flames++;
    step(world);
    if (f.cannon.firing === CANNON_SHOT_FRAMES) x = f.motion.x;
    if (f.cannon.firing !== undefined && f.cannon.firing >= CANNON_SHOT_FRAMES) assertEquals(f.motion.x, x);
    if (f.motion.z > peak) peak = f.motion.z;
  }
  assertEquals(flames, CANNON_RISE_FRAMES);
  assertEquals(peak, mainDeckZ(STAGE) + CANNON_PEAK_HEIGHT);
  assertTrue(x > mainDeckLeft(STAGE) && x < mainDeckRight(STAGE));
});

test("Blackrock's cannon: the fighter is in tumble and cannot act until a beat after the flames end, and takes no damage [k2 property]", () => {
  const { world, f } = caught();
  const damage = f.status.damage;
  const jumps = f.jump.remaining;
  step(world, ATTACK);
  let flamesEnded = -1;
  let acted = -1;
  for (let frame = 0; frame < 120 && acted < 0; frame++) {
    step(world, controls({ jumpPressed: true }));
    if (f.cannon.held === undefined && flamesEnded < 0) flamesEnded = frame;
    if (flamesEnded >= 0 && f.jump.remaining < jumps) acted = frame;
    assertEquals(f.status.damage, damage);
  }
  assertTrue(flamesEnded > 0);
  assertEquals(acted - flamesEnded, CANNON_BEAT_FRAMES);
});

test("Blackrock's cannon: fired from any point of its path, or by itself after the hold, the fighter lands over the deck [k2 property]", () => {
  for (const wait of [0, 20, 60, 100, 140, 170, CANNON_HOLD_FRAMES]) {
    const { world, f } = caught();
    for (let i = 0; i < wait; i++) step(world);
    if (wait < CANNON_HOLD_FRAMES) step(world, ATTACK);
    for (let i = 0; i < CANNON_HOLD_FRAMES + CANNON_SHOT_FRAMES + CANNON_RISE_FRAMES + 20 && f.cannon.held !== undefined; i++) step(world);
    assertTrue(f.cannon.held === undefined);
    assertTrue(f.motion.x > mainDeckLeft(STAGE) + 100.0 && f.motion.x < mainDeckRight(STAGE) - 100.0);
    assertTrue(f.motion.z > mainDeckZ(STAGE));
    assertFalse(f.cannon.passing);
  }
});
