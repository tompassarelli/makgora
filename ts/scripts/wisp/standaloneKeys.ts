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
