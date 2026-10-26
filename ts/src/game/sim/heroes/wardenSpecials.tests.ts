import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, DownState, SpecialAction } from "../codes";
import { createFighter } from "../fighter";
import { setWorldMotionValue } from "../motion";
import { fighterAt } from "../roster";

const PERCENTS = [0, 50, 100, 150];
const TARGET_AHEAD = 60.0;
const AIRBORNE_HEIGHT = 40.0;
const WATCH_FRAMES = 150;

function fanOfKnivesAt(percent: number, airborne: boolean): void {
  const state = createReplaySnapshot();
  const maiev = fighterAt(state.world, 0);
  const target = fighterAt(state.world, 1);
  copyFighterState(maiev, createFighter(Character.warden, 0.0, 1), 3);
  copyFighterState(target, createFighter(Character.warden, TARGET_AHEAD, -1), 3);
  target.status.damage = f32(percent);
  if (airborne) {
    target.motion.z = AIRBORNE_HEIGHT;
    target.motion.vz = 0.0;
    target.motion.grounded = false;
    target.motion.surface = undefined;
    setWorldMotionValue(target.motion.meleeZ, target.motion.z);
    setWorldMotionValue(target.motion.meleeVelocityZ, target.motion.vz);
  }
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 272;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  let struck = false;
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    const row = inputRow({ held: tick === 1 ? maskOf(Action.moveDown, Action.special) : 0,
      pressed: tick === 1 ? maskOf(Action.special) : 0, axisZ: tick === 1 ? -127 : 0, specialZ: tick === 1 ? -1 : 0 });
    if (row === undefined) throw new Error("Fan of Knives input row");
    adaptInput(row, maiev, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (tick === 1) assertEquals(maiev.special.action, SpecialAction.heroDown, "Maiev starts Fan of Knives");
    struck ||= target.status.damage > percent;
    assertEquals(target.down.state, DownState.none, `${percent}% ${airborne ? "airborne" : "grounded"} target, frame ${tick}: down state`);
  }
  assertTrue(struck);
  assertGreaterThan(target.status.damage, percent);
  assertTrue(target.motion.grounded);
  assertEquals(target.launch.hitstun, 0, `${percent}% ${airborne ? "airborne" : "grounded"} target ends its hitstun`);
}

test("Maiev's ground Fan of Knives never tumbles or downs a grounded or airborne target at 0, 50, 100 or 150 percent [k1 scenario]", () => {
  for (const percent of PERCENTS) {
    fanOfKnivesAt(percent, false);
    fanOfKnivesAt(percent, true);
  }
});
