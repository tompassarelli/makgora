import { at } from "wisp/src/runtime/lookup";
import { Action } from "../input/actions";
import { type KeyBindings, keyFor, keyLabel } from "../input/keyBindings";
import type { MenuControls } from "./frames";

const PROMPT_ACTIONS = [Action.moveLeft, Action.moveRight, Action.moveUp, Action.moveDown, Action.attack, Action.special];

const JOURNAL_PROMPT = "Stick: move pointer · A / Click: choose · Start or click Done: back";

export interface MenuPrompt {
  text: string;
  readonly keys: number[];
}

export const createMenuPrompt = (): MenuPrompt => ({ text: "", keys: [-2, -2, -2, -2, -2, -2] });

function keysChanged(prompt: MenuPrompt, bindings: Readonly<KeyBindings>): boolean {
  let changed = false;
  for (let index = 0; index < PROMPT_ACTIONS.length; index++) {
    const key = keyFor(bindings, at(PROMPT_ACTIONS, index), 0) ?? -1;
    if (prompt.keys[index] !== key) changed = true;
    prompt.keys[index] = key;
  }
  return changed;
}

export function updateMenuPrompt(prompt: MenuPrompt, controls: MenuControls, bindings: Readonly<KeyBindings>): void {
  if (controls === "journal") {
    prompt.text = JOURNAL_PROMPT;
    return;
  }
  if (!keysChanged(prompt, bindings)) return;
  const name = (index: number) => keyLabel(keyFor(bindings, at(PROMPT_ACTIONS, index), 0));
  prompt.text = `Move: ${name(0)}/${name(1)} + ${name(2)}/${name(3)}   Choose: ${name(4)}   Back: ${name(5)}`;
}
