import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { max, min, toInt } from "../../core/numbers";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { CandleState, Character } from "../codes";
import type { Fighter } from "../fighter";
import { type Roster, fighterAt, isActive } from "../roster";
import { surfaceCount, surfaceLeft, surfaceRight, surfaceShiftX, surfaceZAt } from "../stage";
import { stageBounds } from "../stageBounds";
import { bodyTop } from "../surfaces";
import { melee } from "../tuning";

export const CANDLE_MAX_HEAT = 300;
export const CANDLE_LEVEL_HEAT = 75;
export const CANDLE_MAX_LEVEL = 3;
export const CANDLE_HEAT_PER_DAMAGE = 8;
export const CANDLE_HIT_HEAT_CAP = 75;
export const CANDLE_DECAY_EVERY = 3;
export const CANDLE_DROP_KNOCKBACK = 140.0;
export const CANDLE_GUARD_FRAMES = 180;
export const CANDLE_UNTOUCHED_FRAMES = 300;
export const CANDLE_AWAY_FRAMES = 600;
export const CANDLE_PICKUP_DELAY = 20;
export const CANDLE_POP_HEIGHT = 40.0;
export const CANDLE_POP_SPEED = 2.5;
export const CANDLE_POP_RISE = 7.0;
export const CANDLE_GRAVITY = 0.5;
export const CANDLE_FALL_SPEED = 8.0;
export const CANDLE_TOUCH_REACH = 30.0;
const CANDLE_TOUCH_HEIGHT = melee(10.0);
export const CANDLE_BARE_VARIANT = 4;

export function candleLevel(f: Readonly<Fighter>): number {
  return min(CANDLE_MAX_LEVEL, idiv(f.candle.heat, CANDLE_LEVEL_HEAT));
}

export function specialVariant(f: Readonly<Fighter>): number {
  if (f.character !== Character.kobold) return 0;
  return f.candle.state !== CandleState.held ? CANDLE_BARE_VARIANT : candleLevel(f);
}

export function candleHeatGain(source: Readonly<Fighter>, damage: number): number {
  if (source.character !== Character.kobold || source.candle.state !== CandleState.held || damage <= 0) return 0;
  return min(CANDLE_HIT_HEAT_CAP, CANDLE_HEAT_PER_DAMAGE * toInt(damage));
}

export function feedCandle(f: Fighter, gain: number): void {
  f.candle.heat = min(CANDLE_MAX_HEAT, f.candle.heat + gain);
}

export function candleDrops(target: Readonly<Fighter>, knockback: number): boolean {
  return target.character === Character.kobold && target.candle.state === CandleState.held && target.candle.guard === 0 && knockback >= CANDLE_DROP_KNOCKBACK;
}

export function dropCandle(f: Fighter): void {
  const candle = f.candle;
  const { x } = f.motion;
  candle.state = CandleState.airborne;
  candle.x = x;
  candle.z = f32(f.motion.z + CANDLE_POP_HEIGHT);
  candle.vx = f32((x > 0 ? -1 : x < 0 ? 1 : -f.facing) * CANDLE_POP_SPEED);
  candle.vz = CANDLE_POP_RISE;
  candle.surface = undefined;
  candle.timer = CANDLE_UNTOUCHED_FRAMES;
  candle.away = 0;
  candle.dropSerial++;
}

function holdCandle(f: Fighter): void {
  const candle = f.candle;
  candle.state = CandleState.held;
  candle.x = 0.0;
  candle.z = 0.0;
  candle.vx = 0.0;
  candle.vz = 0.0;
  candle.surface = undefined;
  candle.timer = 0;
  candle.away = 0;
  candle.guard = CANDLE_GUARD_FRAMES;
  candle.returnSerial++;
}

function touchesCandle(f: Readonly<Fighter>): boolean {
  const { candle } = f;
  const { x, z } = f.motion;
  return Math.abs(f32(x - candle.x)) <= CANDLE_TOUCH_REACH
    && z <= f32(candle.z + CANDLE_TOUCH_HEIGHT) && z >= f32(candle.z - melee(bodyTop(f.character)));
}

function canTakeCandle(f: Readonly<Fighter>): boolean {
  const { candle } = f;
  return (candle.state === CandleState.airborne || candle.state === CandleState.resting) && candle.away >= CANDLE_PICKUP_DELAY
    && !f.status.out && f.grab.owner === undefined && f.status.frozenFrames <= 0 && f.launch.hitlag === 0 && f.launch.hitstun === 0 && touchesCandle(f);
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

function landCandle(candle: Fighter["candle"], stage: number, frame: number, previousZ: number): void {
  let landing: number | undefined;
  let landingZ = 0.0;
  for (let surface = 0; surface < surfaceCount(stage); surface++) {
    if (candle.x < surfaceLeft(stage, surface, frame) || candle.x > surfaceRight(stage, surface, frame)) continue;
    const z = surfaceZAt(stage, surface, frame, candle.x);
    if (previousZ >= z && candle.z <= z && (landing === undefined || z > landingZ)) {
      landing = surface;
      landingZ = z;
    }
  }
  if (landing === undefined) return;
  candle.state = CandleState.resting;
  candle.surface = landing;
  candle.z = landingZ;
  candle.vx = 0.0;
  candle.vz = 0.0;
}

export function advanceCandleBodies(world: Roster, stage: number, frame: number): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const candle = fighterAt(world, slot).candle;
    if (candle.state === CandleState.resting && candle.surface !== undefined) {
      const surface = candle.surface;
      candle.x = f32(candle.x + surfaceShiftX(stage, surface, frame));
      if (candle.x >= surfaceLeft(stage, surface, frame) && candle.x <= surfaceRight(stage, surface, frame)) {
        candle.z = surfaceZAt(stage, surface, frame, candle.x);
        continue;
      }
      candle.state = CandleState.airborne;
      candle.surface = undefined;
    }
    if (candle.state !== CandleState.airborne) continue;
    const previousZ = candle.z;
    candle.vz = max(-CANDLE_FALL_SPEED, f32(candle.vz - CANDLE_GRAVITY));
    candle.x = f32(candle.x + candle.vx);
    candle.z = f32(candle.z + candle.vz);
    if (candle.vz <= 0) landCandle(candle, stage, frame, previousZ);
    if (candle.state === CandleState.airborne && candle.z < stageBounds(stage).blast.bottom) {
      candle.state = CandleState.lost;
      candle.vx = 0.0;
      candle.vz = 0.0;
    }
  }
}

export function settleCandles(world: Roster, matchFrame: number): void {
  const decays = imod(matchFrame, CANDLE_DECAY_EVERY) === 0;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    const candle = f.candle;
    if (candle.state === CandleState.held) {
      candle.guard = max(0, candle.guard - 1);
      if (decays) candle.heat = max(0, candle.heat - 1);
    } else if (canTakeCandle(f)) {
      holdCandle(f);
    } else {
      candle.away = min(CANDLE_AWAY_FRAMES, candle.away + 1);
      candle.timer = max(0, candle.timer - 1);
      if (candle.timer === 0 || candle.away >= CANDLE_AWAY_FRAMES) {
        holdCandle(f);
        candle.heat = 0;
        candle.lit = true;
      }
    }
  }
}
