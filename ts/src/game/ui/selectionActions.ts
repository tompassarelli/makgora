import type { MatchMode, MatchState } from "../lobby/lobbyState";
import type { RulePreset } from "../lobby/rulePresets";
import type { RosterTile } from "../menu/selectionDrag";
import type { ItemKind } from "../sim/codes";
import type { TrainingSetting } from "./ruleButtons";

export interface DelayControl {
  readonly frames: number;
  readonly high: boolean;
  readonly auto: boolean;
  readonly adjustable: boolean;
  readonly canLess: boolean;
  readonly canMore: boolean;
  readonly note: string;
}

export const FIXED_DELAY: DelayControl = { frames: 2, high: false, auto: true, adjustable: false, canLess: false, canMore: false, note: "" };

export interface LobbyNet {
  readonly delay: DelayControl;
  /** The frames of input delay, short, for the gear badge. */
  readonly delayBadge: string;
  readonly echoes: readonly string[];
}

/** Classic's or a Lore Battle's two drawer lines: the start setting and the route. */
export interface ClassicLines {
  readonly setting: string;
  readonly route: string;
}

/** The select bar's words that come from match flow and Classic progress, which the host writes. */
export interface SelectText {
  modeLabel(game: Readonly<MatchState>): string;
  modeName(mode: MatchMode): string;
  rulesPill(game: Readonly<MatchState>): readonly string[];
  classicLines(game: Readonly<MatchState>, fighter: number): ClassicLines;
}

export interface SelectionActions {
  selectChoice(participantId: number, choice: RosterTile): void;
  selectCpuChoice(participantId: number, cpu: number, choice: RosterTile): void;
  cycleMode(actorId: number, fighterSlot: number): void;
  recallChoice(actorId: number, chipSlot: number): void;
  openSettings(participantId: number): void;
  openMainMenu(participantId: number): void;
  start(participantId: number): void;
  changeStocks(participantId: number, direction: -1 | 1): void;
  changeTime(participantId: number, direction: -1 | 1): void;
  toggleTeamBattle(participantId: number): void;
  toggleFriendlyFire(participantId: number): void;
  changeTeam(participantId: number, fighterSlot: number, direction: -1 | 1): void;
  changeCostume(participantId: number, fighterSlot: number, direction: -1 | 1): void;
  toggleEndless(participantId: number): void;
  toggleAutomaticRematch(participantId: number): void;
  toggleItems(participantId: number): void;
  toggleUltimates(participantId: number): void;
  toggleItemKind(participantId: number, kind: ItemKind): void;
  chooseMatchMode(participantId: number, mode: MatchMode): void;
  applyRulePreset(participantId: number, preset: RulePreset): void;
  stepClassicTier(participantId: number, direction: -1 | 1): void;
  stepTraining(participantId: number, setting: TrainingSetting, direction: -1 | 1): void;
  toggleHitAreas(participantId: number): void;
  stepSpeed(participantId: number): void;
  changeCpuOpponent(actorId: number, cpuSlot: number, direction: -1 | 1): void;
  changeCpuTier(actorId: number, cpuSlot: number, direction: -1 | 1): void;
  stepTutorial(participantId: number, direction: -1 | 1): void;
  startTutorial(participantId: number): void;
  closeTutorial(participantId: number): void;
  changeInputDelay(participantId: number, step: -1 | 0 | 1): void;
}
