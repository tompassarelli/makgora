import { PARTICIPANT_SLOTS, type ParticipantSlot, isParticipantSlot, participantActive } from "../input/participants";
import { type Roster, fighterAt, isActive, isContender } from "../sim/roster";
import { f32 } from "wisp/src/sim/f32";
import { fighterActive, holdingStart, humanPresent, type MatchState, Phase } from "./lobbyState";
import { keepsStocks, timedMatch } from "./matchRules";

export function winningMask(game: Readonly<MatchState>): number {
  const winner = game.winner;
  if (winner === undefined) return 0;
  if (!game.teamBattle || game.run.active) return 1 << winner;
  let mask = 0;
  for (const slot of PARTICIPANT_SLOTS) if (fighterActive(game, slot) && !participantActive(game.departedMask, slot)
    && game.teamChoices[slot] === game.teamChoices[winner]) mask |= 1 << slot;
  return mask;
}

export function participantLeft(game: MatchState, slot: number, world: Roster): void {
  if (!isParticipantSlot(slot) || !humanPresent(game, slot)) return;
  game.departedMask += 1 << slot;
  game.rematchReadiness[slot] = false;
  game.rematchCountdown = 0;
  if (game.phase !== Phase.match) return;
  game.interrupted = true;
  game.timedOut = false;
  game.winner = undefined;
  let survivor: ParticipantSlot | undefined;
  let contested = false;
  for (const fighter of PARTICIPANT_SLOTS) {
    if (isContender(world, fighter) && !participantActive(game.departedMask, fighter) && fighterAt(world, fighter).status.stocks > 0) {
      if (survivor !== undefined && (!game.teamBattle || game.teamChoices[survivor] !== game.teamChoices[fighter])) contested = true;
      survivor = fighter;
    }
  }
  game.winner = contested ? undefined : survivor;
  game.phase = Phase.result;
}

function resolveRemaining(game: MatchState, world: Roster): void {
  let survivor: ParticipantSlot | undefined;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isContender(world, slot) || participantActive(game.departedMask, slot) || fighterAt(world, slot).status.stocks <= 0) continue;
    if (survivor !== undefined && (!game.teamBattle || game.teamChoices[survivor] !== game.teamChoices[slot])) return;
    survivor = slot;
  }
  game.winner = survivor;
  game.phase = Phase.result;
}

export function resolveStocks(game: MatchState, world: Roster): void {
  if (game.phase === Phase.match && !keepsStocks(game)) resolveRemaining(game, world);
}

function teamStocksAndDamage(game: MatchState, world: Roster, team: number): { readonly stocks: number; readonly damage: number } {
  let stocks = 0;
  let damage = 0.0;
  for (const member of PARTICIPANT_SLOTS) {
    if (!isContender(world, member) || participantActive(game.departedMask, member) || game.teamChoices[member] !== team) continue;
    const fighter = fighterAt(world, member);
    stocks += fighter.status.stocks;
    if (fighter.status.stocks > 0) damage = f32(damage + fighter.status.damage);
  }
  return { stocks, damage };
}

function leadingTeamSlot(game: MatchState, world: Roster): ParticipantSlot | undefined {
  let best: ParticipantSlot | undefined;
  let bestStocks = 0;
  let bestDamage = 0.0;
  let tied = false;
  let seen = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isContender(world, slot) || participantActive(game.departedMask, slot)) continue;
    const team = game.teamChoices[slot];
    const bit = 1 << team;
    if ((seen & bit) !== 0) continue;
    seen |= bit;
    const { stocks, damage } = teamStocksAndDamage(game, world, team);
    if (best === undefined || stocks > bestStocks || stocks === bestStocks && damage < bestDamage) {
      best = slot;
      bestStocks = stocks;
      bestDamage = damage;
      tied = false;
    } else if (stocks === bestStocks && damage === bestDamage) tied = true;
  }
  return tied ? undefined : best;
}

function leadingFighterSlot(world: Roster): ParticipantSlot | undefined {
  let best: ParticipantSlot | undefined;
  let tied = false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isContender(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    if (best === undefined) { best = slot; continue; }
    const leader = fighterAt(world, best);
    if (fighter.status.stocks > leader.status.stocks || (fighter.status.stocks === leader.status.stocks && fighter.status.damage < leader.status.damage)) {
      best = slot;
      tied = false;
    } else if (fighter.status.stocks === leader.status.stocks && fighter.status.damage === leader.status.damage) tied = true;
  }
  return tied ? undefined : best;
}

export function advanceClock(game: MatchState, world: Roster): void {
  if (game.phase !== Phase.match || !timedMatch(game) || holdingStart(game)) return;
  game.remainingFrames--;
  if (game.remainingFrames > 0) return;
  game.remainingFrames = 0;
  game.timedOut = true;
  game.winner = game.teamBattle ? leadingTeamSlot(game, world) : leadingFighterSlot(world);
  game.phase = Phase.result;
}

export function forfeit(game: MatchState, losingSlot: number, world: Roster): void {
  if (!isActive(world, losingSlot)) return;
  const fighter = fighterAt(world, losingSlot);
  fighter.status.stocks = 0;
  fighter.status.out = true;
  resolveRemaining(game, world);
  game.rematchReadiness.fill(false);
}
