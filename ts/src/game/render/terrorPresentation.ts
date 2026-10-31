import { f32 } from "wisp/src/sim/f32";
import { IMPACT_DEFILE_MODEL } from "../assets/impactAssetInfo";
import { fighterModelScale } from "../presentation/fighterScale";
import { type ShockwaveRing, shockwaveRing } from "../presentation/shockwaveRing";
import { terrorResisted } from "../presentation/terrorCues";
import { HeroStatusKind } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { type ParkedFlags, type WorldOrigin, hideEffect, parkOnce, placeEffect } from "./effects";
import { createEffect, destroyEffect, Effect, resetEffectMatrix, setEffectAlpha, setEffectAnimation, setEffectColor, setEffectMatrixScale, setEffectPosition, setEffectRoll, setEffectScale, setEffectTime, setEffectTimeScale } from "wisp/game/effects";

export const HOWL_TARGET_MODEL = "Abilities\\Spells\\Other\\HowlOfTerror\\HowlTarget.mdx";
export const RESIST_FLASH_MODEL = "Abilities\\Spells\\Items\\SpellShieldAmulet\\SpellShieldCaster.mdx";
const RING = 0;
const FEAR = 1;
const RESIST = 2;
const FEL_RED = [255, 48, 24] as const;
const RIM_HEIGHT = f32(0.6);
const RESIST_FRAMES = 18;

export class TerrorPresentation {
  private readonly ring: Effect;
  private readonly fear: Effect;
  private readonly resist: Effect;
  private readonly parked: ParkedFlags = [];
  private readonly pose: ShockwaveRing = { x: 0.0, z: 0.0, radius: 0.0, alpha: 0 };
  private hits = 0;
  private resistAge = RESIST_FRAMES;

  constructor(private readonly origin: WorldOrigin) {
    this.ring = createEffect(IMPACT_DEFILE_MODEL, origin.x, origin.y);
    setEffectAnimation(this.ring, "stand");
    setEffectTimeScale(this.ring, 0.0);
    this.fear = createEffect(HOWL_TARGET_MODEL, origin.x, origin.y);
    this.resist = createEffect(RESIST_FLASH_MODEL, origin.x, origin.y);
    this.hide();
  }

  present(fighter: Readonly<Fighter> | undefined, roaring: boolean, paused: boolean): void {
    if (fighter === undefined) {
      this.hide();
      return;
    }
    this.presentRing(fighter);
    const scale = fighterModelScale(fighter);
    const x = this.origin.x + fighter.motion.x;
    const z = this.origin.z + fighter.motion.z;
    if (fighter.status.condition === HeroStatusKind.fear && !fighter.status.out) {
      this.parked[FEAR] = false;
      placeEffect(this.fear, x, this.origin.y - 8.0, z + f32(150.0 * scale));
      setEffectScale(this.fear, scale);
      setEffectTimeScale(this.fear, paused || fighter.launch.hitlag > 0 ? 0.0 : 1.0);
    } else parkOnce(this.fear, this.origin, this.parked, FEAR);
    if (terrorResisted(fighter, this.hits, roaring)) this.resistAge = 0;
    this.hits = fighter.visuals.hit;
    if (this.resistAge < RESIST_FRAMES && !fighter.status.out) {
      if (this.resistAge === 0) {
        setEffectTime(this.resist, 0.0);
        setEffectColor(this.resist, 255, 255, 255);
      }
      this.parked[RESIST] = false;
      placeEffect(this.resist, x, this.origin.y - 12.0, z + f32(60.0 * scale));
      setEffectScale(this.resist, f32(f32(0.8) * scale));
      setEffectTimeScale(this.resist, paused ? 0.0 : 1.0);
      if (!paused) this.resistAge++;
    } else parkOnce(this.resist, this.origin, this.parked, RESIST);
  }

  private presentRing(fighter: Readonly<Fighter>): void {
    const ring = shockwaveRing(this.pose, fighter);
    if (ring === undefined) {
      parkOnce(this.ring, this.origin, this.parked, RING);
      return;
    }
    this.parked[RING] = false;
    setEffectPosition(this.ring, this.origin.x + ring.x, this.origin.y - 8.0, this.origin.z + ring.z);
    setEffectScale(this.ring, ring.radius);
    resetEffectMatrix(this.ring);
    setEffectRoll(this.ring, f32(Math.PI * 0.5));
    // Warcraft may apply matrix scale before or after the roll, so the rim's 0.6 height is stretched on Y and Z alike.
    setEffectMatrixScale(this.ring, 1.0, f32(1.0 / RIM_HEIGHT), f32(1.0 / RIM_HEIGHT));
    setEffectColor(this.ring, FEL_RED[0], FEL_RED[1], FEL_RED[2]);
    setEffectAlpha(this.ring, ring.alpha);
  }

  hide(): void {
    for (const [model, index] of [[this.ring, RING], [this.fear, FEAR], [this.resist, RESIST]] as const) parkOnce(model, this.origin, this.parked, index);
    this.resistAge = RESIST_FRAMES;
  }

  destroy(): void {
    for (const model of [this.ring, this.fear, this.resist]) {
      hideEffect(model, this.origin);
      destroyEffect(model);
    }
  }
}
