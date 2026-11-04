import { RANDOM_STAGE } from "../menu/stageCatalog";
import { PARTICIPANT_SLOTS, isParticipantSlot } from "../input/participants";
import { scheduleMatchItems } from "../match/centreItem";
import { resetMatchOrbs } from "../sim/orbState";
import { nextMatchSeed } from "../match/botRandom";
import { resolveCpuOpponent } from "../match/cpuProfiles";
import { clearTrainingReadout } from "../match/trainingState";
import { firstHumanSlot, humanActive, humanPresent, MATCH_TICKS_PER_SECOND, type MatchState, Phase, ResultPick, START_HOLD_FRAMES } from "./lobbyState";
import { drawCpuFighters } from "./characterChoice";
import { allCharactersReady, practiceSelected } from "./characterReadiness";
import { resolveStageChoice } from "./stageSelect";
import { timedMatch } from "./matchRules";

function beginMatch(game: MatchState, keepCpuFighters = false): void {
  game.winner = undefined;
  game.interrupted = false;
  game.departedMask = 0;
  game.timedOut = false;
  game.rematchCountdown = 0;
  game.practice = !game.training && !game.run.active && practiceSelected(game);
  clearTrainingReadout(game.trainer);
  game.remainingFrames = timedMatch(game) ? game.timeLimitMinutes * 60 * MATCH_TICKS_PER_SECOND : 0;

  if (game.matchFrame > 0) game.matchSeed = nextMatchSeed(game.matchSeed);
  resolveStageChoice(game, game.matchSeed);
  for (const slot of PARTICIPANT_SLOTS) game.cpuResolvedOpponents[slot] = resolveCpuOpponent(game.cpuOpponents[slot], game.matchSeed, slot);
  if (!keepCpuFighters) drawCpuFighters(game);
  game.startHold = game.practice || game.training ? 0 : START_HOLD_FRAMES;
  game.matchFrame = 0;
  game.phase = Phase.match;
  scheduleMatchItems(game);
  resetMatchOrbs(game.orbs);
}

export const canRequestStart = (game: Readonly<MatchState>, slot: number): boolean =>
  game.phase === Phase.stageMenu && humanActive(game, slot) && allCharactersReady(game);

export function requestStart(game: MatchState, slot: number): boolean {
  if (!canRequestStart(game, slot)) return false;
  resolveStageChoice(game);
  beginMatch(game);
  return true;
}

export function leaveMatch(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.match || !(game.practice ? slot === firstHumanSlot(game) : (game.endless || game.training) && humanPresent(game, slot))) return false;
  game.phase = Phase.characterMenu;
  game.practice = false;
  game.trainer.lesson = -1;
  return true;
}

export const REMATCH_COUNTDOWN_SECONDS = 5;

export function beginRematchCountdown(game: MatchState, seconds: number): void {
  game.rematchCountdown = game.phase === Phase.result && game.automaticRematch && !game.interrupted && !game.run.active ? seconds * MATCH_TICKS_PER_SECOND : 0;
}

export function cancelRematchCountdown(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.result || game.rematchCountdown === 0 || !humanPresent(game, slot)) return false;
  game.rematchCountdown = 0;
  return true;
}

export function tickRematchCountdown(game: MatchState): boolean {
  if (game.phase !== Phase.result || game.rematchCountdown === 0) return false;
  game.rematchCountdown--;
  if (game.rematchCountdown > 0 || !allCharactersReady(game)) return false;
  game.rematchReadiness.fill(false);
  game.stageChoice = RANDOM_STAGE;
  game.stageResolved = false;
  beginMatch(game, true);
  return true;
}

export const resultChoicesOpen = (game: Readonly<MatchState>): boolean => game.phase === Phase.result && !game.run.active && game.rematchCountdown === 0;

export function confirmRematch(game: MatchState, slot: number, pick: ResultPick = ResultPick.characters): boolean {
  if (game.phase !== Phase.result || !isParticipantSlot(slot) || !humanPresent(game, slot)) return false;
  game.rematchReadiness[slot] = true;
  game.resultPicks[slot] = pick;
  const present = PARTICIPANT_SLOTS.filter(participant => humanPresent(game, participant));
  if (pick !== ResultPick.characters && present.some(participant => !game.rematchReadiness[participant])) return false;
  const agreed = present.every(participant => game.resultPicks[participant] === pick) ? pick : ResultPick.characters;
  game.rematchReadiness.fill(false);
  game.resultPicks.fill(ResultPick.characters);
  if (agreed === ResultPick.rematch && allCharactersReady(game) && game.stageResolved) beginMatch(game, true);
  else if (agreed === ResultPick.newStage && allCharactersReady(game)) {
    game.stageChoice = RANDOM_STAGE;
    game.stageResolved = false;
    game.phase = Phase.stageMenu;
  } else game.phase = Phase.characterMenu;
  return true;
}
