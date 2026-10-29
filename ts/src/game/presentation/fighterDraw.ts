import { originalClip, originalClipNamed } from "../../generated/clips/fighterOriginalClipInfo";
import type { Character } from "../sim/codes";
import { fighterPoseFacing } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { heroCueWindows } from "./cueWindows";
import { specialClip } from "./fighterClips";
import { fitFighterPlacement } from "./fighterPlacement";
import type { FighterPose } from "./fighterPose";
import { specialCueState } from "./specialCues";
import { teeterPitch } from "./teeterLean";

export const GRAB_HOLD_DEPTH = 80.0;

/** The fighter's body as drawn on one frame: original clip, seconds into it, offset from the world origin, facing and lean. */
export interface FighterDraw {
  index: number | undefined;
  seconds: number;
  x: number;
  y: number;
  z: number;
  facing: number;
  pitch: number;
}

export function createFighterDraw(): FighterDraw {
  return { index: undefined, seconds: 0.0, x: 0.0, y: 0.0, z: 0.0, facing: 1, pitch: 0.0 };
}

/** `frame` is the presented simulation frame and `matchFrame` places moving decks; false when nothing is drawn. */
export function fitFighterDraw(out: FighterDraw, character: Character, fighter: Readonly<Fighter>, pose: Readonly<FighterPose>, stage: number, frame: number, matchFrame: number): boolean {
  const special = specialCueState(fighter);
  const startup = special.phase === "startup"
    ? specialClip(character, fighter.special.action, fighter.motion.grounded, false).classicStartup : undefined;
  const index = startup?.index ?? pose.clipIndex ?? originalClipNamed(character, pose.clipName);
  const clip = index === undefined ? undefined : originalClip(character, index);
  out.index = clip === undefined ? undefined : index;
  if (fighter.status.out || clip === undefined) return false;
  const duration = clip.endSeconds - clip.startSeconds;
  const move = startup === undefined ? undefined : runningHeroSpecial(fighter);
  let seconds = startup === undefined ? Math.max(0.0, pose.clipTime)
    : (startup.startSeconds ?? 0.0) + startup.seconds * Math.max(0, fighter.special.frame - 1) / Math.max(1, move === undefined ? 1 : heroCueWindows(move).startup.last - 1);
  if (duration <= 0.0) seconds = 0.0;
  else if (clip.looping) {
    const turns = seconds / duration;
    seconds -= Math.floor(turns) * duration;
  } else if (seconds > duration) seconds = duration;
  out.seconds = seconds;
  fitFighterPlacement(out, fighter, stage);
  out.y = fighter.grab.target === undefined ? 0.0 : -GRAB_HOLD_DEPTH;
  out.facing = fighterPoseFacing(fighter);
  out.pitch = teeterPitch(fighter, stage, matchFrame, frame, out.facing);
  return true;
}
