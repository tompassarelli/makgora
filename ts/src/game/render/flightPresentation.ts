import { type FlightPose, eggPose, emptyFlightPose, flightFlamesPose } from "../presentation/flightLook";
import { fitFighterPlacement } from "../presentation/fighterPlacement";
import type { FlightLook } from "../presentation/model/look";
import type { Fighter } from "../sim/fighter";
import { facingYaw, hideEffect, placeEffect, type WorldOrigin } from "./effects";

export class FlightPresentation {
  private readonly flames: effect;
  private readonly egg: effect;
  private readonly pose: FlightPose = emptyFlightPose();
  private readonly placement = { x: 0.0, z: 0.0 };
  private flamesShown = false;
  private eggShown = false;

  constructor(private readonly flight: Readonly<FlightLook>, private readonly origin: Readonly<WorldOrigin>) {
    this.flames = AddSpecialEffect(flight.flames, origin.x, origin.y);
    this.egg = AddSpecialEffect(flight.egg, origin.x, origin.y);
    hideEffect(this.flames, origin);
    hideEffect(this.egg, origin);
  }

  present(fighter: Readonly<Fighter> | undefined, stage: number, paused: boolean): void {
    const flames = fighter === undefined ? undefined : flightFlamesPose(fighter, this.flight, this.pose);
    this.flamesShown = this.place(this.flames, fighter, flames, stage, paused, this.flamesShown);
    const egg = fighter === undefined ? undefined : eggPose(fighter, this.flight, this.pose);
    this.eggShown = this.place(this.egg, fighter, egg, stage, paused, this.eggShown);
  }

  private place(model: effect, fighter: Readonly<Fighter> | undefined, pose: Readonly<FlightPose> | undefined, stage: number, paused: boolean, shown: boolean): boolean {
    if (fighter === undefined || pose === undefined || !pose.visible) {
      if (shown) hideEffect(model, this.origin);
      return false;
    }
    fitFighterPlacement(this.placement, fighter, stage);
    placeEffect(model, this.origin.x + this.placement.x, this.origin.y, this.origin.z + this.placement.z + pose.z);
    BlzSetSpecialEffectYaw(model, facingYaw(fighter.facing));
    BlzSetSpecialEffectScale(model, pose.scale);
    BlzSetSpecialEffectTimeScale(model, paused || fighter.launch.hitlag > 0 ? 0.0 : 1.0);
    return true;
  }

  hide(): void {
    this.present(undefined, 0, false);
  }

  drawnEffects(into: effect[]): void {
    into.push(this.flames, this.egg);
  }

  destroy(): void {
    for (const model of [this.flames, this.egg]) {
      hideEffect(model, this.origin);
      DestroyEffect(model);
    }
  }
}
