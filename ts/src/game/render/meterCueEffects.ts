import type { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { Cue } from "../presentation/specialCues";
import { EX_AURA, EX_CAST_VOLUME, type MeterCueFit, type MeterCueState, type MeterCueView, SUPER_AURA, ULTIMATE_BURST, ULTIMATE_CAST_VOLUME, clearMeterCueState, createMeterCueState, meterCueFit, observeMeterCues, ultimateFirstEffectFrame } from "../presentation/meterCues";
import { type WorldOrigin, effectMotion, hideEffect, placeEffect } from "./effects";

class MeterCueModel {
  private model: effect | undefined;
  private shown = false;
  private seekAgain = false;

  // Online, Warcraft handles must be born on the same turn on every client, so shared play parks one handle made at startup instead of making one when the cue shows.
  constructor(private readonly cue: Cue, private readonly fit: MeterCueFit, private readonly origin: WorldOrigin, private readonly shared: boolean) {
    if (!shared) return;
    this.model = AddSpecialEffect(cue.model, origin.x, origin.y);
    hideEffect(this.model, origin);
  }

  showing(): boolean {
    return this.shown;
  }

  show(shown: boolean, fighter: Readonly<Fighter>, front: number): boolean {
    if (shown === this.shown) return false;
    this.shown = shown;
    if (!shown) {
      this.hide();
      return true;
    }
    const { x, y, z } = this.at(fighter, front);
    if (!this.shared) this.model = AddSpecialEffect(this.cue.model, x, y);
    const model = this.model;
    if (model === undefined) return true;
    placeEffect(model, x, y, z);
    BlzSetSpecialEffectScale(model, this.fit.scale);
    BlzSetSpecialEffectTimeScale(model, 1.0);
    if (this.cue.sequence !== undefined) BlzSetSpecialEffectAnimation(model, this.cue.sequence);
    BlzSetSpecialEffectTime(model, 0.0);
    this.seekAgain = true;
    return true;
  }

  follow(fighter: Readonly<Fighter> | undefined, front: number): void {
    const model = this.model;
    if (!this.shown || model === undefined || fighter === undefined) return;
    const { x, y, z } = this.at(fighter, front);
    placeEffect(model, x, y, z);
    if (!this.seekAgain) return;
    // Warcraft discards animation seeks in the callback selecting the animation (#58 native rulers).
    BlzSetSpecialEffectTime(model, 0.0);
    this.seekAgain = false;
  }

  setPaused(paused: boolean): void {
    if (this.shown && this.model !== undefined) BlzSetSpecialEffectTimeScale(this.model, paused ? 0.0 : 1.0);
  }

  clear(): void {
    this.shown = false;
    this.seekAgain = false;
    this.hide();
  }

  destroy(): void {
    this.clear();
    if (this.model !== undefined) DestroyEffect(this.model);
    this.model = undefined;
  }

  private readonly placed = { x: 0.0, y: 0.0, z: 0.0 };

  private at(fighter: Readonly<Fighter>, front: number): Readonly<{ x: number; y: number; z: number }> {
    this.placed.x = this.origin.x + fighter.motion.x + fighter.facing * this.fit.x;
    this.placed.y = front;
    this.placed.z = this.origin.z + fighter.motion.z + this.fit.z;
    return this.placed;
  }

  private hide(): void {
    const model = this.model;
    if (model === undefined) return;
    if (this.shared) hideEffect(model, this.origin);
    else {
      effectMotion().release(model);
      DestroyEffect(model);
      this.model = undefined;
    }
  }
}

/** The EX cast aura, the full-bar flame aura and the ultimate's flame burst over one fighter (docs/design/ultimates.md): sounds and trace follow confirmed frames, pictures the presented frame. */
export class MeterCueEffects {
  private readonly heard: MeterCueState = createMeterCueState();
  private readonly seen: MeterCueState = createMeterCueState();
  private readonly traced: MeterCueView = createMeterCueState().view;
  private readonly exAura: MeterCueModel;
  private readonly superAura: MeterCueModel;
  private readonly burst: MeterCueModel;
  private readonly exSound: sound;
  private readonly ultimateSound: sound;
  private readonly front: number;
  private lit: { readonly frame: number; readonly line: string } | undefined;

  constructor(character: Character, private readonly origin: WorldOrigin, shared = false) {
    this.front = origin.y - 12.0;
    this.exAura = new MeterCueModel(EX_AURA, meterCueFit(EX_AURA, character), origin, shared);
    this.superAura = new MeterCueModel(SUPER_AURA, meterCueFit(SUPER_AURA, character), origin, shared);
    this.burst = new MeterCueModel(ULTIMATE_BURST, meterCueFit(ULTIMATE_BURST, character), origin, shared);
    this.exSound = CreateSoundFromLabel(EX_AURA.sound ?? "", false, true, true, 10, 10);
    this.ultimateSound = CreateSoundFromLabel(ULTIMATE_BURST.sound ?? "", false, true, true, 10, 10);
  }

  confirm(frame: number, fighter: Readonly<Fighter> | undefined, playing: boolean, ultimatesOff: boolean, trace?: (text: string) => void): void {
    const view = observeMeterCues(this.heard, playing ? fighter : undefined, ultimatesOff);
    if (fighter === undefined || !playing) {
      if (this.traced.exAura || this.traced.superAura || this.traced.burst) this.forget();
      return;
    }
    if (view.superAura !== this.traced.superAura) {
      this.traced.superAura = view.superAura;
      const line = `super-aura ${view.superAura ? "on" : "off"} mana ${fighter.mana.points}`;
      this.lit = view.superAura ? { frame, line } : undefined;
      trace?.(line);
    }
    this.confirmUltimate(view, fighter, trace);
    this.confirmEx(view, fighter, trace);
  }

  private confirmUltimate(view: Readonly<MeterCueView>, fighter: Readonly<Fighter>, trace: ((text: string) => void) | undefined): void {
    const { frame } = fighter.special;
    if (view.ultimateSound) {
      this.play(this.ultimateSound, fighter, ULTIMATE_CAST_VOLUME);
      trace?.(`ultimate-sound ${ULTIMATE_BURST.sound ?? ""} action-frame ${frame} first-own-effect ${ultimateFirstEffectFrame(fighter.tuning.ultimate)}`);
    }
    if (view.burst === this.traced.burst) return;
    this.traced.burst = view.burst;
    trace?.(`ultimate-burst ${view.burst ? "on" : "off"} action-frame ${frame}`);
  }

  private confirmEx(view: Readonly<MeterCueView>, fighter: Readonly<Fighter>, trace: ((text: string) => void) | undefined): void {
    const { action, frame } = fighter.special;
    if (view.exSound) {
      this.play(this.exSound, fighter, EX_CAST_VOLUME);
      trace?.(`ex-sound ${EX_AURA.sound ?? ""} action ${action} action-frame ${frame}`);
    }
    if (view.exAura === this.traced.exAura) return;
    this.traced.exAura = view.exAura;
    trace?.(`ex-aura ${view.exAura ? "on" : "off"} action ${action} action-frame ${frame}`);
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, ultimatesOff: boolean): void {
    const live = playing ? fighter : undefined;
    const view = observeMeterCues(this.seen, live, ultimatesOff);
    if (live === undefined) {
      this.hideModels();
      return;
    }
    this.burst.follow(live, this.front);
    this.exAura.follow(live, this.front);
    this.superAura.follow(live, this.front);
    this.superAura.show(view.superAura, live, this.front);
    this.burst.show(view.burst, live, this.front);
    this.exAura.show(view.exAura, live, this.front);
  }

  /** The trace line and frame that lit the full-bar aura still showing, for a trace that starts after it. */
  litAura(): { readonly frame: number; readonly line: string } | undefined {
    return this.lit;
  }

  rebindModels(bind: (object: object, prototype: object) => void): void {
    bind(this.exAura, MeterCueModel.prototype);
    bind(this.superAura, MeterCueModel.prototype);
    bind(this.burst, MeterCueModel.prototype);
  }

  setPaused(paused: boolean): void {
    this.burst.setPaused(paused);
    this.exAura.setPaused(paused);
    this.superAura.setPaused(paused);
  }

  clear(): void {
    this.forget();
    this.hideModels();
  }

  private forget(): void {
    clearMeterCueState(this.heard);
    this.traced.exAura = false;
    this.traced.superAura = false;
    this.traced.burst = false;
    this.lit = undefined;
    StopSound(this.exSound, false, false);
    StopSound(this.ultimateSound, false, false);
  }

  private hideModels(): void {
    clearMeterCueState(this.seen);
    if (this.burst.showing()) this.burst.clear();
    if (this.exAura.showing()) this.exAura.clear();
    if (this.superAura.showing()) this.superAura.clear();
  }

  destroy(): void {
    this.burst.destroy();
    this.exAura.destroy();
    this.superAura.destroy();
    clearMeterCueState(this.heard);
    clearMeterCueState(this.seen);
    KillSoundWhenDone(this.exSound);
    KillSoundWhenDone(this.ultimateSound);
  }

  private play(cue: sound, fighter: Readonly<Fighter>, volume: number): void {
    StopSound(cue, false, false);
    SetSoundPosition(cue, this.origin.x + fighter.motion.x, this.origin.y, this.origin.z + fighter.motion.z);
    SetSoundVolume(cue, volume);
    StartSound(cue);
  }
}
