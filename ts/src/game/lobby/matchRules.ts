import { isParticipantSlot } from "../input/participants";
import { ItemKind, itemBit } from "../sim/codes";
import { type CpuOpponentChoice, type CpuTier, isCpuOpponentChoice, isCpuTier } from "../match/cpuProfiles";
import { canChooseComputer, humanActive, type MatchState, Phase } from "./lobbyState";

export const settingRules = (game: Readonly<MatchState>, slot: number): boolean => game.phase === Phase.characterMenu && humanActive(game, slot);

export function setTeamBattle(game: MatchState, actor: number, on: boolean): void {
  if (settingRules(game, actor) && !game.training && !game.arcade) game.teamBattle = on;
}

export function setFriendlyFire(game: MatchState, actor: number, on: boolean): void {
  if (settingRules(game, actor) && game.teamBattle) game.friendlyFire = on;
}

export function setStocks(game: MatchState, slot: number, count: number): void {
  if (settingRules(game, slot) && count >= 1 && count <= 9) game.stockCount = count;
}

export function setTimeLimit(game: MatchState, slot: number, minutes: number): void {
  if (settingRules(game, slot) && minutes >= 0 && minutes <= 10) game.timeLimitMinutes = minutes;
}

export function setEndless(game: MatchState, slot: number, endless: boolean): void {
  if (settingRules(game, slot)) game.endless = endless;
}

export function setCpuOpponent(game: MatchState, actor: number, computer: number, opponent: CpuOpponentChoice): void {
  if (game.phase === Phase.characterMenu && isParticipantSlot(computer) && canChooseComputer(game, actor, computer) && isCpuOpponentChoice(opponent)) game.cpuOpponents[computer] = opponent;
}

export function setCpuTier(game: MatchState, actor: number, computer: number, tier: CpuTier): void {
  if (game.phase === Phase.characterMenu && isParticipantSlot(computer) && canChooseComputer(game, actor, computer) && isCpuTier(tier)) game.cpuTiers[computer] = tier;
}

export function setAutomaticRematch(game: MatchState, slot: number, automatic: boolean): void {
  if (settingRules(game, slot)) game.automaticRematch = automatic;
}

export function setItemsOn(game: MatchState, slot: number, on: boolean): void {
  if (settingRules(game, slot)) game.items.on = on;
}

export function setUltimatesOn(game: MatchState, slot: number, on: boolean): void {
  if (settingRules(game, slot)) game.ultimatesOff = !on;
}

export function setOrbsOn(game: MatchState, slot: number, on: boolean): void {
  if ((game.phase === Phase.characterMenu || game.phase === Phase.stageMenu) && humanActive(game, slot)) game.orbs.on = on;
}

export function toggleItemKind(game: MatchState, slot: number, kind: ItemKind): void {
  if (settingRules(game, slot) && kind !== ItemKind.none) game.items.enabledMask ^= itemBit(kind);
}

export const timedMatch = (game: Readonly<MatchState>): boolean => !game.practice && !game.endless && !game.training && game.timeLimitMinutes > 0;

export const keepsStocks = (game: Readonly<MatchState>): boolean => game.practice || game.endless || game.training;
