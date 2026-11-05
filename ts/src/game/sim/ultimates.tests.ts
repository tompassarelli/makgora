import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../match/inputAdapter";
import { inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { canonicalState } from "../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { Character, SpecialAction } from "./codes";
import { createFighter, type Fighter } from "./fighter";
import { fillMeter } from "./meter";
import { fighterAt } from "./roster";

const FOE_FAR = 500.0;
const ULTIMATE = maskOf(Action.attack, Action.special);

interface Duel {
  readonly state: ReplayState;
  readonly blademaster: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function duel(foeX: number): Duel {
  const state = createReplaySnapshot();
  const blademaster = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(blademaster, createFighter(Character.blademaster, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.warden, foeX, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 503;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  fillMeter(blademaster);
  return { state, blademaster, foe, tick: 0 };
}

function step(d: Duel, held: number, pressed: number, axisX = 0): void {
  d.tick++;
  const row = inputRow({ held: held | pressed, pressed, axisX });
  if (row === undefined) throw new Error("Bladestorm input row");
  adaptInput(row, d.blademaster, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

function spinning(f: Readonly<Fighter>): boolean {
  return f.special.action === SpecialAction.heroUltimate;
}

const MOVE_DOWN = maskOf(Action.moveDown);
const MOVE_RIGHT = maskOf(Action.moveRight);
const JUMP = maskOf(Action.jump);

function castInAir(d: Duel): void {
  const f = d.blademaster;
  step(d, JUMP, JUMP);
  while (f.motion.grounded || f.motion.vz > 0.0) step(d, JUMP, 0);
  step(d, 0, ULTIMATE);
  assertTrue(spinning(f));
}

function axisOf(held: number): number {
  return held === MOVE_RIGHT ? 127 : 0;
}

function floatRun(d: Duel, cast: number, to: number): void {
  while (d.tick < to) {
    const age = d.tick + 1 - cast;
    const held = age < 14 ? 0 : age < 28 ? MOVE_DOWN : age < 42 ? JUMP : age < 56 ? MOVE_RIGHT : 0;
    step(d, held, 0, axisOf(held));
  }
}

test("A rollback from mid-float replays the same spin [k1 scenario]", () => {
  const d = duel(FOE_FAR);
  castInAir(d);
  const cast = d.tick;
  const saveTick = cast + 30;
  floatRun(d, cast, saveTick);
  const snapshot = createReplaySnapshot();
  copyReplayState(snapshot, d.state);
  floatRun(d, cast, saveTick + 70);
  const expected = canonicalState(d.state);
  const finalZ = d.blademaster.motion.z;
  copyReplayState(d.state, snapshot);
  d.tick = saveTick;
  floatRun(d, cast, saveTick + 70);
  assertEquals(canonicalState(d.state), expected);
  assertEquals(d.blademaster.motion.z, finalZ);
});
