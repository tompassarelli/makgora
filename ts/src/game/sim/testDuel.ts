

import { ATTACK_BUFFER_FRAMES, type AttackBuffer, attackBuffer } from "../input/attackBuffer";
import { type FrameControls, createBufferedFrameControls, createFrameControls } from "../match/controls";
import { type MatchState, Phase, createMatchState } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { takenManaGain } from "./mana";
import { type Controls, type Roster, copyControls, createRoster } from "./roster";
import { controls } from "./testWorld";

export interface Duel {
  readonly illidan: Fighter;
  readonly target: Fighter;
  readonly commands: readonly [AttackBuffer, AttackBuffer];




  drained: number;

  readonly step: (this: void, first?: Readonly<Controls>, second?: Readonly<Controls>) => number;
  readonly run: (this: void, frames: number, first?: Readonly<Controls>, second?: Readonly<Controls>) => void;
}


export function duel(gap: number, character: Character = Character.rifleman): Duel {
  const game = createMatchState();
  game.phase = Phase.match;
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  const target = createFighter(character, gap, -1);
  const world = createRoster(3, [illidan, target]);
  const commands: [AttackBuffer, AttackBuffer] = [attackBuffer(ATTACK_BUFFER_FRAMES), attackBuffer(ATTACK_BUFFER_FRAMES)];
  let frame = 0;
  const frameControls = (first: Readonly<Controls>, second: Readonly<Controls>): FrameControls => {
    const out = createFrameControls();
    copyControls(out.inputs[0], first);
    copyControls(out.inputs[1], second);
    out.commands[0] = commands[0];
    out.commands[1] = commands[1];
    return out;
  };
  const d: Duel = {
    illidan, target, commands, drained: 0,
    step: (first = controls(), second = controls()) => {
      frame++;
      const mana = target.mana.points;
      const damage = target.status.damage;
      stepMatch(game, world, frameControls(first, second), frame);
      if (target.status.damage > damage) d.drained += mana - target.mana.points + takenManaGain(target.status.damage - damage);
      return frame;
    },
    run: (frames, first, second) => { for (let i = 0; i < frames; i++) d.step(first, second); },
  };
  d.run(3);
  return d;
}


export function lift(f: Fighter, z: number): void {
  f.motion.grounded = false;
  f.motion.surface = undefined;
  f.motion.z = z;
  f.motion.vz = 0.0;
  f.motion.vx = 0.0;
}


interface DuelMatch {
  readonly game: MatchState;
  readonly controls: FrameControls;
  frame: number;
}

const duelMatches = new WeakMap<Roster, DuelMatch>();

/** Steps a two-fighter roster through the real match step, so tests follow the game's own step order. */
export function stepDuel(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls(), stage = 0): void {
  let match = duelMatches.get(world);
  if (match === undefined) {
    const game = createMatchState();
    game.phase = Phase.match;
    game.stageChoice = stage;
    match = { game, controls: createBufferedFrameControls(), frame: 0 };
    duelMatches.set(world, match);
  }
  match.frame++;
  copyControls(match.controls.inputs[0], first);
  copyControls(match.controls.inputs[1], second);
  stepMatch(match.game, world, match.controls, match.frame);
}

/** Two fighters in one roster, settled for `settle` frames of stepDuel. */
export function duelPair<Owner extends Fighter, Target extends Fighter>(owner: Owner, target: Target, settle = 3, stage = 0): { world: Roster; owner: Owner; target: Target } {
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < settle; i++) stepDuel(world, controls(), controls(), stage);
  return { world, owner, target };
}
