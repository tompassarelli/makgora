import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, DownState, SpecialAction } from "../../sim/codes";
import type { Fighter } from "../../sim/fighter";
import { createFighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";

const PERCENTS = [0, 50, 100, 150];
const TARGET_AHEAD = 60.0;
const AIRBORNE_HEIGHT = 40.0;
const MAIEV_AIR_HEIGHT = 300.0;
const WATCH_FRAMES = 150;

function lift(fighter: Fighter, height: number): void {
  fighter.motion.z = height;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

function fanScene(percent: number, targetX: number, maievHeight: number, targetHeight: number) {
  const state = createReplaySnapshot();
  const maiev = fighterAt(state.world, 0);
  const target = fighterAt(state.world, 1);
  copyFighterState(maiev, createFighter(Character.warden, 0.0, 1), 3);
  copyFighterState(target, createFighter(Character.warden, targetX, targetX > 0 ? -1 : 1), 3);
  target.status.damage = f32(percent);
  if (maievHeight > 0) lift(maiev, maievHeight);
  if (targetHeight > 0) lift(target, targetHeight);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 272;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const step = (tick: number): void => {
    const row = inputRow({ held: tick === 1 ? maskOf(Action.moveDown, Action.special) : 0,
      pressed: tick === 1 ? maskOf(Action.special) : 0, axisZ: tick === 1 ? -127 : 0, specialZ: tick === 1 ? -1 : 0 });
    if (row === undefined) throw new Error("Fan of Knives input row");
    adaptInput(row, maiev, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (tick === 1) assertEquals(maiev.special.action, SpecialAction.heroDown, "Maiev starts Fan of Knives");
  };
  return { maiev, target, step };
}

function fanOfKnivesAt(percent: number, airborne: boolean): void {
  const { target, step } = fanScene(percent, TARGET_AHEAD, 0.0, airborne ? AIRBORNE_HEIGHT : 0.0);
  let struck = false;
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    step(tick);
    struck ||= target.status.damage > percent;
    assertEquals(target.down.state, DownState.none, `${percent}% ${airborne ? "airborne" : "grounded"} target, frame ${tick}: down state`);
  }
  assertTrue(struck);
  assertGreaterThan(target.status.damage, percent);
  assertTrue(target.motion.grounded);
  assertEquals(target.launch.hitstun, 0, `${percent}% ${airborne ? "airborne" : "grounded"} target ends its hitstun`);
}

function fanLaunch(percent: number, targetX: number, maievHeight: number): { knockbackX: number; knockbackZ: number; damage: number; grounded: boolean } {
  const { target, step } = fanScene(percent, targetX, maievHeight, maievHeight);
  for (let tick = 1; tick <= 12; tick++) {
    step(tick);
    if (target.status.damage > percent) {
      return { knockbackX: target.launch.knockbackX, knockbackZ: target.launch.knockbackZ, damage: f32(target.status.damage - percent), grounded: target.motion.grounded };
    }
  }
  throw new Error(`Fan of Knives missed a foe at ${targetX} with Maiev ${maievHeight} up at ${percent}%`);
}

test("Maiev's ground Fan of Knives never tumbles or downs a grounded or airborne target at 0, 50, 100 or 150 percent [k1 scenario]", () => {
  for (const percent of PERCENTS) {
    fanOfKnivesAt(percent, false);
    fanOfKnivesAt(percent, true);
  }
});

test("Maiev's ground Fan of Knives pushes a foe on either side of her away from her [k1 scenario]", () => {
  for (const side of [1, -1]) {
    const launch = fanLaunch(0, side * TARGET_AHEAD, 0.0);
    assertGreaterThan(launch.knockbackX * side, 0.0);
    assertTrue(launch.grounded || launch.knockbackZ >= 0);
  }
  const ahead = fanLaunch(0, TARGET_AHEAD, 0.0);
  const behind = fanLaunch(0, -TARGET_AHEAD, 0.0);
  assertEquals(behind.knockbackX, -ahead.knockbackX, "both sides push equally hard");
});

test("Maiev's air Fan of Knives sends a foe on either side of her away on the same set semi-spike at 0 and 100 percent [k1 scenario]", () => {
  for (const side of [1, -1]) {
    const fresh = fanLaunch(0, side * TARGET_AHEAD, MAIEV_AIR_HEIGHT);
    const worn = fanLaunch(100, side * TARGET_AHEAD, MAIEV_AIR_HEIGHT);
    assertEquals(fresh.damage, 5.0, `air hit on side ${side} deals 5%`);
    assertGreaterThan(fresh.knockbackX * side, 0.0);
    assertEquals(fresh.knockbackZ <= 0, true, `side ${side}: not popped up, knockback ${fresh.knockbackZ}`);
    assertEquals(worn.knockbackX, fresh.knockbackX, `side ${side}: same horizontal launch at 0 and 100 percent`);
    assertEquals(worn.knockbackZ, fresh.knockbackZ, `side ${side}: same vertical launch at 0 and 100 percent`);
  }
});
