import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Phase } from "../../lobby/lobbyState";
import { copyControls, createRoster, fighterAt, neutralControls } from "../../sim/roster";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { SURF } from "./specials";

const LEADER = 0;
const PARTNER = 2;
const FLAT_STAGE = 0;
const SURF_WATCH = 90;
const DISMOUNT_FRAME = SURF.linkedLast + 1;
const HIT_TICK = 20;
const NEUTRAL = neutralControls();

function duel(partnerOffset: number, foeX = -900.0): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, foeX, 1)]);
  const match = state.match;
  match.phase = Phase.match;
  match.stageChoice = FLAT_STAGE;
  match.startHold = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.ultimatesOff = true;
  initializeMatchFighters(match, world);
  const partner = fighterAt(world, PARTNER);
  partner.motion.x = f32(fighterAt(world, LEADER).motion.x - partnerOffset);
  return { ...state, world };
}


function step(state: ReplayState, tick: number, stick: number): void {
  const input = state.controls.inputs[LEADER];
  copyControls(input, NEUTRAL);
  input.direction = stick;
  if (tick === 1) {
    input.specialPressed = true;
    input.specialZ = 1;
    input.verticalDirection = 1;
  }
  stepMatch(state.match, state.world, state.controls, tick);
}

test("A linked ride restored from a mid-ride state replays to the same match, through the dismount [k1 scenario]", () => {
  for (const save of [HIT_TICK, DISMOUNT_FRAME + 1]) {
    const live = duel(60.0);
    for (let tick = 1; tick < save; tick++) step(live, tick, 1);
    const replay = createReplaySnapshot();
    copyReplayState(replay, live);
    for (let tick = save; tick <= SURF_WATCH; tick++) {
      step(live, tick, 1);
      step(replay, tick, 1);
      assertEquals(canonicalState(replay), canonicalState(live), `saved at ${save}, tick ${tick}`);
    }
  }
});
