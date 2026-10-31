import { PARTICIPANT_SLOTS } from "../input/participants";
import { f32 } from "wisp/src/sim/f32";
import { DuoOrder, DuoRole } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { STANCE_RING_MODEL } from "../presentation/specialCues";
import { type ParkedFlags, type WorldOrigin, parkOnce, placeEffect } from "./effects";
import { createEffect, destroyEffect, setEffectAlpha, setEffectAnimation, setEffectScale, setEffectTime, setEffectTimeScale } from "wisp/game/effects";

const RING_SCALE = f32(0.4);

/** A ring on the floor under a partner holding its ground. */
export class StanceRingEffects {
  private readonly rings: readonly effect[];

  private parked: ParkedFlags | undefined;

  constructor(private readonly origin: WorldOrigin) {
    this.rings = PARTICIPANT_SLOTS.map(() => createEffect(STANCE_RING_MODEL, origin.x, origin.y));
    this.clear();
  }

  clear(): void {
    for (let slot = 0; slot < this.rings.length; slot++) this.hideSlot(slot);
  }

  hideSlot(slot: number): void {
    const ring = this.rings[slot];
    if (ring !== undefined) parkOnce(ring, this.origin, (this.parked ??= []), slot);
  }

  present(fighter: Readonly<Fighter> | undefined, slot: number): void {
    const ring = this.rings[slot];
    if (ring === undefined) return;
    const parked = (this.parked ??= []);
    const duo = fighter?.duo;
    if (fighter === undefined || duo === undefined || duo.role !== DuoRole.partner || duo.order !== DuoOrder.hold || fighter.status.out) {
      parkOnce(ring, this.origin, parked, slot);
      return;
    }
    if (parked[slot] !== false) {
      setEffectAnimation(ring, "stand");
      setEffectTime(ring, 0.0);
      setEffectTimeScale(ring, 0.0);
    }
    parked[slot] = false;
    placeEffect(ring, this.origin.x + fighter.motion.x, this.origin.y, this.origin.z + fighter.motion.z);
    setEffectScale(ring, RING_SCALE);
    setEffectAlpha(ring, 255);
  }

  destroy(): void {
    for (const ring of this.rings) destroyEffect(ring);
  }
}
