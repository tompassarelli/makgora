import { min } from "../core/numbers";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { HeroClip } from "../sim/heroes/hero";
import * as dh from "./demonHunterAssetInfo";
import { characterClips } from "./fighterClips";
import { originalClip } from "../../generated/clips/fighterOriginalClipInfo";
import { FRAME_SECONDS } from "./frameClock";
import { IllidanLocomotion } from "./illidanMotion";
import { type PoseClip, selectFighterClipIndex } from "./poseClip";

export const CROUCH_CLIP_FRAMES = 24;
export const CROUCH_KEY = `motion${IllidanLocomotion.crouch}`;

const clipRate = (seconds: number, frames: number): number => f32(seconds / f32(frames * FRAME_SECONDS));

export function crouchClip(f: Readonly<Fighter>): HeroClip | undefined {
  if (f.character === Character.demonHunter) return { index: dh.DEMON_HUNTER_CROUCH_INDEX, seconds: dh.DEMON_HUNTER_CROUCH_SECONDS };
  return characterClips(f.character).crouch;
}

export const crouchLoops = (f: Readonly<Fighter>, clip: Readonly<HeroClip>): boolean => originalClip(f.character, clip.index)?.looping === true;

export function selectCrouchClip(pose: PoseClip, f: Readonly<Fighter>, crouching: boolean): number | undefined {
  const clip = crouchClip(f);
  if (clip === undefined || !crouching) return undefined;
  if (pose.animation !== CROUCH_KEY || pose.clipIndex !== clip.index) selectFighterClipIndex(pose, clip.index);
  pose.animation = CROUCH_KEY;
  if (crouchLoops(f, clip)) return clipRate(clip.seconds, CROUCH_CLIP_FRAMES);
  const held = f32(clip.seconds - FRAME_SECONDS);
  if (pose.clipTime >= held) {
    pose.clipTime = held;
    return 0.0;
  }
  return min(clipRate(clip.seconds, CROUCH_CLIP_FRAMES), f32(f32(held - pose.clipTime) / FRAME_SECONDS));
}
