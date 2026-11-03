import { ACTION_ORDER, Action } from "./actions";
import { type DirectionalInput, clearDirections, directionOf, neutralDirections, updateDirections } from "./directionalInput";
import type { Direction } from "./inputRow";
import { type KeyBindings, actionFor, keyFor } from "./keyBindings";
import { padLayerAction } from "./padKeys";

const KEY_CODES = 256;





export interface PlayerKeys {

  readonly down: boolean[];

  heldFirst: number;
  heldSecond: number;
  heldPad: number;

  readonly directions: DirectionalInput;
}

export function playerKeys(): PlayerKeys {
  return { down: Array.from({ length: KEY_CODES }, () => false), heldFirst: 0, heldSecond: 0, heldPad: 0, directions: neutralDirections() };
}

const isKeyCode = (key: number) => key >= 0 && key < KEY_CODES;

export function keyDown({ down }: Readonly<PlayerKeys>, key: number): boolean {
  return isKeyCode(key) && down[key] === true;
}

export function actionHeld({ heldFirst, heldSecond, heldPad }: Readonly<PlayerKeys>, action: Action): boolean {
  return ((heldFirst | heldSecond | heldPad) & (1 << action)) !== 0;
}


const SHIELD_TRIGGERS = (1 << Action.leftTrigger) | (1 << Action.rightTrigger) | (1 << Action.lightShield);
const C_STICK_ACTIONS = (1 << Action.cLeft) | (1 << Action.cRight) | (1 << Action.cUp) | (1 << Action.cDown);

export function withControlOptions(held: number, stickJump = false, cStickTilt = true): number {
  let out = held;
  if (stickJump) {
    const up = (out & (1 << Action.moveUp)) !== 0 && (out & (1 << Action.moveDown)) === 0;
    const tilted = (out & (1 << Action.modY)) !== 0 || ((out & (1 << Action.modX)) !== 0 && (out & SHIELD_TRIGGERS) !== 0);
    if (up && !tilted) out |= 1 << Action.jump;
  }
  if (!cStickTilt && (out & C_STICK_ACTIONS) !== 0) out |= 1 << Action.strong;
  return out;
}

export function heldActions(keys: Readonly<PlayerKeys>, stickJump = false, cStickTilt = true): number {
  let mask = 0;
  for (const action of ACTION_ORDER) {
    if (actionHeld(keys, action)) mask |= 1 << action;
  }
  return withControlOptions(mask, stickJump, cStickTilt);
}

export function directionX(keys: Readonly<PlayerKeys>): Direction {
  return directionOf(heldActions(keys), Action.moveRight, Action.moveLeft);
}

export function directionZ(keys: Readonly<PlayerKeys>): Direction {
  return directionOf(heldActions(keys), Action.moveUp, Action.moveDown);
}

function holdSlot(keys: PlayerKeys, key: number, bindings: Readonly<KeyBindings>, held: boolean): Action | undefined {
  const bound = actionFor(bindings, key);
  const action = bound ?? padLayerAction(key);
  if (action === undefined) return undefined;
  const slot = 1 << action;
  if (bound === undefined) keys.heldPad = held ? keys.heldPad | slot : keys.heldPad & ~slot;
  else if (keyFor(bindings, action, 0) === key) keys.heldFirst = held ? keys.heldFirst | slot : keys.heldFirst & ~slot;
  else keys.heldSecond = held ? keys.heldSecond | slot : keys.heldSecond & ~slot;
  updateDirections(keys.directions, directionX(keys), directionZ(keys));
  return action;
}


export function pressKey(keys: PlayerKeys, key: number, bindings: Readonly<KeyBindings>): Action | undefined {
  if (!isKeyCode(key) || keys.down[key] === true) return undefined;
  keys.down[key] = true;
  return holdSlot(keys, key, bindings, true);
}


export function releaseKey(keys: PlayerKeys, key: number, bindings: Readonly<KeyBindings>): Action | undefined {
  if (!isKeyCode(key) || keys.down[key] !== true) return undefined;
  keys.down[key] = false;
  return holdSlot(keys, key, bindings, false);
}

export function clearKeys(keys: PlayerKeys): void {
  keys.down.fill(false);
  keys.heldFirst = 0;
  keys.heldSecond = 0;
  keys.heldPad = 0;
  clearDirections(keys.directions);
}
