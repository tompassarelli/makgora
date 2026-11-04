import type { MatchState } from "../lobby/lobbyState";
import { RULE_BUTTONS, type RuleName, rulePanel } from "./ruleButtons";
import { type BarPanel, barBoxContains } from "../core/selectBarLayout";
import { CLASSIC_LEVEL_HELP, FRIENDLY_FIRE_HELP, ITEM_RULE_HELP, LORE_BATTLE_HELP, MATCH_RULE_HELP, MODES, MODE_LIST_HELP, TRAINING_RULE_HELP, inputDelayHelp } from "./guide/text";

const versus = (game: Readonly<MatchState>): boolean => !game.training && !game.classic && !game.lore;

const HELP: Readonly<Record<Exclude<RuleName, "training" | "easierClassic" | "harderClassic" | "inputDelay">, string>> = { ...MATCH_RULE_HELP, ...ITEM_RULE_HELP, ...TRAINING_RULE_HELP, friendlyFire: FRIENDLY_FIRE_HELP };

const SHOWN_IN: Readonly<Record<string, (game: Readonly<MatchState>) => boolean>> = {
  ...Object.fromEntries(Object.keys(MATCH_RULE_HELP).map(name => [name, versus])),
  ...Object.fromEntries(Object.keys(ITEM_RULE_HELP).map(name => [name, (game: Readonly<MatchState>) => versus(game) && game.items.on])),
  ...Object.fromEntries(Object.keys(TRAINING_RULE_HELP).map(name => [name, (game: Readonly<MatchState>) => game.training])),
  friendlyFire: (game) => versus(game) && game.teamBattle,
  easierClassic: (game) => game.classic || game.lore,
  harderClassic: (game) => game.classic || game.lore,
};

const ruleShown = (name: RuleName, game: Readonly<MatchState>): boolean => SHOWN_IN[name]?.(game) ?? true;

const RULE_NAMES = Object.keys(RULE_BUTTONS).filter((name): name is RuleName => name in RULE_BUTTONS);

/** The rule under the pointer among those drawn: the bar's own while no panel is open, else the open panel's. */
export function hoveredRule(game: Readonly<MatchState>, open: BarPanel | undefined, x: number, y: number): RuleName | undefined {
  for (const name of RULE_NAMES) {
    if (rulePanel(name) !== open || !ruleShown(name, game)) continue;
    if (barBoxContains(RULE_BUTTONS[name], x, y)) return name;
  }
  return undefined;
}


function modeHelp(game: Readonly<MatchState>): string {
  const current = game.lore ? "Lore Battles: story fights against set opponents."
    : game.classic ? "Classic: a run of fights that ends with a boss."
    : game.training ? "Training: practise on a partner you set up; no stocks or timer."
    : "Versus: fight players and computers with the rules on this screen.";
  return `Mode: open the list to choose Versus, Training, Classic or Lore Battles. ${current}`;
}


export function ruleHelp(name: RuleName, game: Readonly<MatchState>, offlineDelay: number): string {
  if (name === "inputDelay") return inputDelayHelp(offlineDelay);
  if (name === "training") return modeHelp(game);
  if (name === "easierClassic" || name === "harderClassic") return game.lore ? LORE_BATTLE_HELP : CLASSIC_LEVEL_HELP;
  return HELP[name];
}
