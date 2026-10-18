





import { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { ATTACK_CUES, type AttackCueState, attackCueState, fighterRenderedCues } from "../presentation/attackCues";
import { characterModelScale } from "../presentation/modelScale";
import { CUE_ANCHORS, MISSING_CUE_MODEL, type Cue, specialCueState } from "../presentation/specialCues";
import { PARKED_CUE_TIME_SCALE, type ParkedFlags, type WorldOrigin, facingYaw, parkCue, parkOnce, placeEffect } from "./effects";
import { HitAreaEffects } from "./hitAreaEffects";
import { POPCORN_CUE_MODELS } from "../presentation/cueEmitterInfo";
import { modelFailed } from "wisp/src/platform/modelFailures";
import { idiv } from "wisp/src/sim/intMath";
import { fighterName } from "../sim/heroes/registry";
import { f32 } from "wisp/src/sim/f32";
import { specialAreaRegion } from "../presentation/disjointCues";

interface CueModel {
  readonly cue: Cue;
  readonly model: effect;
}

export const POPCORN_VOICES = 2;

interface PopcornVoices {
  readonly models: effect[];
  next: number;
}

interface PopcornCue {
  readonly cue: Cue;
  readonly model: effect;
  readonly born: number;
  readonly position: WorldOrigin;
  readonly facing: number;
  readonly scale: number;
  readonly strike: number | undefined;
  seekStep: number;
}

interface CuePlacement {
  x: number;
  z: number;
  scale: number;
}

export class SpecialCueEffects {
  private readonly missing: effect;
  private readonly missingParked: ParkedFlags = [];
  private readonly reported: Record<string, boolean | undefined> = {};
  private readonly areas: HitAreaEffects;
  private readonly cues: CueModel[] = [];
  private parked: ParkedFlags | undefined;

  private shown: Cue | undefined;
  private shownKey = 0;
  private seekAgain = false;
  private readonly popcorn: PopcornCue[] = [];
  private confirmedCue: Cue | undefined;
  private confirmedKey = 0;
  private confirmedFrame = 0;
  private popcornNow = 0.0;
  private readonly front: number;
  private readonly scale: number;
  private readonly attack: AttackCueState = { cue: undefined, x: 0.0, z: 0.0, key: 0 };
  private readonly confirmedAttack: AttackCueState = { cue: undefined, x: 0.0, z: 0.0, key: 0 };
  private readonly voices: { [model: string]: PopcornVoices | undefined } = {};
  private readonly placed: CuePlacement = { x: 0.0, z: 0.0, scale: 0.0 };
  private readonly cueSounds: { [name: string]: sound | undefined } = {};

  // Online, Warcraft handles must be born on the same turn on every client, so shared play restarts emitters made here instead of making fresh ones on confirmed frames.
  constructor(private readonly character: Character, private readonly origin: WorldOrigin, private readonly shared = false) {
    this.missing = AddSpecialEffect(MISSING_CUE_MODEL, origin.x, origin.y);
    this.areas = new HitAreaEffects(character, origin);
    this.front = origin.y - 12.0;
    this.scale = characterModelScale(character);
    for (const shown of fighterRenderedCues(character)) {
      const cue = shown;
      if (cue.sound !== undefined && this.cueSounds[cue.sound] === undefined) this.cueSounds[cue.sound] = CreateSoundFromLabel(cue.sound, false, true, true, 10, 10);
      if (POPCORN_CUE_MODELS[cue.model] !== true) this.cues.push({ cue, model: AddSpecialEffect(cue.model, origin.x, origin.y) });
      else if (shared && this.voices[cue.model] === undefined) {
        const models: effect[] = [];
        for (let voice = 0; voice < (cue.birth?.voices ?? POPCORN_VOICES); voice++) {
          const model = AddSpecialEffect(cue.model, origin.x, origin.y);
          this.parkPopcorn(model);
          models.push(model);
        }
        this.voices[cue.model] = { models, next: 0 };
      }
    }
    this.clear();
  }

  clear(): void {
    parkOnce(this.missing, this.origin, this.missingParked, 0);
    this.areas.clear();
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry !== undefined) parkCue(entry.model, this.origin, parked, index);
    }
    this.shown = undefined;
    this.shownKey = 0;
    this.seekAgain = false;
    for (const entry of this.popcorn) this.retirePopcorn(entry.model);
    this.popcorn.length = 0;
    this.confirmedCue = undefined;
    this.confirmedKey = 0;
    this.confirmedFrame = 0;
    this.popcornNow = 0.0;
    for (const sound of Object.values(this.cueSounds)) if (sound !== undefined) StopSound(sound, false, false);
  }


  confirm(fighter: Readonly<Fighter> | undefined, playing: boolean, now: number): void {
    this.popcornNow = now;
    const state = fighter === undefined || !playing ? undefined : specialCueState(fighter);
    let cue = state?.cues === undefined || state.phase === "none" ? undefined
      : state.phase === "startup" ? state.cues.startup : state.cues.active;
    let key = fighter === undefined ? 0 : fighter.special.action * 100 + fighter.special.form;
    if (fighter !== undefined && state !== undefined && cue === undefined) {
      const attack = attackCueState(fighter, this.confirmedAttack);
      if (attack.cue !== undefined) {
        cue = attack.cue;
        key = 100 + attack.key;
      }
    }
    if (cue?.birth?.strike !== undefined && (fighter === undefined || specialAreaRegion(fighter, cue.birth.strike).strike === undefined)) cue = undefined;
    const frame = fighter?.special.frame ?? 0;
    if (cue?.sound !== undefined && fighter !== undefined && (cue !== this.confirmedCue || key !== this.confirmedKey || frame < this.confirmedFrame)) {
      const sound = this.cueSounds[cue.sound];
      if (sound !== undefined) {
        StopSound(sound, false, false);
        SetSoundPosition(sound, this.origin.x + fighter.motion.x, this.origin.y, this.origin.z + fighter.motion.z);
        SetSoundVolume(sound, 127);
        StartSound(sound);
      }
    }
    if (cue !== undefined && fighter !== undefined && POPCORN_CUE_MODELS[cue.model] === true && (cue !== this.confirmedCue || key !== this.confirmedKey || (cue.birth?.eachFrame === true && frame !== this.confirmedFrame))) {
      const first = cue.birth?.strike;
      const count = first === undefined ? 1 : cue.birth?.strikes ?? 1;
      for (let offset = 0; offset < count; offset++) {
        const index = first === undefined ? undefined : first + offset;
        if (!this.place(fighter, cue, index)) continue;
        const { x, z, scale } = this.placed;
        const position = {
          x: this.origin.x + fighter.motion.x + fighter.facing * x,
          y: this.front - (cue.depth ?? 0.0) * this.scale,
          z: this.origin.z + fighter.motion.z + z,
        };
        const model = this.popcornModel(cue, position, fighter.facing, scale);
        if (model !== undefined) this.popcorn.push({ cue, model, born: now, position, facing: fighter.facing, scale, strike: index, seekStep: 0 });
      }
    }
    for (let index = this.popcorn.length - 1; index >= 0; index--) {
      const entry = this.popcorn[index];
      if (entry !== undefined && entry.cue !== cue && now - entry.born >= 1.0) {
        this.retirePopcorn(entry.model);
        this.popcorn.splice(index, 1);
      }
    }
    this.confirmedCue = cue;
    this.confirmedKey = key;
    this.confirmedFrame = frame;
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, paused: boolean): void {
    this.areas.present(fighter, playing);
    let cue: Cue | undefined;
    let x = 0.0;
    let z = 0.0;
    let key = 0;
    let cueName = "normal attack";
    let strikeScale = 1.0;
    if (fighter !== undefined && playing) {
      const special = specialCueState(fighter);
      if (special.cues !== undefined && special.phase !== "none") {
        cue = special.phase === "startup" ? special.cues.startup : special.cues.active;
        cueName = `${special.cues.spell} ${special.phase}`;
        const anchor = CUE_ANCHORS[cue.anchor];
        x = anchor.x * this.scale;
        z = anchor.z * this.scale;
        key = fighter.special.action * 100 + fighter.special.form;
        if (cue.rebirthFrames !== undefined) key += 1000000 * (1 + idiv(fighter.special.frame, cue.rebirthFrames));
      } else {
        const attack = attackCueState(fighter, this.attack);
        cue = attack.cue;
        for (const entries of Object.values(ATTACK_CUES[this.character] ?? {})) for (const entry of entries ?? []) if (entry.cue === cue) cueName = entry.name;
        if (cue !== undefined && cue.anchor === "overhead") {
          x = 0.0;
          z = CUE_ANCHORS.overhead.z * this.scale;
        } else {
          x = attack.x;
          z = attack.z;
        }
        key = 100 + attack.key;
      }
    }
    if (cue?.birth?.strike !== undefined && fighter !== undefined) {
      const strike = specialAreaRegion(fighter, cue.birth.strike).strike;
      if (strike === undefined) cue = undefined;
      else {
        x = strike.x2; z = strike.z2;
        if (cue.birth.strikeRadius !== undefined) strikeScale = f32(strike.radius / cue.birth.strikeRadius);
      }
    }
    const anchorFrame = fighter === undefined ? undefined : cue?.anchorFrames?.[Math.max(0, fighter.special.frame - 1)];
    if (anchorFrame !== undefined) {
      x = anchorFrame.x * this.scale;
      z = anchorFrame.z * this.scale;
    }
    const parked = (this.parked ??= []);
    const failed = cue !== undefined && modelFailed(cue.model);
    if (failed && fighter !== undefined && cue !== undefined) {
      this.missingParked[0] = false;
      placeEffect(this.missing, this.origin.x + fighter.motion.x + fighter.facing * x, this.front, this.origin.z + fighter.motion.z + z);
      BlzSetSpecialEffectScale(this.missing, 1.5 * this.scale);
      BlzSetSpecialEffectColor(this.missing, 255, 0, 255);
      BlzSetSpecialEffectAlpha(this.missing, 255);
      const identity = `${cueName}: ${cue.model}`;
      if (this.reported[identity] !== true) {
        this.reported[identity] = true;
        DisplayTimedTextToPlayer(GetLocalPlayer(), 0.0, 0.0, 30.0, `Missing effect: ${fighterName(this.character)} / ${identity}`);
      }
    } else parkOnce(this.missing, this.origin, this.missingParked, 0);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry === undefined) continue;
      if (fighter === undefined || entry.cue !== cue || failed) {
        parkCue(entry.model, this.origin, parked, index);
        continue;
      }
      const { model } = entry;
      parked[index] = false;
      placeEffect(model, this.origin.x + fighter.motion.x + fighter.facing * x, this.front - (cue.depth ?? 0.0) * this.scale, this.origin.z + fighter.motion.z + z);
      if (this.shown !== cue || this.shownKey !== key) {
        if (entry.cue.sequence !== undefined) BlzSetSpecialEffectAnimation(model, entry.cue.sequence);
        BlzSetSpecialEffectTime(model, entry.cue.seconds ?? 0.0);
        this.seekAgain = true;
      } else if (this.seekAgain) {
        // Warcraft discards animation seeks in the callback selecting the animation (#58 native rulers).
        BlzSetSpecialEffectTime(model, entry.cue.seconds ?? 0.0);
        this.seekAgain = false;
      }
      BlzSetSpecialEffectYaw(model, cue.yaw ?? facingYaw(fighter.facing));
      BlzSetSpecialEffectPitch(model, entry.cue.pitch ?? 0.0);
      BlzSetSpecialEffectRoll(model, entry.cue.roll ?? 0.0);
      const progress = entry.cue.scaleFrames === undefined ? 0.0 : f32(Math.min(1.0, Math.max(0.0, f32((fighter.special.frame - 1) / Math.max(1, entry.cue.scaleFrames - 1)))));
      const scale = entry.cue.scaleEnd === undefined ? entry.cue.scale : f32(entry.cue.scale + f32(f32(entry.cue.scaleEnd - entry.cue.scale) * progress));
      BlzSetSpecialEffectScale(model, scale * strikeScale * this.scale);
      BlzSetSpecialEffectAlpha(model, entry.cue.alpha ?? 255);
      const color = entry.cue.color;
      if (color !== undefined) BlzSetSpecialEffectColor(model, color[0], color[1], color[2]);
      BlzSetSpecialEffectTimeScale(model, paused || fighter.launch.hitlag > 0 ? 0.0 : entry.cue.timeScale ?? 1.0);
    }
    if (fighter !== undefined && playing) {
      for (const entry of this.popcorn) {
        if (modelFailed(entry.cue.model)) {
          this.parkPopcorn(entry.model);
          continue;
        }
        const lingering = entry.cue !== cue && !fighter.status.out && entry.cue.birth?.lingerFrames !== undefined
          && entry.born + entry.cue.birth.lingerFrames / 60.0 >= this.popcornNow;
        if (entry.cue !== cue && !lingering) {
          this.parkPopcorn(entry.model);
          continue;
        }
        if (!lingering && entry.strike !== undefined && !this.place(fighter, entry.cue, entry.strike)) {
          this.parkPopcorn(entry.model);
          continue;
        }
        const placed = entry.strike === undefined ? undefined : this.placed;
        const position = lingering ? entry.position : { x: this.origin.x + fighter.motion.x + fighter.facing * (placed?.x ?? x), y: this.front - (entry.cue.depth ?? 0.0) * this.scale, z: this.origin.z + fighter.motion.z + (placed?.z ?? z) };
        placeEffect(entry.model, position.x, position.y, position.z);
        BlzSetSpecialEffectYaw(entry.model, entry.cue.yaw ?? facingYaw(lingering ? entry.facing : fighter.facing));
        BlzSetSpecialEffectPitch(entry.model, entry.cue.pitch ?? 0.0);
        BlzSetSpecialEffectRoll(entry.model, entry.cue.roll ?? 0.0);
        BlzSetSpecialEffectScale(entry.model, (lingering ? entry.scale : placed?.scale ?? entry.cue.scale * strikeScale) * this.scale);
        if (entry.cue.birth === undefined) {
          if (entry.seekStep === 0 && entry.cue.sequence !== undefined) BlzSetSpecialEffectAnimation(entry.model, entry.cue.sequence);
          if (entry.seekStep < 2) { BlzSetSpecialEffectTime(entry.model, entry.cue.seconds ?? 0.0); entry.seekStep++; }
          BlzSetSpecialEffectTimeScale(entry.model, paused || fighter.launch.hitlag > 0 ? 0.0 : 1.0);
        }
      }
    }
    this.shown = cue;
    this.shownKey = key;
  }

  private place(fighter: Readonly<Fighter>, cue: Cue, index: number | undefined): boolean {
    const out = this.placed;
    if (index === undefined) {
      const anchor = CUE_ANCHORS[cue.anchor];
      out.x = anchor.x * this.scale;
      out.z = anchor.z * this.scale;
      out.scale = cue.scale;
      return true;
    }
    const strike = specialAreaRegion(fighter, index).strike;
    if (strike === undefined) return false;
    const ratio = cue.birth?.strikeRadius === undefined ? 1.0 : f32(strike.radius / cue.birth.strikeRadius);
    out.scale = f32(cue.scale * (cue.birth?.taper === true ? f32(ratio * ratio) : ratio));
    const trail = cue.birth?.trail;
    if (trail === undefined) {
      out.x = strike.x2;
      out.z = strike.z2;
    } else {
      out.x = f32(f32(f32(strike.x1 + strike.x2) * 0.5) + f32(trail * out.scale));
      out.z = f32(f32(strike.z1 + strike.z2) * 0.5);
    }
    return true;
  }

  private popcornModel(cue: Cue, position: WorldOrigin, facing: number, scale: number): effect | undefined {
    const path = cue.model;
    if (!this.shared) {
      const model = AddSpecialEffect(path, position.x, position.y);
      BlzSetSpecialEffectPosition(model, position.x, position.y, position.z);
      BlzSetSpecialEffectScale(model, scale * this.scale);
      BlzSetSpecialEffectYaw(model, cue.yaw ?? facingYaw(facing));
      BlzSetSpecialEffectPitch(model, cue.pitch ?? 0.0);
      BlzSetSpecialEffectRoll(model, cue.roll ?? 0.0);
      BlzPlaySpecialEffect(model, ANIM_TYPE_BIRTH);
      return model;
    }
    const voices = this.voices[path];
    const model = voices?.models[voices.next];
    if (voices === undefined || model === undefined) return undefined;
    voices.next = voices.next + 1 >= voices.models.length ? 0 : voices.next + 1;
    for (let index = this.popcorn.length - 1; index >= 0; index--) if (this.popcorn[index]?.model === model) this.popcorn.splice(index, 1);
    BlzSetSpecialEffectPosition(model, position.x, position.y, position.z);
    BlzSetSpecialEffectScale(model, scale * this.scale);
    BlzSetSpecialEffectYaw(model, cue.yaw ?? facingYaw(facing));
    BlzSetSpecialEffectPitch(model, cue.pitch ?? 0.0);
    BlzSetSpecialEffectRoll(model, cue.roll ?? 0.0);
    BlzSetSpecialEffectTimeScale(model, 1.0);
    BlzSpecialEffectClearSubAnimations(model);
    BlzPlaySpecialEffect(model, ANIM_TYPE_BIRTH);
    return model;
  }

  private retirePopcorn(model: effect): void {
    this.parkPopcorn(model);
    if (!this.shared) DestroyEffect(model);
  }

  private parkPopcorn(model: effect): void {
    parkCue(model, this.origin, [], 0);
  }

  setPaused(paused: boolean): void {
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry !== undefined) BlzSetSpecialEffectTimeScale(entry.model, paused ? 0.0 : parked[index] === true ? PARKED_CUE_TIME_SCALE : entry.cue.timeScale ?? 1.0);
    }
    for (const { model } of this.popcorn) BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
  }

  weaponEffects(into: effect[]): void {
    this.areas.drawnEffects(into);
  }

  destroy(): void {
    this.clear();
    this.areas.destroy();
    DestroyEffect(this.missing);
    for (const sound of Object.values(this.cueSounds)) if (sound !== undefined) KillSoundWhenDone(sound);
    for (const { model } of this.cues) DestroyEffect(model);
    this.cues.length = 0;
    for (const voices of Object.values(this.voices)) for (const model of voices?.models ?? []) DestroyEffect(model);
  }
}
