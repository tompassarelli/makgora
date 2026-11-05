import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase, stageClock } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { type Scene, airborne, fighter, frame, scene } from "../../match/padScene";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { canonicalState } from "../../replay/canonical";
import { Character, GrappleState } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "../../sim/stage";

const NORDRASSIL = 10;
const TOP_PLATFORM = 3;
const FIRE = [Action.grab, Action.moveUp] as const;
const UP = [Action.moveUp] as const;
const FIRE_FRAMES = 11;
const NEUTRAL: readonly Action[] = [];

function place(s: Scene, facing: number, x: number, z: number): void {
  const f = fighter(s);
  airborne(f, x, z);
  setWorldMotionValue(f.motion.meleeZ, z);
  f.facing = facing;
}

function sceneFor(stage: number, facing: number): Scene {
  return scene(stage, [{ character: Character.tinker, x: 0, facing }, { character: Character.rifleman, x: 1500, facing: -1 }]);
}

function beneath(stage: number, platform: number, facing: number, lift = 90, near = 106): Scene {
  const s = sceneFor(stage, facing);
  const at = stageClock(s.game) + FIRE_FRAMES;
  const middle = (surfaceLeft(stage, platform, at) + surfaceRight(stage, platform, at)) / 2;
  place(s, facing, middle - facing * near, surfaceZ(stage, platform, at) - 55 - near + lift);
  return s;
}

function run(s: Scene, frames: number, held: readonly Action[]): void {
  for (let i = 0; i < frames; i++) frame(s, held);
}

function fireUntilLatched(s: Scene, fire: readonly Action[] = FIRE, hold: readonly Action[] = UP): number {
  frame(s, fire);
  for (let n = 2; n <= 20; n++) {
    if (fighter(s).grapple.state === GrappleState.latched) return n - 1;
    frame(s, hold);
  }
  return fighter(s).grapple.state === GrappleState.latched ? 20 : -1;
}


test("Only one latch is allowed per airtime and a landing restores it [k1 scenario]", () => {
  const s = beneath(NORDRASSIL, TOP_PLATFORM, 1);
  assertGreaterThan(fireUntilLatched(s), 0);
  run(s, 3, NEUTRAL);
  frame(s, [Action.jump]);
  const f = fighter(s);
  assertEquals(f.grapple.state, GrappleState.none);
  assertTrue(f.grapple.spent);
  run(s, 6, NEUTRAL);
  const x = f.motion.x;
  const z = f.motion.z;
  place(s, 1, x, z);
  assertEquals(fireUntilLatched(s), -1);
  assertEquals(f.grapple.state, GrappleState.none);
  place(s, 1, 0.0, 400.0);
  run(s, 200, NEUTRAL);
  assertTrue(f.motion.grounded);
  assertFalse(f.grapple.spent);
});

test("A rollback across a latch and a release replays to the same state [k1 scenario]", () => {
  const state = createReplaySnapshot();
  const tinker = fighterAt(state.world, 0);
  const start = createFighter(Character.tinker, 0.0, 1);
  const middle = (surfaceLeft(NORDRASSIL, TOP_PLATFORM, 0) + surfaceRight(NORDRASSIL, TOP_PLATFORM, 0)) / 2;
  start.motion.x = middle - 106;
  start.motion.z = surfaceZ(NORDRASSIL, TOP_PLATFORM, 0) - 161 + 90;
  start.motion.grounded = false;
  start.motion.surface = undefined;
  copyFighterState(tinker, start, 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.rifleman, 1500.0, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = NORDRASSIL;
  state.match.matchSeed = 611;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const scripted = (tick: number): readonly Action[] => tick === 1 ? FIRE : tick === 45 ? [Action.jump] : tick < 45 ? NEUTRAL : NEUTRAL;
  let previous = 0;
  const tickOnce = (tick: number): void => {
    const mask = maskOf(...scripted(tick));
    for (const slot of [0, 1]) {
      const held = slot === 0 ? mask : 0;
      const pressed = slot === 0 ? mask & ~previous : 0;
      const row = inputRow({ held, pressed, axisZ: slot === 0 && tick === 1 ? 127 : 0 });
      if (row === undefined) throw new Error("input row");
      const input = state.controls.inputs[slot];
      const commands = state.controls.commands[slot];
      if (input === undefined || commands === undefined) throw new Error("controls slot");
      adaptInput(row, fighterAt(state.world, slot), tick, input, commands);
    }
    previous = mask;
    stepMatch(state.match, state.world, state.controls, tick);
  };
  const snapshot = createReplaySnapshot();
  let saved = 0;
  let latchedTick = 0;
  let releasedTick = 0;
  for (let tick = 1; tick <= 80; tick++) {
    tickOnce(tick);
    if (latchedTick === 0 && tinker.grapple.state === GrappleState.latched) latchedTick = tick;
    if (latchedTick > 0 && releasedTick === 0 && tinker.grapple.state === GrappleState.none) releasedTick = tick;
    if (saved === 0 && latchedTick > 0 && tick === latchedTick + 5) {
      saved = tick;
      copyReplayState(snapshot, state);
      previous = 0;
    }
  }
  assertGreaterThan(latchedTick, 0);
  assertGreaterThan(releasedTick, saved);
  const expected = canonicalState(state);
  copyReplayState(state, snapshot);
  previous = 0;
  for (let tick = saved + 1; tick <= 80; tick++) tickOnce(tick);
  assertEquals(canonicalState(state), expected, "replayed state");
});
