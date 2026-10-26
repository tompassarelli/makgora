import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { groundOptionOpen, groundState } from "./groundMovement";
import { type Controls, type Roster } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { GroundOption, GroundState, WALK_MIDDLE_STICK_THRESHOLD } from "./stickZones";
import { controls } from "./testWorld";
import { duelPair, lift, stepDuel } from "./testDuel";

const STAGE = 1;
const DECK = 2;
const EDGE = surfaceRight(STAGE, DECK, 0);
const TOP = surfaceZ(STAGE, DECK, 0);
const WAVELAND_TEETERS = 100.0;
const WAVELAND_IN_LAG = 80.0;
const DASH_RELEASED_SHORT = 60.0;
const DASH_FRAMES = 3;

interface Run { readonly world: Roster; readonly f: Fighter }

function onPlatform(x: number, facing: number): Run {
  const { world, owner } = duelPair(createFighter(Character.rifleman, x, facing), createFighter(Character.rifleman, -900.0, -1), 0, STAGE);
  owner.motion.z = TOP;
  owner.motion.grounded = true;
  owner.motion.surface = DECK;
  for (let i = 0; i < 3; i++) step({ world, f: owner });
  owner.motion.x = x;
  return { world, f: owner };
}

function step(run: Run, input: Readonly<Controls> = controls()): void {
  stepDuel(run.world, input, controls(), STAGE);
}

function waveland(gap: number, facing: number): Run {
  const run = onPlatform(f32(EDGE - gap), facing);
  lift(run.f, f32(TOP + 4.0));
  step(run, controls({ airDodgePressed: true, dodgeX: 1, dodgeZ: -1, direction: 1, verticalDirection: -1, shield: true }));
  return run;
}

const analog = (x: number): Controls => controls({ diStickValid: true, diStickX: x, direction: x > 0 ? 1 : x < 0 ? -1 : 0 });

interface Edge { readonly frame: number; readonly lag: number; readonly teetered: boolean }

function untilEdge(run: Run, input: (frame: number) => Readonly<Controls>, frames = 40): Edge {
  for (let frame = 1; frame <= frames; frame++) {
    const lag = run.f.landing.lag;
    step(run, input(frame));
    if (run.f.motion.x === EDGE && run.f.motion.grounded) return { frame, lag, teetered: true };
    if (!run.f.motion.grounded && run.f.motion.x > EDGE) return { frame, lag, teetered: false };
  }
  return { frame: frames, lag: run.f.landing.lag, teetered: false };
}

function holdsAtEdge(run: Run, frames: number): boolean {
  for (let i = 0; i < frames; i++) {
    step(run);
    if (run.f.motion.x !== EDGE || !run.f.motion.grounded || run.f.motion.surface !== DECK) return false;
  }
  return true;
}

test("Teeter: a landing sliding to an edge with the stick neutral stops there and teeters in either facing, its lag ended, whether the lag is still running or already over [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    for (const gap of [WAVELAND_IN_LAG, WAVELAND_TEETERS]) {
      const run = waveland(gap, facing);
      const edge = untilEdge(run, () => controls());
      assertTrue(edge.teetered);
      assertEquals(run.f.facing, facing);
      assertEquals(edge.lag > 0, gap === WAVELAND_IN_LAG);
      assertEquals(run.f.landing.lag, 0);
      assertEquals(run.f.motion.vx, 0.0);
      assertEquals(groundState(run.f), GroundState.stand);
      assertTrue(holdsAtEdge(run, 30));
    }
  }
});

test("Teeter: the same landing holding toward the edge does not teeter in either facing but falls on the teeter frame with the edge cancel kept [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    const neutral = untilEdge(waveland(WAVELAND_IN_LAG, facing), () => controls());
    const run = waveland(WAVELAND_IN_LAG, facing);
    const toward = untilEdge(run, () => controls({ direction: 1 }));
    assertFalse(toward.teetered);
    assertEquals(toward.frame, neutral.frame);
    assertGreaterThan(toward.lag, 0);
    assertEquals(run.f.landing.lag, 0);
    assertEquals(run.f.motion.surface, undefined);
  }
});

test("Teeter: a slow walk toward an edge teeters; a stick past the slow walk walks off [k1 scenario]", () => {
  const slow = onPlatform(f32(EDGE - 40.0), 1);
  assertTrue(untilEdge(slow, () => analog(f32(WALK_MIDDLE_STICK_THRESHOLD - f32(0.1))), 120).teetered);
  assertTrue(holdsAtEdge(slow, 10));
  const brisk = onPlatform(f32(EDGE - 40.0), 1);
  assertFalse(untilEdge(brisk, () => analog(f32(WALK_MIDDLE_STICK_THRESHOLD + f32(0.2))), 120).teetered);
});

test("Teeter cancel: a dash released just short of the edge teeters, ending the dash, with jab and tilts open at once [k1 scenario]", () => {
  const dash = (frame: number): Controls => frame <= DASH_FRAMES ? controls({ direction: 1 }) : controls();
  const run = onPlatform(f32(EDGE - DASH_RELEASED_SHORT), 1);
  const edge = untilEdge(run, dash);
  assertTrue(edge.teetered);
  assertGreaterThan(edge.frame, DASH_FRAMES);
  assertEquals(groundState(run.f), GroundState.stand);
  assertTrue(groundOptionOpen(run.f, GroundOption.jab) && groundOptionOpen(run.f, GroundOption.tilt));
  const open = onPlatform(f32(surfaceLeft(STAGE, DECK, 0) + 20.0), 1);
  for (let frame = 1; frame <= edge.frame; frame++) step(open, dash(frame));
  assertEquals(groundState(open.f), GroundState.dash);
  assertFalse(groundOptionOpen(open.f, GroundOption.jab));
});
