import { ARCADE_CHARACTERS, arcadeTable } from "../arcade/tables";
import { type StagePool, createStagePool, copyStagePool } from "../menu/stagePool";
import { PLAYABLE_CHARACTERS, isMatchCharacter, nextCharacterIn, DEFAULT_FIGHTER } from "../roster/kits";
import { isComingSoon, shownFighters } from "../roster/forge";
import { type CostumeTint, costumeIndex, costumeOf } from "../roster/costumes";
import { floorMod } from "wisp/src/sim/intMath";
import { type MatchCamera, createMatchCamera, copyMatchCamera } from "../sim/matchCamera";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots, isParticipantMask, isParticipantSlot, participantActive } from "../input/participants";
import { Character } from "../sim/codes";
import { type MatchOrbs, copyMatchOrbs, createMatchOrbs } from "../sim/orbState";
import { CPU_OPPONENT_CHOICE_DEFAULT, CPU_OPPONENT_DEFAULT, CPU_TIER_DEFAULT, type CpuOpponentChoice, type CpuOpponentId, type CpuTier } from "../match/cpuProfiles";
import { type MatchItems, copyMatchItems, createMatchItems } from "../match/items";
import { type Team } from "../sim/teams";
import { STAGE_AT_REST } from "../sim/stage";
import { type ConfiguredRun, copyConfiguredRun, createConfiguredRun } from "../arcade/runState";
import { type TrainingState, copyTrainingState, createTrainingState } from "../match/trainingState";
import { copyComputerLead } from "../core/computerLead";

export const Phase = { characterMenu: 0, stageMenu: 1, match: 2, result: 3 } as const;
export type Phase = (typeof Phase)[keyof typeof Phase];
export const ResultPick = { rematch: 0, newStage: 1, characters: 2 } as const;
export type ResultPick = (typeof ResultPick)[keyof typeof ResultPick];
export const RESULT_PICKS = 3;
export const DEFAULT_RESULT_PICK: ResultPick = ResultPick.rematch;
export const shownResultPick = (focus: readonly number[] | undefined, slot: number): number => focus?.[slot] ?? DEFAULT_RESULT_PICK;
export const MATCH_TICKS_PER_SECOND = 60;

export const ARCADE_TIER_DEFAULT = 1;

export interface MatchState {
  readonly camera: MatchCamera;
  phase: Phase;
  readonly characterChoices: Slots<Character>;
  readonly costumeChoices: Slots<number>;
  readonly cpuOpponents: Slots<CpuOpponentChoice>;
  readonly cpuRandomFighters: Slots<boolean>;
  readonly cpuTiers: Slots<CpuTier>;

  readonly cpuResolvedOpponents: Slots<CpuOpponentId>;
  readonly characterReadiness: Slots<boolean>;
  readonly rematchReadiness: Slots<boolean>;
  readonly resultPicks: Slots<ResultPick>;
  departedMask: number;
  interrupted: boolean;

  humanMask: number;
  humanFighterMask: number;
  humanCount: number;
  computerMask: number;
  stageChoice: number;
  stageResolved: boolean;
  readonly stagePool: StagePool;

  hazards: boolean;

  winner: ParticipantSlot | undefined;
  teamBattle: boolean;
  friendlyFire: boolean;
  readonly teamChoices: Slots<Team>;
  stockCount: number;
  timeLimitMinutes: number;

  endless: boolean;

  automaticRematch: boolean;

  forge: boolean;

  rematchCountdown: number;
  remainingFrames: number;

  matchSeed: number;

  startHold: number;

  matchFrame: number;
  timedOut: boolean;
  practice: boolean;

  training: boolean;
  readonly trainer: TrainingState;

  readonly items: MatchItems;

  ultimatesOff: boolean;
  readonly orbs: MatchOrbs;

  computerLead?: number;

  arcade: boolean;
  arcadeTier: number;

  readonly run: ConfiguredRun;
}

