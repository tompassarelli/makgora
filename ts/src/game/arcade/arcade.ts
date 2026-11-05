import { at } from "wisp/src/runtime/lookup";
import { idiv } from "wisp/src/sim/intMath";
import type { Character } from "../sim/codes";
import { CPU_TIERS } from "../match/cpuProfiles";
import { type MatchState, Phase, characterReady, firstHumanSlot } from "../lobby/lobbyState";
import { endConfiguredRun } from "../lobby/matchMode";
import { fighterName } from "../roster/kits";
import { applyConfiguredMatch, beginConfiguredRun } from "./configuredMatch";
import { arcadePlan, stageOpponent } from "./plan";
import { ARCADE_SPINE, FINAL_STAGE, nextPlayableStage } from "./spine";
import { type ConfiguredMatch, type ConfiguredOpponent, RunOutcome, WinCondition } from "./runState";
import { arcadeTable } from "./tables";

export const WARCHIEF_TIER = CPU_TIERS.length - 1;
export const continuesAllowed = (tier: number): boolean => tier < WARCHIEF_TIER;

function arcadeEntry(fighter: Character, seed: number, stage: number, tier: number): ConfiguredMatch {
  const spine = at(ARCADE_SPINE, stage);
  const plans = arcadePlan(fighter, seed);
  const plan = at(plans, stage);
  const opponent = stageOpponent(plans, stage);
  const opponents: ConfiguredOpponent[] = opponent === undefined ? [] : [{ character: opponent, opponent: "wren", tier: at(CPU_TIERS, tier), stocks: spine.opponentStocks }];
  return {
    id: `arcade.${fighter}.${stage}.${tier}`, opponents, stage: plan.arena, stocks: spine.opponentStocks, playerStocks: spine.playerStocks,
    timeMinutes: idiv(spine.clockSeconds, 60), playerDamage: 0, hazards: true, win: WinCondition.ko, last: stage === FINAL_STAGE,
    reactionLead: spine.reactionLead, speaker: opponents[0] === undefined ? "" : fighterName(opponents[0].character), intro: plan.line,
  };
}

export function startArcade(game: MatchState, slot: number): boolean {
  const first = firstHumanSlot(game);
  if (game.phase !== Phase.characterMenu || !game.arcade || game.run.active || first === undefined || slot !== first || !characterReady(game, slot)) return false;
  const fighter = game.characterChoices[first];
  if (arcadeTable(fighter) === undefined) return false;
  beginConfiguredRun(game, first, fighter);
  game.run.tier = game.arcadeTier;
  game.run.seed = game.matchSeed;
  applyConfiguredMatch(game, arcadeEntry(fighter, game.run.seed, game.run.fight, game.run.tier));
  return true;
}

export const ArcadeStep = { none: 0, fight: 1, menu: 2 } as const;
export type ArcadeStep = (typeof ArcadeStep)[keyof typeof ArcadeStep];

export function continueArcade(game: MatchState, slot: number): ArcadeStep {
  const { run } = game;
  if (game.phase !== Phase.result || !run.active || slot !== run.player) return ArcadeStep.none;
  const lost = run.outcome !== RunOutcome.won;
  if (run.cleared || (lost && !continuesAllowed(run.tier))) {
    endConfiguredRun(game);
    return ArcadeStep.menu;
  }
  if (lost) run.continues++;
  else run.fight = nextPlayableStage(run.fight);
  applyConfiguredMatch(game, arcadeEntry(run.fighter, run.seed, run.fight, run.tier));
  return ArcadeStep.fight;
}

export function quitArcade(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.result || !game.run.active || slot !== game.run.player) return false;
  endConfiguredRun(game);
  return true;
}

export function skipToArcadeStage(game: MatchState, stage: number): void {
  const { run } = game;
  if (!run.active || game.phase !== Phase.stageMenu) return;
  run.fight = nextPlayableStage(Math.max(0, Math.min(FINAL_STAGE, stage - 1)) - 1);
  applyConfiguredMatch(game, arcadeEntry(run.fighter, run.seed, run.fight, run.tier));
}
