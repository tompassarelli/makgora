import { CandleState } from "./codes";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { at } from "wisp/src/runtime/lookup";

export const REST_BEAR = 1;
export const REST_FREEZE_TRAP = 2;
export const REST_CANNON = 4;
export const REST_WATER = 8;
export const REST_CANDLE = 16;
export const REST_PLACED = 32;
export const RESTING_GROUPS = REST_BEAR | REST_FREEZE_TRAP | REST_CANNON | REST_WATER | REST_CANDLE | REST_PLACED;

export type Resting<T> = { readonly [K in keyof T]: T[K] extends readonly (infer E)[] ? readonly E[] : T[K] };

export interface Bear {
  exDamage: boolean;
  life: number;
  x: number;
  z: number;
  velocityX: number;
  velocityZ: number;
  swipeCooldown: number;
  hitSerial: number;
  surface: number | undefined;
}

export interface FreezeTrap {
  exReach: boolean;
  life: number;
  arming: number;
  x: number;
  z: number;
  surface: number | undefined;
  serial: number;
  cooldown: number;
}

export interface Candle {
  heat: number;
  state: CandleState;
  lit: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  surface: number | undefined;
  timer: number;
  away: number;
  guard: number;
  readonly struck: (number | undefined)[];
  specialStruck: number;
  dropSerial: number;
  snuffSerial: number;
  returnSerial: number;
}

interface PlacedFields {
  life: number;
  age: number;
  x: number;
  z: number;
  direction: number;
  durability: number;
  serial: number;
  spec: unknown;
  readonly struck: (number | undefined)[];
  specialStruck: number;
  mode: number;
  modeFrame: number;
  apart: number;
  bitten: number;
  surface: number | undefined;
}

export interface StageCannon {
  held: number | undefined;
  firing: number | undefined;
  cooldown: number;
  passing: boolean;
}

export interface Water {
  inWater: boolean;
  frames: number;
  entries: number;
  hydraFrame: number;
  hydraX: number;
  hydraStrikeFrame: number;
}

interface RestingGroups {
  restingGroups: number;
  readonly bear: Readonly<Bear>;
  readonly freezeTrap: Readonly<FreezeTrap>;
  readonly cannon: Readonly<StageCannon>;
  readonly water: Readonly<Water>;
  readonly candle: Resting<Candle>;
  readonly placed: Resting<PlacedFields>;
  readonly pack: readonly Resting<PlacedFields>[];
}

const positiveZero = (value: number) => value === 0 && 1 / value > 0;

export function mutableBear(fighter: RestingGroups): Bear {
  fighter.restingGroups = fighter.restingGroups & ~REST_BEAR;
  const bear: Bear = fighter.bear;
  return bear;
}

export function mutableFreezeTrap(fighter: RestingGroups): FreezeTrap {
  fighter.restingGroups = fighter.restingGroups & ~REST_FREEZE_TRAP;
  const trap: FreezeTrap = fighter.freezeTrap;
  return trap;
}

export function bearResting(bear: Readonly<Bear>): boolean {
  return !bear.exDamage && positiveZero(bear.life) && positiveZero(bear.x) && positiveZero(bear.z) && positiveZero(bear.velocityX) && positiveZero(bear.velocityZ)
    && positiveZero(bear.swipeCooldown) && positiveZero(bear.hitSerial) && bear.surface === undefined;
}

export function freezeTrapResting(trap: Readonly<FreezeTrap>): boolean {
  return !trap.exReach && positiveZero(trap.life) && positiveZero(trap.arming) && positiveZero(trap.x) && positiveZero(trap.z) && trap.surface === undefined
    && positiveZero(trap.serial) && positiveZero(trap.cooldown);
}

export function restBear(fighter: RestingGroups): void {
  if ((fighter.restingGroups & REST_BEAR) !== 0) return;
  const bear: Bear = fighter.bear;
  bear.exDamage = false;
  bear.life = 0;
  bear.x = 0.0;
  bear.z = 0.0;
  bear.velocityX = 0.0;
  bear.velocityZ = 0.0;
  bear.swipeCooldown = 0;
  bear.hitSerial = 0;
  bear.surface = undefined;
  fighter.restingGroups = fighter.restingGroups | REST_BEAR;
}

export function restFreezeTrap(fighter: RestingGroups): void {
  if ((fighter.restingGroups & REST_FREEZE_TRAP) !== 0) return;
  const trap: FreezeTrap = fighter.freezeTrap;
  trap.exReach = false;
  trap.life = 0;
  trap.arming = 0;
  trap.x = 0.0;
  trap.z = 0.0;
  trap.surface = undefined;
  trap.serial = 0;
  trap.cooldown = 0;
  fighter.restingGroups = fighter.restingGroups | REST_FREEZE_TRAP;
}


