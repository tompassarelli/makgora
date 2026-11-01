import { empoweredAuraScale } from "../presentation/empoweredAuraLook";
import type { EmpoweredAuraLook } from "../presentation/model/look";
import type { Fighter } from "../sim/fighter";
import { createEffect, destroyEffect, Effect, setEffectAnimation, setEffectScale, setEffectTime, setEffectTimeScale } from "wisp/game/effects";
import { type ParkedFlags, type WorldOrigin, hideEffect, parkOnce, placeEffect } from "./effects";

const FEET = 2.0;
const SHOWN = 0;

export class EmpoweredAuraPresentation {
  private readonly aura: Effect;
  private readonly parked: ParkedFlags = [];

  constructor(private readonly look: Readonly<EmpoweredAuraLook>, private readonly origin: Readonly<WorldOrigin>) {
    this.aura = createEffect(look.model, origin.x, origin.y);
    parkOnce(this.aura, origin, this.parked, SHOWN);
  }

  present(fighter: Readonly<Fighter> | undefined, paused: boolean): void {
    const scale = fighter === undefined ? 0.0 : empoweredAuraScale(fighter, this.look);
    if (fighter === undefined || scale <= 0.0) {
      this.hide();
      return;
    }
    if (this.parked[SHOWN] !== false) {
      setEffectAnimation(this.aura, "stand");
      setEffectTime(this.aura, 0.0);
    }
    this.parked[SHOWN] = false;
    placeEffect(this.aura, this.origin.x + fighter.motion.x, this.origin.y, this.origin.z + fighter.motion.z + FEET);
    setEffectScale(this.aura, scale);
    setEffectTimeScale(this.aura, paused || fighter.launch.hitlag > 0 ? 0.0 : 1.0);
  }

  drawnEffects(into: Effect[]): void {
    into.push(this.aura);
  }

  hide(): void {
    parkOnce(this.aura, this.origin, this.parked, SHOWN);
  }

  destroy(): void {
    hideEffect(this.aura, this.origin);
    destroyEffect(this.aura);
  }
}
