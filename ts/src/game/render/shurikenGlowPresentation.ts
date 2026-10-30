import { fitFighterPlacement } from "../presentation/fighterPlacement";
import { fighterModelScale } from "../presentation/fighterScale";
import { SHURIKEN_GLOW_COLOR, SHURIKEN_GLOW_MODEL, SHURIKEN_GLOW_ON_HAND, shurikenGlowScale, shurikenGlowShown, shurikensStored } from "../presentation/shurikenCues";
import { fighterPoseFacing } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { facingYaw, hideEffect, placeEffect, type WorldOrigin } from "./effects";

export class ShurikenGlowPresentation {
  private readonly glow: effect;
  private readonly placement = { x: 0.0, z: 0.0 };
  private shown = false;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.glow = AddSpecialEffect(SHURIKEN_GLOW_MODEL, origin.x, origin.y);
    hideEffect(this.glow, origin);
  }

  present(fighter: Readonly<Fighter> | undefined, stage: number): void {
    if (fighter === undefined || !shurikenGlowShown(fighter)) {
      this.hide();
      return;
    }
    this.shown = true;
    const facing = fighterPoseFacing(fighter);
    const scale = fighterModelScale(fighter);
    fitFighterPlacement(this.placement, fighter, stage);
    placeEffect(this.glow, this.origin.x + this.placement.x + SHURIKEN_GLOW_ON_HAND.x * scale * facing, this.origin.y, this.origin.z + this.placement.z + SHURIKEN_GLOW_ON_HAND.z * scale);
    BlzSetSpecialEffectYaw(this.glow, facingYaw(facing));
    BlzSetSpecialEffectScale(this.glow, shurikenGlowScale(shurikensStored(fighter.special.charge)) * scale);
    BlzSetSpecialEffectColor(this.glow, SHURIKEN_GLOW_COLOR[0], SHURIKEN_GLOW_COLOR[1], SHURIKEN_GLOW_COLOR[2]);
  }

  drawnEffects(into: effect[]): void {
    into.push(this.glow);
  }

  hide(): void {
    if (this.shown) hideEffect(this.glow, this.origin);
    this.shown = false;
  }

  destroy(): void {
    hideEffect(this.glow, this.origin);
    DestroyEffect(this.glow);
  }
}
