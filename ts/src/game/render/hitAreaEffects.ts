import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { DISJOINT_CUES, disjointNormals, hitAreaPose, normalAreaPose, specialAreaRegion, type HitAreaPose } from "../presentation/disjointCues";
import { type ParkedFlags, type WorldOrigin, facingYaw, parkCue } from "./effects";


export const HIT_AREA_EFFECT_CAPACITY = 12;
export const ACCENT_SEQUENCE = "stand";
export const ACCENT_SECONDS = f32(0.3);
export const CUE_FRONT = -14.0;


export class HitAreaEffects {
  private readonly models: effect[] = [];
  private frame = 0;
  private readonly styles;
  private readonly parked: ParkedFlags = [];
  private readonly region = emptyHitRegion();
  private readonly pose: HitAreaPose = { visible: false, x: 0.0, z: 0.0, scale: 1.0 };

  constructor(character: Character, private readonly origin: WorldOrigin, drawn: boolean) {
    this.styles = disjointNormals(createFighter(character, 0.0, 1));
    const cue = drawn ? DISJOINT_CUES[character] : undefined;
    if (cue !== undefined) for (let index = 0; index < HIT_AREA_EFFECT_CAPACITY; index++) this.models.push(AddSpecialEffect(cue.model, origin.x, origin.y));
    this.clear();
  }

  clear(): void {
    this.frame = 0;
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) parkCue(model, this.origin, this.parked, index);
    }
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean): void {
    let shown = 0;
    if (fighter !== undefined && playing && !fighter.status.out && DISJOINT_CUES[fighter.character] !== undefined) {
      const style = fighter.attack.style;
      const normal = style !== undefined && this.styles.includes(style);
      const count = normal ? authoredHitRegionCount(style, fighter.tuning.moves) : runningHeroSpecial(fighter)?.regions?.length ?? 2;
      for (let index = 0; index < count; index++) {
        if (fighter.character === Character.warden && fighter.special.action === SpecialAction.heroDown) continue;
        if (!normal && runningHeroSpecial(fighter)?.beam !== undefined) continue;
        const pose = normal ? normalAreaPose(fighter, style, index, this.region, this.pose) : hitAreaPose(fighter, specialAreaRegion(fighter, index), this.pose);
        if (!pose.visible) continue;
        const model = this.models[shown];
        if (model === undefined) break;
        const cue = DISJOINT_CUES[fighter.character];
        const starts = this.parked[shown] === true;
        this.parked[shown++] = false;
        BlzSetSpecialEffectPosition(model, this.origin.x + pose.x, this.origin.y + CUE_FRONT, this.origin.z + pose.z);
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
    this.frame = fighter?.special.frame ?? 0;
  }

  drawnEffects(into: effect[]): void {
    for (const model of this.models) into.push(model);
  }

  destroy(): void {
    this.clear();
    for (const model of this.models) DestroyEffect(model);
    this.models.length = 0;
  }
}
