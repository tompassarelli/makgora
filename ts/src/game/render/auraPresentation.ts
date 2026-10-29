import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { hideEffect, type WorldOrigin } from "./effects";

export const AURA_CLOUD_MODEL = "Abilities\\Spells\\Undead\\PlagueCloud\\PlagueCloudCaster.mdx";
const CLOUD_SCALE = f32(1.4);

interface Cloud {
  readonly model: effect;
  shown: boolean;
}

export class AuraPresentation {
  private readonly clouds: readonly Cloud[];

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    this.clouds = PARTICIPANT_SLOTS.map(() => {
      const model = AddSpecialEffect(AURA_CLOUD_MODEL, origin.x, origin.y);
      hideEffect(model, origin);
      return { model, shown: false };
    });
  }

  present(playing: boolean, world: Readonly<Roster>): void {
    for (const slot of PARTICIPANT_SLOTS) {
      const cloud = this.clouds[slot];
      if (cloud === undefined) continue;
      const fighter = playing && isActive(world, slot) ? fighterAt(world, slot) : undefined;
      if (fighter !== undefined && fighter.status.aura && !fighter.status.out) {
        BlzSetSpecialEffectPosition(cloud.model, this.origin.x + fighter.motion.x, this.origin.y, this.origin.z + fighter.motion.z);
        BlzSetSpecialEffectScale(cloud.model, CLOUD_SCALE);
        if (!cloud.shown) BlzPlaySpecialEffect(cloud.model, ANIM_TYPE_STAND);
        cloud.shown = true;
      } else if (cloud.shown) {
        hideEffect(cloud.model, this.origin);
        cloud.shown = false;
      }
    }
  }
}
