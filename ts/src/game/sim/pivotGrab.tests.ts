import "./roster";
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GroundAction } from "./codes";
import { attackActive, attackStartup, inGrabContext } from "./conditions";
import { type Fighter, createFighter } from "./fighter";
import { type Controls, type Roster } from "./roster";
import { controls } from "./testWorld";
import { duelPair, queueDuelAttack, stepDuel } from "./testDuel";

const START = -300.0;
const FAR = 300.0;
const DASH_FRAMES = 6;
const RUN_FRAMES = 30;
const BEYOND_DASH_REACH = 128.0;
const PIVOT_FRAMES_TOM_CHOSE = [1, 2];
const FIRST_FRAME_AFTER_PIVOT = 3;

type Moment = "turnaround" | number;

interface Run { readonly world: Roster; readonly f: Fighter; readonly target: Fighter }

const forward = controls({ direction: 1 });
const back = controls({ direction: -1 });

function dashing(frames: number): Run {
  const { world, owner: f, target } = duelPair(createFighter(Character.rifleman, START, 1), createFighter(Character.rifleman, FAR, -1));
  for (let i = 0; i < frames; i++) stepDuel(world, forward);
  return { world, f, target };
}

function stepWithGrab(run: Run, input: Readonly<Controls>): void {
  queueDuelAttack(run.world, AttackStyle.grab, 0);
  stepDuel(run.world, input);
}

function pivotGrab(moment: Moment): Run {
  const run = dashing(DASH_FRAMES);
  if (moment === "turnaround") {
    stepWithGrab(run, back);
    return run;
  }
  stepDuel(run.world, back);
  for (let frame = 1; frame < moment; frame++) stepDuel(run.world, controls());
  stepWithGrab(run, controls());
  return run;
}

function travelToEnd(run: Run): number {
  const from = run.f.motion.x;
  for (let frame = 0; run.f.attack.style !== undefined && frame < 120; frame++) stepDuel(run.world, controls());
  return f32(run.f.motion.x - from);
}

function placeTarget(target: Fighter, beside: Readonly<Fighter>, x: number): void {
  target.motion.x = x;
  target.motion.z = beside.motion.z;
  target.motion.vx = 0.0;
  target.motion.grounded = beside.motion.grounded;
  target.motion.surface = beside.motion.surface;
}

function catchesBeyondDashReach(moment: Moment): boolean {
  const probe = pivotGrab(moment);
  const lastActive = attackStartup(probe.f, AttackStyle.grab) + attackActive(probe.f, AttackStyle.grab) - 1;
  while (probe.f.attack.frame < lastActive) stepDuel(probe.world, controls());
  const lastX = probe.f.motion.x;
  const run = pivotGrab(moment);
  while (run.f.attack.frame < attackStartup(run.f, AttackStyle.grab) - 1) stepDuel(run.world, controls());
  placeTarget(run.target, run.f, f32(lastX - BEYOND_DASH_REACH));
  for (let frame = 0; frame < attackActive(run.f, AttackStyle.grab) + 1 && !inGrabContext(run.target); frame++) stepDuel(run.world, controls());
  return inGrabContext(run.target);
}

test("Pivot grab: a grab on the dash-back turnaround frame or on either pivot frame after it faces the new way, slides on with the dash's momentum and catches with the pivot box, beyond the dash grab's reach [k3 measure docs/design/grabs.md]", () => {
  const moments: Moment[] = ["turnaround", ...PIVOT_FRAMES_TOM_CHOSE];
  for (const moment of moments) {
    const run = pivotGrab(moment);
    assertEquals(run.f.attack.style, AttackStyle.grab, `grab at ${moment}`);
    assertTrue(run.f.attack.pivotGrab);
    assertTrue(run.f.attack.dashGrab);
    assertEquals(run.f.facing, -1);
    assertLessThan(run.f.motion.vx, -run.f.tuning.physics.walkSpeed);
    assertLessThan(travelToEnd(run), -BEYOND_DASH_REACH * 0.5);
    assertTrue(catchesBeyondDashReach(moment));
  }
});

test("Pivot grab: the pivot lasts two frames, so a grab on the frame after them is the standing grab and keeps none of the dash [k3 measure docs/design/grabs.md]", () => {
  const run = pivotGrab(FIRST_FRAME_AFTER_PIVOT);
  assertEquals(run.f.attack.style, AttackStyle.grab);
  assertFalse(run.f.attack.pivotGrab);
  assertFalse(run.f.attack.dashGrab);
  assertGreaterThan(travelToEnd(run), -run.f.tuning.physics.walkSpeed);
});

test("Pivot grab: a dash back flicked on either pivot frame still dash-dances, dashing the other way at once [k1 scenario]", () => {
  for (const frame of PIVOT_FRAMES_TOM_CHOSE) {
    const run = dashing(DASH_FRAMES);
    stepDuel(run.world, back);
    for (let neutral = 1; neutral < frame; neutral++) stepDuel(run.world, controls());
    stepDuel(run.world, forward);
    assertEquals(run.f.ground.action, GroundAction.dash);
    assertEquals(run.f.ground.dashDirection, 1);
    assertEquals(run.f.facing, 1);
    assertGreaterThan(run.f.motion.vx, 0.0);
  }
});

test("Pivot grab: a grab from a standstill is the standing grab and a grab in a forward dash is the dash grab, neither a pivot grab [k1 scenario]", () => {
  const standing = dashing(0);
  stepWithGrab(standing, controls());
  assertEquals(standing.f.attack.style, AttackStyle.grab);
  assertFalse(standing.f.attack.dashGrab);
  assertFalse(standing.f.attack.pivotGrab);
  assertEquals(standing.f.motion.vx, 0.0);
  for (const frames of [0, DASH_FRAMES - 1]) {
    const dash = dashing(frames);
    stepWithGrab(dash, forward);
    assertEquals(dash.f.attack.style, AttackStyle.grab, `dash grab after ${frames}`);
    assertTrue(dash.f.attack.dashGrab);
    assertFalse(dash.f.attack.pivotGrab);
    assertEquals(dash.f.facing, 1);
  }
});

test("Pivot grab: a grab on the run-turn frame stays the Turn-run pivot grab [k1 scenario]", () => {
  const run = dashing(RUN_FRAMES);
  assertEquals(run.f.ground.action, GroundAction.run);
  stepWithGrab(run, back);
  assertEquals(run.f.attack.style, AttackStyle.grab);
  assertTrue(run.f.attack.pivotGrab);
  assertTrue(run.f.attack.dashGrab);
});
