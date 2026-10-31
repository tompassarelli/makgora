

import { summonClip, summonClipCount } from "../presentation/summonClipInfo";
import type { SummonProjection } from "../presentation/summonState";
import { type WorldOrigin, hideEffect, placeEffect } from "./effects";
import { createEffect, destroyEffect, Effect, setEffectAlpha, setEffectAnimation, setEffectBlendTime, setEffectScale, setEffectTime, setEffectTimeScale, setEffectYaw } from "wisp/game/effects";

export class SummonPresentation {
  private readonly clips: Effect[] = [];
  private visible: number | undefined;

  constructor(
    summon: number,
    private readonly origin: WorldOrigin,
  ) {
    const count = summonClipCount(summon);
    for (let index = 0; index < count; index++) {
      const clip = summonClip(summon, index);
      const model = createEffect(clip.modelPath, origin.x, origin.y);
      setEffectBlendTime(model, 0.0);
      setEffectAnimation(model, "Stand");
      setEffectTimeScale(model, 0.0);
      hideEffect(model, origin);
      this.clips.push(model);
    }
  }

  hide(): void {
    const shown = this.visible === undefined ? undefined : this.clips[this.visible];
    if (shown !== undefined) hideEffect(shown, this.origin);
    this.visible = undefined;
  }

  present(pose: Readonly<SummonProjection>): void {
    const model = pose.visible && pose.clipIndex !== undefined ? this.clips[pose.clipIndex] : undefined;
    if (model === undefined || pose.clipIndex === undefined) {
      this.hide();
      return;
    }
    if (this.visible !== pose.clipIndex) {
      this.hide();
      this.visible = pose.clipIndex;
    }
    placeEffect(model, this.origin.x + pose.x, this.origin.y, this.origin.z + pose.z);
    setEffectYaw(model, pose.yaw);
    setEffectScale(model, pose.scale);
    setEffectTime(model, pose.seconds);
    setEffectAlpha(model, 255);
  }

  destroy(): void {

    this.hide();
    for (const model of this.clips) destroyEffect(model);
    this.clips.length = 0;
  }
}
