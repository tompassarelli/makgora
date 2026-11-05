import { PLAYABLE_CHARACTERS, DEFAULT_FIGHTER } from "../roster/kits";
import { shownFighters } from "../roster/forge";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS, type ParticipantSlot, isParticipantSlot } from "../input/participants";
import { Character } from "../sim/codes";
import { lobbyMatchSeed } from "../match/botRandom";
import { drawCpuFighter } from "../match/cpuProfiles";
import { canChooseComputer, characterFor, type CharacterOffer, computerActive, defaultChoice, humanFighterActive, humanPresent, type MatchState, nextMatchCharacter, Phase, selectableMatchCharacter } from "./lobbyState";

export function initializeComputerChoices(game: MatchState, seed: number): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!computerActive(game, slot)) continue;
    const salted = floorMod(floorMod(seed, 46337) + (slot + 1) * 7919, 46337);
    const mixed = floorMod(salted * salted + 12345, 46337);
    game.characterChoices[slot] = defaultChoice(mixed ^ floorMod(mixed * 31, 46337));
    game.cpuRandomFighters[slot] = true;
  }
}

export function startComputerChoices(game: MatchState, lobbyCounter: number, menuFrames: number): void {
  game.matchSeed = lobbyMatchSeed(lobbyCounter);
  initializeComputerChoices(game, menuFrames + game.matchSeed);
}

export function selectCharacter(game: MatchState, slot: number, choice: number, offered: CharacterOffer = selectableMatchCharacter): void {
  if (game.phase !== Phase.characterMenu || !isParticipantSlot(slot) || !humanPresent(game, slot) || !humanFighterActive(game, slot) || !offered(game, choice)) return;
  chooseFighter(game, slot, choice);
  game.characterReadiness[slot] = true;
}

function chooseFighter(game: MatchState, slot: ParticipantSlot, choice: Character): void {
  if (game.characterChoices[slot] !== choice) game.costumeChoices[slot] = 0;
  game.characterChoices[slot] = choice;
}

export const RANDOM_FIGHTER = -1;

export const randomFighterOffered = (game: Readonly<MatchState>): boolean => !game.arcade;

export const cpuFighterRandom = (game: Readonly<MatchState>, slot: number): boolean => isParticipantSlot(slot) && computerActive(game, slot) && game.cpuRandomFighters[slot] && randomFighterOffered(game);

export const shownFighter = (game: Readonly<MatchState>, slot: number): number | undefined => cpuFighterRandom(game, slot) ? RANDOM_FIGHTER : characterFor(game, slot);

export function selectCpuCharacter(game: MatchState, actor: number, slot: number, choice: number, offered: CharacterOffer = selectableMatchCharacter): void {
  if (game.phase !== Phase.characterMenu || !isParticipantSlot(slot) || !canChooseComputer(game, actor, slot)) return;
  if (choice === RANDOM_FIGHTER && randomFighterOffered(game)) game.cpuRandomFighters[slot] = true;
  else if (offered(game, choice)) {
    chooseFighter(game, slot, choice);
    game.cpuRandomFighters[slot] = false;
  } else return;
  game.characterReadiness[slot] = true;
}

export function nextCpuCharacter(game: Readonly<MatchState>, slot: number, direction: number): number {
  if (!randomFighterOffered(game)) return nextMatchCharacter(game, characterFor(game, slot), direction);
  const choices = shownFighters(PLAYABLE_CHARACTERS, game.forge);
  const last = choices.length - 1;
  const index = cpuFighterRandom(game, slot) ? (direction > 0 ? -1 : last + 1) : choices.indexOf(game.characterChoices[slot] ?? DEFAULT_FIGHTER);
  const next = index + (direction > 0 ? 1 : -1);
  return next < 0 || next > last ? RANDOM_FIGHTER : choices[next] ?? DEFAULT_FIGHTER;
}

export function drawCpuFighters(game: MatchState): void {
  if (game.run.active) return;
  for (const slot of PARTICIPANT_SLOTS) if (cpuFighterRandom(game, slot)) game.characterChoices[slot] = drawCpuFighter(shownFighters(PLAYABLE_CHARACTERS), game.matchSeed, slot);
}
