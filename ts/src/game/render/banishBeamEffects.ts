import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import { BANISH_SWIRL_COUNT, BANISH_SWIRL_MODEL, BANISH_SWIRL_SCALE, BANISH_SWIRL_TINT } from "../fighters/kaelthas/look";
import { type BanishSwirl, banishSwirl } from "../presentation/banishBeam";
import { PARKED_CUE_TIME_SCALE, type ParkedFlags, type WorldOrigin, facingYaw, parkCue, placeEffect } from "./effects";
import { createEffect, destroyEffect, Effect, setEffectAlpha, setEffectColor, setEffectScale, setEffectTime, setEffectTimeScale, setEffectYaw } from "wisp/game/effects";

/** Banish's beam: stock Banish swirls spread along the live beam region from Kael's hand. */
export class BanishBeamEffects {
  private readonly models: Effect[] = [];
  private readonly parked: ParkedFlags = [];
  private readonly swirl: BanishSwirl = { x: 0.0, z: 0.0 };

  constructor(private readonly origin: WorldOrigin, private readonly front: number, private readonly scale: number) {
    for (let index = 0; index < BANISH_SWIRL_COUNT; index++) this.models.push(createEffect(BANISH_SWIRL_MODEL, origin.x, origin.y));
    this.clear();
  }

  clear(): void {
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) parkCue(model, this.origin, this.parked, index);
    }
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, paused: boolean): void {
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model === undefined) continue;
      if (fighter === undefined || !playing || !banishSwirl(fighter, index, this.swirl)) {
        parkCue(model, this.origin, this.parked, index);
        continue;
      }
      const starts = this.parked[index] === true;
      this.parked[index] = false;
      placeEffect(model, this.origin.x + this.swirl.x, this.front, this.origin.z + this.swirl.z);
      setEffectYaw(model, facingYaw(fighter.facing));
      setEffectScale(model, BANISH_SWIRL_SCALE * this.scale);
      setEffectAlpha(model, 255);
      setEffectColor(model, BANISH_SWIRL_TINT[0], BANISH_SWIRL_TINT[1], BANISH_SWIRL_TINT[2]);
      if (starts) setEffectTime(model, f32(0.2));
      setEffectTimeScale(model, paused || fighter.launch.hitlag > 0 ? 0.0 : 1.0);
    }
  }

  setPaused(paused: boolean): void {
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) setEffectTimeScale(model, paused ? 0.0 : this.parked[index] === true ? PARKED_CUE_TIME_SCALE : 1.0);
    }
  }

  drawnEffects(into: Effect[]): void {
    for (const model of this.models) into.push(model);
  }

  destroy(): void {
    this.clear();
    for (const model of this.models) destroyEffect(model);
    this.models.length = 0;
  }
}
