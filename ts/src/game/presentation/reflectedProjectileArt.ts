import { type Character, ProjectileKind } from "../sim/codes";
import { heroDefinition } from "../sim/heroes/registry";
import type { SpecialProjectile } from "../sim/specials/schema";
import { ORIGINAL_KINDS, ORIGINAL_PROJECTILE_MODELS, heroProjectileArt, ultimateProjectiles } from "./projectileArt";

function addLaterModels(spec: Readonly<SpecialProjectile> | undefined, models: string[]): void {
  if (spec === undefined) return;
  if (spec.model !== undefined && !models.includes(spec.model)) models.push(spec.model);
  addLaterModels(spec.expiresInto, models);
  addLaterModels(spec.burstInto, models);
}


/** Every model a fighter's reflectable projectiles can show, including what they expire or burst into. */
export function reflectedProjectileModels(character: Character): readonly string[] {
  const specials = heroDefinition(character)?.specials;
  const models: string[] = specials === undefined ? (ORIGINAL_KINDS[character] ?? [ProjectileKind.blaster]).map((kind) => ORIGINAL_PROJECTILE_MODELS[kind]) : [];
  const specs = [...(specials === undefined ? [] : heroProjectileArt(specials).map(({ spec }) => spec)), ...ultimateProjectiles(character)];
  for (const spec of specs) if (spec.reflectable) addLaterModels(spec, models);
  return models;
}


/** Opponents' reflectable projectile models a fighter's renderer has no pool for yet, each once. */
export function opponentReflectedModels(opponents: readonly Character[], taken: readonly string[]): string[] {
  const models: string[] = [];
  for (const opponent of opponents) for (const path of reflectedProjectileModels(opponent)) if (!taken.includes(path) && !models.includes(path)) models.push(path);
  return models;
}
