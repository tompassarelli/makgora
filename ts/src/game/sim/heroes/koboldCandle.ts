import { idiv, imod } from "wisp/src/sim/intMath";
import { max, min, toInt } from "../../../runtime/numbers";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { CandleState, Character } from "../codes";
import type { Fighter } from "../fighter";
import { type Roster, fighterAt, isActive } from "../roster";

export const CANDLE_MAX_HEAT = 300;
export const CANDLE_LEVEL_HEAT = 75;
export const CANDLE_MAX_LEVEL = 3;
export const CANDLE_HEAT_PER_DAMAGE = 8;
export const CANDLE_HIT_HEAT_CAP = 75;
export const CANDLE_DECAY_EVERY = 3;

export function candleLevel(f: Readonly<Fighter>): number {
  return min(CANDLE_MAX_LEVEL, idiv(f.candle.heat, CANDLE_LEVEL_HEAT));
}

export function candleHeatGain(source: Readonly<Fighter>, damage: number): number {
  if (source.character !== Character.kobold || source.candle.state !== CandleState.held || damage <= 0) return 0;
  return min(CANDLE_HIT_HEAT_CAP, CANDLE_HEAT_PER_DAMAGE * toInt(damage));
}

export function feedCandle(f: Fighter, gain: number): void {
  f.candle.heat = min(CANDLE_MAX_HEAT, f.candle.heat + gain);
}

export function resetCandle(f: Fighter): void {
  const candle = f.candle;
  candle.heat = 0;
  candle.state = CandleState.held;
  candle.lit = true;
  candle.x = 0.0;
  candle.z = 0.0;
  candle.vx = 0.0;
  candle.vz = 0.0;
  candle.surface = undefined;
  candle.timer = 0;
  candle.away = 0;
  candle.guard = 0;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) candle.struck[slot] = undefined;
  candle.specialStruck = 0;
}

export function advanceCandleBodies(world: Roster, stage: number): void {
}

export function settleCandles(world: Roster, matchFrame: number): void {
  if (imod(matchFrame, CANDLE_DECAY_EVERY) !== 0) return;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const candle = fighterAt(world, slot).candle;
    if (candle.state === CandleState.held) candle.heat = max(0, candle.heat - 1);
  }
}
