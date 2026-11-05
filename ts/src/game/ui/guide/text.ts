import { formatInt } from "wisp/game/text";
import { Action } from "../../input/actions";
import { type KeyBindings, PRESET_NAMES, keyFor, keyLabel, presetOf } from "../../input/keyBindings";
import { ITEM_INTERVAL_MAX_SECONDS, ITEM_INTERVAL_MIN_SECONDS } from "../../match/centreItem";
import { ITEM_BUFF_FRAMES } from "../../sim/itemBuffs";
import { ULTIMATE_CLOCK_FRAMES } from "../../sim/meter";
import { ORB_INTERVAL_FRAMES } from "../../sim/orbs";

export const HELP_COMMAND = "-help";
export const COMMANDS_COMMAND = "-commands";
export const CONTROLS_PANEL_KEY = "F2";
export const HELP_KEY = "F9";
export const WARCRAFT_MENU_KEY = "F10";

export const START_HINT = `Type ${HELP_COMMAND} or press ${HELP_KEY} for help.`;

export const PLAYER_COMMANDS: readonly string[] = [
  `${HELP_COMMAND} or ${COMMANDS_COMMAND}: show this list of commands.`,
  "-save: save your current controls and delay as your profile for next time.",
  "-load: load your saved profile.",
  `${CONTROLS_PANEL_KEY}: open the Controls screen at fighter select, or show and hide the controls panel in a match. ${HELP_KEY}: help (Controls, How to play, Commands).`,
  "Y: start from fighter or stage select (in a match Y is C-up by default). Esc or Backspace (Start on a controller): pause. -clip: save the last ten seconds of a match for a bug report.",
];

export const CONTROLS_TITLE = "Controls";
export const HOW_TO_PLAY_TITLE = "How to play";
export const COMMANDS_TITLE = "Commands";

export const HOW_TO_PLAY_POINTS: readonly string[] = [
  "Stocks: each fighter has a few lives (stocks). Hits raise damage %, and the higher it is the farther a hit sends you. Fly past the edge of the screen and you lose a stock; the last fighter with stocks wins.",
  "Shield: hold your shield key to block. The bubble shrinks while held and breaks if it gets too small, leaving you dizzy. Shield in the air to air-dodge.",
  "Recovery: knocked off the stage, use your second jump, then Up + Special to fly back. Grab the ledge to hang on, then press a direction or jump to get up.",
];

export const HOW_TO_PLAY = HOW_TO_PLAY_POINTS.join("|n|n");

export const CONTROL_ROWS: readonly (readonly [string, Action])[] = [
  ["Left", Action.moveLeft], ["Right", Action.moveRight], ["Up", Action.moveUp], ["Down", Action.moveDown],
  ["Jump", Action.jump], ["Short hop", Action.shortHop], ["Attack", Action.attack], ["Special", Action.special], ["Strong (smash)", Action.strong],
  ["Grab", Action.grab], ["Shield", Action.leftTrigger], ["Second shield", Action.rightTrigger], ["Light shield", Action.lightShield],
  ["Walk (Mod X)", Action.modX], ["Tilt (Mod Y)", Action.modY],
  ["C-up", Action.cUp], ["C-left", Action.cLeft], ["C-down", Action.cDown], ["C-right", Action.cRight],
];

const QUEST_LOG_ACTIONS: readonly Action[] = [Action.moveLeft, Action.moveRight, Action.moveUp, Action.moveDown, Action.jump, Action.attack, Action.special, Action.grab, Action.leftTrigger];
const LAYOUT_ROWS = CONTROL_ROWS.filter(([, action]) => QUEST_LOG_ACTIONS.includes(action));

export const CONTROLS_REBIND_HINT = "Click a lit key to rebind, or click its red x to clear.";
export const CONTROLS_CAPTURE_HINT = "Press the new key for the flashing action. Delete clears it, Escape cancels.";

export const CONTROLS_CHANGE = `To change it, press ${CONTROLS_PANEL_KEY} at fighter select: pick WASD, Box or a Custom slot; click a key and press another to rebind it. Save keeps it for next time.`;

export function controlsDescription(bindings: Readonly<KeyBindings>): string {
  const preset = presetOf(bindings);
  const keys = LAYOUT_ROWS.map(([name, action]) => `${name} ${keyLabel(keyFor(bindings, action, 0))}`).join(", ");
  return `Your layout: ${preset === undefined ? "your own keys" : PRESET_NAMES[preset]}.|n${keys}.|n|n${CONTROLS_CHANGE}`;
}

export const COMMANDS_DESCRIPTION = PLAYER_COMMANDS.join("|n");

