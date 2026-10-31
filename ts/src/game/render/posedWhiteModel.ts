import { WHITE_FIGHTER_MODELS } from "../../generated/assets/whiteFighterModels";
import { ARENA_CAMERA, FLOOR_HEIGHT } from "../presentation/arenaCamera";
import { originalClip } from "../../generated/clips/fighterOriginalClipInfo";
import type { FighterDraw } from "../presentation/fighterDraw";
import type { Character } from "../sim/codes";
import { cosineTurns, sineTurns } from "../sim/mathTables";
import { squareRoot } from "../sim/warcraftMath";
import type { MatchCamera } from "../sim/matchCamera";
import { facingYaw, hideEffect, placeEffect, type WorldOrigin } from "./effects";
import { createEffect, destroyEffect, setEffectAlpha, setEffectAnimation, setEffectBlendTime, setEffectColor, setEffectOrientation, setEffectScale, setEffectTime, setEffectTimeScale } from "wisp/game/effects";

/** A white copy of the fighter's model held on the fighter's pose, moved `lift` units toward the camera (away when negative) and grown by `grow` round the body's middle. */
export class PosedWhiteModel {
  private readonly model: effect;
  private shown = false;

  constructor(private readonly character: Character, private readonly origin: WorldOrigin, private readonly bodyScale: number) {
    this.model = createEffect(WHITE_FIGHTER_MODELS[character] ?? "", origin.x, origin.y);
    setEffectBlendTime(this.model, 0.0);
    setEffectAnimation(this.model, "Stand");
    setEffectTimeScale(this.model, 0.0);
    hideEffect(this.model, origin);
  }

  pose(draw: Readonly<FighterDraw>, camera: Readonly<MatchCamera>, lift: number, grow: number, height: number): boolean {
    const index = draw.index;
    const clip = index === undefined ? undefined : originalClip(this.character, index);
    if (clip === undefined) return false;
    setEffectTime(this.model, clip.startSeconds + draw.seconds);
    setEffectOrientation(this.model, facingYaw(draw.facing), draw.pitch, 0.0);
    const x = this.origin.x + draw.x, y = this.origin.y + draw.y, z = this.origin.z + draw.z - (grow - 1.0) * height * 0.5;
    const pitch = ARENA_CAMERA.angleOfAttack / 360.0, yaw = ARENA_CAMERA.rotation / 360.0;
    const distance = camera.distance;
    const towardX = this.origin.x + camera.x - cosineTurns(yaw) * cosineTurns(pitch) * distance - x;
    const towardY = this.origin.y - sineTurns(yaw) * cosineTurns(pitch) * distance - y;
    const towardZ = FLOOR_HEIGHT + camera.z - sineTurns(pitch) * distance - z;
    const length = squareRoot(towardX * towardX + towardY * towardY + towardZ * towardZ);
    const toward = length > Math.abs(lift) * 2.0 ? lift / length : 0.0;
    placeEffect(this.model, x + towardX * toward, y + towardY * toward, z + towardZ * toward);
    setEffectScale(this.model, this.bodyScale * (1.0 - toward) * grow);
    this.shown = true;
    return true;
  }

  tint(alpha: number, red: number, green: number, blue: number): void {
    setEffectAlpha(this.model, alpha);
    setEffectColor(this.model, red, green, blue);
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
    destroyEffect(this.model);
  }
}
