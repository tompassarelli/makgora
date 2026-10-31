import { Effect, setEffectColor } from "wisp/game/effects";
export function tintProjectile(model: Effect, cue: { readonly color?: readonly [number, number, number] | undefined } | undefined): void {
  const color = cue?.color;
  if (color === undefined) return;
  setEffectColor(model, color[0], color[1], color[2]);
}
