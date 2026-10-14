import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, LedgeState } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { aerialJumps, groundedJumps } from "./itemBuffs";
import { installDamageLaunch } from "./knockback";
import { resolveLedges } from "./ledge";
import { createReferenceFighter } from "./referenceRig";
import type { Controls } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { advanceSolo, controls, testWorld } from "./testWorld";

const PLATFORM_STAGE = 1;
const PLATFORM = 1;

function standing(stage: number, deck: number, x: number): Fighter {
  const f = createFighter(Character.rifleman, x, 1);
  f.motion.grounded = true;
  f.motion.surface = deck;
  f.motion.z = surfaceZ(stage, deck, 0);
  f.jump.remaining = groundedJumps(f);
  return f;
}

function untilAirborne(f: Fighter, stage: number, input: Readonly<Controls>): void {
  for (let frame = 0; frame < 120 && f.motion.grounded; frame++) advanceSolo(f, stage, input, 0.0);
  assertTrue(!f.motion.grounded);
}

test("a fighter launched off the ground keeps only its midair jump [k3 measure #550]", () => {
  const f = standing(0, 0, 0.0);
  installDamageLaunch(f, 120.0, f32(0.5), f32(0.866), true);
  assertTrue(!f.motion.grounded);
  assertEquals(f.jump.remaining, aerialJumps(f));
});

test("a hit in the air refreshes the midair jump and never grants the ground jump [k3 measure #550]", () => {
  for (const before of [0, 1]) {
    const f = standing(0, 0, 0.0);
    f.motion.grounded = false;
    f.motion.surface = undefined;
    f.motion.z = f32(f.motion.z + 200.0);
    f.jump.remaining = before;
    installDamageLaunch(f, 120.0, f32(0.5), f32(0.866), false);
    assertEquals(f.jump.remaining, aerialJumps(f), `${before} jumps before the hit`);
  }
});

test("walking off the main deck keeps only the midair jump [k3 measure #550]", () => {
  const f = standing(0, 0, f32(surfaceRight(0, 0, 0) - 10.0));
  untilAirborne(f, 0, controls({ direction: 1 }));
  assertEquals(f.jump.remaining, aerialJumps(f));
});

test("dropping through a platform keeps only the midair jump [k3 measure #550]", () => {
  const centre = f32(f32(surfaceLeft(PLATFORM_STAGE, PLATFORM, 0) + surfaceRight(PLATFORM_STAGE, PLATFORM, 0)) / 2);
  const f = standing(PLATFORM_STAGE, PLATFORM, centre);
  untilAirborne(f, PLATFORM_STAGE, controls({ down: true, verticalDirection: -1 }));
  assertEquals(f.jump.remaining, aerialJumps(f));
});

test("letting go of the ledge keeps only the midair jump [k3 measure #550]", () => {
  const f = createReferenceFighter(Character.rifleman, 620.0, -1);
  f.motion.grounded = false;
  f.motion.z = -80.0;
  f.motion.vz = -2.0;
  f.motion.deltaZ = -2.0;
  f.jump.remaining = groundedJumps(f);
  resolveLedges(testWorld(f, createReferenceFighter(Character.rifleman, 0.0, 1)), 0, [controls(), controls()]);
  assertEquals(f.ledge.state, LedgeState.hang);
  for (let frame = 0; frame < 60 && f.ledge.state !== LedgeState.none; frame++) advanceSolo(f, 0, controls({ getupDirectionPressed: true, getupDirection: 1 }), 0.0);
  assertEquals(f.ledge.state, LedgeState.none);
  assertTrue(!f.motion.grounded);
  assertEquals(f.jump.remaining, aerialJumps(f));
});
