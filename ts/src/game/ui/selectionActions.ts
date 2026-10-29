import type { RosterTile } from "../menu/selectionDrag";
import type { ItemKind } from "../sim/codes";
import type { TrainingSetting } from "./ruleButtons";

export interface LobbyNet {
  readonly delayText: string;
  readonly hostControl: boolean;
  readonly echoes: readonly string[];
}

export interface SelectionActions {
  selectChoice(participantId: number, choice: RosterTile): void;
  selectCpuChoice(participantId: number, cpu: number, choice: RosterTile): void;
  cycleMode(actorId: number, fighterSlot: number): void;
  recallChoice(actorId: number, chipSlot: number): void;
  openSettings(participantId: number): void;
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
  cycleMatchMode(participantId: number): void;
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
