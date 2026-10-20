export const REST_BEAR = 1;
export const REST_FREEZE_TRAP = 2;
export const RESTING_GROUPS = REST_BEAR | REST_FREEZE_TRAP;

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

interface RestingGroups {
  restingGroups: number;
  readonly bear: Readonly<Bear>;
  readonly freezeTrap: Readonly<FreezeTrap>;
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

export function settleRestingGroups(fighter: RestingGroups): void {
  fighter.restingGroups = (bearResting(fighter.bear) ? REST_BEAR : 0) | (freezeTrapResting(fighter.freezeTrap) ? REST_FREEZE_TRAP : 0);
}
