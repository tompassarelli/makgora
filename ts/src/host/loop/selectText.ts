import type { MatchState } from "../../game/lobby/lobbyState";
import type { MatchMode } from "../../game/lobby/matchMode";
import type { ClassicLines, SelectText } from "../../game/ui/selectionActions";
import { MODE_LABELS, rulesPillParts, selectionModeLabel } from "../../game/session/messages";
import { classicRouteSummary, classicTierSetting } from "../../game/classic/classicText";

function classicLines(game: Readonly<MatchState>, fighter: number): ClassicLines {
  return { setting: classicTierSetting(game.classicTier), route: classicRouteSummary(fighter) };
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
