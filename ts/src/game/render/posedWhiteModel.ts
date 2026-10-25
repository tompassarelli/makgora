import { WHITE_FIGHTER_MODELS } from "../../generated/assets/whiteFighterModels";
import { ARENA_CAMERA, FLOOR_HEIGHT } from "../presentation/arenaCamera";
import { originalClip, originalClipNamed } from "../../generated/clips/fighterOriginalClipInfo";
import { fitFighterPlacement } from "../presentation/fighterPlacement";
import type { FighterPose } from "../presentation/fighterPose";
import { characterModelScale } from "../presentation/modelScale";
import type { Character } from "../sim/codes";
import { fighterPoseFacing } from "../sim/conditions";
import { cosineTurns, sineTurns } from "../sim/mathTables";
import { squareRoot } from "../sim/warcraftMath";
import type { Fighter } from "../sim/fighter";
import type { MatchCamera } from "../sim/matchCamera";
import { facingYaw, hideEffect, placeEffect, type WorldOrigin } from "./effects";

/** A white copy of the fighter's model held on the fighter's pose, moved `lift` units toward the camera (away when negative) and grown by `grow` round the body's middle. */
export class PosedWhiteModel {
  private readonly model: effect;
  private readonly placement = { x: 0.0, z: 0.0 };
  private shown = false;

  constructor(private readonly character: Character, private readonly origin: WorldOrigin) {
    this.model = AddSpecialEffect(WHITE_FIGHTER_MODELS[character] ?? "", origin.x, origin.y);
    BlzSetSpecialEffectAnimationBlendTime(this.model, 0.0);
    BlzSetSpecialEffectAnimation(this.model, "Stand");
    BlzSetSpecialEffectTimeScale(this.model, 0.0);
    hideEffect(this.model, origin);
  }

  pose(fighter: Readonly<Fighter>, pose: Readonly<FighterPose>, stage: number, camera: Readonly<MatchCamera>, lift: number, grow: number, height: number): boolean {
    const index = pose.clipIndex ?? originalClipNamed(this.character, pose.clipName);
    const clip = index === undefined ? undefined : originalClip(this.character, index);
    if (index === undefined || clip === undefined) return false;
    fitFighterPlacement(this.placement, fighter, stage);
    let seconds = Math.max(0.0, pose.clipTime);
    const duration = clip.endSeconds - clip.startSeconds;
    if (duration <= 0.0) seconds = 0.0;
    else if (clip.looping) seconds -= I2R(R2I(seconds / duration)) * duration;
    else seconds = Math.min(seconds, duration);
    BlzSetSpecialEffectTime(this.model, clip.startSeconds + seconds);
    BlzSetSpecialEffectYaw(this.model, facingYaw(fighterPoseFacing(fighter)));
    const x = this.origin.x + this.placement.x, y = this.origin.y, z = this.origin.z + this.placement.z - (grow - 1.0) * height * 0.5;
    const pitch = ARENA_CAMERA.angleOfAttack / 360.0, yaw = ARENA_CAMERA.rotation / 360.0;
    const distance = camera.distance;
    const towardX = this.origin.x + camera.x - cosineTurns(yaw) * cosineTurns(pitch) * distance - x;
    const towardY = this.origin.y - sineTurns(yaw) * cosineTurns(pitch) * distance - y;
    const towardZ = FLOOR_HEIGHT + camera.z - sineTurns(pitch) * distance - z;
    const length = squareRoot(towardX * towardX + towardY * towardY + towardZ * towardZ);
    const toward = length > Math.abs(lift) * 2.0 ? lift / length : 0.0;
    placeEffect(this.model, x + towardX * toward, y + towardY * toward, z + towardZ * toward);
    BlzSetSpecialEffectScale(this.model, characterModelScale(fighter.character) * (1.0 - toward) * grow);
    this.shown = true;
    return true;
  }

  tint(alpha: number, red: number, green: number, blue: number): void {
    BlzSetSpecialEffectAlpha(this.model, alpha);
    BlzSetSpecialEffectColor(this.model, red, green, blue);
  }

  hide(): void {
    if (this.shown) hideEffect(this.model, this.origin);
    this.shown = false;
  }

  drawnEffects(into: effect[]): void {
    into.push(this.model);
  }

  destroy(): void {
    hideEffect(this.model, this.origin);
    DestroyEffect(this.model);
  }
}
