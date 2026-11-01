

import { ATTACK_BUFFER_FRAMES, type AttackBuffer, attackBuffer, queueAttack } from "../input/attackBuffer";
import { type FrameControls, createBufferedFrameControls, createFrameControls } from "../match/controls";
import { type MatchState, Phase, createMatchState } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { Character, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { type Controls, type Roster, copyControls, createRoster } from "./roster";
import { controls } from "./testWorld";

export interface Duel {
  readonly illidan: Fighter;
  readonly target: Fighter;
  readonly commands: readonly [AttackBuffer, AttackBuffer];

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
    illidan, target, commands,
    step: (first = controls(), second = controls()) => {
      frame++;
      stepMatch(game, world, frameControls(first, second), frame);
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

/** Steps `owner`'s running special to its end; `jump` is the largest frame gain in one step, so more than one means frames were skipped. */
export function specialToEnd(world: Roster, owner: Fighter, second: Readonly<Controls> = controls()): { last: number; jump: number } {
  let last = owner.special.frame;
  let jump = 0;
  for (let steps = 0; steps < 120; steps++) {
    stepDuel(world, controls(), second);
    if (owner.special.action === SpecialAction.none) break;
    jump = Math.max(jump, owner.special.frame - last);
    last = owner.special.frame;
  }
  return { last, jump };
}

/** Queues the attack command the input layer would send for `style` on the next stepDuel frame. */
export function queueDuelAttack(world: Roster, style: number, facing: -1 | 0 | 1, slot = 0): void {
  const match = duelMatches.get(world);
  if (match === undefined) throw new Error("queueDuelAttack needs a world that has been stepped with stepDuel");
  const buffer = match.controls.commands[slot];
  if (buffer === undefined) throw new Error("no attack buffer for slot");
  queueAttack(buffer, { style, facing, frame: match.frame + 1, mayCharge: false, cStick: false });
}
