

import { DEMON_HUNTER_MODEL_FILE } from "../presentation/demonHunterAssetInfo";
import { RIFLEMAN_MODEL_FILE } from "../presentation/fighterAssetInfo";
import {
  IMPACT_CHARGE,
  IMPACT_COUNT,
  IMPACT_GRAB,
  IMPACT_KIND_COUNT,
  IMPACT_LEDGE_CATCH,
  IMPACT_LEDGE_RECOVERY,
  IMPACT_READY,
  IMPACT_SCREEN_KO,
  IMPACT_STAR_KO,
  IMPACT_THROW,
  IMPACTS_PER_KIND,
  type ImpactPose,
  type ImpactState,
  advanceImpacts,
  clearImpactState,
  clearImpactSlot,
  createImpactState,
  emitImpacts,
  isContactImpact,
  KO_STAR_FLIGHT_FRAMES,
  projectImpact,
  projectKo,
  STAR_KO_DEPTH,
} from "../presentation/impactState";
import { createMatchCamera, type MatchCamera } from "../sim/matchCamera";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { impactAnimation, impactColour, impactModel, impactModelScale, impactSoundNames, impactStartSeconds, presentImpactSounds, presentStarKoTwinkle, presentStartSounds, type ImpactSoundSink } from "../presentation/hitPresentation";
import { VOICE_CAP, VoiceClass, admitVoice, createVoiceBudget, liveVoices, resetVoiceBudget } from "../presentation/voiceBudget";
import { SoundBank, SoundKind } from "./soundBank";
import { tierSoundPaths } from "../presentation/moveTiers";
import type { ImpactEvents } from "../presentation/impactEvents";
import { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS } from "../roster/kits";
import { type ParkedFlags, type WorldOrigin, hideEffect, parkOnce, placeEffect } from "./effects";
import { characterModelScale } from "../presentation/modelScale";
import { originalClip, originalClipNamed } from "../../generated/clips/fighterOriginalClipInfo";
import { KO_BLUR_DISTANCE, type KoFlash, createKoFlash, endKoFlash, koFlashLevels, noteKoFlash } from "../presentation/koFlash";
import type { Fighter } from "../sim/fighter";
import { heroLook } from "../roster/looks";
import { bodyCostume, bodyVariants, costumeClipModel } from "../roster/costumes";


const KO_VARIANTS = bodyVariants(SELECTABLE_CHARACTERS);
const KO_FIGHTERS = KO_VARIANTS.length;
const KO_BODY_COUNT = IMPACTS_PER_KIND * 2 * KO_FIGHTERS;
const STAR_KO_FIRST = IMPACT_STAR_KO * IMPACTS_PER_KIND;


const SAME_HIT_FRAMES = 2;

const DRAWN_FRAMES = 64;


const shieldSerial = (events: Readonly<ImpactEvents>): number => (events.shieldHit ? events.shieldVariant : -1);

const impactSerial = (events: Readonly<ImpactEvents>): number => (events.impact >= 0 ? events.performSerial : -1);

const startSerial = (events: Readonly<ImpactEvents>): number => (events.perform >= 0 ? events.performSerial * 256 + events.perform : events.swing >= 0 ? -2 - events.swing : -1);


export function fighterModel(character: number): string {
  const look = heroLook(character);
  if (look !== undefined) return look.model;
  return character === Character.rifleman ? RIFLEMAN_MODEL_FILE : DEMON_HUNTER_MODEL_FILE;
}

export class CombatEffects {
  private readonly impacts: effect[] = [];
  private readonly koBodies: effect[] = [];
  readonly sounds = new SoundBank();

  private soundFrames: number[] = [];

  private soundsFrom: "every" | "early" | "late" = "every";

  private earlySoundTried = false;

  private earlyHitFrames: number[] = [];
  private earlyHitSerials: number[] = [];
  private earlyShieldSerials: number[] = [];
  private earlyPerformSerials: number[] = [];
  private earlyStartSerials: number[] = [];

