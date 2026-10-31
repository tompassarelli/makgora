import { FighterAgencyForecast, type FighterAgency } from "../presentation/fighterAgency";
import type { Fighter } from "../sim/fighter";
import { hideEffect, type WorldOrigin, placeEffect } from "./effects";
import { f32 } from "wisp/src/sim/f32";
import { createEffect, destroyEffect, Effect, setEffectAlpha, setEffectAnimation, setEffectBlendTime, setEffectColor, setEffectRoll, setEffectScale, setEffectTime, setEffectTimeScale } from "wisp/game/effects";


export class AgencyMarker {
  readonly forecast = new FighterAgencyForecast();
  private readonly halo: Effect;
  private shown = false;

  constructor(private readonly origin: WorldOrigin) {
    this.halo = createEffect("Abilities\\Spells\\Other\\GeneralAuraTarget\\GeneralAuraTarget.mdl", origin.x, origin.y);
    setEffectBlendTime(this.halo, 0.0);
    setEffectAnimation(this.halo, "Stand");
    setEffectTimeScale(this.halo, 0.0);
    setEffectTime(this.halo, 0.5);

    setEffectRoll(this.halo, f32(Math.PI / 2.0));
    hideEffect(this.halo, origin);
  }

  present(fighter: Readonly<Fighter> | undefined, agency: FighterAgency): void {
    if (fighter === undefined || fighter.status.out || agency === "act") {
      this.hide();
      return;
    }
    this.shown = true;

    placeEffect(this.halo, this.origin.x + fighter.motion.x, this.origin.y + 40.0, this.origin.z + fighter.motion.z + 90.0);
    setEffectScale(this.halo, 1.75);
    setEffectAlpha(this.halo, 255);
    setEffectColor(this.halo, agency === "none" ? 255 : 0, agency === "none" ? 100 : 255, agency === "none" ? 40 : 0);
  }

  hide(): void {
    if (!this.shown) return;
    hideEffect(this.halo, this.origin);
    this.shown = false;
  }

  drawnEffects(into: Effect[]): void {
    into.push(this.halo);
  }

  destroy(): void {
    hideEffect(this.halo, this.origin);
    destroyEffect(this.halo);
  }
}
