import { max, min } from "../core/numbers";
import { floorMod } from "wisp/src/sim/intMath";
import type { Fighter } from "./fighter";


export const ROSTER_MANA = { max: 100, exCost: 33, segments: 3, trickleFrames: 150, dropGain: 18 } as const;

export function spendMana(f: Fighter, cost: number): void {
  if (cost > 0) f.mana.points = max(0, f.mana.points - cost);
}

export function gainMana(f: Fighter, points: number): void {
  if (points > 0 && !f.status.out) f.mana.points = min(ROSTER_MANA.max, f.mana.points + points);
}

export function drainMana(f: Fighter, points: number): void {
  f.mana.points = max(0, f.mana.points - points);
}

export const trickleDue = (playedFrames: number): boolean => playedFrames > 0 && floorMod(playedFrames, ROSTER_MANA.trickleFrames) === 0;
