import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { DISJOINT_CUES, disjointNormals, flareRegionShown, hitAreaPose, normalAreaPose, specialAreaRegion, type HitAreaPose } from "../presentation/disjointCues";
import { PARKED_CUE_TIME_SCALE, type ParkedFlags, type WorldOrigin, facingYaw, parkCue } from "./effects";
import { clearEffectSubAnimations, createEffect, destroyEffect, Effect, EffectAnimation, playEffectAnimation, setEffectAlpha, setEffectAnimation, setEffectPitch, setEffectPosition, setEffectScale, setEffectTime, setEffectTimeScale, setEffectYaw } from "wisp/game/effects";


export const HIT_AREA_EFFECT_CAPACITY = 12;
export const ACCENT_SEQUENCE = "stand";
export const ACCENT_SECONDS = f32(0.3);
export const CUE_FRONT = -14.0;


export class HitAreaEffects {
  private readonly models: Effect[] = [];
  private frame = 0;
  private readonly styles;
  private readonly parked: ParkedFlags = [];
  private readonly region = emptyHitRegion();
  private readonly pose: HitAreaPose = { visible: false, x: 0.0, z: 0.0, scale: 1.0 };

  constructor(private readonly character: Character, private readonly origin: WorldOrigin) {
    this.styles = disjointNormals(createFighter(character, 0.0, 1));
    const cue = DISJOINT_CUES[character];
    if (cue !== undefined) for (let index = 0; index < HIT_AREA_EFFECT_CAPACITY; index++) this.models.push(createEffect(cue.model, origin.x, origin.y));
    this.clear();
  }

  clear(): void {
    this.frame = 0;
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) parkCue(model, this.origin, this.parked, index);
    }
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, paused: boolean): void {
    let shown = 0;
    if (fighter !== undefined && playing && !fighter.status.out && DISJOINT_CUES[fighter.character] !== undefined) {
      const style = fighter.attack.style;
      const normal = style !== undefined && this.styles.includes(style);
      const count = normal ? authoredHitRegionCount(style, fighter.tuning.moves) : runningHeroSpecial(fighter)?.regions?.length ?? 2;
      for (let index = 0; index < count; index++) {
        if (fighter.character === Character.warden && fighter.special.action === SpecialAction.heroDown) continue;
        if (!normal && runningHeroSpecial(fighter)?.beam !== undefined) continue;
        if (normal && !flareRegionShown(fighter.character, style, index)) continue;
        const pose = normal ? normalAreaPose(fighter, style, index, this.region, this.pose) : hitAreaPose(fighter, specialAreaRegion(fighter, index), this.pose);
        if (!pose.visible) continue;
        const model = this.models[shown];
        if (model === undefined) break;
        const cue = DISJOINT_CUES[fighter.character];
        const starts = this.parked[shown] === true;
        this.parked[shown++] = false;
        setEffectPosition(model, this.origin.x + pose.x, this.origin.y + CUE_FRONT, this.origin.z + pose.z);
        setEffectYaw(model, facingYaw(fighter.facing));
        setEffectPitch(model, 0.0);
        setEffectScale(model, f32(pose.scale * (cue?.scale ?? 0.5)));
        setEffectAlpha(model, 255);
        if (cue?.birth === undefined) setEffectAnimation(model, cue?.sequence ?? ACCENT_SEQUENCE);
        else if (starts || (cue.birth.eachFrame && fighter.special.frame !== this.frame)) {
          clearEffectSubAnimations(model);
          if (cue.sequence === "birth") playEffectAnimation(model, EffectAnimation.birth);
          else setEffectAnimation(model, cue.sequence ?? ACCENT_SEQUENCE);
        }
        setEffectTime(model, cue?.seconds ?? ACCENT_SECONDS);
        setEffectTimeScale(model, paused ? 0.0 : cue?.timeScale ?? 0.0);
      }
    }
    for (let index = shown; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) parkCue(model, this.origin, this.parked, index);
    }
    this.frame = fighter?.special.frame ?? 0;
  }

  setPaused(paused: boolean): void {
    const cue = DISJOINT_CUES[this.character];
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) setEffectTimeScale(model, paused ? 0.0 : this.parked[index] === true ? PARKED_CUE_TIME_SCALE : cue?.timeScale ?? 0.0);
    }
  }

  drawnEffects(into: Effect[]): void {
    for (const model of this.models) into.push(model);
  }

  destroy(): void {
    this.clear();
    for (const model of this.models) destroyEffect(model);
    this.models.length = 0;
  }
}