export function mutableCannon(fighter: RestingGroups): StageCannon {
  fighter.restingGroups = fighter.restingGroups & ~REST_CANNON;
  const cannon: StageCannon = fighter.cannon;
  return cannon;
}

export function mutableWater(fighter: RestingGroups): Water {
  fighter.restingGroups = fighter.restingGroups & ~REST_WATER;
  const water: Water = fighter.water;
  return water;
}

export function cannonResting(cannon: Readonly<StageCannon>): boolean {
  return cannon.held === undefined && cannon.firing === undefined && positiveZero(cannon.cooldown) && !cannon.passing;
}

export function waterResting(water: Readonly<Water>): boolean {
  return !water.inWater && positiveZero(water.frames) && positiveZero(water.entries) && positiveZero(water.hydraFrame) && positiveZero(water.hydraX)
    && water.hydraStrikeFrame === -1;
}

export function restCannon(fighter: RestingGroups): void {
  if ((fighter.restingGroups & REST_CANNON) !== 0) return;
  const cannon: StageCannon = fighter.cannon;
  cannon.held = undefined;
  cannon.firing = undefined;
  cannon.cooldown = 0;
  cannon.passing = false;
  fighter.restingGroups = fighter.restingGroups | REST_CANNON;
}

export function restWater(fighter: RestingGroups): void {
  if ((fighter.restingGroups & REST_WATER) !== 0) return;
  const water: Water = fighter.water;
  water.inWater = false;
  water.frames = 0;
  water.entries = 0;
  water.hydraFrame = 0;
  water.hydraX = 0.0;
  water.hydraStrikeFrame = -1;
  fighter.restingGroups = fighter.restingGroups | REST_WATER;
}


export function mutableCandle(fighter: RestingGroups): Candle {
  fighter.restingGroups = fighter.restingGroups & ~REST_CANDLE;
  return fighter.candle as Candle;
}

export function candleResting(candle: Resting<Candle>): boolean {
  if (candle.state !== CandleState.held || (candle.state === 0 && 1 / candle.state < 0) || !candle.lit || candle.surface !== undefined) return false;
  if (!positiveZero(candle.heat) || !positiveZero(candle.x) || !positiveZero(candle.z) || !positiveZero(candle.vx) || !positiveZero(candle.vz)) return false;
  if (!positiveZero(candle.timer) || !positiveZero(candle.away) || !positiveZero(candle.guard) || !positiveZero(candle.specialStruck)) return false;
  if (!positiveZero(candle.dropSerial) || !positiveZero(candle.snuffSerial) || !positiveZero(candle.returnSerial)) return false;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) if (candle.struck[slot] !== undefined) return false;
  return true;
}

export function settleCandle(fighter: RestingGroups): void {
  if (candleResting(fighter.candle)) fighter.restingGroups = fighter.restingGroups | REST_CANDLE;
}


function placedObjectResting(placed: Resting<PlacedFields>): boolean {
  if (placed.spec !== undefined || placed.surface !== undefined || placed.direction !== 1) return false;
  if (!positiveZero(placed.life) || !positiveZero(placed.age) || !positiveZero(placed.x) || !positiveZero(placed.z) || !positiveZero(placed.durability)) return false;
  if (!positiveZero(placed.serial) || !positiveZero(placed.specialStruck) || !positiveZero(placed.mode) || !positiveZero(placed.modeFrame)) return false;
  if (!positiveZero(placed.apart) || !positiveZero(placed.bitten)) return false;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) if (placed.struck[slot] !== undefined) return false;
  return true;
}

export function placedResting(fighter: Omit<RestingGroups, "restingGroups">): boolean {
  if (!placedObjectResting(fighter.placed)) return false;
  for (let animal = 1; animal <= fighter.pack.length; animal++) if (!placedObjectResting(at(fighter.pack, animal - 1))) return false;
  return true;
}

export function settleRestingGroups(fighter: RestingGroups): void {
  fighter.restingGroups = (bearResting(fighter.bear) ? REST_BEAR : 0) | (freezeTrapResting(fighter.freezeTrap) ? REST_FREEZE_TRAP : 0)
    | (cannonResting(fighter.cannon) ? REST_CANNON : 0) | (waterResting(fighter.water) ? REST_WATER : 0) | (candleResting(fighter.candle) ? REST_CANDLE : 0)
    | (placedResting(fighter) ? REST_PLACED : 0);
}