  private readonly voices = createVoiceBudget();

  private readonly voiceHandles: (sound | undefined)[] = [];

  private shownAges: (number | undefined)[] | undefined;

  private shownEmissions: (number | undefined)[] = [];

  private tints: (readonly number[] | undefined)[] | undefined;

  private drawnContacts: number[] = [];





  private readonly late: ImpactState = createImpactState();

  private lateConfirmed: (number | undefined)[] = [];
  private lateLive = 0;
  private presentedFrame: number | undefined;

  private koFlash: KoFlash | undefined;
  private koFlashShown = false;
  cineFilter = true;

  private koParked: (boolean | undefined)[] | undefined;

  private readonly koOwners: (number | undefined)[] = [];

  private parked: ParkedFlags | undefined;

  private readonly busyKinds: boolean[] = [];

  private camera: Readonly<MatchCamera> = createMatchCamera();

  private readonly pose: ImpactPose = { visible: false, alpha: 0, scale: 0.0, x: 0.0, z: 0.0, pitch: 0.0 };

  readonly x: number;
  readonly y: number;
  readonly z: number;

  costumeOf: (slot: number) => number = () => 0;

  constructor(origin: WorldOrigin) {
    this.x = origin.x;
    this.y = origin.y - 8.0;
    this.z = origin.z;
    const parked: ParkedFlags = [];
    this.parked = parked;
    const names = impactSoundNames(SELECTABLE_CHARACTERS);
    for (const path of tierSoundPaths()) Preload(path);
    this.sounds.prepare(SoundKind.combatFile, names.files);
    this.sounds.prepare(SoundKind.combatLabel, names.labels);
    for (let i = 0; i < IMPACT_COUNT; i++) {
      const model = AddSpecialEffect(impactModel(floorDiv(i, IMPACTS_PER_KIND)), origin.x, origin.y);
      this.tint(model, i, floorDiv(i, IMPACTS_PER_KIND), 0.0);
      parkOnce(model, this, parked, i);
      this.impacts.push(model);
    }
    for (let i = 0; i < KO_BODY_COUNT; i++) {
      const { character, costume } = at(KO_VARIANTS, floorMod(i, KO_FIGHTERS));
      const index = originalClipNamed(character, "stand hit");
      const clip = index === undefined ? undefined : originalClip(character, index);
      const timeline = clip?.timeline === true ? clip : undefined;
      const model = AddSpecialEffect(timeline === undefined ? fighterModel(character) : costumeClipModel(character, costume, timeline), origin.x, origin.y);
      BlzSetSpecialEffectAnimation(model, timeline === undefined ? "stand hit" : "Stand");
      BlzSetSpecialEffectAnimationBlendTime(model, 0.0);
      BlzSetSpecialEffectTimeScale(model, 0.0);
      BlzSetSpecialEffectTime(model, timeline === undefined ? f32(0.1) : f32(timeline.startSeconds + f32(0.1)));
      parkOnce(model, this, parked, IMPACT_COUNT + i);
      this.koBodies.push(model);
    }
  }

  clear(): void {
    const parked = (this.parked ??= []);
    this.impacts.forEach((model, i) => parkOnce(model, this, parked, i));
    this.koBodies.forEach((model, i) => parkOnce(model, this, parked, IMPACT_COUNT + i));
    this.shownAges = undefined;
    this.soundFrames = [];
    this.earlyHitFrames = [];
    this.earlyHitSerials = [];
    this.earlyShieldSerials = [];
    this.earlyPerformSerials = [];
    this.earlyStartSerials = [];
    resetVoiceBudget(this.voices);
    for (let slot = 0; slot < VOICE_CAP; slot++) this.voiceHandles[slot] = undefined;
    this.shownEmissions = [];
    this.drawnContacts = [];
    clearImpactState(this.late);
    this.lateConfirmed = [];
    this.lateLive = 0;
    this.presentedFrame = undefined;
    if (this.koFlash !== undefined) endKoFlash(this.koFlash);
    this.hideKoFlash();
  }


