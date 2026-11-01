import type { MatchMode, MatchState } from "../../game/lobby/lobbyState";
import type { ClassicLines, SelectText } from "../../game/ui/selectionActions";
import { MODE_LABELS, rulesPillParts, selectionModeLabel } from "../../game/session/messages";
import { classicRouteSummary, classicTierSetting } from "../../game/classic/classicText";
import { loreBattle, loreBattleSetting, loreBattleSummary } from "../../game/classic/loreBattles";
import { loreClears } from "../../game/classic/loreClears";

function classicLines(game: Readonly<MatchState>, fighter: number): ClassicLines {
  const { classicTier, lore, loreBattle: battle } = game;
  if (!lore) return { setting: classicTierSetting(classicTier), route: classicRouteSummary(fighter) };
  const clears = loreClears();
  const chosen = loreBattle(battle);
  return { setting: loreBattleSetting(battle, chosen !== undefined && clears.has(chosen.id)), route: loreBattleSummary(battle, clears.count()) };
}

/** The select bar's words from match flow and Classic progress, which the ui layer may not read itself. */
export const SELECT_TEXT: SelectText = {
  modeLabel(game: Readonly<MatchState>): string {
    return selectionModeLabel(game);
  },
  modeName(mode: MatchMode): string {
    return MODE_LABELS[mode];
  },
  rulesPill(game: Readonly<MatchState>): readonly string[] {
    return rulesPillParts(game);
  },
  classicLines(game: Readonly<MatchState>, fighter: number): ClassicLines {
    return classicLines(game, fighter);
  },
};
