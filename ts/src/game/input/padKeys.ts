import { Action } from "./actions";

export interface PadKey {
  readonly action: Action;
  readonly key: string;
  readonly code: number;
}

// The controller presses these keys; none is in the WASD, Hitbox or Custom preset, and a player's own binding of one wins.
export const PAD_LAYER: readonly PadKey[] = [
  { action: Action.attack, key: "c", code: 0x43 },
  { action: Action.special, key: "v", code: 0x56 },
  { action: Action.jump, key: "t", code: 0x54 },
  { action: Action.shortHop, key: "1", code: 0x31 },
  { action: Action.grab, key: "2", code: 0x32 },
  { action: Action.leftTrigger, key: "3", code: 0x33 },
  { action: Action.rightTrigger, key: "4", code: 0x34 },
  { action: Action.lightShield, key: "5", code: 0x35 },
  { action: Action.walk, key: "6", code: 0x36 },
  { action: Action.strong, key: "`", code: 0xc0 },
  { action: Action.moveLeft, key: "[", code: 0xdb },
  { action: Action.moveRight, key: "]", code: 0xdd },
  { action: Action.moveUp, key: ";", code: 0xba },
  { action: Action.moveDown, key: "'", code: 0xde },
  { action: Action.smashLeft, key: ",", code: 0xbc },
  { action: Action.smashRight, key: ".", code: 0xbe },
  { action: Action.smashUp, key: "-", code: 0xbd },
  { action: Action.smashDown, key: "\\", code: 0xdc },
];

export function padLayerAction(code: number): Action | undefined {
  for (const entry of PAD_LAYER) {
    if (entry.code === code) return entry.action;
  }
  return undefined;
}

export function padLayerKey(action: Action): PadKey {
  for (const entry of PAD_LAYER) {
    if (entry.action === action) return entry;
  }
  throw new Error(`action ${action} has no pad key`);
}
