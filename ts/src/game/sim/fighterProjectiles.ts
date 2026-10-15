import { at } from "wisp/src/runtime/lookup";
import type { Fighter, Projectile } from "./fighter";

export function mutableProjectile(fighter: Fighter, index: number): Projectile {
  return at(fighter.projectiles, index);
}
