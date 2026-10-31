





import { itemBodyTint } from "../presentation/itemLook";
import {
  ORIGINAL_LIGHT_ACTIVE_ANIMATION,
  ORIGINAL_LIGHT_GATE_SECONDS,
  ORIGINAL_LIGHT_INACTIVE_ANIMATION,
  originalClip,
  originalClipCount,
  originalLightPath,
} from "../../generated/clips/fighterOriginalClipInfo";
import { type Character, HeroStatusKind } from "../sim/codes";
import { isIntangible } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { type WorldOrigin, FIGHTER_PHASE_ALPHA, facingYaw, hideEffect, placeEffect } from "./effects";
import { damageTint } from "../presentation/hitPresentation";
import { specialCueState } from "../presentation/specialCues";
import { fighterModelReplaced } from "../presentation/fighterForm";
import type { FighterDraw } from "../presentation/fighterDraw";
import { outgoingPoseAlpha, poseBlendFrames } from "../presentation/damageBlend";
import { costumeClipModel } from "../roster/costumes";
import { createEffect, destroyEffect, setEffectAlpha, setEffectAnimation, setEffectBlendTime, setEffectColor, setEffectOrientation, setEffectPosition, setEffectScale, setEffectTeamColor, setEffectTime, setEffectTimeScale, setEffectYaw } from "wisp/game/effects";
import { player } from "wisp/game/players";

const PETRIFIED_GREY = 150;
// Warcraft freezes global sequences at time scale 0, so a shown body runs, jumped one frame behind its clip time so the frame it then advances lands on it.
const RUNNING = 1.0;
const FRAME_SECONDS = 1.0 / 60.0;
const HELD = 0.0;
const CHILL_TINT = { red: 120, green: 190, blue: 255 };

export class FighterPoolPresentation {
  private readonly clips: effect[] = [];
  private readonly light: effect | undefined;
  private readonly scale: number;
  private lightVisible = false;
  private visible: number | undefined;
  private yaw: number | undefined;
  private pitch: number | undefined;
  private red: number | undefined;
  private green: number | undefined;
  private blue: number | undefined;
  private alpha: number | undefined;
  private lightYaw: number | undefined;

  private blendFrom: number | undefined;
  private blendStart = 0;
  private blendFrames = 0;

  missingSelections = 0;

  constructor(
    private readonly character: Character,
    participant: number,
    private readonly origin: WorldOrigin,
    costume: number,
    scale: number,
  ) {
    const { x, y, z } = origin;
    this.scale = scale;
    const lightPath = originalLightPath(character);
    if (lightPath !== undefined) {
      const light = createEffect(lightPath, x, y);
      setEffectPosition(light, x, y, z);
      setEffectScale(light, this.scale);
      setEffectBlendTime(light, 0.0);
      setEffectTimeScale(light, 0.0);
      this.suppress(light);
      this.light = light;
    }
    const count = originalClipCount(character);
    for (let index = 0; index < count; index++) {
      const clip = originalClip(character, index);
      if (clip === undefined) break;
      const model = createEffect(costumeClipModel(character, costume, clip), x, y);
      setEffectTeamColor(model, player(participant));
      setEffectBlendTime(model, 0.0);
      setEffectAnimation(model, "Stand");
      setEffectTimeScale(model, RUNNING);
      hideEffect(model, origin);
      this.clips.push(model);
    }
  }


  admitted(): boolean {
    return this.clips.length > 0;
  }


  private suppress(light: effect): void {
    setEffectAnimation(light, ORIGINAL_LIGHT_INACTIVE_ANIMATION);
    setEffectTime(light, ORIGINAL_LIGHT_GATE_SECONDS);
  }

  private endBlend(): void {
    const from = this.blendFrom === undefined ? undefined : this.clips[this.blendFrom];
    if (from !== undefined && this.blendFrom !== this.visible) hideEffect(from, this.origin);
    this.blendFrom = undefined;
  }

  drawnEffects(into: effect[]): void {
    for (const model of this.clips) into.push(model);
    if (this.light !== undefined) into.push(this.light);
  }

  redraw(): void {
    this.yaw = undefined;
    this.pitch = undefined;
    this.lightYaw = undefined;
  }

  hide(): void {
    this.endBlend();
    const shown = this.visible === undefined ? undefined : this.clips[this.visible];
    if (shown !== undefined) hideEffect(shown, this.origin);
    this.visible = undefined;
    if (this.light !== undefined && this.lightVisible) {
      this.suppress(this.light);
      this.lightVisible = false;
    }
  }

