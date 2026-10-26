import { assertEquals, assertFalse, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, SpecialAction } from "../codes";
import { createFighter, type Fighter } from "../fighter";
import { setWorldMotionValue } from "../motion";
import { fighterAt } from "../roster";
import { CLAP_REACH } from "./mountainKingSpecials";
import { SHORT } from "./mountainKingMoves";

const WATCH_FRAMES = 90;
const AIR_HEIGHT = 200.0;

function lift(fighter: Fighter, height: number): void {
  fighter.motion.z = height;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

function clapMatch(foeAhead: number, airborne: boolean): { state: ReplayState; muradin: Fighter; foe: Fighter } {
  const state = createReplaySnapshot();
  const muradin = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(muradin, createFighter(Character.mountainKing, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.mountainKing, foeAhead, -1), 3);
  if (airborne) {
    lift(muradin, AIR_HEIGHT);
    lift(foe, f32(AIR_HEIGHT - 20.0));
  }
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 510;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, muradin, foe };
}

function firstHit(foeAhead: number, airborne: boolean, held: (tick: number) => boolean, pressed: (tick: number) => boolean): number {
  const { state, muradin, foe } = clapMatch(foeAhead, airborne);
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    const down = tick === 1;
    const row = inputRow({ held: (down ? maskOf(Action.moveDown) : 0) | (held(tick) || pressed(tick) ? maskOf(Action.special) : 0),
      pressed: pressed(tick) ? maskOf(Action.special) : 0, axisZ: down ? -127 : 0, specialZ: down ? -1 : 0 });
    if (row === undefined) throw new Error("Thunder Clap input row");
    adaptInput(row, muradin, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (tick === 1) assertEquals(muradin.special.action, SpecialAction.heroDown, "Muradin starts Thunder Clap");
    if (airborne) assertFalse(muradin.motion.grounded);
    if (foe.status.damage > 0) return tick;
  }
  return 0;
}

const NEAR = f32(CLAP_REACH * f32(0.5));

test("Muradin's earliest small Thunder Clap hits on frame 10, the held clap on frame 50 and the air clap on frame 15 [k3 measure #510]", () => {
  assertEquals(firstHit(NEAR, false, () => false, tick => (tick & 1) === 1), 10, "earliest small clap");
  assertEquals(firstHit(NEAR, false, () => true, tick => tick === 1), 50, "held clap");
  assertEquals(firstHit(f32(SHORT * f32(0.5)), true, () => false, tick => tick === 1), 15, "air clap");
});