export const defaultChoice = (index: number): Character => {
  const featured = shownFighters(PLAYABLE_CHARACTERS);
  return featured[floorMod(index, featured.length)] ?? DEFAULT_FIGHTER;
};

export function createMatchState(): MatchState {
  return {
    camera: createMatchCamera(),
    phase: Phase.characterMenu, characterChoices: [defaultChoice(0), defaultChoice(1), defaultChoice(2), defaultChoice(0)], costumeChoices: [0, 0, 0, 0], matchSeed: 0,
    cpuOpponents: [CPU_OPPONENT_CHOICE_DEFAULT, CPU_OPPONENT_CHOICE_DEFAULT, CPU_OPPONENT_CHOICE_DEFAULT, CPU_OPPONENT_CHOICE_DEFAULT],
    cpuRandomFighters: [false, false, false, false],
    cpuTiers: [CPU_TIER_DEFAULT, CPU_TIER_DEFAULT, CPU_TIER_DEFAULT, CPU_TIER_DEFAULT],
    cpuResolvedOpponents: [CPU_OPPONENT_DEFAULT, CPU_OPPONENT_DEFAULT, CPU_OPPONENT_DEFAULT, CPU_OPPONENT_DEFAULT],
    characterReadiness: [false, false, false, false], rematchReadiness: [false, false, false, false],
    resultPicks: [ResultPick.characters, ResultPick.characters, ResultPick.characters, ResultPick.characters],
    teamBattle: false, friendlyFire: false, teamChoices: [0, 1, 0, 1],
    departedMask: 0, interrupted: false, humanMask: 1, humanFighterMask: 1, humanCount: 1, computerMask: 0,
    stageChoice: 2, hazards: true, stageResolved: false, stagePool: createStagePool(), winner: undefined, stockCount: 3, timeLimitMinutes: 7, endless: false, automaticRematch: false, forge: false, rematchCountdown: 0,

    remainingFrames: 7 * 60 * MATCH_TICKS_PER_SECOND, startHold: 0, matchFrame: 0, timedOut: false, practice: false,
    training: false, trainer: createTrainingState(), items: createMatchItems(), orbs: createMatchOrbs(), ultimatesOff: false,
    arcade: false, arcadeTier: ARCADE_TIER_DEFAULT, run: createConfiguredRun(),
  };
}

export const humanActive = (game: Readonly<MatchState>, slot: number): boolean => {
  const mask = game.humanMask;
  return mask > 0 && mask < 16 && slot >= 0 && slot < 4 && (mask & (1 << slot)) !== 0;
};
export function humanCount(game: Readonly<MatchState>): number {
  let count = 0;
  for (const slot of PARTICIPANT_SLOTS) if (humanActive(game, slot)) count++;
  return count;
}
export const choosingFighter = (game: Readonly<MatchState> | undefined, slot: number): Readonly<MatchState> | undefined =>
  game !== undefined && game.phase === Phase.characterMenu && humanActive(game, slot) ? game : undefined;
export const humanPresent = (game: Readonly<MatchState>, slot: number): boolean => humanActive(game, slot) && !participantActive(game.departedMask, slot);
export const humanFighterActive = (game: Readonly<MatchState>, slot: number): boolean => {
  const mask = game.humanFighterMask;
  return mask > 0 && mask < 16 && slot >= 0 && slot < 4 && (mask & (1 << slot)) !== 0;
};
export const computerActive = (game: Readonly<MatchState>, slot: number): boolean => {
  const mask = game.computerMask;
  return mask > 0 && mask < 16 && slot >= 0 && slot < 4 && (mask & (1 << slot)) !== 0;
};

export function firstHumanSlot(game: Readonly<MatchState>): ParticipantSlot | undefined {
  return PARTICIPANT_SLOTS.find(slot => humanActive(game, slot));
}

export function cpuSlot(game: Readonly<MatchState>): ParticipantSlot | undefined {
  return PARTICIPANT_SLOTS.find(slot => computerActive(game, slot));
}

