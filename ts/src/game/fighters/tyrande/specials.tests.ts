import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { fighterAt } from "../../sim/roster";

type Press = "arrow" | "aura" | "grace" | "none";
type Script = (tick: number) => readonly [Press, Press];

interface Duel {
  readonly state: ReplayState;
  readonly tyrande: Fighter;
  readonly foe: Fighter;
  tick: number;
}

const ROWS: Readonly<Record<Press, Parameters<typeof inputRow>[0]>> = {
  arrow: { held: maskOf(Action.special), pressed: maskOf(Action.special) },
  aura: { held: maskOf(Action.moveRight, Action.special), pressed: maskOf(Action.special), axisX: 127, specialX: 1 },
  grace: { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 },
  none: {},
};

function duel(foe: Character, foeAhead: number): Duel {
  const state = createReplaySnapshot();
  const tyrande = fighterAt(state.world, 0);
  const other = fighterAt(state.world, 1);
  copyFighterState(tyrande, createFighter(Character.tyrande, 0.0, 1), 3);
  copyFighterState(other, createFighter(foe, foeAhead, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, tyrande, foe: other, tick: 0 };
}

function step(d: Duel, [own, other]: readonly [Press, Press]): void {
  d.tick++;
  const first = inputRow(ROWS[own]);
  const second = inputRow(ROWS[other]);
  if (first === undefined || second === undefined) throw new Error("Tyrande input row");
  adaptInput(first, d.tyrande, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  adaptInput(second, d.foe, d.tick, d.state.controls.inputs[1], d.state.controls.commands[1]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}


const VOLLEY_END = 260;
const VOLLEY_SHOTS = [40, 80, 120, 160, 200] as const;
const volleyScript: Script = (tick) => [tick === 3 ? "aura" : (VOLLEY_SHOTS as readonly number[]).includes(tick) ? "arrow" : "none", "none"];

function replayFrom(foe: Character, foeAhead: number, script: Script, end: number, saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(foe, foeAhead);
  const snapshot = createReplaySnapshot();
  for (let tick = 1; tick <= end; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    step(run, script(tick));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  for (let tick = saveTick; tick <= end; tick++) step(run, script(tick));
  return { expected, replayed: canonicalState(run.state) };
}


test("A rollback replays Trueshot Aura through three moonlit arrows and their lapse to the live checksum [k1 scenario]", () => {
  for (const save of [2, 10, 45, 85, 125, 170, 230]) {
    const replay = replayFrom(Character.medivh, 160.0, volleyScript, VOLLEY_END, save);
    assertEquals(replay.replayed, replay.expected);
  }
});
