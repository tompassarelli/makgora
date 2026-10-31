import { f32 } from "wisp/src/sim/f32";
import { fighterModelScale } from "../presentation/fighterScale";
import type { Fighter } from "../sim/fighter";
import { SEA_SURFACE_Z, hasTide } from "../sim/stageHazards";
import { type ParkedFlags, type WorldOrigin, hideEffect, parkOnce, placeEffect } from "./effects";

export const SEA_SPLASH_MODEL = "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx";
/** Frames the splash model plays before it is parked again; the native window's rings and foam outlast it. */
export const SPLASH_FRAMES = 36;
const ENTRY_SCALE = f32(0.7);
const EXIT_SCALE = f32(1.0);
const WATER_TINT = [190, 225, 240] as const;
const SPLASH = 0;

/** The spray a fighter throws where it crosses the sea's surface, in or out; presentation only, read from the sim's own in-water flag. */
export class SeaSplashPresentation {
  private readonly splash: effect;
  private readonly parked: ParkedFlags = [];
  private wet = false;
  private age = SPLASH_FRAMES;

  constructor(private readonly origin: WorldOrigin) {
    this.splash = AddSpecialEffect(SEA_SPLASH_MODEL, origin.x, origin.y);
    this.hide();
  }

  present(fighter: Readonly<Fighter> | undefined, stage: number, paused: boolean): void {
    if (fighter === undefined || !hasTide(stage) || fighter.status.out) {
      this.hide();
      this.wet = false;
      return;
    }
    const wet = fighter.water.inWater;
    if (wet !== this.wet && !paused) {
      this.wet = wet;
      this.age = 0;
      BlzSetSpecialEffectTime(this.splash, 0.0);
      BlzSetSpecialEffectColor(this.splash, WATER_TINT[0], WATER_TINT[1], WATER_TINT[2]);
      BlzSetSpecialEffectScale(this.splash, f32(fighterModelScale(fighter) * (wet ? ENTRY_SCALE : EXIT_SCALE)));
      this.parked[SPLASH] = false;
      placeEffect(this.splash, this.origin.x + fighter.motion.x, this.origin.y - 12.0, this.origin.z + SEA_SURFACE_Z);
    }
    if (this.age < SPLASH_FRAMES) {
      BlzSetSpecialEffectTimeScale(this.splash, paused ? 0.0 : 1.0);
      if (!paused) this.age++;
    } else parkOnce(this.splash, this.origin, this.parked, SPLASH);
  }

  hide(): void {
    parkOnce(this.splash, this.origin, this.parked, SPLASH);
    this.age = SPLASH_FRAMES;
  }

  destroy(): void {
    hideEffect(this.splash, this.origin);
    DestroyEffect(this.splash);
  }
}
