import { PARTICIPANT_SLOTS } from "../input/participants";
import { CPU_TIERS } from "../match/cpuProfiles";
import { arcadeRouted, computerActive, type MatchState, nextMatchCharacter, Phase } from "./lobbyState";
import { settingRules } from "./matchRules";

export function setTraining(game: MatchState, slot: number, training: boolean): void {
  if (!settingRules(game, slot)) return;
  game.training = training;
  if (training) {
    game.teamBattle = false;
    game.arcade = false;
  }
  if (!training) game.trainer.lesson = -1;
}

export function cycleMatchMode(game: MatchState, slot: number): void {
  if (!settingRules(game, slot)) return;
  game.teamBattle = false;
  if (game.arcade) game.arcade = false;
  else if (game.training) {
    game.training = false;
    game.arcade = true;
    for (const player of PARTICIPANT_SLOTS) {
      if (!arcadeRouted(game.characterChoices[player])) {
        game.characterChoices[player] = nextMatchCharacter(game, undefined, 1);
        game.characterReadiness[player] = false;
      }
    }
  } else game.training = true;
}

export type MatchMode = "versus" | "training" | "arcade";
export const MATCH_MODES: readonly MatchMode[] = ["versus", "training", "arcade"];
export const matchMode = (game: Readonly<MatchState>): MatchMode => game.arcade ? "arcade" : game.training ? "training" : "versus";

export function chooseMatchMode(game: MatchState, slot: number, mode: MatchMode): void {
  for (let step = 0; step < MATCH_MODES.length && matchMode(game) !== mode; step++) cycleMatchMode(game, slot);
}

export function stepArcadeTier(game: MatchState, slot: number, direction: number): void {
  if (settingRules(game, slot) && game.arcade && !game.run.active) game.arcadeTier = Math.max(0, Math.min(CPU_TIERS.length - 1, game.arcadeTier + direction));
}

export function endConfiguredRun(game: MatchState): void {
  const { run } = game;
  if (!run.active) return;
  run.active = false;
  run.current = undefined;
  game.humanFighterMask = run.savedHumanFighters;
  game.computerMask = run.savedComputers;
  game.stockCount = run.savedStocks;
  game.timeLimitMinutes = run.savedMinutes;
  game.hazards = run.savedHazards;
  game.items.on = run.savedItems;
  game.rematchReadiness.fill(false);
  for (const slot of PARTICIPANT_SLOTS) if (computerActive(game, slot)) game.characterReadiness[slot] = true;
  game.phase = Phase.characterMenu;
}