export function canChooseComputer(game: Readonly<MatchState>, actor: number, computer: number): boolean {
  return humanPresent(game, actor) && (actor === firstHumanSlot(game) || actor === computer) && computerActive(game, computer);
}

export function fighterMask(game: Readonly<MatchState>): number {
  return game.practice && game.phase === Phase.match ? game.humanFighterMask : game.humanFighterMask + game.computerMask;
}

export const fighterActive = (game: Readonly<MatchState>, slot: number): boolean => participantActive(fighterMask(game), slot);

export function updateConnectedHumans(game: MatchState, humans: number): void {
  if (!isParticipantMask(humans) || game.phase === Phase.match) return;
  game.humanMask = humans;
  game.departedMask = 0;
  game.interrupted = false;
  game.humanCount = PARTICIPANT_SLOTS.filter(slot => humanActive(game, slot)).length;
}

export function setParticipants(game: MatchState, humans: number, computers: number): void {
  if (!isParticipantMask(humans) || computers < 0 || computers >= 16 || game.phase === Phase.match || (humans & computers) !== 0) return;
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanActive(game, slot) !== participantActive(humans, slot) || computerActive(game, slot) !== participantActive(computers, slot)) game.characterReadiness[slot] = false;
    if (participantActive(computers, slot)) game.characterReadiness[slot] = true;
    game.rematchReadiness[slot] = false;
  }
  game.humanFighterMask = humans;
  game.computerMask = computers;
  updateConnectedHumans(game, humans);
}

export function setComputerParticipants(game: MatchState, computers: number): void {
  if (!isParticipantMask(computers) || game.phase === Phase.match) return;
  for (const slot of PARTICIPANT_SLOTS) {
    game.characterReadiness[slot] = participantActive(computers, slot);
    game.rematchReadiness[slot] = false;
  }
  game.humanFighterMask = 0;
  game.computerMask = computers;
}

export function canCycleSlotMode(game: Readonly<MatchState>, actor: number, slot: number): boolean {
  return game.phase === Phase.characterMenu && humanPresent(game, actor) && isParticipantSlot(slot) && (actor === slot || actor === firstHumanSlot(game));
}

export function cycleSlotMode(game: MatchState, actor: number, slot: number): boolean {
  if (!isParticipantSlot(slot) || !canCycleSlotMode(game, actor, slot)) return false;
  const bit = 1 << slot;
  if (humanFighterActive(game, slot)) {
    game.humanFighterMask -= bit;
    game.computerMask += bit;
    game.cpuRandomFighters[slot] = true;
    game.characterReadiness[slot] = true;
  } else if (computerActive(game, slot)) {
    game.computerMask -= bit;
    game.characterReadiness[slot] = false;
  } else {
    game.humanFighterMask += bit;
    game.characterReadiness[slot] = false;
  }
  return true;
}

export function hasUnassignedHuman(game: Readonly<MatchState>): boolean {
  return PARTICIPANT_SLOTS.some(slot => humanFighterActive(game, slot) && !humanPresent(game, slot));
}

export function setHumanMask(game: MatchState, mask: number): void { setParticipants(game, mask, 0); }
export function setHumanCount(game: MatchState, count: number): void {
  if (count >= 1 && count <= 4) setHumanMask(game, (1 << count) - 1);
}

