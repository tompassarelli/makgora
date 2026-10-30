import { mkdirSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { generateMDX, parseMDX, model as mdx } from "war3-model";
import { ensure, onGlobalClock, tracks } from "./original-clips";

const [input, output, ...names] = process.argv.slice(2);
const project = resolve(import.meta.dir, "../..");
ensure(input && output && names.length > 0 && relative(project, resolve(output)).startsWith(".."), "usage: bun tools/animations/fade-clear.ts SHIPPED.mdx PRIVATE_OUTPUT SEQUENCE...");
const ALPHA = /^\.(GeosetAnims\.\d+|Materials\.\d+\.Layers\.\d+)\.Alpha$/;
const source = parseMDX(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
const windows = names.map((name) => {
  const found = model.Sequences.filter((sequence) => sequence.Name === name);
  ensure(found.length === 1, `${name}: expected exactly one such sequence`);
  return found[0]!.Interval;
});
const EPSILON = 1e-3;
const inside = (frame: number) => windows.some(([start, end]) => frame >= start! && frame <= end!);
const [openStart, openEnd] = model.Sequences[0]!.Interval;
const keyAt = (key: mdx.AnimKeyframe, frame: number): mdx.AnimKeyframe => ({ ...key, Frame: frame, Vector: key.Vector.slice() });

let cleared = 0;
tracks(model, (track, path) => {
  if (!ALPHA.test(path) || onGlobalClock(track)) return;
  const level = track.Keys.find((key) => key.Frame >= openStart! && key.Frame <= openEnd!)?.Vector[0] ?? 1;
  if (level <= 0) return;
  let changed = false;
  for (const [start, end] of windows) {
    const keys = track.Keys.filter((key) => key.Frame >= start! && key.Frame <= end!);
    if (keys.some((key) => (key.Vector[0] ?? 1) < level - EPSILON)) {
      for (const key of keys) {
        key.Vector[0] = level;
        key.InTan?.fill(0);
        key.OutTan?.fill(0);
      }
      if (!keys.some((key) => key.Frame === end)) track.Keys.push(keyAt(keys[keys.length - 1]!, end!));
      if (!keys.some((key) => key.Frame === start)) track.Keys.push(keyAt(keys[0]!, start!));
      track.Keys.sort((x, y) => x.Frame - y.Frame);
      changed = true;
    }
  }
  if (changed) cleared++;
});
ensure(cleared > 0, "no body geoset fades in the named sequences");

const outside = (m: mdx.Model) => {
  const copy = structuredClone(m);
  tracks(copy, (track) => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter((key) => !inside(key.Frame)); });
  return copy;
};
ensure(isDeepStrictEqual(outside(model), outside(source)), "Clearing the fade changed a sequence that was not named");
const bytes = generateMDX(model), decoded = parseMDX(bytes);
ensure(isDeepStrictEqual(parseMDX(generateMDX(decoded)), decoded), "MDX round trip changed model");
mkdirSync(resolve(output), { recursive: true });
await Bun.write(join(resolve(output), basename(input)), bytes);
console.log(`FADE_CLEAR_PASS ${cleared} alpha tracks held at full in ${names.join(", ")}; ${join(resolve(output), basename(input))}`);
