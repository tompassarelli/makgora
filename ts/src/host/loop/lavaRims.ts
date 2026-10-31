import { createEffect, destroyEffect, playEffectAnimation, setEffectColor, setEffectMatrixScale, setEffectPosition, setEffectScale } from "wisp/game/effects";
import { hideEffect } from "../../game/render/effects";
import { drawnScale, lavaRimPiece } from "../../game/presentation/stageScenery";
import type { ShellState } from "./state";

export function createLavaRims(s: ShellState): void {
  const { origin } = s;
  for (const side of [-1, 1] as const) {
    const rim = lavaRimPiece(side);
    const effect = createEffect(rim.model, origin.x + rim.x, origin.y + rim.y);
    setEffectPosition(effect, origin.x + rim.x, origin.y + rim.y, origin.z + rim.z);
    const drawn = drawnScale(rim);
    setEffectScale(effect, drawn.scale);
    if (drawn.matrixScale !== undefined) setEffectMatrixScale(effect, drawn.matrixScale[0], drawn.matrixScale[1], drawn.matrixScale[2]);
    setEffectColor(effect, 64, 30, 20);
    playEffectAnimation(effect, ANIM_TYPE_STAND);
    s.stageLavaRims.push(effect);
  }
}

export function destroyLavaRims(s: ShellState): void {
  for (const rim of s.stageLavaRims) {
    hideEffect(rim, s.origin);
    destroyEffect(rim);
  }
  s.stageLavaRims.length = 0;
}
