import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";

export type Press = "press" | "up" | "hold" | "shield" | "jump" | "none";

export interface Stick { readonly x: number; readonly z: number }

export interface Duel {
  readonly state: ReplayState;
  readonly akama: Fighter;
  readonly foe: Fighter;
  tick: number;
}

export function duel(foeAhead: number): Duel {
  const state = createReplaySnapshot();
  const akama = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(akama, createFighter(Character.akama, 0.0, 1), 3);
  copyFighterState(foe, createFighter(Character.peon, foeAhead, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, akama, foe, tick: 0 };
}

const PRESSES: Readonly<Record<Press, { readonly held: number; readonly pressed: number; readonly specialZ?: number }>> = {
  press: { held: maskOf(Action.special), pressed: maskOf(Action.special) },
  up: { held: maskOf(Action.special), pressed: maskOf(Action.special), specialZ: 1 },
  hold: { held: maskOf(Action.special), pressed: 0 },
  shield: { held: maskOf(Action.special) | maskOf(Action.rightTrigger), pressed: maskOf(Action.rightTrigger) },
  jump: { held: maskOf(Action.special) | maskOf(Action.jump), pressed: maskOf(Action.jump) },
  none: { held: 0, pressed: 0 },
};

export function step(d: Duel, press: Press, stick: Stick = { x: 0, z: 0 }): void {
  d.tick++;
  const fields = PRESSES[press];
  const row = inputRow({ ...fields, axisX: Math.round(stick.x * 127), axisZ: Math.round(stick.z * 127) });
  if (row === undefined) throw new Error("Akama input row");
  adaptInput(row, d.akama, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

export function idle(d: Duel, frames: number): void {
  for (let frame = 0; frame < frames; frame++) step(d, "none");
}

export function lift(fighter: Fighter, height: number, x = fighter.motion.x): void {
  fighter.motion.x = x;
  fighter.motion.z = height;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeX, fighter.motion.x);
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}
