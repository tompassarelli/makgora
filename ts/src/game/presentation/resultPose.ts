import { floorMod } from "wisp/src/sim/intMath";
import type { FighterOriginalClip } from "../../generated/clips/fighterOriginalClip";

export interface ResultClips {
  readonly winnerClip: FighterOriginalClip;
  readonly repeatVictory: boolean;
  readonly heldClip: FighterOriginalClip;
  readonly standClip: FighterOriginalClip;
}

export interface ResultPose {
  readonly clip: FighterOriginalClip;
  readonly time: number;
}

const modelTime = (clip: FighterOriginalClip, seconds: number): number => (clip.timeline === true ? clip.startSeconds : 0.0) + seconds;

const looped = (clip: FighterOriginalClip, seconds: number): ResultPose => {
  const duration = clip.endSeconds - clip.startSeconds;
  return { clip, time: modelTime(clip, duration <= 0.0 ? 0.0 : floorMod(seconds, duration)) };
};

/** What a results-screen fighter shows `seconds` into the results: the winner plays its victory from the start, then loops it or holds ready; the loser stands in its idle stand. */
export function resultPoseAt(clips: ResultClips, winning: boolean, seconds: number): ResultPose {
  if (!winning) return looped(clips.standClip, seconds);
  const holding = !clips.repeatVictory && seconds >= clips.winnerClip.endSeconds - clips.winnerClip.startSeconds;
  const clip = holding ? clips.heldClip : clips.winnerClip;
  const duration = clip.endSeconds - clip.startSeconds;
  if (holding || duration <= 0.0) return { clip, time: modelTime(clip, 0.0) };
  return { clip, time: modelTime(clip, clips.repeatVictory ? floorMod(seconds, duration) : seconds) };
}