const ITEM_SECONDS = ITEM_BUFF_FRAMES / 60;
const ORB_SECONDS = ORB_INTERVAL_FRAMES / 60;
const METER_SECONDS = ULTIMATE_CLOCK_FRAMES / 60;
const STOCKS_HELP = "Stocks: how many times each fighter can be knocked off the stage before they lose.";
const TIME_HELP = "Time limit: the match ends when it runs out. Lower it to “No time limit” to play until stocks run out.";

export const MATCH_RULE_HELP = {
  teamBattle: "Team Battle: choose each fighter’s red, blue, teal or purple team. At least two teams must join; the last team standing wins.",
  fewerStocks: STOCKS_HELP,
  moreStocks: STOCKS_HELP,
  lessTime: TIME_HELP,
  moreTime: TIME_HELP,
  endless: "Endless play: no stocks are lost and there is no timer. Fight freely; pause, then hold Esc for a second (or hold L, R and A and press Start) to leave.",
  automaticRematch: "Automatic rematch: when a match ends, the same fighters and rules start again after a short countdown.",
  forge: "Forge: also show the fighters and stages still in development, marked with a hammer, on every player’s character and stage select. Random, computer picks and Arcade use finished fighters only.",
  items: `Items: a power-up appears at centre stage every ${ITEM_INTERVAL_MIN_SECONDS}–${ITEM_INTERVAL_MAX_SECONDS} s after a 10 s countdown. Touch it and press Attack to grab it.`,
  ultimates: `Ultimates: with a full meter bar, Attack + Special unleashes your fighter's ultimate. The bar fills from the match clock: full ${METER_SECONDS} s after the start and after each use. With Orbs on, only the orb that appears above centre stage every ${ORB_SECONDS} s fills it, half a bar each. Off: no ultimates; Attack + Special is the ordinary special.`,
} as const;

export const ITEM_RULE_HELP = {
  itemSpeed: `Speed item: for ${ITEM_SECONDS} s you run and drift ×1.3 faster and jump higher. You glow cyan in a whirlwind.`,
  itemHeavy: `Heavy item: for ${ITEM_SECONDS} s you turn to iron: knockback you take ÷1.5 and you fall faster.`,
} as const;

const BEHAVIOUR_HELP = "Partner: what the training partner does: stand, shield, crouch, jump, attack or fight back.";
const ESCAPE_HELP = "Partner drift: which way the partner steers while it flies from your hits.";
const TECH_HELP = "Partner tech: whether and where the partner breaks its fall when it hits the ground.";
const DAMAGE_HELP = "Partner damage: the partner's starting damage. Higher damage sends it flying farther.";

export const TRAINING_RULE_HELP = {
  lessBehaviour: BEHAVIOUR_HELP, moreBehaviour: BEHAVIOUR_HELP,
  lessEscape: ESCAPE_HELP, moreEscape: ESCAPE_HELP,
  lessTech: TECH_HELP, moreTech: TECH_HELP,
  lessDamage: DAMAGE_HELP, moreDamage: DAMAGE_HELP,
  hitAreas: "Hit areas: draw where every attack hits and where every fighter can be hit.",
  speed: "Game speed: slow the whole game to half or quarter speed to study moves.",
} as const;

export const FRIENDLY_FIRE_HELP = "Friendly Fire: when on, teammates can damage and grab each other. Computers keep targeting the opposing teams.";

export const inputDelayHelp = (offline: number): string => `Input delay: frames a press waits before it acts, the same for every player. Online, Auto follows the slowest connection and the host can press − or + to set a number, or Auto to go back. Offline it is fixed at ${formatInt(offline)}.`;

export const MODES = {
  versus: "Versus: fight players and computers with the rules on this screen.",
  training: "Training: practise on a partner you set up; no stocks or timer.",
  arcade: "Arcade: a fixed run of eight fights that ends on your rival. The Horde won the world, and now every race fights up through the war bands for the right to challenge the Warchief.",
} as const;

export const ARCADE_MODE_HELP = "Arcade: a fixed run of eight fights ending on your rival.";
export const MODE_LIST_HELP = "Mode: open the list to choose Versus, Training, or Arcade.";
export const ARCADE_TIER_HELP = "Tier: Peon, Grunt or Warchief sets every computer fighter's skill for the whole run. Peon and Grunt replay a lost stage; Warchief ends the run on a loss.";

export const PAUSE_KEYS = { controls: [CONTROLS_PANEL_KEY, "Show controls"], warcraftMenu: [WARCRAFT_MENU_KEY, "Warcraft menu"] } as const;
