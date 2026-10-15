


import { FROST_ICE_MODEL, FROST_TRAP_MODEL } from "../../generated/assets/frostAssetInfo";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../sim/codes";
import { SpecialForm } from "../sim/specials/schema";
import type { Fighter } from "../sim/fighter";
import { FROST_ARMOR_SHELL_MODEL } from "../presentation/specialCues";
import { type ParkedFlags, type WorldOrigin, parkOnce, placeEffect } from "./effects";

interface FrostSlot {
  readonly trap: effect;
  readonly ice: effect;
  readonly shell: effect;
}

const SHELL_HEIGHT = 60.0;
const SHELL_SCALE = f32(0.8);

export class FrostEffects {
  private readonly slots: readonly FrostSlot[];

  private parked: ParkedFlags | undefined;

  constructor(private readonly origin: WorldOrigin) {
    this.slots = PARTICIPANT_SLOTS.map(() => ({
      trap: AddSpecialEffect(FROST_TRAP_MODEL, origin.x, origin.y),
      ice: AddSpecialEffect(FROST_ICE_MODEL, origin.x, origin.y),
      shell: AddSpecialEffect(FROST_ARMOR_SHELL_MODEL, origin.x, origin.y),
    }));
    this.clear();
  }

  clear(): void {
    for (let slot = 0; slot < this.slots.length; slot++) this.hideSlot(slot);
  }

  hideSlot(slot: number): void {
    const frost = this.slots[slot];
    if (frost === undefined) return;
    const parked = (this.parked ??= []);
    parkOnce(frost.trap, this.origin, parked, 2 * slot);
    parkOnce(frost.ice, this.origin, parked, 2 * slot + 1);
    parkOnce(frost.shell, this.origin, parked, 2 * this.slots.length + slot);
  }

  present(fighter: Readonly<Fighter>, slot: number): void {
    const frost = this.slots[slot];
    if (frost === undefined) return;
    const { x, y, z } = this.origin;
    const out = fighter.status.out;
    const trap = fighter.freezeTrap;
    const parked = (this.parked ??= []);
    if (trap.life > 0 && !out) {
      parked[2 * slot] = false;
      placeEffect(frost.trap, x + trap.x, y, z + trap.z);
      BlzSetSpecialEffectScale(frost.trap, 1.0);
      BlzSetSpecialEffectAlpha(frost.trap, trap.arming > 0 ? 100 : 255);
    } else {
      parkOnce(frost.trap, this.origin, parked, 2 * slot);
    }
    if (fighter.status.frozenFrames > 0 && !out) {
      parked[2 * slot + 1] = false;
      placeEffect(frost.ice, x + fighter.motion.x, y, z + fighter.motion.z);
      BlzSetSpecialEffectScale(frost.ice, 1.0);
      BlzSetSpecialEffectAlpha(frost.ice, 255);
    } else {
      parkOnce(frost.ice, this.origin, parked, 2 * slot + 1);
    }
    const shellIndex = 2 * this.slots.length + slot;
    if (fighter.character === Character.lich && fighter.special.action === SpecialAction.heroDown && fighter.special.form !== SpecialForm.recall && fighter.status.armorFrames > 0 && !out) {
      if (parked[shellIndex] !== false) {
        BlzSetSpecialEffectAnimation(frost.shell, "stand");
        BlzSetSpecialEffectTime(frost.shell, 0.0);
      }
      parked[shellIndex] = false;
      placeEffect(frost.shell, x + fighter.motion.x, y, z + fighter.motion.z + SHELL_HEIGHT);
      BlzSetSpecialEffectScale(frost.shell, SHELL_SCALE);
      BlzSetSpecialEffectAlpha(frost.shell, 255);
    } else {
      parkOnce(frost.shell, this.origin, parked, shellIndex);
    }
  }

  destroy(): void {
    for (const { trap, ice, shell } of this.slots) {
      DestroyEffect(trap);
      DestroyEffect(ice);
      DestroyEffect(shell);
    }
  }
}
