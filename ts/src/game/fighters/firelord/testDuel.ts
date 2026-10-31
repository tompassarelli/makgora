import { f32 } from "wisp/src/sim/f32";
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

export type Press = "down" | "hold" | "none";

export interface Stick { readonly x: number; readonly z: number }

export interface Duel {
  readonly state: ReplayState;
  readonly caster: Fighter;
  readonly foe: Fighter;
  tick: number;
}

export function duel(foeAhead: number, facing = 1, casterX = 0.0): Duel {
  const state = createReplaySnapshot();
  const caster = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(caster, createFighter(Character.firelord, casterX, facing), 3);
  copyFighterState(foe, createFighter(Character.peon, f32(casterX + f32(foeAhead * facing)), -facing), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, caster, foe, tick: 0 };
}

const PRESSES: Readonly<Record<Press, { readonly held: number; readonly pressed: number }>> = {
  hold: { held: maskOf(Action.special), pressed: 0 },
  down: { held: maskOf(Action.special), pressed: maskOf(Action.special) },
  none: { held: 0, pressed: 0 },
};

const BEYOND = 0.5;
const beyond = (value: number): number => (value > BEYOND ? 1 : value < -BEYOND ? -1 : 0);

export function step(d: Duel, press: Press, stick: Stick = { x: 0, z: 0 }, special?: Stick): void {
  d.tick++;
  const fields = PRESSES[press];
  const pressed = press === "down";
  const row = inputRow({ ...fields, axisX: Math.round(stick.x * 127), axisZ: Math.round(stick.z * 127), specialX: pressed ? beyond(special?.x ?? stick.x) : 0, specialZ: pressed ? beyond(special?.z ?? stick.z) : 0 });
  if (row === undefined) throw new Error("Firelord input row");
  adaptInput(row, d.caster, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
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

export function placeFoe(d: Duel, x: number): void {
  d.foe.motion.x = x;
  setWorldMotionValue(d.foe.motion.meleeX, x);
}
