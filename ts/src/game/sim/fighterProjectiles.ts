import { at } from "wisp/src/runtime/lookup";
import { type Character, ProjectileKind } from "./codes";
import type { Fighter, Projectile } from "./fighter";

export function mutableProjectile(fighter: Fighter, index: number): Projectile {
  const projectile = at(fighter.projectiles, index);
  if (index >= fighter.projectileSlots) fighter.projectileSlots = index + 1;
  return projectile;
}

const positiveZero = (value: number) => value === 0 && 1 / value > 0;

function resting(projectile: Readonly<Projectile>, family: Character): boolean {
  return projectile.life === 0 && projectile.direction === 0 && projectile.kind === ProjectileKind.blaster && projectile.visualFamily === family
    && projectile.serial === 0 && projectile.damageMultiplier === 1.0 && !projectile.newlyReflected
    && projectile.poolHits === 0 && projectile.poolWait === 0 && projectile.spec === undefined && projectile.surface === undefined
    && positiveZero(projectile.x) && positiveZero(projectile.z) && positiveZero(projectile.velocityX) && positiveZero(projectile.velocityZ);
}

export function restProjectiles(fighter: Fighter, family: Character): void {
  const projectiles = fighter.projectiles;
  for (let index = fighter.projectileSlots; index < projectiles.length; index++) {
    const projectile: Projectile = at(projectiles, index);
    projectile.visualFamily = family;
  }
  let slots = fighter.projectileSlots;
  while (slots > 0 && resting(at(projectiles, slots - 1), family)) slots--;
  fighter.projectileSlots = slots;
}

export function settleProjectileSlots(fighter: Fighter): void {
  const projectiles = fighter.projectiles;
  const family = at(projectiles, projectiles.length - 1).visualFamily;
  let slots = projectiles.length;
  while (slots > 0 && resting(at(projectiles, slots - 1), family)) slots--;
  fighter.projectileSlots = slots;
}
