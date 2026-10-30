import { FRAME_SECONDS } from "./frameClock";
import * as clips from "./fighterClips";
import type { Fighter } from "../sim/fighter";
import type { HeroPose } from "../sim/heroes/hero";
import type { FighterPose } from "./fighterPose";

export const JUMP_CLIP_FRAMES = 24;

export const hopPose = (f: Readonly<Fighter>): HeroPose => {
  const table = clips.characterClips(f.character);
  return table.fullHop !== undefined && table.shortHop !== undefined ? f.jump.held ? "fullHop" : "shortHop" : "jump";
};
export const jumpPose = (pose: Readonly<FighterPose>, f: Readonly<Fighter>): HeroPose => pose.doubleJumpAnimation ? "doubleJump" : hopPose(f);
const HOP_FALL_SLACK_FRAMES = 6;

export const hopClipFrames = (f: Readonly<Fighter>): number => {
  const pose = hopPose(f);
  return pose === "jump" ? JUMP_CLIP_FRAMES : Math.round(clips.clipFor(f.character, pose).seconds / FRAME_SECONDS);
};
export const hopFrames = (f: Readonly<Fighter>): number => hopPose(f) === "jump" ? JUMP_CLIP_FRAMES : hopClipFrames(f) + HOP_FALL_SLACK_FRAMES;
