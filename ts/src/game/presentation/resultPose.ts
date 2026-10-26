import { floorMod } from "wisp/src/sim/intMath";
import type { FighterOriginalClip } from "../../generated/clips/fighterOriginalClip";
import { originalClip, originalClipNamed } from "../../generated/clips/fighterOriginalClipInfo";
import { heroLook } from "../roster/looks";

export interface ResultClips {
  readonly winnerClip: FighterOriginalClip;
  readonly repeatVictory: boolean;
  readonly heldClip: FighterOriginalClip;
  readonly standClip: FighterOriginalClip;
  readonly defeatClip?: FighterOriginalClip | undefined;
}

export interface ResultPose {
  readonly clip: FighterOriginalClip;
  readonly time: number;
}

const LAST_FRAME_SECONDS = 1.0 / 60.0;

const modelTime = (clip: FighterOriginalClip, seconds: number): number => (clip.timeline === true ? clip.startSeconds : 0.0) + seconds;

const looped = (clip: FighterOriginalClip, seconds: number): ResultPose => {
  const duration = clip.endSeconds - clip.startSeconds;
  return { clip, time: modelTime(clip, duration <= 0.0 ? 0.0 : floorMod(seconds, duration)) };
};

/** The defeated sequence a fighter's look names, or undefined when it names none or its model lacks that sequence. */
export function defeatClip(character: number): FighterOriginalClip | undefined {
  const name = heroLook(character)?.defeat;
  const index = name === undefined ? undefined : originalClipNamed(character, name);
  return index === undefined ? undefined : originalClip(character, index);
}

/** What a results-screen fighter shows `seconds` into the results: the winner plays its victory from the start, then loops it or holds ready; the loser plays its defeated sequence once and holds its last frame, or stands in its idle stand when it has none. */
export function resultPoseAt(clips: ResultClips, winning: boolean, seconds: number): ResultPose {
  if (!winning) {
    const defeat = clips.defeatClip;
    if (defeat === undefined) return looped(clips.standClip, seconds);
    return { clip: defeat, time: modelTime(defeat, Math.max(0.0, Math.min(seconds, defeat.endSeconds - defeat.startSeconds - LAST_FRAME_SECONDS))) };
  }
  const holding = !clips.repeatVictory && seconds >= clips.winnerClip.endSeconds - clips.winnerClip.startSeconds;
  const clip = holding ? clips.heldClip : clips.winnerClip;
  const duration = clip.endSeconds - clip.startSeconds;
  if (holding || duration <= 0.0) return { clip, time: modelTime(clip, 0.0) };
  return { clip, time: modelTime(clip, clips.repeatVictory ? floorMod(seconds, duration) : seconds) };
}
