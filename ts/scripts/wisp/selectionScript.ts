import { pointerStep, scriptedPointer } from "wisp/src/headless/pointerScript";
import { Action } from "../../src/game/input/actions";

export const ACTIONS: Readonly<Record<string, Action>> = {
  attack: Action.attack, special: Action.special, jump: Action.jump,
  grab: Action.grab, shield: Action.leftTrigger, walk: Action.modX,
  left: Action.moveLeft, right: Action.moveRight, up: Action.moveUp, down: Action.moveDown,
  cLeft: Action.cLeft, cRight: Action.cRight,
  cUp: Action.cUp, cDown: Action.cDown,
};

/** A script whose first line is this stays on character select instead of starting a match, so a scene check can draw the selection screen. Its other lines are `STEP BUTTON`, which holds that button (attack, special, jump, left and so on) for 3 steps from STEP, and the pad format's mouse steps `STEP pointer X Y` (move the cursor) and `STEP click X Y [FRAMES]` (press the left button at STEP and release it FRAMES later, 1 by default) at X, Y of Warcraft's 0.8 by 0.6 screen, played through the same pointer feed as the window's mouse; `start` and `back` (Esc) work as buttons too, and a `cpu` word on the first line (`#! select cpu`) fills slot 2 with a one-stock Wren Expert so a match ends by itself; a click on Done closes the controls panel that opens first. */
export const SELECTION_SCRIPT = "#! select";
export const CPU_OPPONENT = "cpu";
export const MENU_BUTTONS = new Set(["start", "back"]);

const selectionLines = (script: string) => script.split("\n").map(line => line.trim().split(/\s+/)).filter(([step]) => /^\d+$/.test(step ?? ""));

export const selectionPresses = (script: string): readonly { readonly step: number; readonly button: string }[] =>
  selectionLines(script).flatMap(([step, button]) => button !== undefined && (ACTIONS[button] !== undefined || MENU_BUTTONS.has(button)) ? [{ step: Number(step), button }] : []);

export const selectionPointer = (script: string) => scriptedPointer(selectionLines(script).flatMap(([step, verb, ...args]) => {
  const found = pointerStep(Number(step), verb ?? "", args);
  return found === undefined ? [] : [found];
}));

export function selectionScriptProblems(script: string): readonly string[] {
  const problems: string[] = [];
  script.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    const [step, verb, ...rest] = line.split(/\s+/);
    const where = `selection script line ${index + 1} (${line})`;
    if (!/^\d+$/.test(step ?? "")) problems.push(`${where}: starts with a whole step number`);
    else if (verb === "click" || verb === "pointer") {
      try {
        pointerStep(Number(step), verb, rest);
      } catch (error) {
        problems.push(`${where}: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (verb === undefined || rest.length > 0 || (ACTIONS[verb] === undefined && !MENU_BUTTONS.has(verb))) problems.push(`${where}: needs STEP BUTTON, STEP pointer X Y or STEP click X Y [FRAMES]`);
  });
  return problems;
}
