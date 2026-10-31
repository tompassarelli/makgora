





import { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { FOLLOW_UP_FORM } from "../sim/specials/schema";
import { ATTACK_CUES, type AttackCueState, attackCueState, fighterRenderedCues } from "../presentation/attackCues";
import { characterModelScale } from "../presentation/modelScale";
import { CUE_ANCHORS, MISSING_CUE_MODEL, type Cue } from "../presentation/specialCues";
import { shownCueState } from "../presentation/shownCueState";
import { PARKED_CUE_TIME_SCALE, type ParkedFlags, type WorldOrigin, facingYaw, parkCue, parkOnce, placeEffect } from "./effects";
import { HitAreaEffects } from "./hitAreaEffects";
import { BanishBeamEffects } from "./banishBeamEffects";
import { POPCORN_CUE_MODELS } from "../presentation/cueEmitterInfo";
import { modelFailed } from "wisp/src/platform/modelFailures";
import { idiv } from "wisp/src/sim/intMath";
import { fighterName } from "../roster/kits";
import { f32 } from "wisp/src/sim/f32";
import { specialAreaRegion } from "../presentation/disjointCues";
import { CueLinger, type CuePlace } from "../presentation/cueLinger";
import { clearEffectSubAnimations, createEffect, destroyEffect, playEffectAnimation, setEffectAlpha, setEffectAnimation, setEffectColor, setEffectPitch, setEffectPosition, setEffectRoll, setEffectScale, setEffectTime, setEffectTimeScale, setEffectYaw } from "wisp/game/effects";
import { displayTimedText } from "wisp/game/frames";
import { localPlayer } from "wisp/game/players";
import { playSound, releaseWhenDone, setSoundPosition, setSoundVolume, soundFromLabel, stopSound } from "wisp/game/sound";

interface CueModel {
  readonly cue: Cue;
  readonly model: effect;
}

export const POPCORN_VOICES = 2;

const cueKey = (fighter: Readonly<Fighter>): number => fighter.special.action * 100 + fighter.special.form + fighter.special.variant * 100000;

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
  private readonly banish: BanishBeamEffects | undefined;
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
  private readonly linger = new CueLinger();
  private readonly heldPlace: CuePlace = { x: 0.0, y: 0.0, z: 0.0, facing: 1, scale: 1.0 };

  // Online, Warcraft handles must be born on the same turn on every client, so shared play restarts emitters made here instead of making fresh ones on confirmed frames.
  constructor(private readonly character: Character, private readonly origin: WorldOrigin, private readonly shared: boolean, bodyScale = characterModelScale(character)) {
    this.missing = createEffect(MISSING_CUE_MODEL, origin.x, origin.y);
    this.areas = new HitAreaEffects(character, origin);
    this.front = origin.y - 12.0;
    this.scale = bodyScale;
    if (character === Character.kaelthas) this.banish = new BanishBeamEffects(origin, this.front, this.scale);
    for (const shown of fighterRenderedCues(character)) {
      const cue = shown;
      if (cue.sound !== undefined && this.cueSounds[cue.sound] === undefined) this.cueSounds[cue.sound] = soundFromLabel(cue.sound, false, true, true, 10, 10);
      if (POPCORN_CUE_MODELS[cue.model] !== true) this.cues.push({ cue, model: createEffect(cue.model, origin.x, origin.y) });
      else if (shared && this.voices[cue.model] === undefined) {
        const models: effect[] = [];
        for (let voice = 0; voice < (cue.birth?.voices ?? POPCORN_VOICES); voice++) {
          const model = createEffect(cue.model, origin.x, origin.y);
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
    this.banish?.clear();
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry !== undefined) parkCue(entry.model, this.origin, parked, index);
    }
    this.shown = undefined;
    this.shownKey = 0;
    this.seekAgain = false;
    this.linger.clear();
    for (const entry of this.popcorn) this.retirePopcorn(entry.model);
    this.popcorn.length = 0;
    this.confirmedCue = undefined;
    this.confirmedKey = 0;
    this.confirmedFrame = 0;
    this.popcornNow = 0.0;
    for (const sound of Object.values(this.cueSounds)) if (sound !== undefined) stopSound(sound, false, false);
  }


  confirm(fighter: Readonly<Fighter> | undefined, playing: boolean, now: number): void {
    this.popcornNow = now;
    const state = fighter === undefined || !playing ? undefined : shownCueState(fighter);
    let cue = state?.cues === undefined || state.phase === "none" ? undefined
      : state.phase === "startup" ? state.cues.startup : state.cues.active;
    let key = fighter === undefined ? 0 : cueKey(fighter);
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
        stopSound(sound, false, false);
        setSoundPosition(sound, this.origin.x + fighter.motion.x, this.origin.y, this.origin.z + fighter.motion.z);
        setSoundVolume(sound, 127);
        playSound(sound);
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
    this.areas.present(fighter, playing, paused);
    this.banish?.present(fighter, playing, paused);
    let cue: Cue | undefined;
    let x = 0.0;
    let z = 0.0;
    let key = 0;
    let cueName = "normal attack";
    let attackNamed = false;
    let strikeScale = 1.0;
    if (fighter !== undefined && playing) {
      const special = shownCueState(fighter);
      if (special.cues !== undefined && special.phase !== "none") {
        cue = special.phase === "startup" ? special.cues.startup : special.cues.active;
        cueName = `${special.cues.spell} ${special.phase}`;
        const anchor = CUE_ANCHORS[cue.anchor];
        x = anchor.x * this.scale;
        z = anchor.z * this.scale;
        key = cueKey(fighter);
        if (cue.rebirthFrames !== undefined) key += 1000000 * (1 + idiv(fighter.special.frame, cue.rebirthFrames));
      } else {
        const attack = attackCueState(fighter, this.attack);
        cue = attack.cue;
        attackNamed = true;
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
      setEffectScale(this.missing, 1.5 * this.scale);
      setEffectColor(this.missing, 255, 0, 255);
      setEffectAlpha(this.missing, 255);
      if (attackNamed) for (const entries of Object.values(ATTACK_CUES[this.character] ?? {})) for (const entry of entries ?? []) if (entry.cue === cue) cueName = entry.name;
      const identity = `${cueName}: ${cue.model}`;
      if (this.reported[identity] !== true) {
        this.reported[identity] = true;
        displayTimedText(localPlayer(), 0.0, 0.0, 30.0, `Missing effect: ${fighterName(this.character)} / ${identity}`);
      }
    } else parkOnce(this.missing, this.origin, this.missingParked, 0);
    const held = fighter !== undefined && cue !== undefined && !failed && POPCORN_CUE_MODELS[cue.model] !== true ? cue : undefined;
    if (held !== undefined && fighter !== undefined) {
      const progress = held.scaleFrames === undefined ? 0.0 : f32(Math.min(1.0, Math.max(0.0, f32((fighter.special.frame - 1 + (fighter.special.form < FOLLOW_UP_FORM ? fighter.special.charge : 0)) / Math.max(1, held.scaleFrames - 1)))));
      const scale = held.scaleEnd === undefined ? held.scale : f32(held.scale + f32(f32(held.scaleEnd - held.scale) * progress));
      const place = this.heldPlace;
      place.x = this.origin.x + fighter.motion.x + fighter.facing * x;
      place.y = this.front - (held.depth ?? 0.0) * this.scale;
      place.z = this.origin.z + fighter.motion.z + z;
      place.facing = fighter.facing;
      place.scale = scale * strikeScale * this.scale;
    }
    this.linger.show(held, held === undefined ? undefined : this.heldPlace, this.popcornNow, fighter === undefined || !playing || fighter.status.out);
    const lingering = this.linger.lingering;
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry === undefined) continue;
      const place = entry.cue === held ? this.heldPlace : entry.cue === lingering ? this.linger.place : undefined;
      if (fighter === undefined || place === undefined) {
        parkCue(entry.model, this.origin, parked, index);
        continue;
      }
      const { model } = entry;
      parked[index] = false;
      placeEffect(model, place.x, place.y, place.z);
      // A lingering cue keeps playing the animation it already had.
      if (entry.cue === held && (this.shown !== held || this.shownKey !== key)) {
        if (entry.cue.sequence !== undefined) setEffectAnimation(model, entry.cue.sequence);
        setEffectTime(model, entry.cue.seconds ?? 0.0);
        this.seekAgain = true;
      } else if (entry.cue === held && this.seekAgain) {
        // Warcraft discards animation seeks in the callback selecting the animation (#58 native rulers).
        setEffectTime(model, entry.cue.seconds ?? 0.0);
        this.seekAgain = false;
      }
      setEffectYaw(model, entry.cue.yaw ?? facingYaw(place.facing));
      setEffectPitch(model, entry.cue.pitch ?? 0.0);
      setEffectRoll(model, entry.cue.roll ?? 0.0);
      setEffectScale(model, place.scale);
      setEffectAlpha(model, entry.cue.alpha ?? 255);
      const color = entry.cue.color;
      if (color !== undefined) setEffectColor(model, color[0], color[1], color[2]);
      setEffectTimeScale(model, paused || fighter.launch.hitlag > 0 ? 0.0 : entry.cue.timeScale ?? 1.0);
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
        setEffectYaw(entry.model, entry.cue.yaw ?? facingYaw(lingering ? entry.facing : fighter.facing));
        setEffectPitch(entry.model, entry.cue.pitch ?? 0.0);
        setEffectRoll(entry.model, entry.cue.roll ?? 0.0);
        setEffectScale(entry.model, (lingering ? entry.scale : placed?.scale ?? entry.cue.scale * strikeScale) * this.scale);
        if (entry.cue.birth === undefined) {
          if (entry.seekStep === 0 && entry.cue.sequence !== undefined) setEffectAnimation(entry.model, entry.cue.sequence);
          if (entry.seekStep < 2) { setEffectTime(entry.model, entry.cue.seconds ?? 0.0); entry.seekStep++; }
          setEffectTimeScale(entry.model, paused || fighter.launch.hitlag > 0 ? 0.0 : 1.0);
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
      const model = createEffect(path, position.x, position.y);
      setEffectPosition(model, position.x, position.y, position.z);
      setEffectScale(model, scale * this.scale);
      setEffectYaw(model, cue.yaw ?? facingYaw(facing));
      setEffectPitch(model, cue.pitch ?? 0.0);
      setEffectRoll(model, cue.roll ?? 0.0);
      playEffectAnimation(model, ANIM_TYPE_BIRTH);
      return model;
    }
    const voices = this.voices[path];
    const model = voices?.models[voices.next];
    if (voices === undefined || model === undefined) return undefined;
    voices.next = voices.next + 1 >= voices.models.length ? 0 : voices.next + 1;
    for (let index = this.popcorn.length - 1; index >= 0; index--) if (this.popcorn[index]?.model === model) this.popcorn.splice(index, 1);
    setEffectPosition(model, position.x, position.y, position.z);
    setEffectScale(model, scale * this.scale);
    setEffectYaw(model, cue.yaw ?? facingYaw(facing));
    setEffectPitch(model, cue.pitch ?? 0.0);
    setEffectRoll(model, cue.roll ?? 0.0);
    setEffectTimeScale(model, 1.0);
    clearEffectSubAnimations(model);
    playEffectAnimation(model, ANIM_TYPE_BIRTH);
    return model;
  }

  private retirePopcorn(model: effect): void {
    this.parkPopcorn(model);
    if (!this.shared) destroyEffect(model);
  }

  private parkPopcorn(model: effect): void {
    parkCue(model, this.origin, [], 0);
  }

  setPaused(paused: boolean): void {
    this.areas.setPaused(paused);
    this.banish?.setPaused(paused);
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry !== undefined) setEffectTimeScale(entry.model, paused ? 0.0 : parked[index] === true ? PARKED_CUE_TIME_SCALE : entry.cue.timeScale ?? 1.0);
    }
    for (const { model } of this.popcorn) setEffectTimeScale(model, paused ? 0.0 : 1.0);
  }

  weaponEffects(into: effect[]): void {
    this.areas.drawnEffects(into);
    this.banish?.drawnEffects(into);
  }

  drawnEffects(into: effect[]): void {
    into.push(this.missing);
    for (const { model } of this.cues) into.push(model);
    for (const { model } of this.popcorn) into.push(model);
    for (const voices of Object.values(this.voices)) for (const model of voices?.models ?? []) into.push(model);
    this.areas.drawnEffects(into);
    this.banish?.drawnEffects(into);
  }

  destroy(): void {
    this.clear();
    this.areas.destroy();
    this.banish?.destroy();
    destroyEffect(this.missing);
    for (const sound of Object.values(this.cueSounds)) if (sound !== undefined) releaseWhenDone(sound);
    for (const { model } of this.cues) destroyEffect(model);
    this.cues.length = 0;
    for (const voices of Object.values(this.voices)) for (const model of voices?.models ?? []) destroyEffect(model);
  }
}
