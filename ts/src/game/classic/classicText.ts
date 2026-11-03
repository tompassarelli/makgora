

import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { MATCH_TICKS_PER_SECOND, type MatchState } from "../lobby/lobbyState";
import { fighterName } from "../roster/kits";
import { bossDefinition } from "./bosses";
import { CLASSIC_FIGHTS } from "./classic";
import { classicRoute } from "./routes";
import { RunOutcome } from "./runState";

export const levelName = (tier: number): string => `Level ${tier + 1}`;
export const classicLevel = (game: Readonly<MatchState>): number => (game.run.active ? game.run.tier : game.classicTier);


export const classicTierSetting = (tier: number): string => `Classic start: ${levelName(tier)}`;


export function classicRouteSummary(character: number): string {
  const route = classicRoute(character);
  if (route === undefined) return "";
  return `${route.story}\nFinal battle: ${bossDefinition(route.boss)?.name ?? ""}`;
}


export function classicIntro(game: Readonly<MatchState>): string {
  const entry = game.run.current;
  if (entry === undefined) return "";
  const round = game.run.fight === CLASSIC_FIGHTS - 1 ? "Final battle" : `Round ${game.run.fight + 1} of ${CLASSIC_FIGHTS}`;
  return `${round} — ${entry.speaker}: "${entry.intro}"`;
}


export function runTime(frames: number): string {
  const seconds = floorDiv(frames, MATCH_TICKS_PER_SECOND);
  const rest = floorMod(seconds, 60);
  return `${floorDiv(seconds, 60)}:${rest < 10 ? "0" : ""}${rest}`;
}


export function classicResults(game: Readonly<MatchState>): string {
  const { run } = game;
  const continues = run.continues === 1 ? "1 continue" : `${run.continues} continues`;
  return `Time ${runTime(run.frames)} · ${Math.floor(run.damageTaken)}% damage taken · ${continues} · ${levelName(run.tier)}`;
}


export function classicEnding(game: Readonly<MatchState>): { speaker: string; lines: readonly string[]; results: string } {
  const route = classicRoute(game.run.fighter);
  return { speaker: fighterName(game.run.fighter), lines: route?.ending ?? [], results: classicResults(game) };
}


export function classicResultMessage(game: Readonly<MatchState>): string {
  const { run } = game;
  if (run.cleared) return `${fighterName(run.fighter)} cleared Classic!`;
  if (run.outcome === RunOutcome.won) return `Round ${run.fight + 1} cleared!`;
  return "Defeated.";
}


export function classicResultHelp(game: Readonly<MatchState>, confirm: string): string {
  const { run } = game;
  if (run.cleared) return `Press ${confirm} to return to fighter selection.`;
  if (run.outcome === RunOutcome.won) {
    const next = run.fight + 1 === CLASSIC_FIGHTS - 1 ? "the final battle" : `round ${run.fight + 2}`;
    return `Press ${confirm} for ${next}. Back ends the run.`;
  }
  return `Press ${confirm} to try this fight again. Back ends the run.`;
}


