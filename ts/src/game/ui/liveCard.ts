import { floorMod } from "wisp/src/sim/intMath";
import { costumeClipModel, costumeIndex } from "../roster/costumes";
import type { FighterOriginalClip } from "../../generated/clips/fighterOriginalClip";
import { originalClip, originalClipNamed } from "../../generated/clips/fighterOriginalClipInfo";
import { Frame, setFrameModel, setFrameSpriteAnimation, setFrameSpriteTime, setFrameVisible } from "wisp/game/frames";

/** Whether the window draws fighters itself into their cards: set by the native window's game module, never in the Warcraft build. */
export const livePortraits = { enabled: false };

const STAND_NAMES = ["stand", "stand -1", "stand - 1", "stand 1"];

function standClip(character: number): FighterOriginalClip | undefined {
  for (const name of STAND_NAMES) {
    const index = originalClipNamed(character, name);
    const clip = index === undefined ? undefined : originalClip(character, index);
    if (clip !== undefined) return clip;
  }
  return undefined;
}

/** Points a SPRITE frame at `character`'s idle `seconds` into its loop; false (leaving the frame untouched) when the fighter has no idle clip. */
export function showLiveFighter(frame: Frame, character: number, costume: number, seconds: number): boolean {
  const clip = standClip(character);
  if (clip === undefined) return false;
  const duration = clip.endSeconds - clip.startSeconds;
  const into = duration > 0 ? floorMod(seconds, duration) : 0;
  setFrameModel(frame, costumeClipModel(character, costume, clip), 0);
  setFrameSpriteAnimation(frame, 0, 0);
  setFrameSpriteTime(frame, (clip.timeline === true ? clip.startSeconds : 0) + into);
  return true;
}

/** Shows `character`'s live idle in `render` when the window draws fighters itself and hides the baked `portrait` behind it; otherwise hides `render`. */
export function presentLiveFighter(render: Frame, portrait: Frame, shown: boolean, character: number | undefined, costumeChoice: number, seconds: number): void {
  const live = livePortraits.enabled && shown && character !== undefined && character >= 0 && showLiveFighter(render, character, costumeIndex(character, costumeChoice), seconds);
  setFrameVisible(render, live);
  if (live) setFrameVisible(portrait, false);
}
