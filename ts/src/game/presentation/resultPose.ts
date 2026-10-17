import { floorMod } from "wisp/src/sim/intMath";
import type { FighterOriginalClip } from "../../generated/clips/fighterOriginalClip";

export interface ResultClips {
  readonly winnerClip: FighterOriginalClip;
  readonly repeatVictory: boolean;
  readonly heldClip: FighterOriginalClip;
  readonly defeatedClip: FighterOriginalClip;
}

export interface ResultPose {
  readonly clip: FighterOriginalClip;
  readonly time: number;
}

const HELD_FRAME_SECONDS = 1.0 / 60.0;

const modelTime = (clip: FighterOriginalClip, seconds: number): number => (clip.timeline === true ? clip.startSeconds : 0.0) + seconds;

/** What a results-screen fighter shows `seconds` into the results: the winner plays its victory from the start, then loops it or holds ready; the loser lies in the last frame of its knockdown. */
export function resultPoseAt(clips: ResultClips, winning: boolean, seconds: number): ResultPose {
  if (!winning) {
    const clip = clips.defeatedClip;
    return { clip, time: modelTime(clip, Math.max(0.0, clip.endSeconds - clip.startSeconds - HELD_FRAME_SECONDS)) };
  }
  const holding = !clips.repeatVictory && seconds >= clips.winnerClip.endSeconds - clips.winnerClip.startSeconds;
  const clip = holding ? clips.heldClip : clips.winnerClip;
  const duration = clip.endSeconds - clip.startSeconds;
  if (holding || duration <= 0.0) return { clip, time: modelTime(clip, 0.0) };
  return { clip, time: modelTime(clip, clips.repeatVictory ? floorMod(seconds, duration) : seconds) };
}
