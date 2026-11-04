import { PARTICIPANT_SLOTS, isParticipantSlot } from "../input/participants";
import { canChooseComputer, computerActive, fighterActive, fighterMask, hasUnassignedHuman, humanActive, humanFighterActive, type MatchState, Phase } from "./lobbyState";

export function practiceSelected(game: Readonly<MatchState>): boolean {
  return game.humanCount === 1 && game.humanFighterMask === game.humanMask && !PARTICIPANT_SLOTS.some(slot => computerActive(game, slot) && game.characterReadiness[slot]);
}

export function validTeams(game: Readonly<MatchState>): boolean {
  if (!game.teamBattle) return true;
  let teams = 0;
  for (const slot of PARTICIPANT_SLOTS) if (fighterActive(game, slot)) teams |= 1 << game.teamChoices[slot];
  return teams !== 0 && (teams & (teams - 1)) !== 0;
}

export function allCharactersReady(game: Readonly<MatchState>): boolean {
  if (fighterMask(game) === 0 || hasUnassignedHuman(game) || !validTeams(game)) return false;
  return !PARTICIPANT_SLOTS.some(slot => fighterActive(game, slot) && !game.characterReadiness[slot] && !(practiceSelected(game) && computerActive(game, slot)));
}

export function unreadyCharacter(game: MatchState, slot: number): void {
  if (game.phase === Phase.characterMenu && isParticipantSlot(slot) && humanActive(game, slot)) game.characterReadiness[slot] = false;
}

export function recallCharacter(game: MatchState, actor: number, chip: number): void {
  if (game.phase !== Phase.characterMenu || !humanActive(game, actor) || !isParticipantSlot(chip)) return;
  if ((chip === actor && humanFighterActive(game, chip)) || canChooseComputer(game, actor, chip)) game.characterReadiness[chip] = false;
}
