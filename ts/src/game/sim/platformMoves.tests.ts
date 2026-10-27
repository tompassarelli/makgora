import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { setWorldMotionValue } from "./motion";
import type { Controls, Roster } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { controls } from "./testWorld";
import { duelPair, stepDuel } from "./testDuel";

const STAGE = 1;
const PLATFORM = 1;
const FAR = -900.0;
const HOLD_FRAMES = 12;
const NEUTRAL = controls();
const DOWN = controls({ verticalDirection: -1 });
const FLICK_DOWN = controls({ diStickValid: true, diStickX: 0.0, diStickZ: -1.0, down: true });
const SLOW_DOWN_RAMP = [f32(0.3), f32(0.4), 0.5, f32(0.6)].map((z) => controls({ diStickValid: true, diStickX: 0.0, diStickZ: -z, down: true }));

interface Scene { readonly world: Roster; readonly f: Fighter }

function platformCenter(): number {
  return (surfaceLeft(STAGE, PLATFORM, 0) + surfaceRight(STAGE, PLATFORM, 0)) / 2;
}

function place(f: Fighter, z: number, vz: number): void {
  f.motion.x = platformCenter();
  f.motion.z = z;
  f.motion.vx = 0.0;
  f.motion.vz = vz;
  f.motion.grounded = false;
  f.motion.surface = undefined;
  setWorldMotionValue(f.motion.meleeZ, z);
  setWorldMotionValue(f.motion.meleeVelocityZ, vz);
}

function scene(): Scene {
  const { world, owner } = duelPair(createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, FAR, -1), 0, STAGE);
  return { world, f: owner };
}

function hold(s: Scene, input: Readonly<Controls>, frames: number): void {
  for (let i = 0; i < frames; i++) stepDuel(s.world, input, NEUTRAL, STAGE);
}

function fallFrom(height: number, input: Readonly<Controls>): Scene {
  const s = scene();
  place(s.f, surfaceZ(STAGE, PLATFORM, 0) + height, 0.0);
  for (let i = 0; i < 60 && !s.f.motion.grounded && s.f.motion.z > surfaceZ(STAGE, PLATFORM, 0) - 1.0; i++) stepDuel(s.world, input, NEUTRAL, STAGE);
  return s;
}

function standsOnPlatform(f: Fighter): boolean {
  return f.motion.grounded && f.motion.surface === PLATFORM;
}

test("A fighter who lands on a platform without holding down drops through on his first down input, flicked on a keyboard or an analog stick [k1 scenario]", () => {
  for (const flick of [DOWN, FLICK_DOWN]) {
    for (const wait of [0, 3, 12]) {
      const s = fallFrom(30.0, NEUTRAL);
      assertTrue(standsOnPlatform(s.f));
      hold(s, NEUTRAL, wait);
      assertTrue(standsOnPlatform(s.f));
      hold(s, flick, 1);
      assertFalse(s.f.motion.grounded);
      hold(s, NEUTRAL, 30);
      assertEquals(s.f.motion.surface, 0);
    }
  }
});

test("A fighter who lands on a platform with down held stays on it until the stick is let go and flicked down once, which drops him [k1 scenario]", () => {
  const landed = fallFrom(30.0, DOWN);
  assertTrue(standsOnPlatform(landed.f));
  hold(landed, DOWN, HOLD_FRAMES);
  assertTrue(standsOnPlatform(landed.f));
  hold(landed, NEUTRAL, 1);
  assertTrue(standsOnPlatform(landed.f));
  hold(landed, DOWN, 1);
  assertFalse(landed.f.motion.grounded);
});

test("A fighter falling onto a platform with down held, in a fast fall or not, lands on it and does not pass through [k1 scenario]", () => {
  for (const input of [DOWN, FLICK_DOWN]) {
    for (const height of [30.0, 150.0]) {
      const s = fallFrom(height, input);
      assertTrue(standsOnPlatform(s.f));
      hold(s, input, HOLD_FRAMES);
      assertTrue(standsOnPlatform(s.f));
    }
  }
});

test("A slow, gentle push down on a platform crouches without dropping [k1 scenario]", () => {
  const s = fallFrom(30.0, NEUTRAL);
  hold(s, NEUTRAL, HOLD_FRAMES);
  for (const step of SLOW_DOWN_RAMP) hold(s, step, 1);
  hold(s, FLICK_DOWN, HOLD_FRAMES);
  assertTrue(standsOnPlatform(s.f));
  assertTrue(s.f.motion.crouching);
});

test("Rising into a platform with down held still lands on it crouching [k1 scenario]", () => {
  const s = scene();
  place(s.f, surfaceZ(STAGE, PLATFORM, 0) - 40.0, 6.0);
  for (let i = 0; i < 30 && !s.f.motion.grounded; i++) stepDuel(s.world, DOWN, NEUTRAL, STAGE);
  assertTrue(standsOnPlatform(s.f));
  assertTrue(s.f.motion.crouching);
  hold(s, DOWN, HOLD_FRAMES);
  assertTrue(standsOnPlatform(s.f));
});
