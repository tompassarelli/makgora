import { PROJECTILE_DRAW_OFFSETS } from "../presentation/projectileArt";
import type { WorldOrigin } from "./effects";
import { createEffect, Effect, setEffectAnimation, setEffectTime } from "wisp/game/effects";

/** Makes one parked projectile effect at the draw's first pose and returns its index in models. */
export function addPoolEffect(models: Effect[], visible: boolean[], drawn: string, origin: WorldOrigin): number {
  const index = models.length;
  const model = createEffect(drawn, origin.x, origin.y);
  models.push(model);
  const draw = PROJECTILE_DRAW_OFFSETS[drawn];
  if (draw?.sequence !== undefined) {
    setEffectAnimation(model, draw.sequence);
    setEffectTime(model, draw.seconds ?? 0.0);
  }
  visible.push(false);
  return index;
}

export function addPoolEffects(models: Effect[], visible: boolean[], drawn: string, origin: WorldOrigin, count: number): number[] {
  const effects: number[] = [];
  for (let slot = 0; slot < count; slot++) effects.push(addPoolEffect(models, visible, drawn, origin));
  return effects;
}
