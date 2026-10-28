import { f32 } from "wisp/src/sim/f32";
import { MATCH_TICKS_PER_SECOND, type MatchState, Phase, createMatchState, setComputerParticipants } from "../lobby/lobbyState";
import type { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { type Roster, createRoster } from "../sim/roster";
import type { CpuOpponentId, CpuTier } from "./cpuProfiles";
import { resetMatchOrbs } from "../sim/orbState";
import { initializeMatchFighters, matchSpawnX } from "./step";

export interface FieldMatchRules {
  readonly stage: number;
  readonly seed: number;
  readonly shift?: number;
  readonly opponents?: readonly [CpuOpponentId, CpuOpponentId];
  readonly tiers?: readonly [CpuTier, CpuTier];
  readonly stocks?: number | undefined;
  readonly minutes?: number | undefined;
  readonly orbs?: boolean | undefined;
}

export const fieldSpawnX = (slot: 0 | 1, shift = 0.0): number => f32(matchSpawnX(slot) + shift);

export function fieldMatch(a: Character, b: Character, rules: FieldMatchRules): { readonly match: MatchState; readonly world: Roster } {
  const match = createMatchState();
  setComputerParticipants(match, 3);
  match.characterChoices[0] = a;
  match.characterChoices[1] = b;
  match.stageChoice = rules.stage;
  const opponents = rules.opponents ?? ["wren", "wren"];
  const tiers = rules.tiers ?? ["expert", "expert"];
  for (const slot of [0, 1] as const) {
    match.cpuOpponents[slot] = opponents[slot];
    match.cpuResolvedOpponents[slot] = opponents[slot];
    match.cpuTiers[slot] = tiers[slot];
  }
  match.matchSeed = rules.seed;
  match.stockCount = rules.stocks ?? 3;
  match.timeLimitMinutes = rules.minutes ?? 4;
  match.remainingFrames = match.timeLimitMinutes * 60 * MATCH_TICKS_PER_SECOND;
  match.phase = Phase.match;
  match.orbs.on = rules.orbs === true;
  resetMatchOrbs(match.orbs);
  const world = createRoster(3, [createFighter(a, fieldSpawnX(0, rules.shift), 1), createFighter(b, fieldSpawnX(1, rules.shift), -1)]);
  initializeMatchFighters(match, world);
  return { match, world };
}
