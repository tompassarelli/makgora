import { createBufferedFrameControls } from "./controls";
import { createMatchState, Phase } from "../lobby/lobbyState";
import { stepMatch } from "./step";
import { AttackStyle, Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { Action, bit, maskOf } from "../input/actions";
import { adaptInput } from "./inputAdapter";
import { hasPendingAttack } from "../input/attackBuffer";
import { commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";


export const A = bit(Action.attack), S = bit(Action.strong), B = bit(Action.special), G = bit(Action.grab), W = maskOf(Action.modX, Action.modY), T = bit(Action.leftTrigger), J = bit(Action.jump);
export const R = bit(Action.moveRight), L = bit(Action.moveLeft), U = bit(Action.moveUp), D = bit(Action.moveDown);

export interface Keyboard {
  readonly owner: Fighter;
  readonly press: (this: void, held: number) => { readonly queued: boolean; readonly special: boolean; readonly direction: number };
}

export function keyboard(): Keyboard {
  const game = createMatchState();
  game.phase = Phase.match;
  const owner = createFighter(Character.rifleman, 0.0, 1);
  const world = createRoster(3, [owner, createFighter(Character.rifleman, 1500.0, -1)]);
  const frameControls = createBufferedFrameControls();
  const capture = keyboardCapture();
  let frame = 0;
  const press = (held: number) => {
    frame++;
    sampleKeys(capture, held);
    adaptInput(capture.row, owner, frame, frameControls.inputs[0], frameControls.commands[0]);
    commitEdges(capture);
    const result = { queued: hasPendingAttack(frameControls.commands[0], frame), special: frameControls.inputs[0].specialPressed, direction: frameControls.inputs[0].direction };
    stepMatch(game, world, frameControls, frame);
    return result;
  };
  for (let i = 0; i < 3; i++) press(0);
  return { owner, press };
}

export const smashFor = (key: number): AttackStyle => key === U ? AttackStyle.upSmash : key === D ? AttackStyle.downSmash : AttackStyle.forwardSmash;
