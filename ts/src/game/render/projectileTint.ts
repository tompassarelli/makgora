export function tintProjectile(model: effect, cue: { readonly color?: readonly [number, number, number] | undefined } | undefined): void {
  const color = cue?.color;
  if (color === undefined) return;
  BlzSetSpecialEffectColor(model, color[0], color[1], color[2]);
}
