import { type SpherePose, emptySpherePose, spherePose } from "../presentation/sphereOrbit";
import type { OrbitLook } from "../presentation/model/look";
import type { Fighter } from "../sim/fighter";
import { facingYaw, hideEffect, placeEffect, type WorldOrigin } from "./effects";
import { createEffect, destroyEffect, setEffectScale, setEffectTimeScale, setEffectYaw } from "wisp/game/effects";

export class SpherePresentation {
  private readonly spheres: effect[] = [];
  private readonly pose: SpherePose = emptySpherePose();
  private shown = false;

  constructor(private readonly orbit: Readonly<OrbitLook>, private readonly origin: Readonly<WorldOrigin>) {
    for (let index = 0; index < orbit.count; index++) {
      const model = createEffect(orbit.model, origin.x, origin.y);
      hideEffect(model, origin);
      this.spheres.push(model);
    }
  }

  present(fighter: Readonly<Fighter> | undefined, frame: number, paused: boolean): void {
    let shown = false;
    for (let index = 0; index < this.spheres.length; index++) {
      const model = this.spheres[index];
      if (model === undefined) continue;
      const pose = fighter === undefined ? undefined : spherePose(fighter, this.orbit, index, frame, this.pose);
      if (fighter === undefined || pose === undefined || !pose.visible) {
        if (this.shown) hideEffect(model, this.origin);
        continue;
      }
      shown = true;
      placeEffect(model, this.origin.x + pose.x, this.origin.y + pose.depth, this.origin.z + pose.z);
      setEffectYaw(model, facingYaw(fighter.facing));
      setEffectScale(model, pose.scale);
      setEffectTimeScale(model, paused ? 0.0 : 1.0);
    }
    this.shown = shown;
  }

  hide(): void {
    this.present(undefined, 0, false);
  }

  drawnEffects(into: effect[]): void {
    for (const model of this.spheres) into.push(model);
  }

  destroy(): void {
    for (const model of this.spheres) {
      hideEffect(model, this.origin);
      destroyEffect(model);
    }
  }
}
