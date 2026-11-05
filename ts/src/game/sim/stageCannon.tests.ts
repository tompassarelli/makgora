import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { setWorldMotionValue } from "./motion";
import { CANNON_TEST_STAGE } from "./stage";
import { CANNON_Z, cannonX } from "./stageHazards";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { canonicalState } from "../replay/canonical";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { fighterAt } from "./roster";
import { mutableCannon } from "./fighterRest";

const STAGE = CANNON_TEST_STAGE;
const FAR = 2000.0;




function park(f: Fighter, x: number): void {
  f.motion.grounded = false;
  f.motion.x = x;
  f.motion.z = CANNON_Z;
  f.motion.vz = 0.0;
  setWorldMotionValue(f.motion.meleeZ, CANNON_Z);
}


test("Blackrock's cannon: the barrel's occupant is rollback and canonical state, and a replay across the catch matches [k1 scenario]", () => {
  const live = createReplaySnapshot();
  live.match.stageChoice = STAGE;
  live.match.phase = Phase.match;
  live.match.hazards = true;
  const a = fighterAt(live.world, 0);
  copyFighterState(a, createFighter(Character.rifleman, cannonX(2), 1), 3);
  copyFighterState(fighterAt(live.world, 1), createFighter(Character.rifleman, FAR, -1), 3);
  park(a, cannonX(2));
  let tick = 0;
  const advance = (state: ReplayState, to: number): void => {
    while (tick < to) {
      tick++;
      stepMatch(state.match, state.world, state.controls, tick);
    }
  };
  const saved = createReplaySnapshot();
  copyReplayState(saved, live);
  advance(live, 60);
  assertTrue(a.cannon.held !== undefined);
  const expected = canonicalState(live);
  const replay = createReplaySnapshot();
  copyReplayState(replay, saved);
  tick = 0;
  advance(replay, 60);
  assertEquals(canonicalState(replay), expected);
  mutableCannon(fighterAt(replay.world, 0)).held = undefined;
  assertTrue(canonicalState(replay) !== expected);
});
