import { max, min } from "../core/numbers";
import { toInt } from "wisp/src/sim/binary32";
import { idiv } from "wisp/src/sim/intMath";
import type { Fighter } from "./fighter";


export const ROSTER_MANA = { max: 100, exCost: 33, segments: 3, dealtPoints: 1, dealtPercent: 1, dealtCap: 12, takenPoints: 1, takenPercent: 2, takenCap: 6 } as const;

export function spendMana(f: Fighter, cost: number): void {
  if (cost > 0) f.mana.points = max(0, f.mana.points - cost);
}

export function gainMana(f: Fighter, points: number): void {
  if (points > 0 && !f.status.out) f.mana.points = min(ROSTER_MANA.max, f.mana.points + points);
}

export function drainMana(f: Fighter, points: number): void {
  f.mana.points = max(0, f.mana.points - points);
}

export function dealtManaGain(damage: number): number {
  return min(ROSTER_MANA.dealtCap, idiv(toInt(max(0.0, damage)) * ROSTER_MANA.dealtPoints, ROSTER_MANA.dealtPercent));
}

export function takenManaGain(damage: number): number {
  return min(ROSTER_MANA.takenCap, idiv(toInt(max(0.0, damage)) * ROSTER_MANA.takenPoints, ROSTER_MANA.takenPercent));
}
