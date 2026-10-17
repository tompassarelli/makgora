import { model as mdx } from "../../ts/scripts/clipNodes";
import { isDeepStrictEqual } from "node:util";
import { Character } from "../../ts/src/game/sim/codes";
import { FIGHTER_ART } from "../../ts/src/generated/fighterArtData";
import { onGlobalClock } from "./original-clips";
import { originalClipNamed } from "../../ts/src/generated/clips/fighterOriginalClipInfo";

export function flashableSequences(character: number, sequences: readonly mdx.Sequence[]): mdx.Sequence[] {
  const art = FIGHTER_ART.get(character);
  if (art === undefined) throw new Error(`no fighter art for character ${character}`);
  const indices = new Set(art.flashClips);
  for (const name of character === Character.demonHunter ? ["stand", "stand ready", "stand hit"] : ["stand", "stand ready", "stand hit", "walk"]) {
    const index = originalClipNamed(character, name);
    if (index !== undefined) indices.add(index);
  }
  if (character < Character.demonHunter) {
    const attack = originalClipNamed(character, "attack");
    if (attack !== undefined) indices.add(attack);
  }
  return sequences.filter((sequence, index) => indices.has(index));
}

export function keepFlashableKeys(track: mdx.AnimVector, sequences: readonly mdx.Sequence[]): void {
  if (onGlobalClock(track)) return;
  track.Keys = track.Keys.filter(key => sequences.some(sequence => key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]));
  if (track.LineType !== mdx.LineType.Linear && track.LineType !== mdx.LineType.DontInterp) return;
  const keys = track.Keys;
  track.Keys = keys.filter((key, index) => {
    const before = keys[index - 1], after = keys[index + 1];
    if (before === undefined || after === undefined) return true;
    if (!sequences.some(sequence => before.Frame >= sequence.Interval[0] && after.Frame <= sequence.Interval[1]
      && key.Frame > sequence.Interval[0] && key.Frame < sequence.Interval[1])) return true;
    return !isDeepStrictEqual(before.Vector, key.Vector) || !isDeepStrictEqual(after.Vector, key.Vector);
  });
}

// Warcraft 3.0.1 crashes when loading an empty animation track (#284).




export function trimFlashTracks(value: unknown, sequences: readonly mdx.Sequence[]): void {
  if (typeof value !== "object" || value === null || ArrayBuffer.isView(value)) return;
  const owner = value as Record<string, unknown>;

  for (const [name, child] of Object.entries(owner)) {
    if (name === "Nodes" || typeof child !== "object" || child === null) continue;
    if (!("Keys" in child) || !Array.isArray(child.Keys)) {
      trimFlashTracks(child, sequences);
      continue;
    }
    const track = child as mdx.AnimVector;
    keepFlashableKeys(track, sequences);
    if (track.Keys.length === 0) delete owner[name];
  }
}

export function preservesFlashKey(track: mdx.AnimVector | undefined, key: mdx.AnimKeyframe): boolean {
  if (track === undefined) return false;
  if (track.Keys.some(item => isDeepStrictEqual(item, key))) return true;
  if (track.LineType !== mdx.LineType.Linear && track.LineType !== mdx.LineType.DontInterp) return false;
  const before = track.Keys.findLast(item => item.Frame < key.Frame);
  const after = track.Keys.find(item => item.Frame > key.Frame);
  return before !== undefined && after !== undefined
    && isDeepStrictEqual(before.Vector, key.Vector) && isDeepStrictEqual(after.Vector, key.Vector);
}
