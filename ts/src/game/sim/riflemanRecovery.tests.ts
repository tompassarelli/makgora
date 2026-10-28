import { assertEquals, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "./codes";
import { EMPTY_LANDING_LAG, RIFLEMAN_RECOVERY_LANDING_LAG } from "./down";
import { type Fighter, createFighter } from "./fighter";
import { controls } from "./testWorld";
import { duelPair, lift, stepDuel } from "./testDuel";

const RECOVERY_FLIGHT_FRAMES = 240;
const STRAIGHT_UP_APEX = f32(465.2);
const DIAGONAL_REACH = 237.0;

interface Flight { readonly apex: number; readonly reach: number; readonly landingLag: number; readonly owner: Fighter }

function recoveryFlight(aimX: number, aimZ: number): Flight {
  const { world, owner } = duelPair(createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, -900.0, 1));
  const x0 = owner.motion.x;
  const z0 = owner.motion.z;
  stepDuel(world, controls({ specialPressed: true, specialX: aimX, specialZ: aimZ, direction: aimX, verticalDirection: aimZ }));
  let apex = 0;
  let reach = 0;
  let landingLag = -1;
  let airborne = false;
  for (let frame = 0; frame < RECOVERY_FLIGHT_FRAMES; frame++) {
    stepDuel(world);
    apex = Math.max(apex, owner.motion.z - z0);
    reach = Math.max(reach, Math.abs(owner.motion.x - x0));
    if (!owner.motion.grounded) airborne = true;
    else if (airborne && landingLag < 0) landingLag = owner.landing.lag;
  }
  return { apex, reach, landingLag, owner };
}

function landingLagAfterLift(): number {
  const { world, owner } = duelPair(createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, -900.0, 1));
  lift(owner, 300.0);
  let landingLag = -1;
  for (let frame = 0; frame < RECOVERY_FLIGHT_FRAMES && landingLag < 0; frame++) {
    stepDuel(world, controls());
    if (owner.motion.grounded) landingLag = owner.landing.lag;
  }
  return landingLag;
}

test("Rifleman's up special with its speed values at 0.949: straight up apexes at 465.2 and a diagonal reaches 237.0 across, down from 517.4 and 263.3 [k1 scenario]", () => {
  const up = recoveryFlight(0, 1);
  assertNear(up.apex, STRAIGHT_UP_APEX, 0.5);
  const diagonal = recoveryFlight(1, 1);
  assertNear(diagonal.reach, DIAGONAL_REACH, 0.5);
});

test("Rifleman's up special lands with 14 frames of landing lag, 10 more than a plain airborne landing, and a plain landing keeps the old 4 [k1 scenario]", () => {
  assertEquals(RIFLEMAN_RECOVERY_LANDING_LAG - EMPTY_LANDING_LAG, 10);
  const up = recoveryFlight(0, 1);
  assertEquals(up.landingLag, RIFLEMAN_RECOVERY_LANDING_LAG);
  assertEquals(landingLagAfterLift(), EMPTY_LANDING_LAG);
});
