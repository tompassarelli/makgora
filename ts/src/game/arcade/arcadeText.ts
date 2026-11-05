import { at } from "wisp/src/runtime/lookup";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { MATCH_TICKS_PER_SECOND, type MatchState } from "../lobby/lobbyState";
import { CPU_TIERS } from "../match/cpuProfiles";
import { fighterName } from "../roster/kits";
import { WARCHIEF_TIER, continuesAllowed } from "./arcade";
import { ARCADE_SPINE, ARCADE_STAGES, FINAL_STAGE, StageKind, nextPlayableStage } from "./spine";
import { RunOutcome } from "./runState";
import { arcadeTable } from "./tables";

export const ARCADE_PREMISE = "The Horde won the world, and now every race fights up through the war bands for the right to challenge the Warchief.";

const STAGE_TITLES: Readonly<Record<StageKind, string>> = { [StageKind.hallway]: "Hallway", [StageKind.elite]: "Elite", [StageKind.bonus]: "Bonus", [StageKind.rival]: "Rival" };

export const tierName = (tier: number): string => {
  const name = at(CPU_TIERS, Math.max(0, Math.min(WARCHIEF_TIER, tier)));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
};
export const shownTier = (game: Readonly<MatchState>): number => (game.run.active ? game.run.tier : game.arcadeTier);

export const arcadeTierSetting = (tier: number): string => `Arcade tier: ${tierName(tier)}`;

export function arcadeRouteSummary(character: number): string {
  const table = arcadeTable(character);
  return table === undefined ? "" : `A run of ${ARCADE_STAGES} stages ending on your rival: ${fighterName(table.rival)}`;
}

export function stageTitle(stage: number): string {
  return `Stage ${stage + 1} of ${ARCADE_STAGES} · ${STAGE_TITLES[at(ARCADE_SPINE, stage).kind]}`;
}

export function arcadeIntro(game: Readonly<MatchState>): string {
  const entry = game.run.current;
  if (entry === undefined) return "";
  const title = stageTitle(game.run.fight);
  if (entry.intro !== "") return `${title} — ${entry.speaker}: "${entry.intro}"`;
  return game.run.fight === 0 ? `${title}. ${ARCADE_PREMISE}` : `${title} — ${entry.speaker}`;
}

export function runTime(frames: number): string {
  const seconds = floorDiv(frames, MATCH_TICKS_PER_SECOND);
  const rest = floorMod(seconds, 60);
  return `${floorDiv(seconds, 60)}:${rest < 10 ? "0" : ""}${rest}`;
}

export function arcadeResults(game: Readonly<MatchState>): string {
  const { run } = game;
  const continues = run.continues === 1 ? "1 continue" : `${run.continues} continues`;
  return `Time ${runTime(run.frames)} · ${Math.floor(run.damageTaken)}% damage taken · ${continues} · ${tierName(run.tier)}`;
}

export function arcadeEnding(game: Readonly<MatchState>): { speaker: string; results: string } {
  return { speaker: fighterName(game.run.fighter), results: arcadeResults(game) };
}

export function arcadeResultMessage(game: Readonly<MatchState>): string {
  const { run } = game;
  if (run.cleared) return `${fighterName(run.fighter)} cleared Arcade!`;
  if (run.outcome === RunOutcome.won) return `Stage ${run.fight + 1} cleared!`;
  return continuesAllowed(run.tier) ? "Defeated." : `Defeated at stage ${run.fight + 1} of ${ARCADE_STAGES}.`;
}

export function arcadeResultHelp(game: Readonly<MatchState>, confirm: string): string {
  const { run } = game;
  if (run.cleared) return `Press ${confirm} to return to fighter selection.`;
  if (run.outcome === RunOutcome.won) {
    const next = nextPlayableStage(run.fight);
    return `Press ${confirm} for ${next === FINAL_STAGE ? "your rival" : `stage ${next + 1}`}. Back ends the run.`;
  }
  return continuesAllowed(run.tier) ? `Press ${confirm} to try this stage again. Back ends the run.` : `Press ${confirm} to return to fighter selection.`;
}
