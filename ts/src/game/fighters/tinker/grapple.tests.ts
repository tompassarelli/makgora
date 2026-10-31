import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
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
import { TINKER_MOVES } from "./moves";

const NORDRASSIL = 10;
const DUROTAR = 3;
const TOP_PLATFORM = 3;
const DRIFT_PLATFORM = 1;
const SIDE_PLATFORM = 2;
const MAIN_DECK_LEFT = -600.0;
const FIRE = [Action.grab, Action.moveUp] as const;
const UP = [Action.moveUp] as const;
const FIRE_FRAMES = 11;
const NEUTRAL: readonly Action[] = [];
const spec = (() => { const grapple = TINKER_MOVES.grapple; if (grapple === undefined) throw new Error("Tinker has no grapple"); return grapple; })();

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

function latchesUnderside(facing: number): void {
  const s = beneath(NORDRASSIL, TOP_PLATFORM, facing);
  assertEquals(fireUntilLatched(s), FIRE_FRAMES);
  const g = fighter(s).grapple;
  assertEquals(g.surface, TOP_PLATFORM);
  assertTrue(g.spent);
  assertGreaterThan(g.length, spec.minLength);
  assertLessThan(g.length, spec.maxLength);
}

function followsDrift(facing: number): void {
  const s = beneath(DUROTAR, DRIFT_PLATFORM, facing, 60, 70);
  assertGreaterThan(fireUntilLatched(s), 0);
  const f = fighter(s);
  const anchorX = (): number => surfaceLeft(DUROTAR, f.grapple.surface, stageClock(s.game)) + f.grapple.anchorX;
  const firstAnchor = anchorX();
  for (let i = 0; i < 25; i++) {
    frame(s, UP);
    const dx = f.motion.x - anchorX();
    const dz = f.motion.z + spec.handHeight - (surfaceZ(DUROTAR, f.grapple.surface, stageClock(s.game)) + f.grapple.anchorZ);
    assertLessThan(Math.sqrt(dx * dx + dz * dz), f.grapple.length + 1.0);
  }
  assertGreaterThan(Math.abs(anchorX() - firstAnchor), 20.0);
}

test("The claw latches a Nordrassil platform's underside facing right on its first active frame [k1 scenario]", () => latchesUnderside(1));
test("The claw latches a Nordrassil platform's underside facing left on its first active frame [k1 scenario]", () => latchesUnderside(-1));
test("The claw latches a drifting Durotar platform facing right and the anchor follows it [k1 scenario]", () => followsDrift(1));
test("The claw latches a drifting Durotar platform facing left and the anchor follows it [k1 scenario]", () => followsDrift(-1));

test("The claw latches the stage edge from below the deck [k1 scenario]", () => {
  const s = sceneFor(NORDRASSIL, 1);
  place(s, 1, MAIN_DECK_LEFT - 110, 60.0);
  assertGreaterThan(fireUntilLatched(s, [Action.grab], NEUTRAL), 0);
  assertEquals(fighter(s).grapple.surface, 0);
});

test("The claw fired in open air does not latch and spends no latch [k1 scenario]", () => {
  const s = sceneFor(NORDRASSIL, 1);
  place(s, 1, 0.0, 900.0);
  assertEquals(fireUntilLatched(s), -1);
  run(s, 40, NEUTRAL);
  const g = fighter(s).grapple;
  assertEquals(g.state, GrappleState.none);
  assertFalse(g.spent);
});

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

test("A hanging claw slips after the hang limit [k1 scenario]", () => {
  const s = beneath(NORDRASSIL, TOP_PLATFORM, 1);
  assertGreaterThan(fireUntilLatched(s), 0);
  const f = fighter(s);
  run(s, spec.hangFrames - 20, NEUTRAL);
  assertEquals(f.grapple.state, GrappleState.latched);
  run(s, 30, NEUTRAL);
  assertEquals(f.grapple.state, GrappleState.none);
  assertFalse(f.motion.grounded);
});

test("Jumping releases the swing and keeps its speed [k1 scenario]", () => {
  const s = beneath(NORDRASSIL, TOP_PLATFORM, 1);
  assertGreaterThan(fireUntilLatched(s), 0);
  const f = fighter(s);
  let fastest = 0.0;
  for (let i = 0; i < 40; i++) {
    frame(s, NEUTRAL);
    fastest = Math.max(fastest, Math.abs(f.motion.vx));
  }
  assertGreaterThan(fastest, 1.0);
  const before = Math.sqrt(f.motion.vx * f.motion.vx + f.motion.vz * f.motion.vz);
  frame(s, [Action.jump]);
  assertEquals(f.grapple.state, GrappleState.none);
  assertGreaterThan(Math.sqrt(f.motion.vx * f.motion.vx + f.motion.vz * f.motion.vz), before * f32(0.7));
  assertEquals(f.jump.remaining, createFighter(Character.tinker, 0.0, 1).jump.remaining);
});

test("Reeling all the way up pulls him onto the platform [k1 scenario]", () => {
  const s = beneath(NORDRASSIL, TOP_PLATFORM, 1);
  assertGreaterThan(fireUntilLatched(s), 0);
  const f = fighter(s);
  run(s, 90, UP);
  assertTrue(f.motion.grounded);
  assertEquals(f.motion.surface, TOP_PLATFORM);
  assertEquals(f.grapple.state, GrappleState.none);
});

test("Being hit cuts the chain [k1 scenario]", () => {
  const s = beneath(NORDRASSIL, TOP_PLATFORM, 1);
  assertGreaterThan(fireUntilLatched(s), 0);
  const f = fighter(s);
  f.launch.hitstun = 20;
  frame(s, NEUTRAL);
  assertEquals(f.grapple.state, GrappleState.none);
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
