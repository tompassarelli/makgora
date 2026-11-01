import { ITEM_KINDS, itemBit } from "../sim/codes";
import { type MatchState, setAutomaticRematch, setEndless, setItemsOn, setStocks, setTimeLimit, setUltimatesOn, toggleItemKind } from "./lobbyState";

export type RulePreset = "standard" | "tourney" | "party" | "endless";

export interface PresetRules {
  readonly stocks?: number;
  readonly minutes?: number;
  readonly items?: boolean;
  readonly everyItem?: boolean;
  readonly ultimates?: boolean;
  readonly endless?: boolean;
  readonly automaticRematch?: boolean;
}

/** Each preset sets only the rules it names; `standard` is a fresh lobby's rules, the drawer's Reset default. */
export const RULE_PRESETS: Readonly<Record<RulePreset, PresetRules>> = {
  standard: { stocks: 3, minutes: 7, items: false, everyItem: true, ultimates: true, endless: false, automaticRematch: false },
  tourney: { stocks: 4, minutes: 8, items: false, ultimates: true, endless: false },
  party: { items: true, everyItem: true, ultimates: true, endless: false },
  endless: { endless: true, ultimates: true },
};

export const PRESET_NAMES: Readonly<Record<RulePreset, string>> = { standard: "Reset default", tourney: "Tourney", party: "Party", endless: "Endless" };

export function applyRulePreset(game: MatchState, slot: number, preset: RulePreset): void {
  const rules = RULE_PRESETS[preset];
  if (rules.stocks !== undefined) setStocks(game, slot, rules.stocks);
  if (rules.minutes !== undefined) setTimeLimit(game, slot, rules.minutes);
  if (rules.items !== undefined) setItemsOn(game, slot, rules.items);
  if (rules.everyItem === true) for (const kind of ITEM_KINDS) if ((game.items.enabledMask & itemBit(kind)) === 0) toggleItemKind(game, slot, kind);
  if (rules.ultimates !== undefined) setUltimatesOn(game, slot, rules.ultimates);
  if (rules.endless !== undefined) setEndless(game, slot, rules.endless);
  if (rules.automaticRematch !== undefined) setAutomaticRematch(game, slot, rules.automaticRematch);
}
