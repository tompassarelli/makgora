import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type BearFeedbackCursor, BEAR_IMPACT_MODEL, BEAR_ROAR_MODEL, advanceBearFeedback, bearState, createBearFeedbackCursor } from "../presentation/bearFeedback";
import { type Fighter, placedObject } from "../sim/fighter";
import { type ParkedFlags, type WorldOrigin, parkOnce, placeEffect } from "./effects";
import { SoundBank, SoundKind } from "./soundBank";
import { createEffect, destroyEffect, setEffectAlpha, setEffectAnimation, setEffectScale, setEffectTime, setEffectTimeScale } from "wisp/game/effects";

interface BearFeedbackSlot { roar: effect; impact: effect; cursor: BearFeedbackCursor }

export class BearFeedback {
  private readonly slots: readonly BearFeedbackSlot[];
  private readonly parked: ParkedFlags = [];
  private readonly sounds = new SoundBank();

  constructor(private readonly origin: WorldOrigin) {
    this.sounds.prepare(SoundKind.label, ["MetalHeavySliceFlesh"]);
    this.slots = PARTICIPANT_SLOTS.flatMap(() => [0, 2].map(() => ({ roar: createEffect(BEAR_ROAR_MODEL, origin.x, origin.y), impact: createEffect(BEAR_IMPACT_MODEL, origin.x, origin.y), cursor: createBearFeedbackCursor() })));
    for (const slot of this.slots) {
      setEffectAnimation(slot.roar, "Stand");
      setEffectTimeScale(slot.roar, 0.0);
      setEffectTime(slot.roar, f32(0.5));
    }
    this.clear();
  }

  clear(): void {
    for (let index = 0; index < this.slots.length; index++) {
      this.hideAnimal(index);
      const slot = this.slots[index];
      if (slot !== undefined) slot.cursor = createBearFeedbackCursor();
    }
  }

  hide(index: number): void {
    this.hideAnimal(index * 2);
    this.hideAnimal(index * 2 + 1);
  }

  private hideAnimal(index: number): void {
    const slot = this.slots[index];
    if (slot === undefined) return;
    parkOnce(slot.roar, this.origin, this.parked, index * 2);
    parkOnce(slot.impact, this.origin, this.parked, index * 2 + 1);
  }

  confirm(frame: number, fighter: Readonly<Fighter>, index: number): void {
    this.confirmAnimal(frame, fighter, index * 2, 0);
    this.confirmAnimal(frame, fighter, index * 2 + 1, 2);
  }

  private confirmAnimal(frame: number, fighter: Readonly<Fighter>, index: number, animal: number): void {
    const slot = this.slots[index];
    if (slot === undefined || animal > fighter.pack.length) return;
    const placed = placedObject(fighter, animal);
    const cues = advanceBearFeedback(slot.cursor, fighter, frame, animal);
    if (cues.hit) {
      this.sounds.playAt(SoundKind.label, "MetalHeavySliceFlesh", this.origin.x + placed.x, this.origin.y, this.origin.z + placed.z, 127);
      setEffectAnimation(slot.impact, "Birth");
      setEffectTime(slot.impact, 0.0);
    }
  }

  present(fighter: Readonly<Fighter>, index: number): void {
    this.presentAnimal(fighter, index * 2, 0);
    this.presentAnimal(fighter, index * 2 + 1, 2);
  }

  private presentAnimal(fighter: Readonly<Fighter>, index: number, animal: number): void {
    const slot = this.slots[index];
    const state = bearState(fighter, animal);
    if (slot === undefined) return;
    if (state === undefined) { this.hideAnimal(index); return; }
    const bear = placedObject(fighter, animal);
    const x = this.origin.x + bear.x;
    const z = this.origin.z + bear.z;
    if (animal === 0 && state === "CHARGING") {
      this.parked[index * 2] = false;
      placeEffect(slot.roar, x, this.origin.y - 12.0, z + 95.0);
      setEffectScale(slot.roar, 2.5);
      setEffectAlpha(slot.roar, 255);
    } else parkOnce(slot.roar, this.origin, this.parked, index * 2);
    if (slot.cursor.frame - slot.cursor.impactFrame < 14) {
      this.parked[index * 2 + 1] = false;
      placeEffect(slot.impact, this.origin.x + slot.cursor.impactX, this.origin.y - 15.0, this.origin.z + slot.cursor.impactZ);
      setEffectScale(slot.impact, 1.5);
      setEffectAlpha(slot.impact, 255);
    } else parkOnce(slot.impact, this.origin, this.parked, index * 2 + 1);
  }

  destroy(): void {
    this.clear();
    for (const slot of this.slots) {
      destroyEffect(slot.roar);
      destroyEffect(slot.impact);
    }
  }
}
