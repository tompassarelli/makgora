import { at } from "wisp/src/runtime/lookup";
import { ProjectileKind } from "../codes";
import type { Fighter } from "../fighter";
import type { SpecialProjectile } from "./schema";

export function ownedCount(f: Readonly<Fighter>, spec: Readonly<SpecialProjectile> | undefined): number {
  let count = 0;
  let index = -1;
  for (const projectile of f.projectiles) {
    index++;
    if (projectile.life > 0 && projectile.kind === ProjectileKind.hero && (spec === undefined ? !laterInVolley(f, index) : projectile.spec === spec)) count++;
  }
  return count;
}

function laterInVolley(f: Readonly<Fighter>, index: number): boolean {
  const spec = at(f.projectiles, index).spec;
  if (spec?.fan === undefined) return false;
  for (let earlier = 0; earlier < index; earlier++) {
    const projectile = at(f.projectiles, earlier);
    if (projectile.life > 0 && projectile.spec === spec) return true;
  }
  return false;
}
