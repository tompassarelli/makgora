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
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { surfaceRight } from "../../sim/stage";
import { CHARGED_AIM_FRAMES, FOLLOW_UP_FORM } from "../../sim/specials/schema";
import { DIVE_TRAVEL, HAMMERFALL_LANDING_LAG, HAMMERFALL_WHIFF_LANDING_LAG, PLUNGE, THUNDER_LEAP_DIVE_FRAME, THUNDER_LEAP_LANDING_LAG } from "./specials";

const H = HERO_REFERENCE_HEIGHT;
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

const near = (actual: number, expected: number, what: string) => assertEquals(Math.abs(actual - expected) <= 0.5, true, `${what}: ${actual} against ${expected}`);

test("Thunder Leap zips 3.0H up in 12 frames, hangs 2 frames at the top on frame 23, and Hammerfall dives 0.24H a frame, the sideways dive 2.16H in 9 frames [k3 measure docs/design/roster.md]", () => {
  assertEquals(THUNDER_LEAP_DIVE_FRAME, 23, "the top is frame 23");
  assertEquals(PLUNGE, f32(H * f32(0.24)), "the dive speed is 0.24H a frame");
  const zip = zipMatch(0.0);
  const startZ = zip.king.motion.z;
  let tick = 1;
  press(zip, tick, UP, true);
  while (zip.king.special.frame < THUNDER_LEAP_DIVE_FRAME - 1) press(zip, ++tick, zip.king.special.frame < CHARGED_AIM_FRAMES ? UP : REST, false);
  near(f32(zip.king.motion.z - startZ), f32(H * f32(2.75)), "the rise one frame before the top");
  press(zip, ++tick, { x: 1, z: 0 }, false);
  assertEquals(zip.king.special.form >= FOLLOW_UP_FORM, true, "the sideways dive starts at the top");
  near(f32(zip.king.motion.z - startZ), f32(H * f32(3.0)), "the rise at the top");
  const topX = zip.king.motion.x;
  for (let n = 0; n < 2; n++) press(zip, ++tick, REST, false);
  near(zip.king.motion.x, topX, "he hangs two frames");
  for (let n = 0; n < DIVE_TRAVEL + 4; n++) press(zip, ++tick, REST, false);
  near(f32(zip.king.motion.x - topX), f32(f32(H * f32(0.24)) * DIVE_TRAVEL), "the sideways dive's reach");
});

test("A Hammerfall dive that hits no one lands in 40 frames of lag, straight down onto the deck or after a sideways dive's helpless fall; one that hits lands in its usual 24, or the leap's 11 after the helpless fall [k1 scenario]", () => {
  const down = zipToLanding({ x: 0, z: -1 });
  assertEquals(down.struck, false, "the straight dive meets no one");
  assertEquals(down.lag, HAMMERFALL_WHIFF_LANDING_LAG, "a whiffed straight dive lands in the whiff lag");
  const sideways = zipToLanding({ x: 1, z: 0 });
  assertEquals(sideways.struck, false, "the sideways dive meets no one");
  assertEquals(sideways.lag, HAMMERFALL_WHIFF_LANDING_LAG, "a whiffed sideways dive's helpless landing pays the whiff lag");
  const downHit = zipToLanding({ x: 0, z: -1 }, { foeOnLine: f32(H * 1.5) });
  assertEquals(downHit.struck, true, "the straight dive strikes the foe on its line");
  assertEquals(downHit.lag, HAMMERFALL_LANDING_LAG, "a dive that hits lands in its usual lag");
  const sidewaysHit = zipToLanding({ x: 1, z: 0 }, { foeOnLine: f32(H * 1.5) });
  assertEquals(sidewaysHit.struck, true, "the sideways dive strikes the foe on its line");
  assertEquals(sidewaysHit.lag, THUNDER_LEAP_LANDING_LAG, "a sideways dive that hits lands from its helpless fall in the leap's lag");
  assertEquals(HAMMERFALL_WHIFF_LANDING_LAG > HAMMERFALL_LANDING_LAG, true, "a whiff costs more than a hit");
});

test("A whiffed Hammerfall dive that lands sliding toward the deck's edge cancels its whiff lag: facing the edge he stops there in a teeter, and with the stick toward it he slides off, both with no lag [k1 scenario]", () => {
  const edge = surfaceRight(0, 0, 0);
  const teeter = zipToLanding({ x: 1, z: -1 }, { kingX: EDGE_RUN_IN });
  assertEquals(teeter.lag, HAMMERFALL_WHIFF_LANDING_LAG, "he lands from the whiffed dive in the whiff lag");
  for (let n = 0; n < 6; n++) press(teeter.zip, ++teeter.tick, REST, false);
  assertEquals(teeter.zip.king.motion.grounded, true, "he stays on the deck");
  assertEquals(teeter.zip.king.motion.x, edge, "he stops at the edge");
  assertEquals(teeter.zip.king.landing.lag, 0, "the teeter cancels the whiff lag");
  const off = zipToLanding({ x: 1, z: -1 }, { kingX: EDGE_RUN_IN, after: { x: 1, z: 0 } });
  assertEquals(off.lag, HAMMERFALL_WHIFF_LANDING_LAG, "he lands from the whiffed dive in the whiff lag");
  for (let n = 0; n < 6; n++) press(off.zip, ++off.tick, { x: 1, z: 0 }, false);
  assertEquals(off.zip.king.motion.grounded, false, "with the stick toward the edge he slides off it");
  assertEquals(off.zip.king.landing.lag, 0, "sliding off cancels the whiff lag");
  const middle = zipToLanding({ x: 1, z: -1 }, { kingX: -EDGE_RUN_IN });
  for (let n = 0; n < 6; n++) press(middle.zip, ++middle.tick, REST, false);
  assertEquals(middle.zip.king.landing.lag, f32(HAMMERFALL_WHIFF_LANDING_LAG - 6), "away from an edge the whiff lag runs on");
});

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