  confirmKo(frame: number, slot: number, fighter: Readonly<Fighter>, events: Readonly<ImpactEvents>): void {
    noteKoFlash((this.koFlash ??= createKoFlash()), frame, slot, fighter, events);
  }


  private presentKoFlash(frame: number, playing: boolean): void {
    const flash = this.koFlash;
    const levels = flash === undefined ? undefined : koFlashLevels(flash, frame);
    if (flash === undefined || levels === undefined || !playing || !levels.showing) {
      if (flash !== undefined && levels !== undefined && !levels.showing) endKoFlash(flash);
      this.hideKoFlash();
      return;
    }
    if (!this.koFlashShown) {
      if (this.cineFilter) {
        SetCineFilterTexture("ReplaceableTextures\\CameraMasks\\White_Mask.blp");
        SetCineFilterBlendMode(BLEND_MODE_BLEND);
        SetCineFilterTexMapFlags(TEXMAP_FLAG_NONE);
        SetCineFilterStartUV(0.0, 0.0, 1.0, 1.0);
        SetCineFilterEndUV(0.0, 0.0, 1.0, 1.0);
        SetCineFilterDuration(0.0);
        DisplayCineFilter(true);
      }
      SetCameraField(CAMERA_FIELD_DEPTH_OF_FIELD_DISTANCE, KO_BLUR_DISTANCE, 0.0);
      this.koFlashShown = true;
    }
    if (this.cineFilter) {
      SetCineFilterStartColor(levels.colour, levels.colour, levels.colour, levels.alpha);
      SetCineFilterEndColor(levels.colour, levels.colour, levels.colour, levels.alpha);
    }
    SetCameraField(CAMERA_FIELD_DEPTH_OF_FIELD_SCALE, levels.blur, 0.0);
  }

  private hideKoFlash(): void {
    if (!this.koFlashShown) return;
    this.koFlashShown = false;
    DisplayCineFilter(false);
    SetCameraField(CAMERA_FIELD_DEPTH_OF_FIELD_DISTANCE, 0.0, 0.0);
    SetCameraField(CAMERA_FIELD_DEPTH_OF_FIELD_SCALE, 0.0, 0.0);
  }






  confirmContacts(frame: number, slot: number, events: Readonly<ImpactEvents>): void {
    if (!events.hit && !events.shieldHit && !events.shieldReflect && !events.shieldBreak) return;
    const late = this.late;
    emitImpacts(late, events, frame, slot);
    let live = 0;
    // Use IMPACT_COUNT because free slots are undefined and Lua length skips them.
    for (let i = 0; i < IMPACT_COUNT; i++) {

      if (late.ages[i] === 0 && this.lateConfirmed[i] === undefined) {

        if (isContactImpact(floorDiv(i, IMPACTS_PER_KIND))) this.lateConfirmed[i] = frame;
        else clearImpactSlot(late, i);
      }
      if (late.ages[i] !== undefined) live++;
    }
    this.lateLive = live;
  }


  presentConfirmed(frame: number, slot: number, events: Readonly<ImpactEvents>, soundPlayed?: (sound: string, volume: number, pitch: number, cls: number, slot: number, live: number) => void): void {
    const previous = this.soundFrames[slot];
    if (previous !== undefined && frame <= previous) return;
    this.soundFrames[slot] = frame;
    this.presentSounds(frame, events, this.startedEarly(frame, slot, events) ? "late" : "every", soundPlayed);
  }


  presentPredicted(frame: number, slot: number, events: Readonly<ImpactEvents>, soundPlayed?: (sound: string, volume: number, pitch: number, cls: number, slot: number, live: number) => void): void {
    if (this.startedEarly(frame, slot, events)) return;
    this.earlySoundTried = false;
    this.presentSounds(frame, events, "early", soundPlayed);
    if (!this.earlySoundTried) return;
    const index = slot * DRAWN_FRAMES + floorMod(frame, DRAWN_FRAMES);
    this.earlyHitFrames[index] = frame;
    this.earlyHitSerials[index] = events.variant;
    this.earlyShieldSerials[index] = shieldSerial(events);
    this.earlyPerformSerials[index] = impactSerial(events);
    this.earlyStartSerials[index] = startSerial(events);
  }

