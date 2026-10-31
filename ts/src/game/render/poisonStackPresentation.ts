import { PARTICIPANT_SLOTS } from "../input/participants";
import { fighterModelScale } from "../presentation/fighterScale";
import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import { STOCK_MODELS, type WorldOrigin, hideEffect, placeEffect } from "./effects";
import { SoundBank, SoundKind } from "./soundBank";
import { createEffect, destroyEffect, setEffectAlpha, setEffectColor, setEffectScale, setEffectTime, setEffectTimeScale } from "wisp/game/effects";

export const POISON_BURST_MODEL = "Abilities\\Weapons\\PoisonSting\\PoisonStingTarget.mdx";
export const POISON_BURST_SOUND = "PoisonArrowHit";
export const POISON_BURST_FRAMES = 45;
const GLOW_HEIGHT = 225.0;
const GLOW_BASE_SCALE = f32(0.3);
const GLOW_STACK_SCALE = f32(0.12);
const GLOW_BASE_ALPHA = 120;
const GLOW_STACK_ALPHA = 27;
const BURST_HEIGHT = 110.0;
const BURST_SCALE = f32(1.7);

export class PoisonStackPresentation {
  private readonly glow: effect[] = [];
  private readonly burst: effect[] = [];
  private readonly seenPops: number[] = [];
  private readonly burstLeft: number[] = [];
  private readonly shown: boolean[] = [];
  private readonly sounds = new SoundBank();

  constructor(private readonly origin: WorldOrigin) {
    this.sounds.prepare(SoundKind.label, [POISON_BURST_SOUND]);
    for (let slot = 0; slot < PARTICIPANT_SLOTS.length; slot++) {
      const glow = createEffect(STOCK_MODELS.curseTarget, origin.x, origin.y);
      setEffectColor(glow, 190, 255, 30);
      this.glow.push(glow);
      this.burst.push(createEffect(POISON_BURST_MODEL, origin.x, origin.y));
      this.seenPops.push(0);
      this.burstLeft.push(0);
      this.shown.push(false);
    }
    this.clear();
  }

  clear(): void {
    for (let slot = 0; slot < this.glow.length; slot++) {
      this.seenPops[slot] = 0;
      this.burstLeft[slot] = 0;
      this.hide(slot);
    }
  }

  setPaused(paused: boolean): void {
    const scale = paused ? 0.0 : 1.0;
    for (let slot = 0; slot < this.glow.length; slot++) {
      const glow = this.glow[slot];
      const burst = this.burst[slot];
      if (glow !== undefined) setEffectTimeScale(glow, scale);
      if (burst !== undefined) setEffectTimeScale(burst, scale);
    }
  }

  present(fighter: Readonly<Fighter>, slot: number): void {
    const glow = this.glow[slot];
    const burst = this.burst[slot];
    if (glow === undefined || burst === undefined) return;
    const body = fighterModelScale(fighter);
    const x = this.origin.x + fighter.motion.x;
    const z = this.origin.z + fighter.motion.z;
    const stacks = fighter.status.out ? 0 : fighter.status.poisonStacks;
    if (stacks > 0) {
      placeEffect(glow, x, this.origin.y, z + GLOW_HEIGHT * body);
      setEffectScale(glow, f32(GLOW_BASE_SCALE + f32(stacks * GLOW_STACK_SCALE)) * body);
      setEffectAlpha(glow, GLOW_BASE_ALPHA + stacks * GLOW_STACK_ALPHA);
      this.shown[slot] = true;
    } else if (this.shown[slot] === true) {
      hideEffect(glow, this.origin);
      this.shown[slot] = false;
    }
    if (fighter.visuals.poisonBursts !== this.seenPops[slot]) {
      this.seenPops[slot] = fighter.visuals.poisonBursts;
      this.burstLeft[slot] = POISON_BURST_FRAMES;
      setEffectTime(burst, 0.0);
      this.sounds.playAt(SoundKind.label, POISON_BURST_SOUND, x, this.origin.y, z);
    }
    const left = this.burstLeft[slot] ?? 0;
    if (left <= 0) return;
    this.burstLeft[slot] = left - 1;
    if (left === 1) {
      hideEffect(burst, this.origin);
      return;
    }
    placeEffect(burst, x, this.origin.y, z + BURST_HEIGHT * body);
    setEffectScale(burst, BURST_SCALE * body);
  }

  destroy(): void {
    for (const model of [...this.glow, ...this.burst]) destroyEffect(model);
  }

  private hide(slot: number): void {
    const glow = this.glow[slot];
    const burst = this.burst[slot];
    if (glow !== undefined) hideEffect(glow, this.origin);
    if (burst !== undefined) hideEffect(burst, this.origin);
    this.shown[slot] = false;
  }
}
