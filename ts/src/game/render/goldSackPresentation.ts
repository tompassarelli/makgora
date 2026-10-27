import { at } from "wisp/src/runtime/lookup";
import { fitFighterPlacement } from "../presentation/fighterPlacement";
import { characterModelScale } from "../presentation/modelScale";
import { GOLD_SACK_MODEL, GOLD_SACK_ON_BACK, GOLD_SACK_SCALES, goldSackStage } from "../presentation/peonCues";
import { SpecialAction } from "../sim/codes";
import { fighterPoseFacing } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { facingYaw, hideEffect, placeEffect, type WorldOrigin } from "./effects";

const storedSack = (fighter: Readonly<Fighter> | undefined): boolean =>
  fighter !== undefined && !fighter.status.out && fighter.special.charge > 0 && fighter.special.action !== SpecialAction.heroNeutral;

export class GoldSackPresentation {
  private readonly sack: effect;
  private readonly placement = { x: 0.0, z: 0.0 };
  private shown = false;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.sack = AddSpecialEffect(GOLD_SACK_MODEL, origin.x, origin.y);
    hideEffect(this.sack, origin);
  }

  present(fighter: Readonly<Fighter> | undefined, stage: number): void {
    if (fighter === undefined || !storedSack(fighter)) {
      this.hide();
      return;
    }
    this.shown = true;
    const facing = fighterPoseFacing(fighter);
    const scale = characterModelScale(fighter.character);
    fitFighterPlacement(this.placement, fighter, stage);
    placeEffect(this.sack, this.origin.x + this.placement.x + GOLD_SACK_ON_BACK.x * scale * facing, this.origin.y, this.origin.z + this.placement.z + GOLD_SACK_ON_BACK.z * scale);
    BlzSetSpecialEffectYaw(this.sack, facingYaw(facing));
    BlzSetSpecialEffectScale(this.sack, at(GOLD_SACK_SCALES, goldSackStage(fighter.special.charge)) * scale);
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