  private startedEarly(frame: number, slot: number, events: Readonly<ImpactEvents>): boolean {
    const index = slot * DRAWN_FRAMES + floorMod(frame, DRAWN_FRAMES);
    return this.earlyHitFrames[index] === frame && this.earlyHitSerials[index] === events.variant
      && this.earlyShieldSerials[index] === shieldSerial(events) && this.earlyPerformSerials[index] === impactSerial(events) && this.earlyStartSerials[index] === startSerial(events);
  }

  private presentSounds(frame: number, events: Readonly<ImpactEvents>, from: "every" | "early" | "late", soundPlayed: ((sound: string, volume: number, pitch: number, cls: number, slot: number, live: number) => void) | undefined): void {
    this.soundFrame = frame;
    this.soundPlayed = soundPlayed;
    if (from !== "late") {
      if (from === "early" && startSerial(events) !== -1) this.earlySoundTried = true;
      presentStartSounds(events, this.playSound);
    }
    this.soundsFrom = from;
    presentImpactSounds(events, this.playSound);
    this.soundPlayed = undefined;
    this.soundsFrom = "every";
  }

  private soundFrame = 0;
  private soundPlayed: ((sound: string, volume: number, pitch: number, cls: number, slot: number, live: number) => void) | undefined;
  // One sink for every call, so presenting sounds allocates no closure a frame (#400).
  private readonly playSound: ImpactSoundSink = (sound, x, z, volume, pitch, file, cls) => {
    if (this.soundsFrom === "early" ? cls !== VoiceClass.hit : this.soundsFrom === "late" && cls === VoiceClass.hit) return;
    if (cls === VoiceClass.hit) this.earlySoundTried = true;
    const admitted = admitVoice(this.voices, this.soundFrame, cls, sound);
    if (!admitted.play) return;
    const evicted = this.voiceHandles[admitted.slot];
    if (admitted.replaced && evicted !== undefined) StopSound(evicted, false, false);
    this.voiceHandles[admitted.slot] = this.sounds.playAt(file ? SoundKind.combatFile : SoundKind.combatLabel, sound, this.x + x, this.y, this.z + z, floorDiv(volume * admitted.percent, 100), pitch);
    this.soundPlayed?.(sound, volume, pitch, cls, admitted.slot, liveVoices(this.voices, this.soundFrame));
  };





  present(state: Readonly<ImpactState>, frame: number, confirmed: Readonly<ImpactState>, playing: boolean, camera: Readonly<MatchCamera>): void {
    this.camera = camera;
    const shownAges = (this.shownAges ??= []);
    const parked = (this.parked ??= []);
    const count = this.impacts.length;
    const busyKinds = this.busyKinds;
    for (let kind = 0; kind < IMPACT_KIND_COUNT; kind++) {
      const first = kind * IMPACTS_PER_KIND;
      if (first >= count) break;
      if (busyKinds[kind] !== true && state.occupied[kind] === 0 && confirmed.occupied[kind] === 0) continue;
      const last = Math.min(count, first + IMPACTS_PER_KIND);
      for (let i = first; i < last; i++) this.presentImpact(i, kind, state, frame, confirmed, playing, shownAges, parked);
      let busy = false;
      for (let i = first; i < last; i++) if (parked[i] !== true || shownAges[i] !== undefined || this.shownEmissions[i] !== undefined) busy = true;
      busyKinds[kind] = busy;
    }
    if (this.lateLive > 0) this.presentLate(state, frame, playing);
    this.presentKo(frame, confirmed, playing, parked);
  }

