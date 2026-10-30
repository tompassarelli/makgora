import { PARTICIPANT_SLOTS } from "../input/participants";
import { fighterModelScale } from "../presentation/fighterScale";
import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import { type WorldOrigin, hideEffect, placeEffect } from "./effects";
import { RESIST_FLASH_MODEL } from "./terrorPresentation";

export const SPELL_PASS_FRAMES = 18;
const FLASH_HEIGHT = 60.0;
const FLASH_SCALE = f32(0.8);

export class SpellPassPresentation {
  private readonly flash: effect[] = [];
  private readonly seen: number[] = [];
  private readonly left: number[] = [];

  constructor(private readonly origin: WorldOrigin) {
    for (let slot = 0; slot < PARTICIPANT_SLOTS.length; slot++) {
      this.flash.push(AddSpecialEffect(RESIST_FLASH_MODEL, origin.x, origin.y));
      this.seen.push(0);
      this.left.push(0);
    }
    this.clear();
  }

  clear(): void {
    for (let slot = 0; slot < this.flash.length; slot++) {
      this.seen[slot] = 0;
      this.left[slot] = 0;
      this.hide(slot);
    }
  }

  setPaused(paused: boolean): void {
    for (const flash of this.flash) BlzSetSpecialEffectTimeScale(flash, paused ? 0.0 : 1.0);
  }

  present(fighter: Readonly<Fighter>, slot: number): void {
    const flash = this.flash[slot];
    if (flash === undefined) return;
    const passes = fighter.visuals.spellPass;
    const left = this.left[slot] ?? 0;
    if (passes !== this.seen[slot]) {
      this.seen[slot] = passes;
      if (left <= 0) {
        this.left[slot] = SPELL_PASS_FRAMES;
        BlzSetSpecialEffectTime(flash, 0.0);
      }
    }
    const remaining = this.left[slot] ?? 0;
    if (remaining <= 0) return;
    this.left[slot] = remaining - 1;
    if (remaining === 1 || fighter.status.out) {
      this.left[slot] = 0;
      this.hide(slot);
      return;
    }
    const body = fighterModelScale(fighter);
    placeEffect(flash, this.origin.x + fighter.motion.x, this.origin.y - 12.0, this.origin.z + fighter.motion.z + FLASH_HEIGHT * body);
    BlzSetSpecialEffectScale(flash, f32(FLASH_SCALE * body));
  }

  destroy(): void {
    for (const flash of this.flash) {
      hideEffect(flash, this.origin);
      DestroyEffect(flash);
    }
  }

  private hide(slot: number): void {
    const flash = this.flash[slot];
    if (flash !== undefined) hideEffect(flash, this.origin);
  }
}
