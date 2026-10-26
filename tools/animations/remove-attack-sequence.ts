import { model as mdx } from "../../ts/scripts/clipNodes";
import { onGlobalClock, tracks } from "./original-clips";

export function selectedAttackPose(options: string[]): { readonly pose: string | undefined; readonly replace: boolean } {
  const replace = options.includes("--replace-pose"), flag = replace ? "--replace-pose" : "--pose";
  if (replace && options.includes("--pose")) throw new Error("choose either --pose or --replace-pose");
  return { pose: options.includes(flag) ? options[options.indexOf(flag) + 1] : undefined, replace };
}

export function removeAttackSequence(model: mdx.Model, name: string): number {
  const index = model.Sequences.findIndex(sequence => sequence.Name === name);
  if (index < 0) throw new Error(`${name}: sequence is missing`);
  const [sequence] = model.Sequences.splice(index, 1);
  if (sequence === undefined) throw new Error(`${name}: sequence could not be removed`);
  const [start, end] = sequence.Interval;
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(key => key.Frame < start || key.Frame > end); });
  return index;
}
