import type { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { characterModelScale } from "../presentation/modelScale";
import { CUE_ANCHORS, type Cue } from "../presentation/specialCues";
import { EX_AURA, EX_CAST_VOLUME, type MeterCueState, type MeterCueView, SUPER_AURA, ULTIMATE_BURST, ULTIMATE_CAST_VOLUME, clearMeterCueState, createMeterCueState, observeMeterCues, ultimateFirstEffectFrame } from "../presentation/meterCues";
import { type WorldOrigin, effectMotion, hideEffect, placeEffect } from "./effects";

class MeterCueModel {
  private model: effect | undefined;
  private shown = false;
  private seekAgain = false;

  // Online, Warcraft handles must be born on the same turn on every client, so shared play parks one handle made at startup instead of making one when the cue shows.
  constructor(private readonly cue: Cue, private readonly origin: WorldOrigin, private readonly shared: boolean) {
    if (!shared) return;
    this.model = AddSpecialEffect(cue.model, origin.x, origin.y);
    hideEffect(this.model, origin);
  }

  showing(): boolean {
    return this.shown;
  }

  show(shown: boolean, fighter: Readonly<Fighter>, front: number, scale: number): boolean {
    if (shown === this.shown) return false;
    this.shown = shown;
    if (!shown) {
      this.hide();
      return true;
    }
    const { x, y, z } = this.at(fighter, front, scale);
    if (!this.shared) this.model = AddSpecialEffect(this.cue.model, x, y);
    const model = this.model;
    if (model === undefined) return true;
    placeEffect(model, x, y, z);
    BlzSetSpecialEffectScale(model, this.cue.scale * scale);
    BlzSetSpecialEffectTimeScale(model, 1.0);
    if (this.cue.sequence !== undefined) BlzSetSpecialEffectAnimation(model, this.cue.sequence);
    BlzSetSpecialEffectTime(model, 0.0);
    this.seekAgain = true;
    return true;
  }

  follow(fighter: Readonly<Fighter> | undefined, front: number, scale: number): void {
    const model = this.model;
    if (!this.shown || model === undefined || fighter === undefined) return;
    const { x, y, z } = this.at(fighter, front, scale);
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

  private at(fighter: Readonly<Fighter>, front: number, scale: number): Readonly<{ x: number; y: number; z: number }> {
    const anchor = CUE_ANCHORS[this.cue.anchor];
    this.placed.x = this.origin.x + fighter.motion.x + fighter.facing * anchor.x * scale;
    this.placed.y = front;
    this.placed.z = this.origin.z + fighter.motion.z + anchor.z * scale;
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

/** The EX cast aura, the full-bar flame aura and the ultimate's flame burst over one fighter (docs/design/ultimates.md). */
export class MeterCueEffects {
  private readonly state: MeterCueState = createMeterCueState();
  private readonly exAura: MeterCueModel;
  private readonly superAura: MeterCueModel;
  private readonly burst: MeterCueModel;
  private readonly exSound: sound;
  private readonly ultimateSound: sound;
  private readonly front: number;
  private readonly scale: number;

  constructor(character: Character, private readonly origin: WorldOrigin, shared = false) {
    this.front = origin.y - 12.0;
    this.scale = characterModelScale(character);
    this.exAura = new MeterCueModel(EX_AURA, origin, shared);
    this.superAura = new MeterCueModel(SUPER_AURA, origin, shared);
    this.burst = new MeterCueModel(ULTIMATE_BURST, origin, shared);
    this.exSound = CreateSoundFromLabel(EX_AURA.sound ?? "", false, true, true, 10, 10);
    this.ultimateSound = CreateSoundFromLabel(ULTIMATE_BURST.sound ?? "", false, true, true, 10, 10);
  }

  confirm(fighter: Readonly<Fighter> | undefined, playing: boolean, ultimatesOff: boolean, trace?: (text: string) => void): void {
    const view = observeMeterCues(this.state, playing ? fighter : undefined, ultimatesOff);
    if (fighter === undefined || !playing) {
      if (this.burst.showing() || this.exAura.showing() || this.superAura.showing()) this.clear();
      return;
    }
    if (this.superAura.show(view.superAura, fighter, this.front, this.scale)) trace?.(`super-aura ${view.superAura ? "on" : "off"} mana ${fighter.mana.points}`);
    this.confirmUltimate(view, fighter, trace);
    this.confirmEx(view, fighter, trace);
  }

  private confirmUltimate(view: Readonly<MeterCueView>, fighter: Readonly<Fighter>, trace: ((text: string) => void) | undefined): void {
    const { frame } = fighter.special;
    if (view.ultimateSound) {
      this.play(this.ultimateSound, fighter, ULTIMATE_CAST_VOLUME);
      trace?.(`ultimate-sound ${ULTIMATE_BURST.sound ?? ""} action-frame ${frame} first-own-effect ${ultimateFirstEffectFrame(fighter.tuning.ultimate)}`);
    }
    if (this.burst.show(view.burst, fighter, this.front, this.scale)) trace?.(`ultimate-burst ${view.burst ? "on" : "off"} action-frame ${frame}`);
  }

  private confirmEx(view: Readonly<MeterCueView>, fighter: Readonly<Fighter>, trace: ((text: string) => void) | undefined): void {
    const { action, frame } = fighter.special;
    if (view.exSound) {
      this.play(this.exSound, fighter, EX_CAST_VOLUME);
      trace?.(`ex-sound ${EX_AURA.sound ?? ""} action ${action} action-frame ${frame}`);
    }
    if (this.exAura.show(view.exAura, fighter, this.front, this.scale)) trace?.(`ex-aura ${view.exAura ? "on" : "off"} action ${action} action-frame ${frame}`);
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean): void {
    const live = playing ? fighter : undefined;
    this.burst.follow(live, this.front, this.scale);
    this.exAura.follow(live, this.front, this.scale);
    this.superAura.follow(live, this.front, this.scale);
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
    clearMeterCueState(this.state);
    this.burst.clear();
    this.exAura.clear();
    this.superAura.clear();
    StopSound(this.exSound, false, false);
    StopSound(this.ultimateSound, false, false);
  }

  destroy(): void {
    this.burst.destroy();
    this.exAura.destroy();
    this.superAura.destroy();
    clearMeterCueState(this.state);
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
