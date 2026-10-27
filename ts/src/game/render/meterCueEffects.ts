import { type Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { EX_AURA, EX_AURA_FRAMES, EX_CAST_VOLUME, type MeterCue, type MeterCueFit, type MeterCueState, type MeterCueView, ULTIMATE_BURST, ULTIMATE_BURST_FRAMES, ultimateBurst, ULTIMATE_CAST_VOLUME, clearCastCue, clearMeterCueState, confirmCastCue, createCastCue, createMeterCueState, exCastFrame, hideCastCue, meterCueFit, observeMeterCues, presentCastCue, ultimateCastFrame, ultimateFirstEffectFrame } from "../presentation/meterCues";
import { type WorldOrigin, effectMotion, hideEffect, placeEffect } from "./effects";
import { ultimateCastSound } from "../presentation/moveSounds";

class MeterCueModel {
  private model: effect | undefined;
  private shown = false;
  private seekAgain = false;

  // Online, Warcraft handles must be born on the same turn on every client, so shared play parks one handle made at startup instead of making one when the cue shows.
  constructor(private readonly cue: MeterCue, private readonly fit: MeterCueFit, private readonly origin: WorldOrigin, private readonly shared: boolean) {
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
    if (this.cue.alpha !== undefined) BlzSetSpecialEffectAlpha(model, this.cue.alpha);
    BlzSetSpecialEffectTimeScale(model, 1.0);
    this.restart(model);
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

  drawnEffects(into: effect[]): void {
    if (this.shown && this.model !== undefined) into.push(this.model);
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

  private restart(model: effect): void {
    if (this.cue.sequence !== undefined) BlzSetSpecialEffectAnimation(model, this.cue.sequence);
    BlzSetSpecialEffectTime(model, 0.0);
    this.seekAgain = true;
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

/** The EX cast aura and the ultimate's flame burst over one fighter, and the trace of the meter readiness MeterGlow draws (docs/design/ultimates.md): sounds and trace follow confirmed frames; each cast's picture starts on the first presented or confirmed frame holding it and plays in full. */
export class MeterCueEffects {
  private readonly heard: MeterCueState = createMeterCueState();
  private readonly exCast = createCastCue(EX_AURA_FRAMES);
  private readonly burstCast = createCastCue(ULTIMATE_BURST_FRAMES);
  private readonly traced: MeterCueView = createMeterCueState().view;
  private readonly exAura: MeterCueModel;
  private readonly burst: MeterCueModel;
  private readonly exSound: sound;
  private readonly ultimateSound: sound;
  private readonly ultimateLabel: string;
  private readonly front: number;
  private lit: { readonly frame: number; readonly line: string } | undefined;

  constructor(character: Character, private readonly origin: WorldOrigin, shared = false) {
    this.ultimateLabel = ultimateCastSound(character) ?? ULTIMATE_BURST.sound ?? "";
    this.front = origin.y - 12.0;
    this.exAura = new MeterCueModel(EX_AURA, meterCueFit(EX_AURA, character), origin, shared);
    const burst = ultimateBurst(character);
    this.burst = new MeterCueModel(burst, meterCueFit(burst, character), origin, shared);
    this.exSound = CreateSoundFromLabel(EX_AURA.sound ?? "", false, true, true, 10, 10);
    this.ultimateSound = CreateSoundFromLabel(this.ultimateLabel, false, true, true, 10, 10);
  }

  confirm(frame: number, fighter: Readonly<Fighter> | undefined, playing: boolean, ultimatesOff: boolean, trace?: (text: string) => void): void {
    const live = playing ? fighter : undefined;
    const view = observeMeterCues(this.heard, live, ultimatesOff);
    confirmCastCue(this.exCast, exCastFrame(live, frame), live?.special.action ?? SpecialAction.none);
    confirmCastCue(this.burstCast, ultimateCastFrame(live, frame), live?.special.action ?? SpecialAction.none);
    if (fighter === undefined || !playing) {
      if (this.traced.exAura || this.traced.exReady || this.traced.superAura || this.traced.burst) this.forget();
      return;
    }
    if (view.superAura !== this.traced.superAura) {
      this.traced.superAura = view.superAura;
      const line = `super-aura ${view.superAura ? "on" : "off"} mana ${fighter.mana.points}`;
      this.lit = view.superAura ? { frame, line } : undefined;
      trace?.(line);
    }
    if (view.exReady !== this.traced.exReady) {
      this.traced.exReady = view.exReady;
      trace?.(`ex-ready ${view.exReady ? "on" : "off"} mana ${fighter.mana.points}`);
    }
    this.confirmUltimate(view, fighter, trace);
    this.confirmEx(view, fighter, trace);
  }

  private confirmUltimate(view: Readonly<MeterCueView>, fighter: Readonly<Fighter>, trace: ((text: string) => void) | undefined): void {
    const { frame } = fighter.special;
    if (view.ultimateSound) {
      this.play(this.ultimateSound, fighter, ULTIMATE_CAST_VOLUME);
      trace?.(`ultimate-sound ${this.ultimateLabel} action-frame ${frame} first-own-effect ${ultimateFirstEffectFrame(fighter.tuning.ultimate)}`);
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

  present(frame: number, fighter: Readonly<Fighter> | undefined, playing: boolean, trace?: (text: string) => void): void {
    const live = playing ? fighter : undefined;
    if (live === undefined) {
      this.hideModels();
      return;
    }
    this.burst.follow(live, this.front);
    this.exAura.follow(live, this.front);
    const { action } = live.special;
    const burst = presentCastCue(this.burstCast, frame, ultimateCastFrame(live, frame), action);
    if (this.burst.show(burst, live, this.front)) trace?.(`ultimate-burst ${burst ? "on" : "off"} action-frame ${live.special.frame} cast ${this.burstCast.cast}`);
    const exAura = presentCastCue(this.exCast, frame, exCastFrame(live, frame), action);
    if (this.exAura.show(exAura, live, this.front)) trace?.(`ex-aura ${exAura ? "on" : "off"} action-frame ${live.special.frame} cast ${this.exCast.cast}`);
  }

  /** The trace line and frame that lit the full-bar aura still showing, for a trace that starts after it. */
  litAura(): { readonly frame: number; readonly line: string } | undefined {
    return this.lit;
  }

  rebindModels(bind: (object: object, prototype: object) => void): void {
    bind(this.exAura, MeterCueModel.prototype);
    bind(this.burst, MeterCueModel.prototype);
  }

  drawnEffects(into: effect[]): void {
    this.exAura.drawnEffects(into);
    this.burst.drawnEffects(into);
  }

  setPaused(paused: boolean): void {
    this.burst.setPaused(paused);
    this.exAura.setPaused(paused);
  }

  clear(): void {
    clearCastCue(this.exCast);
    clearCastCue(this.burstCast);
    this.forget();
    this.hideModels();
  }

  private forget(): void {
    clearMeterCueState(this.heard);
    this.traced.exAura = false;
    this.traced.exReady = false;
    this.traced.superAura = false;
    this.traced.burst = false;
    this.lit = undefined;
    StopSound(this.exSound, false, false);
    StopSound(this.ultimateSound, false, false);
  }

  private hideModels(): void {
    hideCastCue(this.exCast);
    hideCastCue(this.burstCast);
    if (this.burst.showing()) this.burst.clear();
    if (this.exAura.showing()) this.exAura.clear();
  }

  destroy(): void {
    this.burst.destroy();
    this.exAura.destroy();
    clearMeterCueState(this.heard);
    clearCastCue(this.exCast);
    clearCastCue(this.burstCast);
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
