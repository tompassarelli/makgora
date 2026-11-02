import { f32 } from "wisp/src/sim/f32";
import { ITEM_INTERVAL_MAX_SECONDS, ITEM_INTERVAL_MIN_SECONDS } from "../match/centreItem";
import type { MatchState } from "../lobby/lobbyState";
import { ITEM_BUFF_FRAMES } from "../sim/itemBuffs";
import { RULE_BUTTONS, type RuleName, rulePanel } from "./ruleButtons";
import { type BarPanel, barBoxContains } from "../core/selectBarLayout";

const versus = (game: Readonly<MatchState>): boolean => !game.training && !game.classic && !game.lore;

const ITEM_SECONDS = ITEM_BUFF_FRAMES / 60;

const MATCH_HELP = {
  teamBattle: "Team Battle: choose each fighter’s red, blue, teal or purple team. At least two teams must join; the last team standing wins.",
  fewerStocks: "Stocks: how many times each fighter can be knocked off the stage before they lose.",
  moreStocks: "Stocks: how many times each fighter can be knocked off the stage before they lose.",
  lessTime: "Time limit: the match ends when it runs out. Lower it to “No time limit” to play until stocks run out.",
  moreTime: "Time limit: the match ends when it runs out. Lower it to “No time limit” to play until stocks run out.",
  endless: "Endless play: no stocks are lost and there is no timer. Fight freely; pause and press Escape to leave.",
  automaticRematch: "Automatic rematch: when a match ends, the same fighters and rules start again after a short countdown.",
  items: `Items: a power-up appears at centre stage every ${ITEM_INTERVAL_MIN_SECONDS}–${ITEM_INTERVAL_MAX_SECONDS} s after a 10 s countdown. Touch it and press Attack to grab it.`,
  ultimates: "Ultimates: with a full meter bar, Attack + Special unleashes your fighter's ultimate. The bar fills from the match clock: full 60 s after the start and after each use. With Orbs on, only the centre-stage orb fills it. Off: no ultimates; Attack + Special is the ordinary special.",
} as const;

const ITEM_HELP = {
  itemSpeed: `Speed item: for ${ITEM_SECONDS} s you run and drift ×1.3 faster and jump higher. You glow cyan in a whirlwind.`,
  itemHeavy: `Heavy item: for ${ITEM_SECONDS} s you turn to iron: knockback you take ÷1.5 and you fall faster.`,
} as const;

const TRAINING_HELP = {
  lessBehaviour: "Partner: what the training partner does: stand, shield, crouch, jump, attack or fight back.",
  moreBehaviour: "Partner: what the training partner does: stand, shield, crouch, jump, attack or fight back.",
  lessEscape: "Partner drift: which way the partner steers while it flies from your hits.",
  moreEscape: "Partner drift: which way the partner steers while it flies from your hits.",
  lessTech: "Partner tech: whether and where the partner breaks its fall when it hits the ground.",
  moreTech: "Partner tech: whether and where the partner breaks its fall when it hits the ground.",
  lessDamage: "Partner damage: the partner's starting damage. Higher damage sends it flying farther.",
  moreDamage: "Partner damage: the partner's starting damage. Higher damage sends it flying farther.",
  hitAreas: "Hit areas: draw where every attack hits and where every fighter can be hit.",
  speed: "Game speed: slow the whole game to half or quarter speed to study moves.",
} as const;

export const INPUT_DELAY_HELP = "Input delay: frames a press waits before it acts, the same for every player. Online, Auto follows the slowest connection and the host can press − or + to set a number, or Auto to go back. Against computers it is fixed at 2.";

const HELP: Readonly<Record<Exclude<RuleName, "training" | "easierClassic" | "harderClassic">, string>> = { ...MATCH_HELP, ...ITEM_HELP, ...TRAINING_HELP, friendlyFire: "Friendly Fire: when on, teammates can damage and grab each other. Computers keep targeting the opposing teams.", inputDelay: INPUT_DELAY_HELP };

const SHOWN_IN: Readonly<Record<string, (game: Readonly<MatchState>) => boolean>> = {
  ...Object.fromEntries(Object.keys(MATCH_HELP).map(name => [name, versus])),
  ...Object.fromEntries(Object.keys(ITEM_HELP).map(name => [name, (game: Readonly<MatchState>) => versus(game) && game.items.on])),
  ...Object.fromEntries(Object.keys(TRAINING_HELP).map(name => [name, (game: Readonly<MatchState>) => game.training])),
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


export function ruleHelp(name: RuleName, game: Readonly<MatchState>): string {
  if (name === "training") return modeHelp(game);
  if (name === "easierClassic" || name === "harderClassic") return game.lore ? "Battle: choose which lore battle to fight." : "Difficulty: how strong the opponents are on this Classic run.";
  return HELP[name];
}
