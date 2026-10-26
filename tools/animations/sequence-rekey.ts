import { isDeepStrictEqual } from "node:util";
import type { model as mdx } from "war3-model";
import { ensure, onGlobalClock, tracks } from "./original-clips";

const laterRoot = (target: mdx.Model, path: string) => {
  const at = /^\.Helpers\.(\d+)\./.exec(path)?.[1];
  return at !== undefined && target.Helpers[Number(at)]!.Name.endsWith(" Motion");
};

const keyed = (owner: mdx.Model, target: mdx.Model) => {
  const found = new Map<string, mdx.AnimVector>();
  tracks(owner, (track, path) => { if (!laterRoot(target, path)) found.set(path, track); });
  return found;
};

export function rekeySequences(target: mdx.Model, authored: mdx.Model, names: readonly string[]): void {
  ensure(isDeepStrictEqual(authored.Nodes.map(node => node.Name), target.Nodes.map(node => node.Name)), "rekey: authored and shipped skeletons differ");
  const from = keyed(authored, target), into = keyed(target, target);
  for (const name of names) {
    const source = authored.Sequences.find(sequence => sequence.Name === name), shipped = target.Sequences.find(sequence => sequence.Name === name);
    ensure(source && shipped, `rekey ${name}: no such clip in both models`);
    const [start, end] = [source.Interval[0]!, source.Interval[1]!], [at, until] = [shipped.Interval[0]!, shipped.Interval[1]!];
    ensure(end - start === until - at, `rekey ${name}: length changed from ${until - at} ms to ${end - start} ms`);
    const within = (lo: number, hi: number) => (key: { Frame: number }) => key.Frame >= lo && key.Frame <= hi;
    for (const [path, track] of into) {
      if (onGlobalClock(track)) continue;
      const donor = from.get(path), keys = donor ? donor.Keys.filter(within(start, end)).map(key => ({ ...structuredClone(key), Frame: key.Frame - start + at })) : [];
      ensure(donor || !track.Keys.some(within(at, until)), `rekey ${name}: ${path} has keys only in the shipped model`);
      track.Keys = [...track.Keys.filter(key => !within(at, until)(key)), ...keys].sort((a, b) => a.Frame - b.Frame);
    }
    for (const [path, track] of from) ensure(into.has(path) || !track.Keys.some(within(start, end)), `rekey ${name}: ${path} has keys only in the authored model`);
    shipped.MinimumExtent = source.MinimumExtent.slice(); shipped.MaximumExtent = source.MaximumExtent.slice(); shipped.BoundsRadius = source.BoundsRadius;
  }
}