export function copyMatchState(target: MatchState, source: Readonly<MatchState>): void {
  copyMatchCamera(target.camera, source.camera);
  target.phase = source.phase;
  target.humanMask = source.humanMask;
  target.humanFighterMask = source.humanFighterMask;
  target.computerMask = source.computerMask;
  target.departedMask = source.departedMask;
  target.interrupted = source.interrupted;
  target.humanCount = source.humanCount;
  target.stageChoice = source.stageChoice;
  target.stageResolved = source.stageResolved;
  copyStagePool(target.stagePool, source.stagePool);
  target.hazards = source.hazards;

  target.winner = source.winner;
  target.teamBattle = source.teamBattle;
  target.friendlyFire = source.friendlyFire;
  target.stockCount = source.stockCount;
  target.timeLimitMinutes = source.timeLimitMinutes;
  target.endless = source.endless;
  target.automaticRematch = source.automaticRematch;
  target.forge = source.forge;
  target.rematchCountdown = source.rematchCountdown;
  target.remainingFrames = source.remainingFrames;
  target.matchSeed = source.matchSeed;
  target.startHold = source.startHold;
  target.matchFrame = source.matchFrame;
  target.timedOut = source.timedOut;
  target.practice = source.practice;
  target.training = source.training;
  copyTrainingState(target.trainer, source.trainer);
  copyMatchItems(target.items, source.items);
  target.ultimatesOff = source.ultimatesOff;
  copyComputerLead(target, source);
  copyMatchOrbs(target.orbs, source.orbs);
  target.arcade = source.arcade;
  target.arcadeTier = source.arcadeTier;
  copyConfiguredRun(target.run, source.run);
  for (const slot of PARTICIPANT_SLOTS) {
    target.characterChoices[slot] = source.characterChoices[slot];
    target.costumeChoices[slot] = source.costumeChoices[slot];
    target.teamChoices[slot] = source.teamChoices[slot];
    target.cpuOpponents[slot] = source.cpuOpponents[slot];
    target.cpuRandomFighters[slot] = source.cpuRandomFighters[slot];
    target.cpuTiers[slot] = source.cpuTiers[slot];
    target.cpuResolvedOpponents[slot] = source.cpuResolvedOpponents[slot];
    target.characterReadiness[slot] = source.characterReadiness[slot];
    target.rematchReadiness[slot] = source.rematchReadiness[slot];
    target.resultPicks[slot] = source.resultPicks[slot];
  }
}

export function characterFor(game: Readonly<MatchState>, slot: number): Character | undefined {
  return isParticipantSlot(slot) ? game.characterChoices[slot] : undefined;
}

export function characterReady(game: Readonly<MatchState>, slot: number): boolean {
  return isParticipantSlot(slot) && fighterActive(game, slot) && game.characterReadiness[slot] && (computerActive(game, slot) || humanPresent(game, slot));
}

export function offeredMatchCharacter(game: Readonly<MatchState>, choice: number): choice is Character {
  return isMatchCharacter(choice) && (!game.arcade || arcadeTable(choice) !== undefined);
}

export function selectableMatchCharacter(game: Readonly<MatchState>, choice: number): choice is Character {
  return offeredMatchCharacter(game, choice) && !isComingSoon(choice);
}

export function nextMatchCharacter(game: Readonly<MatchState>, current: number | undefined, direction: number): Character {
  return nextCharacterIn(shownFighters(game.arcade ? ARCADE_CHARACTERS : PLAYABLE_CHARACTERS, game.forge), current, direction);
}

export type CharacterOffer = (game: Readonly<MatchState>, choice: number) => choice is Character;

export const hazardsOn = (game: Readonly<MatchState>): boolean => game.hazards;

export const stageClock = (game: Readonly<MatchState>): number => game.hazards ? game.matchFrame : STAGE_AT_REST;

export function costumeFor(game: Readonly<MatchState>, slot: ParticipantSlot): number {
  return costumeIndex(game.characterChoices[slot], game.costumeChoices[slot]);
}

export function costumeTintFor(game: Readonly<MatchState>, slot: ParticipantSlot, character: Character | undefined): CostumeTint | undefined {
  return character === undefined ? undefined : costumeOf(character, costumeFor(game, slot)).tint;
}

export function fighterColor(game: Readonly<MatchState>, slot: ParticipantSlot): number {
  return game.teamBattle ? game.teamChoices[slot] : slot;
}

export const START_HOLD_FRAMES = 3 * MATCH_TICKS_PER_SECOND;

export const holdingStart = (game: Readonly<MatchState>): boolean => game.phase === Phase.match && game.startHold > 0 && game.matchFrame <= game.startHold;

export const arcadeRouted = (character: number): boolean => arcadeTable(character) !== undefined;
