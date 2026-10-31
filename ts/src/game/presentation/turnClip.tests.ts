import { assertEquals, test } from "wisp/src/runtime/testing";
import { adaptInput } from "../match/inputAdapter";
import { inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { createReplaySnapshot } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { fighterAt } from "../sim/roster";
import { advanceFighterPose, createFighterPose } from "./fighterPose";
import { characterClips } from "./fighterClips";
import { IllidanLocomotion } from "./illidanMotion";

const TURN = `motion${IllidanLocomotion.turn}`;
const STICK: readonly (readonly [number, number])[] = [[20, -50], [50, 0], [90, 127], [96, -127], [110, 0], [160, 127], [210, -127], [250, 0]];
const LAST = 280;

interface Turn { readonly tick: number; readonly flipped: boolean; readonly started: boolean }

function turns(character: Character): readonly Turn[] {
  const state = createReplaySnapshot();
  const fighter = fighterAt(state.world, 0);
  copyFighterState(fighter, createFighter(character, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.peon, 1400.0, -1), 3);
  state.match.phase = Phase.match;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const pose = createFighterPose();
  const seen: Turn[] = [];
  let axisX = 0;
  for (let tick = 1; tick <= LAST; tick++) {
    for (const [at, axis] of STICK) if (at === tick) axisX = axis;
    const row = inputRow({ held: 0, pressed: 0, axisX, axisZ: 0 });
    if (row === undefined) throw new Error("turn input row");
    adaptInput(row, fighter, tick, state.controls.inputs[0], state.controls.commands[0]);
    const facing = fighter.facing, serial = pose.selectionSerial;
    stepMatch(state.match, state.world, state.controls, tick);
    advanceFighterPose(pose, fighter, state.world, state.controls.inputs[0], false, false, false, false);
    const started = pose.animation === TURN && pose.selectionSerial !== serial;
    const flipped = fighter.facing !== facing && fighter.motion.grounded;
    if (started || flipped) seen.push({ tick, flipped, started });
  }
  return seen;
}

test("Every fighter's turn clip starts on the frame its facing flips on the ground and on no other: a standing turn, a dash-back that flips him again mid-turn and a run turnaround each start the turn as the body flips, and the run turnaround's skid before the flip never plays it, so the body never spins back toward the old facing [k1 scenario]", () => {
  for (const character of Object.values(Character)) {
    if (character !== Character.demonHunter && characterClips(character).turn === undefined) continue;
    const seen = turns(character);
    assertEquals(seen.filter((turn) => turn.flipped).length >= 4, true, `fighter ${character}: the stick script flips the facing at least four times on the ground`);
    for (const turn of seen) assertEquals(turn.started, turn.flipped, `fighter ${character} tick ${turn.tick}: ${turn.flipped ? "a facing flip without a turn clip start" : "a turn clip start without a facing flip"}`);
  }
});
