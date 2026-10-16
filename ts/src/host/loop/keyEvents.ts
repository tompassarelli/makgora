


import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { Phase, humanActive } from "../../game/lobby/lobbyState";
import { trampoline } from "wisp/src/platform/dispatch";
import { type ShellState, activeRollback } from "./state";

import { pauseCameraKey } from "./pauseCamera";

export const KEY_DOWN = "shell.keyDown";
export const KEY_UP = "shell.keyUp";
export const KEY_START_DOWN = "shell.keyStartDown";
export const KEY_START_UP = "shell.keyStartUp";
export const KEY_PAUSE_DOWN = "shell.keyPauseDown";
export const KEYBOARD_PAUSE = "shell.keyboardPause";
export const KEYBOARD_PAUSE_PREFIX = "SC_KP";


export const Key = {
  backspace: 0x08, enter: 0x0d, escape: 0x1b, g: 0x47, h: 0x48, j: 0x4a, k: 0x4b, n: 0x4e, r: 0x52, t: 0x54, u: 0x55, w: 0x57, y: 0x59, f1: 0x70, f2: 0x71,
} as const;

export interface KeyEventPolicy {
  enabled: boolean;
  escapeOnly: boolean;
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
}

export function keyEventAllowed(policy: Readonly<KeyEventPolicy>, key: number): boolean {
  if (!policy.enabled) return false;
  if (!policy.escapeOnly) return true;
  return pauseCameraKey(key) || key === Key.escape || key === Key.f2 || key === 0x26 || key === 0x28 || key === 32 || key === 69 || key === Key.n || key === Key.u;
}


export function registerKey(s: Readonly<ShellState>, trigger: trigger, key: number, down: boolean, meta: number = 0): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanActive(s.game, slot)) BlzTriggerRegisterPlayerKeyEvent(trigger, Player(slot), ConvertOsKeyType(key), meta, down);
  }
}

function registerKeys(s: ShellState): void {
  const { keyEvents } = s;
  ensureKeyTriggerPair(keyEvents, () => CreateTrigger(), (down, up) => {
    for (let key = 1; key <= 255; key++) {
      if (key === Key.y || key === Key.enter || key === Key.backspace) continue;
      registerKey(s, down, key, true);
      registerKey(s, up, key, false);
      if (key === 0xbb) {
        registerKey(s, down, key, true, 1);
        registerKey(s, up, key, false, 1);
      }
    }
  }, (down, up) => {
    TriggerAddAction(down, trampoline(KEY_DOWN));
    TriggerAddAction(up, trampoline(KEY_UP));
  });
}






export function syncKeyEvents(s: ShellState): void {
  const rollbackMatch = activeRollback(s) !== undefined && s.game.phase === Phase.match;
  registerKeys(s);
  syncKeyEventPolicy(s.keyEvents, rollbackMatch, s.session.paused, s.pauseMenu?.title === true);
}
