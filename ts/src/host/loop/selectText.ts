import type { MatchState } from "../../game/lobby/lobbyState";
import type { MatchMode } from "../../game/lobby/matchMode";
import type { ArcadeLines, SelectText } from "../../game/ui/selectionActions";
import { MODE_LABELS, rulesPillParts, selectionModeLabel } from "../../game/session/messages";
import { arcadeRouteSummary, arcadeTierSetting } from "../../game/arcade/arcadeText";

function arcadeLines(game: Readonly<MatchState>, fighter: number): ArcadeLines {
  return { setting: arcadeTierSetting(game.arcadeTier), route: arcadeRouteSummary(fighter) };
}

/** The select bar's words from match flow and Arcade progress, which the ui layer may not read itself. */
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
  arcadeLines(game: Readonly<MatchState>, fighter: number): ArcadeLines {
    return arcadeLines(game, fighter);
  },
};