  private presentImpact(i: number, kind: number, state: Readonly<ImpactState>, frame: number, confirmed: Readonly<ImpactState>, playing: boolean, shownAges: (number | undefined)[], parked: ParkedFlags): void {
    const model = this.impacts[i];
    if (model === undefined || this.idleImpact(i, state, confirmed, shownAges, parked)) return;
    const source = kind === IMPACT_STAR_KO || kind === IMPACT_SCREEN_KO ? confirmed : state;
    const age = source.ages[i];

    const pose = playing && age !== undefined ? projectImpact(source, i, this.camera, this.pose) : undefined;
    if (pose === undefined || !pose.visible) {

      if (parked[i] !== true && (this.lateLive === 0 || this.late.ages[i] === undefined)) parkOnce(model, this, parked, i);
      shownAges[i] = undefined;
      this.shownEmissions[i] = undefined;
      return;
    }

    this.showImpact(model, i, kind, age, frame, shownAges);
    this.place(model, i, kind, pose, source.strength[i] ?? 0.0);
  }

  private idleImpact(i: number, state: Readonly<ImpactState>, confirmed: Readonly<ImpactState>, shownAges: readonly (number | undefined)[], parked: ParkedFlags): boolean {
    return parked[i] === true && state.ages[i] === undefined && confirmed.ages[i] === undefined && shownAges[i] === undefined && this.shownEmissions[i] === undefined;
  }

  private showImpact(model: effect, i: number, kind: number, age: number | undefined, frame: number, shownAges: (number | undefined)[]): void {
    const last = shownAges[i];
    if (last !== undefined && age !== undefined && age < last) hideEffect(model, this);
    if (last === undefined || age !== undefined && age < last) {
      BlzSetSpecialEffectAnimation(model, impactAnimation(kind));
      BlzSetSpecialEffectTime(model, impactStartSeconds(kind));
    }
    if (kind === IMPACT_STAR_KO && age !== undefined && age >= KO_STAR_FLIGHT_FRAMES && (last === undefined || last < KO_STAR_FLIGHT_FRAMES || age < last)) {
      this.soundFrame = frame;
      this.soundsFrom = "every";
      presentStarKoTwinkle(this.pose.x, this.pose.z, this.playSound);
    }
    shownAges[i] = age;
    if (age !== undefined) this.drawn(i, kind, frame - age);
  }

  private presentKo(frame: number, confirmed: Readonly<ImpactState>, playing: boolean, parked: ParkedFlags): void {
    this.presentKoFlash(frame, playing);
    const koParked = (this.koParked ??= []);
    for (let i = 0; i < this.koBodies.length; i++) {
      const group = floorDiv(i, KO_FIGHTERS);
      const impact = STAR_KO_FIRST + group;
      if (!playing || confirmed.ages[impact] === undefined) {

        if (koParked[group] !== true) {
          for (let body = i; body < i + KO_FIGHTERS; body++) {
            const hidden = this.koBodies[body];
            if (hidden !== undefined) parkOnce(hidden, this, parked, IMPACT_COUNT + body);
          }
          koParked[group] = true;
        }
        i += KO_FIGHTERS - 1;
        continue;
      }
      const model = this.koBodies[i];
      if (model === undefined) continue;
      const pose = projectKo(confirmed, impact, this.camera);
      const variant = at(KO_VARIANTS, floorMod(i, KO_FIGHTERS));
      if (!pose.visible || pose.character !== variant.character || bodyCostume(pose.character, this.costumeOf(pose.owner)) !== variant.costume) {
        parkOnce(model, this, parked, IMPACT_COUNT + i);
        continue;
      }
      koParked[group] = false;
      parked[IMPACT_COUNT + i] = false;
      this.colourKo(model, i, pose.owner);
      placeEffect(model, this.x + pose.x, this.y + pose.y, this.z + pose.z);
      BlzSetSpecialEffectScale(model, characterModelScale(pose.character) * pose.scale);
      BlzSetSpecialEffectPitch(model, pose.pitch);
      BlzSetSpecialEffectYaw(model, pose.yaw);
      BlzSetSpecialEffectRoll(model, pose.roll);
      BlzSetSpecialEffectAlpha(model, pose.alpha);
    }
  }

