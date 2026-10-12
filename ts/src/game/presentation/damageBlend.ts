



import { at } from "wisp/src/runtime/lookup";
import { floorDiv } from "wisp/src/sim/intMath";
import { max, min } from "../../runtime/numbers";
import type { Fighter } from "../sim/fighter";
import { Character } from "../sim/codes";
import { contactDamageClips } from "./damagePose";
import { characterClips } from "./fighterClips";





export const PAIN_ENTRY_BLEND_FRAMES: readonly number[] = [3, 2, 1];

export const PAIN_EXIT_BLEND_FRAMES = 4;

const STOP_ENTRY_BLEND_FRAMES: Readonly<Partial<Record<Character, number>>> = {
  [Character.mountainKing]: 6,
};


export function isContactPainClip(character: number, index: number): boolean {
  const row = contactDamageClips(character);
  if (row === undefined) return false;
  for (const clip of row) if (clip.index === index) return true;
  return false;
}





export function painEntryBlendFrames(strength: number, hitlag: number): number {
  const frames = at(PAIN_ENTRY_BLEND_FRAMES, max(0, min(strength, PAIN_ENTRY_BLEND_FRAMES.length - 1)));
  return max(0, min(frames, hitlag - 1));
}


export function poseBlendFrames(fighter: Readonly<Fighter>, from: number, to: number): number {
  if (from === to) return 0;
  if (isContactPainClip(fighter.character, to)) return painEntryBlendFrames(fighter.visuals.hitStrength, fighter.launch.hitlag);
  if (isContactPainClip(fighter.character, from)) return PAIN_EXIT_BLEND_FRAMES;
  const frames = STOP_ENTRY_BLEND_FRAMES[fighter.character];
  if (frames === undefined) return 0;
  const clips = characterClips(fighter.character);
  if (to === clips.stop?.index && (from === clips.dash?.index || from === clips.run?.index || from === clips.walk?.index)) return frames;
  return 0;
}





export function outgoingPoseAlpha(elapsed: number, frames: number): number {
  if (frames <= 0 || elapsed < 0 || elapsed >= frames) return 0;
  return floorDiv(255 * (frames - elapsed), frames + 1);
}
