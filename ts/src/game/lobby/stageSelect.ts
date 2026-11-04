import { nextPoolStage, consumePoolStage, togglePoolMode, togglePoolStage } from "../menu/stagePool";
import { RANDOM_STAGE, selectableStageChoice } from "../menu/stageCatalog";
import { humanActive, type MatchState, Phase } from "./lobbyState";
import { allCharactersReady } from "./characterReadiness";

export function selectStage(game: MatchState, slot: number, choice: number): void {
  if (game.phase !== Phase.stageMenu || !humanActive(game, slot) || !selectableStageChoice(choice)) return;
  game.stageChoice = choice;
  game.stageResolved = false;
}

export function changeStagePoolMode(game: MatchState, slot: number): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot)) togglePoolMode(game.stagePool);
}

export function changeStagePoolStage(game: MatchState, slot: number, choice: number): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot)) togglePoolStage(game.stagePool, choice);
}

export function setHazards(game: MatchState, slot: number, on: boolean): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot)) game.hazards = on;
}

export function requestStageSelect(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.characterMenu || !humanActive(game, slot) || !allCharactersReady(game)) return false;
  game.stageChoice = RANDOM_STAGE;
  game.stageResolved = false;
  game.phase = Phase.stageMenu;
  return true;
}

export function returnToCharacters(game: MatchState, slot: number): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot)) game.phase = Phase.characterMenu;
}

export function resolveStageChoice(game: MatchState, seed = game.matchSeed): void {
  if (game.stageResolved) return;
  if (game.stageChoice === RANDOM_STAGE) game.stageChoice = nextPoolStage(game.stagePool, seed);
  else consumePoolStage(game.stagePool, game.stageChoice);
  game.stageResolved = true;
}