  /** `frame` is the presented simulation frame, which times pose blends. */
  present(fighter: Readonly<Fighter>, draw: Readonly<FighterDraw>, drawn: boolean, frame: number): void {
    if (this.clips.length === 0) return;
    const index = draw.index;
    const model = index === undefined ? undefined : this.clips[index];
    const clip = index === undefined ? undefined : originalClip(this.character, index);
    if (!drawn || index === undefined || model === undefined || clip === undefined) {
      if (!fighter.status.out) this.missingSelections++;
      this.hide();
      return;
    }
    const changed = this.visible !== index;
    if (changed) {
      const previous = this.visible;
      const frames = previous === undefined ? 0 : poseBlendFrames(fighter, previous, index);

      if (this.blendFrom === index) this.blendFrom = undefined;
      this.endBlend();
      const shown = previous === undefined ? undefined : this.clips[previous];

      if (frames > 0) {
        this.blendFrom = previous;
        this.blendStart = frame;
        this.blendFrames = frames;
        if (shown !== undefined) setEffectTimeScale(shown, HELD);
      } else if (shown !== undefined) hideEffect(shown, this.origin);
      this.visible = index;
      setEffectTimeScale(model, RUNNING);
    }
    const seconds = draw.seconds;
    const x = this.origin.x + draw.x;
    const y = this.origin.y + draw.y;
    const z = this.origin.z + draw.z;
    const yaw = facingYaw(draw.facing);
    const pitch = draw.pitch;
    placeEffect(model, x, y, z);
    if (changed || this.yaw !== yaw || this.pitch !== pitch) {
      // Native yaw can discard an earlier effect scale (#360's floes), so the scale follows every yaw.
      setEffectOrientation(model, yaw, pitch, 0.0);
      setEffectScale(model, this.scale);
      this.yaw = yaw;
      this.pitch = pitch;
    }
    const base = clip.timeline ? clip.startSeconds : 0.0;
    setEffectTime(model, base + Math.max(0.0, seconds - FRAME_SECONDS));
    if (this.light !== undefined) {
      placeEffect(this.light, x, y, z);
      if (this.lightYaw !== yaw) {
        setEffectYaw(this.light, yaw);
        setEffectScale(this.light, this.scale);
        this.lightYaw = yaw;
      }
      if (!this.lightVisible) {
        setEffectAnimation(this.light, ORIGINAL_LIGHT_ACTIVE_ANIMATION);
        setEffectTime(this.light, ORIGINAL_LIGHT_GATE_SECONDS);
        this.lightVisible = true;
      }
    }
    const tint = damageTint(fighter);
    let red = 255;
    let green = 255;
    let blue = 255;
    let alpha = 255;
    if (fighter.status.frozenFrames > 0 && fighter.status.petrified) {
      red = PETRIFIED_GREY;
      green = PETRIFIED_GREY;
      blue = PETRIFIED_GREY;
    } else if (fighter.status.frozenFrames > 0) {
      red = 155;
      green = 210;
    } else if (tint !== undefined) {
      red = tint.red;
      green = tint.green;
      blue = tint.blue;
    } else if (fighter.status.condition === HeroStatusKind.chill) {
      red = CHILL_TINT.red;
      green = CHILL_TINT.green;
      blue = CHILL_TINT.blue;
    } else {
      const shielded = fighter.shield.raised;
      const item = shielded ? undefined : itemBodyTint(fighter);
      if (shielded) {
        red = 100;
        green = 160;
      } else if (item !== undefined) {
        red = item.red;
        green = item.green;
        blue = item.blue;
      }
      if (isIntangible(fighter)) alpha = FIGHTER_PHASE_ALPHA;
      // Banish's ethereal victim: green and see-through until the status ends.
      if (fighter.status.condition === HeroStatusKind.banish) {
        red = 120;
        blue = 150;
        alpha = FIGHTER_PHASE_ALPHA;
      }
    }
    const transformation = specialCueState(fighter);
    const body = transformation.phase === "none" ? undefined : transformation.cues?.body;
    if (body !== undefined) {
      red = body.red;
      green = body.green;
      blue = body.blue;
      alpha = body.alpha;
    }
    if (transformation.cues?.vanishes === true && isIntangible(fighter)) alpha = 0;
    if (fighterModelReplaced(fighter)) alpha = 0;
    if (changed || this.red !== red || this.green !== green || this.blue !== blue) {
      setEffectColor(model, red, green, blue);
      this.red = red;
      this.green = green;
      this.blue = blue;
    }
    if (changed || this.alpha !== alpha) {
      setEffectAlpha(model, alpha);
      this.alpha = alpha;
    }
    const from = this.blendFrom === undefined ? undefined : this.clips[this.blendFrom];
    if (from === undefined) return;
    const fade = outgoingPoseAlpha(frame - this.blendStart, this.blendFrames);
    if (fade <= 0) {
      this.endBlend();
      return;
    }
    setEffectPosition(from, x, y, z);
    setEffectScale(from, this.scale);
    setEffectColor(from, red, green, blue);
    setEffectAlpha(from, fade);
  }

  destroy(): void {

    if (this.light !== undefined) {
      this.suppress(this.light);
      destroyEffect(this.light);
    }

    this.endBlend();
    const shown = this.visible === undefined ? undefined : this.clips[this.visible];
    if (shown !== undefined) hideEffect(shown, this.origin);
    for (const model of this.clips) destroyEffect(model);
    this.clips.length = 0;
    this.visible = undefined;
  }
}
