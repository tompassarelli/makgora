import type { CpuTier } from "../match/cpuProfiles";

export type FightKind = "hallway" | "stamina" | "team" | "rival";

export const CLEAR_POINTS = 1000;
export const SPEED_POINTS_PER_SECOND = 10;
export const DAMAGE_POINTS = 3000;
export const DAMAGE_POINTS_PER_PERCENT = 10;
export const BONUS_POINTS_PER_DAMAGE = 10;
export const BONUS_POINTS_PER_COMBO_HIT = 100;
export const CONTINUE_PENALTY = 2000;

export const PAR_SECONDS: Readonly<Record<FightKind, number>> = { hallway: 90, stamina: 180, team: 180, rival: 150 };

export interface ClearedFight {
  readonly kind: FightKind;
  readonly seconds: number;
}

export interface RunStats {
  readonly tier: CpuTier;
  readonly fights: readonly ClearedFight[];
  readonly damageTaken: number;
  readonly bonusDamage: number;
  readonly bonusCombo: number;
  readonly continues: number;
  readonly runSeconds: number;
}

export interface ScoreTerms {
  readonly clears: number;
  readonly speed: number;
  readonly damage: number;
  readonly bonus: number;
  readonly continues: number;
  readonly total: number;
}

export interface RunScore {
  readonly total: number;
  readonly runSeconds: number;
}

export function scoreRun(run: RunStats): ScoreTerms {
  let speed = 0;
  for (const fight of run.fights) speed += Math.max(0, SPEED_POINTS_PER_SECOND * (PAR_SECONDS[fight.kind] - fight.seconds));
  const clears = CLEAR_POINTS * run.fights.length;
  const damage = Math.max(0, DAMAGE_POINTS - DAMAGE_POINTS_PER_PERCENT * run.damageTaken);
  const bonus = BONUS_POINTS_PER_DAMAGE * run.bonusDamage + BONUS_POINTS_PER_COMBO_HIT * run.bonusCombo;
  const continues = -CONTINUE_PENALTY * run.continues;
  return { clears, speed, damage, bonus, continues, total: clears + speed + damage + bonus + continues };
}

export function beatsScore(candidate: RunScore, best: RunScore | undefined): boolean {
  if (best === undefined) return true;
  if (candidate.total !== best.total) return candidate.total > best.total;
  return candidate.runSeconds < best.runSeconds;
}
