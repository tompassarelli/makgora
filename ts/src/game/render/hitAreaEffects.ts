import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { runningHeroSpecial } from "../sim/specials/engine";
import { FAN_KNIFE_CUE } from "../presentation/specialCues";
import { DISJOINT_CUES, disjointNormals, fanKnifePose, hitAreaPose, specialAreaRegion, type FanKnifePose, type HitAreaPose } from "../presentation/disjointCues";
import { type ParkedFlags, type WorldOrigin, facingYaw, parkCue } from "./effects";


export const HIT_AREA_EFFECT_CAPACITY = 12;
export const ACCENT_SEQUENCE = "stand";
export const ACCENT_SECONDS = f32(0.3);


export class HitAreaEffects {
  private readonly models: effect[] = [];
  private readonly knives: effect[] = [];
  private readonly knifeParked: ParkedFlags = [];
  private frame = 0;
  private readonly styles;
  private readonly parked: ParkedFlags = [];
  private readonly region = emptyHitRegion();
  private readonly pose: HitAreaPose = { visible: false, x: 0.0, z: 0.0, scale: 1.0 };
  private readonly knife: FanKnifePose = { visible: false, x: 0.0, z: 0.0, scale: 1.0, yaw: 0.0, pitch: 0.0, alpha: 255 };

  constructor(character: Character, private readonly origin: WorldOrigin) {
    this.styles = disjointNormals(createFighter(character, 0.0, 1));
    const cue = DISJOINT_CUES[character];
    if (cue !== undefined) for (let index = 0; index < HIT_AREA_EFFECT_CAPACITY; index++) this.models.push(AddSpecialEffect(cue.model, origin.x, origin.y));
    this.clear();
  }

  clear(): void {
    this.frame = 0;
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) parkCue(model, this.origin, this.parked, index);
    }
    for (let index = 0; index < this.knives.length; index++) {
      const model = this.knives[index];
      if (model !== undefined) parkCue(model, this.origin, this.knifeParked, index);
    }
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean): void {
    let shown = 0;
    let thrown = 0;
    if (fighter !== undefined && playing && !fighter.status.out && DISJOINT_CUES[fighter.character] !== undefined) {
      const style = fighter.attack.style;
      const normal = style !== undefined && this.styles.includes(style);
      const count = normal ? authoredHitRegionCount(style, fighter.tuning.moves) : runningHeroSpecial(fighter)?.regions?.length ?? 1;
      for (let index = 0; index < count; index++) {
        if (fighter.character === Character.warden && fighter.special.action === SpecialAction.heroDown) {
          const pose = fanKnifePose(fighter, index, this.knife);
          const model = this.knives[thrown];
          if (!pose.visible || model === undefined) continue;
          const starts = this.knifeParked[thrown] === true;
          this.knifeParked[thrown++] = false;
          BlzSetSpecialEffectPosition(model, this.origin.x + pose.x, this.origin.y - 14.0, this.origin.z + pose.z);
          BlzSetSpecialEffectYaw(model, pose.yaw);
          BlzSetSpecialEffectPitch(model, pose.pitch);
          BlzSetSpecialEffectScale(model, pose.scale);
          BlzSetSpecialEffectAlpha(model, pose.alpha);
          BlzSetSpecialEffectTimeScale(model, 1.0);
          if (pose.birth !== undefined && (starts || (pose.birth.eachFrame && fighter.special.frame !== this.frame))) {
            BlzSpecialEffectClearSubAnimations(model);
            BlzPlaySpecialEffect(model, ANIM_TYPE_BIRTH);
          }
          continue;
        }
        const region = normal ? authoredHitRegion(this.region, fighter.character, style, fighter.attack.frame, fighter.attack.smashChargeFrames, index, fighter.tuning.moves) : specialAreaRegion(fighter, index);
        const pose = hitAreaPose(fighter, region, this.pose);
        if (!pose.visible) continue;
        const model = this.models[shown];
        if (model === undefined) break;
        const cue = DISJOINT_CUES[fighter.character];
        const starts = this.parked[shown] === true;
        this.parked[shown++] = false;
        BlzSetSpecialEffectPosition(model, this.origin.x + pose.x, this.origin.y - 14.0, this.origin.z + pose.z);
        BlzSetSpecialEffectYaw(model, facingYaw(fighter.facing));
        BlzSetSpecialEffectPitch(model, 0.0);
        BlzSetSpecialEffectScale(model, f32(pose.scale * (cue?.scale ?? 0.5)));
        BlzSetSpecialEffectAlpha(model, 255);
        if (cue?.birth === undefined) BlzSetSpecialEffectAnimation(model, cue?.sequence ?? ACCENT_SEQUENCE);
        else if (starts || (cue.birth.eachFrame && fighter.special.frame !== this.frame)) {
          BlzSpecialEffectClearSubAnimations(model);
          if (cue.sequence === "birth") BlzPlaySpecialEffect(model, ANIM_TYPE_BIRTH);
          else BlzSetSpecialEffectAnimation(model, cue.sequence ?? ACCENT_SEQUENCE);
        }
        BlzSetSpecialEffectTime(model, cue?.seconds ?? ACCENT_SECONDS);
        BlzSetSpecialEffectTimeScale(model, cue?.timeScale ?? 0.0);
      }
    }
    for (let index = shown; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) parkCue(model, this.origin, this.parked, index);
    }
    for (let index = thrown; index < this.knives.length; index++) {
      const model = this.knives[index];
      if (model !== undefined) parkCue(model, this.origin, this.knifeParked, index);
    }
    this.frame = fighter?.special.frame ?? 0;
  }

  drawnEffects(into: effect[]): void {
    for (const model of this.models) into.push(model);
  }

  destroy(): void {
    this.clear();
    for (const model of this.models) DestroyEffect(model);
    for (const model of this.knives) DestroyEffect(model);
    this.models.length = 0;
    this.knives.length = 0;
  }
}
