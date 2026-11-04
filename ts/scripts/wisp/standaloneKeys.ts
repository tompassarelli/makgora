import type { StandaloneInput } from "wisp/scripts/wisp/standalone";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../../src/game/input/keyBindings";
import { ACTIONS } from "./selectionScript";

const BINDINGS = presetBindings(DEFAULT_PRESET);
const ESCAPE_KEY = 0x1b;

export function heldKeys(input: StandaloneInput): Set<number> {
  const buttons = new Set(input.buttons);
  if (input.axisX < -0.28) buttons.add("left");
  if (input.axisX > 0.28) buttons.add("right");
  if (input.axisY < -0.28) buttons.add("down");
  if (input.axisY > 0.28) buttons.add("up");
  const held = new Set<number>();
  for (const button of buttons) {
    const action = ACTIONS[button];
    const key = button === "start" ? 89 : button === "view" ? 75 : button === "back" ? ESCAPE_KEY : action === undefined ? undefined : keyFor(BINDINGS, action, 0);
    if (key !== undefined) held.add(key);
  }
  return held;
}

const ARROW_KEYS: Readonly<Record<string, number>> = { up: 0x26, down: 0x28 };

export function scriptedKeys(buttons: readonly string[]): Set<number> {
  const held = heldKeys({ buttons: buttons.filter(button => ARROW_KEYS[button] === undefined), axisX: 0, axisY: 0 });
  for (const button of buttons) {
    const arrow = ARROW_KEYS[button];
    if (arrow !== undefined) held.add(arrow);
  }
  return held;
}
