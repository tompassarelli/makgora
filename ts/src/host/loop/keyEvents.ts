


import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { Phase, humanActive } from "../../game/lobby/lobbyState";
import { trampoline } from "wisp/src/platform/dispatch";
import { Action } from "../../game/input/actions";
import { type KeyBindings, menuAction } from "../../game/input/keyBindings";
import { type ShellState, activeRollback } from "./state";

import { pausedKeyUsed } from "./pauseCamera";
import { createEvents, Events, onEvents } from "wisp/game/events";
import { addKeyEvent, osKey } from "wisp/game/input";
import { player } from "wisp/game/players";

export const KEY_DOWN = "shell.keyDown";
export const KEY_UP = "shell.keyUp";
export const KEY_START_DOWN = "shell.keyStartDown";
export const KEY_START_UP = "shell.keyStartUp";
export const KEY_PAUSE_DOWN = "shell.keyPauseDown";
export const KEY_HINTS_DOWN = "shell.keyHintsDown";
export const KEYBOARD_PAUSE = "shell.keyboardPause";
export const KEYBOARD_PAUSE_PREFIX = "SC_KP";
export const MAIN_MENU = "shell.mainMenu";


export const Key = {
  backspace: 0x08, enter: 0x0d, escape: 0x1b, g: 0x47, h: 0x48, j: 0x4a, n: 0x4e, r: 0x52, t: 0x54, u: 0x55, w: 0x57, y: 0x59, f1: 0x70, f2: 0x71, f8: 0x77, f9: 0x78, f10: 0x79,
} as const;

export interface KeyEventPolicy {
  enabled: boolean;
  escapeOnly: boolean;
  paused: boolean;
}

export interface KeyTriggerPair<T> {
  down: T | undefined;
  up: T | undefined;
}

export function ensureKeyTriggerPair<T>(pair: KeyTriggerPair<T>, create: () => T, register: (down: T, up: T) => void, attach: (down: T, up: T) => void): void {
  if (pair.down !== undefined && pair.up !== undefined) return;
  if (pair.down !== undefined || pair.up !== undefined) throw new Error("key trigger pair is incomplete");
  const down = create();
  const up = create();
  register(down, up);
  attach(down, up);
  pair.down = down;
  pair.up = up;
}

export function syncKeyEventPolicy(policy: KeyEventPolicy, rollbackMatch: boolean, paused: boolean, title: boolean): void {
  policy.enabled = !rollbackMatch || paused;
  policy.escapeOnly = paused || title;
  policy.paused = paused;
}

export function keyEventAllowed(policy: Readonly<KeyEventPolicy>, key: number, bindings: Readonly<KeyBindings>): boolean {
  if (!policy.enabled) return false;
  if (!policy.escapeOnly) return true;
  const menu = menuAction(bindings, key);
  return (policy.paused && pausedKeyUsed(bindings, key)) || key === Key.escape || key === Key.f2 || (menu !== undefined && menu !== Action.moveLeft && menu !== Action.moveRight);
}


const META_NONE = 0;
const META_SHIFT = 1;
const KEY_META_MASKS: readonly number[] = [META_NONE, META_SHIFT];

export function registerKey(s: Readonly<ShellState>, trigger: Events, key: number, down: boolean): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!humanActive(s.game, slot)) continue;
    for (const meta of KEY_META_MASKS) addKeyEvent(trigger, player(slot), osKey(key), meta, down);
  }
}

function registerKeys(s: ShellState): void {
  const { keyEvents } = s;
  ensureKeyTriggerPair(keyEvents, () => createEvents(), (down, up) => {
    for (let key = 1; key <= 255; key++) {
      if (key === Key.enter || key === Key.backspace) continue;
      registerKey(s, down, key, true);
      registerKey(s, up, key, false);
    }
  }, (down, up) => {
    onEvents(down, trampoline(KEY_DOWN));
    onEvents(up, trampoline(KEY_UP));
  });
}






export function syncKeyEvents(s: ShellState): void {
  const rollbackMatch = activeRollback(s) !== undefined && s.game.phase === Phase.match;
  registerKeys(s);
  syncKeyEventPolicy(s.keyEvents, rollbackMatch, s.session.paused, s.pauseMenu?.title === true);
}
