



import { at } from "wisp/src/runtime/lookup";
import { CPU_TIERS, type CpuOpponentId, type CpuTier } from "../match/cpuProfiles";
import { type MatchState, Phase, characterReady, endConfiguredRun, firstHumanSlot } from "../lobby/lobbyState";
import { fighterName } from "../roster/kits";
import { bossDefinition, bossHealth } from "./bosses";
import { applyConfiguredMatch, beginConfiguredRun } from "./configuredMatch";
import { classicRoute, type ClassicRoute } from "./routes";
import { BossKind, type ConfiguredMatch, type ConfiguredOpponent, RunOutcome, WinCondition } from "./runState";


export const CLASSIC_FIGHTS = 6;

export const CLASSIC_TIERS: readonly CpuTier[] = ["beginner", "beginner", "intermediate", "intermediate", "advanced", "advanced"];

const IDENTITIES: readonly CpuOpponentId[] = ["vale", "ember", "flint", "kite", "rook"];

const PLAYER_STOCKS: readonly number[] = [1, 1, 1, 2, 2, 2];
const RIVAL_STOCKS: readonly number[] = [1, 1, 1, 1, 2];
const FIGHT_MINUTES: readonly number[] = [3, 3, 3, 3, 4, 5];

const fightTier = (fight: number): number => CPU_TIERS.indexOf(at(CLASSIC_TIERS, fight));


function classicEntry(route: Readonly<ClassicRoute>, fight: number): ConfiguredMatch {
  const level = fightTier(fight);
  const last = fight === CLASSIC_FIGHTS - 1;
  const id = `classic.${route.fighter}.${fight}.${level}`;
  if (last) {
    const boss = bossDefinition(route.boss);
    return {
      id, opponents: [], stage: boss?.stage ?? 2, stocks: at(PLAYER_STOCKS, fight), timeMinutes: at(FIGHT_MINUTES, fight), playerDamage: 0,
      hazards: false, win: WinCondition.defeatBoss, boss: route.boss, bossHealth: bossHealth(route.boss, level), last: true,
      speaker: boss?.name ?? "", intro: boss?.intro ?? "",
    };
  }
  const plan = at(route.fights, fight);
  const opponents: ConfiguredOpponent[] = plan.rivals.map((character, index) => ({
    character, opponent: index === 0 ? at(IDENTITIES, fight) : "wren", tier: at(CLASSIC_TIERS, fight), stocks: at(RIVAL_STOCKS, fight),
  }));
  return {
    id, opponents, stage: plan.stage, stocks: at(PLAYER_STOCKS, fight), timeMinutes: at(FIGHT_MINUTES, fight), playerDamage: 0,
    hazards: true, win: WinCondition.ko, boss: BossKind.none, bossHealth: 0, last: false,
    speaker: fighterName(at(plan.rivals, 0)), intro: plan.line,
  };
}


const runRoute = (game: Readonly<MatchState>): ClassicRoute | undefined => (game.run.active ? classicRoute(game.run.fighter) : undefined);


export function startClassic(game: MatchState, slot: number): boolean {
  const first = firstHumanSlot(game);
  if (game.phase !== Phase.characterMenu || !game.classic || game.run.active || first === undefined || slot !== first || !characterReady(game, slot)) return false;
  const fighter = game.characterChoices[first];
  const route = classicRoute(fighter);
  if (route === undefined) return false;
  beginConfiguredRun(game, first, fighter);
  applyConfiguredMatch(game, classicEntry(route, 0));
  return true;
}

export const ClassicStep = { none: 0, fight: 1, menu: 2 } as const;
export type ClassicStep = (typeof ClassicStep)[keyof typeof ClassicStep];





export function continueClassic(game: MatchState, slot: number): ClassicStep {
  const { run } = game;
  const route = runRoute(game);
  if (game.phase !== Phase.result || route === undefined || slot !== run.player) return ClassicStep.none;
  if (run.cleared) {
    endConfiguredRun(game);
    return ClassicStep.menu;
  }
  if (run.outcome === RunOutcome.won) run.fight++;
  else run.continues++;
  applyConfiguredMatch(game, classicEntry(route, run.fight));
  return ClassicStep.fight;
}


export function quitClassic(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.result || !game.run.active || slot !== game.run.player) return false;
  endConfiguredRun(game);
  return true;
}


export function skipToClassicBoss(game: MatchState): void {
  const route = runRoute(game);
  if (route === undefined || game.phase !== Phase.stageMenu) return;
  game.run.fight = CLASSIC_FIGHTS - 1;
  applyConfiguredMatch(game, classicEntry(route, game.run.fight));
}
