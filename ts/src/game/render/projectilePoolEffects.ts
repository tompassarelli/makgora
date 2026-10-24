import { PROJECTILE_DRAW_OFFSETS } from "../presentation/projectileArt";
import type { WorldOrigin } from "./effects";

/** Makes one parked projectile effect at the draw's first pose and returns its index in models. */
export function addPoolEffect(models: effect[], visible: boolean[], drawn: string, origin: WorldOrigin): number {
  const index = models.length;
  const model = AddSpecialEffect(drawn, origin.x, origin.y);
  models.push(model);
  const draw = PROJECTILE_DRAW_OFFSETS[drawn];
  if (draw?.sequence !== undefined) {
    BlzSetSpecialEffectAnimation(model, draw.sequence);
    BlzSetSpecialEffectTime(model, draw.seconds ?? 0.0);
  }
  visible.push(false);
  return index;
}

export function addPoolEffects(models: effect[], visible: boolean[], drawn: string, origin: WorldOrigin, count: number): number[] {
  const effects: number[] = [];
  for (let slot = 0; slot < count; slot++) effects.push(addPoolEffect(models, visible, drawn, origin));
  return effects;
}
