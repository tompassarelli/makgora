import { Action } from "../input/actions";
import { type KeyBindings, PRESET_NAMES, keyFor, keyLabel, presetOf } from "../input/keyBindings";

export const HELP_COMMAND = "-help";
export const COMMANDS_COMMAND = "-commands";

export const START_HINT = "Type -help or press F9 for help.";

export const PLAYER_COMMANDS: readonly string[] = [
  "-help or -commands: show this list of commands.",
  "-save: save your current controls and delay as your profile for next time.",
  "-load: load your saved profile.",
  "F1: open the Controls screen at fighter select. F9: help (Controls, How to play, Commands).",
  "Y: start from fighter or stage select (in a match Y is C-up by default). Esc or Backspace (Start on a controller): pause. H: hide or show the keyboard preview in a match. -clip: save the last ten seconds of a match for a bug report.",
];

export const CONTROLS_TITLE = "Controls";
export const HOW_TO_PLAY_TITLE = "How to play";
export const COMMANDS_TITLE = "Commands";

export const HOW_TO_PLAY = [
  "Stocks: each fighter has a few lives (stocks). Hits raise damage %, and the higher it is the farther a hit sends you. Fly past the edge of the screen and you lose a stock; the last fighter with stocks wins.",
  "Shield: hold your shield key to block. The bubble shrinks while held and breaks if it gets too small, leaving you dizzy. Shield in the air to air-dodge.",
  "Recovery: knocked off the stage, use your second jump, then Up + Special to fly back. Grab the ledge to hang on, then press a direction or jump to get up.",
].join("|n|n");

const LAYOUT_ROWS: readonly (readonly [string, Action])[] = [
  ["Left", Action.moveLeft], ["Right", Action.moveRight], ["Up", Action.moveUp], ["Down", Action.moveDown],
  ["Jump", Action.jump], ["Attack", Action.attack], ["Special", Action.special], ["Grab", Action.grab], ["Shield", Action.leftTrigger],
];

export function controlsDescription(bindings: Readonly<KeyBindings>): string {
  const preset = presetOf(bindings);
  const keys = LAYOUT_ROWS.map(([name, action]) => `${name} ${keyLabel(keyFor(bindings, action, 0))}`).join(", ");
  return `Your layout: ${preset === undefined ? "your own keys" : PRESET_NAMES[preset]}.|n${keys}.|n|nTo change it, press F1 at fighter select: pick WASD, Box or a Custom slot; click a key and press another to rebind it. Save keeps it for next time.`;
}

export const COMMANDS_DESCRIPTION = PLAYER_COMMANDS.join("|n");
