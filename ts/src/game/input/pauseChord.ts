import { Action, bit } from "./actions";
import { type KeyBindings, actionFor, inputAction, keyFor, keyNames } from "./keyBindings";
import { padLayerKey } from "./padKeys";

const SHIELDS: readonly Action[] = [Action.leftTrigger, Action.rightTrigger, Action.lightShield];
const CHORD_ACTIONS: readonly Action[] = [...SHIELDS, Action.attack];
const PAUSE_ACTIONS: readonly Action[] = [Action.moveLeft, Action.moveRight, Action.moveUp, Action.moveDown, Action.cUp, Action.cDown, ...CHORD_ACTIONS];
const ARROWS: readonly number[] = [0x25, 0x26, 0x27, 0x28];
const KEY_CODES = 256;

export type ChordKeys = boolean[];

export const chordKeys = (): ChordKeys => Array.from({ length: KEY_CODES }, () => false);

export function chordAction(bindings: Readonly<KeyBindings>, key: number): Action | undefined {
  const action = inputAction(bindings, key);
  return action !== undefined && CHORD_ACTIONS.includes(action) ? action : undefined;
}

export function noteChordKey(held: ChordKeys, bindings: Readonly<KeyBindings>, key: number, down: boolean): void {
  if (key >= 0 && key < KEY_CODES && chordAction(bindings, key) !== undefined) held[key] = down;
}

// L and R are any two of the shield actions, so a pad set to light shields on both triggers still counts only when two distinct shield keys are down.
export function chordComplete(held: Readonly<ChordKeys>, bindings: Readonly<KeyBindings>): boolean {
  let mask = 0;
  for (let key = 0; key < KEY_CODES; key++) {
    const action = held[key] === true ? chordAction(bindings, key) : undefined;
    if (action !== undefined) mask |= bit(action);
  }
  return (mask & bit(Action.attack)) !== 0 && SHIELDS.filter(action => (mask & bit(action)) !== 0).length >= 2;
}

// Keys the pause screen reads; a key still held when the match pauses must stay masked from the fighter's controls after resume.
export function pausedInputKeys(bindings: Readonly<KeyBindings>): number[] {
  const keys = [...ARROWS, 0x49, 0x4a, 0x4b, 0x4c, 0x4f, 0x50, 0x47, 0x6b, 0x6d];
  for (const action of PAUSE_ACTIONS) {
    for (const slot of [0, 1] as const) {
      const key = keyFor(bindings, action, slot);
      if (key !== undefined) keys.push(key);
    }
    const pad = padLayerKey(action).code;
    if (actionFor(bindings, pad) === undefined) keys.push(pad);
  }
  return keys;
}

export interface ChordLabels {
  readonly left: string;
  readonly right: string;
  readonly attack: string;
}

export function chordLabels(bindings: Readonly<KeyBindings>): ChordLabels {
  const lightBound = keyFor(bindings, Action.lightShield, 0) !== undefined || keyFor(bindings, Action.lightShield, 1) !== undefined;
  return {
    left: keyNames(bindings, Action.leftTrigger),
    right: keyNames(bindings, lightBound ? Action.lightShield : Action.rightTrigger),
    attack: keyNames(bindings, Action.attack),
  };
}
