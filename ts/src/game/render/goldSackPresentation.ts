import { fitFighterPlacement } from "../presentation/fighterPlacement";
import { fighterModelScale } from "../presentation/fighterScale";
import { GOLD_SACK_MODEL, GOLD_SACK_FULL_SCALE, GOLD_SACK_ON_BACK, goldSackStored } from "../presentation/peonCues";
import { fighterPoseFacing } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { facingYaw, hideEffect, placeEffect, type WorldOrigin } from "./effects";

export class GoldSackPresentation {
  private readonly sack: effect;
  private readonly placement = { x: 0.0, z: 0.0 };
  private shown = false;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.sack = AddSpecialEffect(GOLD_SACK_MODEL, origin.x, origin.y);
    hideEffect(this.sack, origin);
  }

  present(fighter: Readonly<Fighter> | undefined, stage: number): void {
    if (fighter === undefined || !goldSackStored(fighter)) {
      this.hide();
      return;
    }
    this.shown = true;
    const facing = fighterPoseFacing(fighter);
    const scale = fighterModelScale(fighter);
    fitFighterPlacement(this.placement, fighter, stage);
    placeEffect(this.sack, this.origin.x + this.placement.x + GOLD_SACK_ON_BACK.x * scale * facing, this.origin.y, this.origin.z + this.placement.z + GOLD_SACK_ON_BACK.z * scale);
    BlzSetSpecialEffectYaw(this.sack, facingYaw(facing));
    BlzSetSpecialEffectScale(this.sack, GOLD_SACK_FULL_SCALE * scale);
  }

  drawnEffects(into: effect[]): void {
    into.push(this.sack);
  }

  hide(): void {
    if (this.shown) hideEffect(this.sack, this.origin);
    this.shown = false;
  }

  destroy(): void {
    hideEffect(this.sack, this.origin);
    DestroyEffect(this.sack);
  }
}
