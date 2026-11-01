import { f32 } from "wisp/src/sim/f32";
import { fighterModelScale } from "../presentation/fighterScale";
import type { Fighter } from "../sim/fighter";
import { ManaShieldChange, manaShieldChange } from "../presentation/manaShieldLook";
import { type ParkedFlags, type WorldOrigin, hideEffect, parkOnce, placeEffect } from "./effects";
import { createEffect, destroyEffect, Effect, setEffectAnimation, setEffectScale, setEffectTime, setEffectTimeScale } from "wisp/game/effects";
import { playSound, releaseWhenDone, setSoundPosition, setSoundVolume, Sound, soundFromLabel, stopSound } from "wisp/game/sound";

export const MANA_SHIELD_BUBBLE_MODEL = "Abilities\\Spells\\Human\\ManaShield\\ManaShieldCaster.mdl";
export const MANA_SHIELD_SHATTER_MODEL = "Abilities\\Spells\\Human\\DispelMagic\\DispelMagicTarget.mdx";
export const MANA_SHIELD_ON_SOUND = "ManaShieldCastSound";
export const MANA_SHIELD_OFF_SOUND = "DispelMagic";
export const MANA_SHIELD_BREAK_SOUND = "ManaBurn";
/** Frames the shatter plays before it is parked again. */
export const SHATTER_FRAMES = 40;
const BUBBLE_SCALE = f32(1.0);
const SHATTER_SCALE = f32(1.2);
const SHATTER_HEIGHT = 70.0;
const BUBBLE = 0;
const SHATTER = 1;

/** Lady Vashj's Mana Shield bubble for as long as the sim's shield is up, with a dispel burst where it breaks; presentation only, read from `status.manaShield`. */
export class ManaShieldPresentation {
  private readonly bubble: Effect;
  private readonly shatter: Effect;
  private readonly onSound: Sound;
  private readonly offSound: Sound;
  private readonly breakSound: Sound;
  private readonly parked: ParkedFlags = [];
  private shielded = false;
  private age = SHATTER_FRAMES;

  constructor(private readonly origin: WorldOrigin) {
    this.bubble = createEffect(MANA_SHIELD_BUBBLE_MODEL, origin.x, origin.y);
    this.shatter = createEffect(MANA_SHIELD_SHATTER_MODEL, origin.x, origin.y);
    this.onSound = soundFromLabel(MANA_SHIELD_ON_SOUND, false, true, true, 10, 10);
    this.offSound = soundFromLabel(MANA_SHIELD_OFF_SOUND, false, true, true, 10, 10);
    this.breakSound = soundFromLabel(MANA_SHIELD_BREAK_SOUND, false, true, true, 10, 10);
    this.hide();
  }

  present(fighter: Readonly<Fighter> | undefined, paused: boolean): void {
    if (fighter === undefined || fighter.status.out) {
      this.hide();
      return;
    }
    const change = manaShieldChange(this.shielded, fighter);
    this.shielded = fighter.status.manaShield;
    const scale = fighterModelScale(fighter);
    const x = this.origin.x + fighter.motion.x;
    const z = this.origin.z + fighter.motion.z;
    if (change === ManaShieldChange.on) this.play(this.onSound, x, z);
    else if (change === ManaShieldChange.off) this.play(this.offSound, x, z);
    else if (change === ManaShieldChange.broken) {
      this.play(this.breakSound, x, z);
      this.age = 0;
      this.parked[SHATTER] = false;
      setEffectAnimation(this.shatter, "birth");
      setEffectTime(this.shatter, 0.0);
      setEffectScale(this.shatter, f32(scale * SHATTER_SCALE));
    }
    if (this.shielded) {
      if (this.parked[BUBBLE] !== false) {
        setEffectAnimation(this.bubble, "stand");
        setEffectTime(this.bubble, 0.0);
      }
      this.parked[BUBBLE] = false;
      placeEffect(this.bubble, x, this.origin.y, z);
      setEffectScale(this.bubble, f32(scale * BUBBLE_SCALE));
      setEffectTimeScale(this.bubble, paused ? 0.0 : 1.0);
    } else parkOnce(this.bubble, this.origin, this.parked, BUBBLE);
    if (this.age < SHATTER_FRAMES) {
      placeEffect(this.shatter, x, this.origin.y, z + f32(scale * SHATTER_HEIGHT));
      setEffectTimeScale(this.shatter, paused ? 0.0 : 1.0);
      if (!paused) this.age++;
    } else parkOnce(this.shatter, this.origin, this.parked, SHATTER);
  }

  hide(): void {
    parkOnce(this.bubble, this.origin, this.parked, BUBBLE);
    parkOnce(this.shatter, this.origin, this.parked, SHATTER);
    this.shielded = false;
    this.age = SHATTER_FRAMES;
  }

  destroy(): void {
    hideEffect(this.bubble, this.origin);
    hideEffect(this.shatter, this.origin);
    destroyEffect(this.bubble);
    destroyEffect(this.shatter);
    releaseWhenDone(this.onSound);
    releaseWhenDone(this.offSound);
    releaseWhenDone(this.breakSound);
  }

  private play(sound: Sound, x: number, z: number): void {
    stopSound(sound, false, false);
    setSoundPosition(sound, x, this.origin.y, z);
    setSoundVolume(sound, 127);
    playSound(sound);
  }
}
