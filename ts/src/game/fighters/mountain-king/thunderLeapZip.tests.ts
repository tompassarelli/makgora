import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { canonicalState } from "../../replay/canonical";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";
import { CHARGED_AIM_FRAMES, FOLLOW_UP_FORM } from "../../sim/specials/schema";
import { HAMMERFALL_WHIFF_LANDING_LAG, THUNDER_LEAP_DIVE_FRAME } from "./specials";

const FAR = 2000.0;
const FOE_SPOT = -450.0;
const WATCH = 300;
const STICK = 127;
const EDGE_RUN_IN = 150.0;

interface Stick {
  readonly x: number;
  readonly z: number;
}

interface Zip {
  readonly state: ReplayState;
  readonly king: Fighter;
  readonly foe: Fighter;
}

function zipMatch(kingX: number): Zip {
  const state = createReplaySnapshot();
  const king = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(king, createFighter(Character.mountainKing, kingX, 1), 3);
  copyFighterState(foe, createFighter(Character.rifleman, FOE_SPOT, 1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 931;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, king, foe };
}

function hold(foe: Fighter, x: number, z: number): void {
  foe.motion.x = x;
  foe.motion.z = z;
  foe.motion.vx = 0.0;
  foe.motion.vz = 0.0;
  foe.motion.grounded = false;
  foe.motion.surface = undefined;
  setWorldMotionValue(foe.motion.meleeX, x);
  setWorldMotionValue(foe.motion.meleeZ, z);
  setWorldMotionValue(foe.motion.meleeVelocityZ, 0.0);
}

function press(zip: Zip, tick: number, stick: Stick, special: boolean): void {
  const held = (stick.x < 0 ? maskOf(Action.moveLeft) : stick.x > 0 ? maskOf(Action.moveRight) : 0)
    | (stick.z < 0 ? maskOf(Action.moveDown) : stick.z > 0 ? maskOf(Action.moveUp) : 0) | (special ? maskOf(Action.special) : 0);
  const row = inputRow({ held, pressed: special ? maskOf(Action.special) : 0, axisX: stick.x * STICK, axisZ: stick.z * STICK, specialZ: special ? 1 : 0 });
  if (row === undefined) throw new Error("Mountain King input row");
  adaptInput(row, zip.king, tick, zip.state.controls.inputs[0], zip.state.controls.commands[0]);
  stepMatch(zip.state.match, zip.state.world, zip.state.controls, tick);
}

const UP: Stick = { x: 0, z: 1 };
const REST: Stick = { x: 0, z: 0 };

function stickAt(zip: Zip, dive: Stick, after: Stick): Stick {
  const { special } = zip.king;
  if (special.action !== SpecialAction.heroUp) return after;
  if (special.form >= FOLLOW_UP_FORM) return REST;
  return special.frame < CHARGED_AIM_FRAMES ? UP : special.frame === THUNDER_LEAP_DIVE_FRAME - 1 ? dive : REST;
}

interface Landing {
  readonly zip: Zip;
  readonly lag: number;
  readonly struck: boolean;
  tick: number;
}

function zipToLanding(dive: Stick, options: { readonly kingX?: number; readonly foeOnLine?: number; readonly after?: Stick } = {}): Landing {
  const zip = zipMatch(options.kingX ?? 0.0);
  let tick = 1;
  press(zip, tick, UP, true);
  assertEquals(zip.king.special.action, SpecialAction.heroUp, "Thunder Leap starts");
  let left = false;
  let foeX = -FAR;
  let foeZ = 0.0;
  while (tick < WATCH) {
    if (options.foeOnLine !== undefined && zip.king.special.frame === THUNDER_LEAP_DIVE_FRAME - 1) {
      const length = dive.x !== 0 && dive.z !== 0 ? f32(0.7071067811865476) : 1.0;
      foeX = f32(zip.king.motion.x + f32(f32(dive.x * length) * options.foeOnLine));
      foeZ = f32(zip.king.motion.z + f32(f32(dive.z * length) * options.foeOnLine));
    }
    if (options.foeOnLine !== undefined && zip.foe.status.damage === 0.0 && foeX !== -FAR) hold(zip.foe, foeX, foeZ);
    press(zip, ++tick, stickAt(zip, dive, options.after ?? REST), false);
    left ||= !zip.king.motion.grounded;
    if (left && zip.king.motion.grounded) return { zip, lag: zip.king.landing.lag, struck: zip.foe.status.damage > 0.0, tick };
  }
  throw new Error("Mountain King never lands");
}

test("A rollback from before a whiffed Hammerfall dive lands replays the landing and its whiff lag to the same state [k1 scenario]", () => {
  const first = zipToLanding({ x: 1, z: -1 }, { kingX: -EDGE_RUN_IN });
  const landTick = first.tick;
  const expected = canonicalState(first.zip.state);
  const zip = zipMatch(-EDGE_RUN_IN);
  const snapshot = createReplaySnapshot();
  const dive: Stick = { x: 1, z: -1 };
  const rollBackFrom = landTick - 4;
  press(zip, 1, UP, true);
  for (let tick = 2; tick <= landTick; tick++) {
    press(zip, tick, stickAt(zip, dive, REST), false);
    if (tick === rollBackFrom) copyReplayState(snapshot, zip.state);
  }
  assertEquals(canonicalState(zip.state), expected, "the second run matches the first");
  copyReplayState(zip.state, snapshot);
  for (let tick = rollBackFrom + 1; tick <= landTick; tick++) press(zip, tick, stickAt(zip, dive, REST), false);
  assertEquals(canonicalState(zip.state), expected, "the replay matches");
  assertEquals(zip.king.landing.lag, HAMMERFALL_WHIFF_LANDING_LAG, "the replay lands in the whiff lag");
});
