


import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { Phase, humanActive } from "../../game/lobby/lobbyState";
import { trampoline } from "wisp/src/platform/dispatch";
import { type ShellState, activeRollback } from "./state";

import { pauseCameraKey } from "./pauseCamera";

export const KEY_DOWN = "shell.keyDown";
export const KEY_UP = "shell.keyUp";


export const Key = {
  enter: 0x0d, escape: 0x1b, g: 0x47, h: 0x48, j: 0x4a, k: 0x4b, n: 0x4e, r: 0x52, t: 0x54, u: 0x55, w: 0x57, y: 0x59, f1: 0x70, f2: 0x71,
} as const;


export function registerKey(s: Readonly<ShellState>, trigger: trigger, key: number, down: boolean, meta: number = 0): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanActive(s.game, slot)) BlzTriggerRegisterPlayerKeyEvent(trigger, Player(slot), ConvertOsKeyType(key), meta, down);
  }
}

export function syncKeyEventTriggers<T>(events: { down: T | undefined; up: T | undefined; enabled: boolean; escapeOnly: boolean }, enabled: boolean, escapeOnly: boolean, create: () => T, register: (down: T, up: T) => void, setEnabled: (trigger: T, enabled: boolean) => void): void {
  if (events.down === undefined || events.up === undefined) {
    const down = create();
    const up = create();
    register(down, up);
    events.down = down;
    events.up = up;
    events.enabled = true;
  }
  events.escapeOnly = escapeOnly;
  if (events.enabled === enabled) return;
  const down = events.down;
  const up = events.up;
  if (down === undefined || up === undefined) return;
  setEnabled(down, enabled);
  setEnabled(up, enabled);
  events.enabled = enabled;
}

function registerKeys(s: ShellState, enabled: boolean, escapeOnly: boolean): void {
  const { keyEvents } = s;
  syncKeyEventTriggers(keyEvents, enabled, escapeOnly, () => CreateTrigger(), (down, up) => {
    for (let key = 1; key <= 255; key++) {
      if (key === Key.y || key === Key.enter) continue;
      registerKey(s, down, key, true);
      registerKey(s, up, key, false);
      if (key === 0xbb) {
        registerKey(s, down, key, true, 1);
        registerKey(s, up, key, false, 1);
      }
    }
    TriggerAddAction(down, trampoline(KEY_DOWN));
    TriggerAddAction(up, trampoline(KEY_UP));
  }, (trigger, enabled) => { if (enabled) EnableTrigger(trigger); else DisableTrigger(trigger); });
}

export function disableKeyEvents(s: ShellState): void {
  const { keyEvents } = s;
  if (keyEvents.down !== undefined) DisableTrigger(keyEvents.down);
  if (keyEvents.up !== undefined) DisableTrigger(keyEvents.up);
  keyEvents.enabled = false;
}






export function syncKeyEvents(s: ShellState): void {
  const rollbackMatch = activeRollback(s) !== undefined && s.game.phase === Phase.match;
  const enabled = !rollbackMatch || s.session.paused;
  const escapeOnly = s.session.paused || s.pauseMenu?.title === true;
  registerKeys(s, enabled, escapeOnly);
}

export function acceptsKeyEvent(key: number, escapeOnly: boolean): boolean {
  return !escapeOnly || pauseCameraKey(key) || key === Key.escape || key === Key.f2 || key === 0x26 || key === 0x28 || key === 32 || key === 69 || key === Key.n || key === Key.u;
}