  private colourKo(model: effect, i: number, owner: number): void {
    if (this.koOwners[i] === owner) return;
    this.koOwners[i] = owner;
    BlzSetSpecialEffectColorByPlayer(model, Player(owner));
  }

  private tint(model: effect, i: number, kind: number, strength: number): void {
    const colour = impactColour(kind, strength);
    const tints = (this.tints ??= []);
    if (colour === undefined || tints[i] === colour) return;
    tints[i] = colour;
    BlzSetSpecialEffectColor(model, colour[0] ?? 255, colour[1] ?? 255, colour[2] ?? 255);
  }

  private place(model: effect, i: number, kind: number, pose: ReturnType<typeof projectImpact>, strength: number): void {
    const parked = (this.parked ??= []);
    parked[i] = false;
    this.busyKinds[kind] = true;
    this.tint(model, i, kind, strength);

    const depth = kind === IMPACT_STAR_KO ? STAR_KO_DEPTH
      : isContactImpact(kind) || kind === IMPACT_GRAB || kind === IMPACT_THROW ? -120.0 : 0.0;
    BlzSetSpecialEffectAlpha(model, pose.alpha);
    BlzSetSpecialEffectScale(model, pose.scale * impactModelScale(kind));
    BlzSetSpecialEffectPitch(model, pose.pitch);
    placeEffect(model, this.x + pose.x, this.y + depth, this.z + pose.z);
  }


  private drawn(i: number, kind: number, emitted: number): void {
    if (!isContactImpact(kind) || this.shownEmissions[i] === emitted) return;
    this.shownEmissions[i] = emitted;
    this.drawnContacts[kind * DRAWN_FRAMES + floorMod(emitted, DRAWN_FRAMES)] = emitted;
  }

  private wasDrawn(kind: number, confirmedFrame: number): boolean {
    for (let emitted = confirmedFrame - SAME_HIT_FRAMES; emitted <= confirmedFrame + SAME_HIT_FRAMES; emitted++) {
      if (this.drawnContacts[kind * DRAWN_FRAMES + floorMod(emitted, DRAWN_FRAMES)] === emitted) return true;
    }
    return false;
  }






  private presentLate(state: Readonly<ImpactState>, frame: number, playing: boolean): void {
    const late = this.late;
    const parked = (this.parked ??= []);
    const advance = this.presentedFrame !== frame;
    this.presentedFrame = frame;
    for (let i = 0; i < IMPACT_COUNT; i++) {
      const age = late.ages[i];
      if (age === undefined) continue;
      const kind = floorDiv(i, IMPACTS_PER_KIND);
      const confirmedFrame = this.lateConfirmed[i];
      this.lateConfirmed[i] = undefined;
      const model = this.impacts[i];
      if (!playing || model === undefined || confirmedFrame !== undefined && this.wasDrawn(kind, confirmedFrame)) {
        clearImpactSlot(late, i);
        if (model !== undefined && state.ages[i] === undefined) parkOnce(model, this, parked, i);
        continue;
      }

      if (state.ages[i] === undefined) {
        if (age === 0) {
          BlzSetSpecialEffectAnimation(model, impactAnimation(kind));
          BlzSetSpecialEffectTime(model, impactStartSeconds(kind));
        }
        this.place(model, i, kind, projectImpact(late, i, this.camera, this.pose), late.strength[i] ?? 0.0);
      }
    }
    if (advance) advanceImpacts(late);
    this.lateLive = 0;
    for (let i = 0; i < IMPACT_COUNT; i++) if (late.ages[i] !== undefined) this.lateLive++;
  }

  setPaused(paused: boolean): void {
    for (const model of this.impacts) BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
  }

  destroy(): void {
    for (const model of this.impacts) DestroyEffect(model);
    for (const model of this.koBodies) DestroyEffect(model);
    this.impacts.length = 0;
    this.koBodies.length = 0;
  }
}
