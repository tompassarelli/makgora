import { chmodSync, cpSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { FIGHTER_RIGS } from "./rigs";
import { Character } from "../../ts/src/game/sim/codes";
import type { HeroClipTable } from "../../ts/src/game/sim/heroes/hero";
import { generateModelMDX as generateMDX } from "../../ts/scripts/mdxCodec";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";
import { fighters } from "../../ts/scripts/heroModelSource";
import { ensureMotionHelper } from "../../ts/scripts/motionHelper";
import type { model as mdx } from "war3-model";

const [inputArg, outputArg] = process.argv.slice(2);
const input = resolve(inputArg ?? ""), output = resolve(outputArg ?? "");
const project = resolve(import.meta.dir, "../..");
ensure(inputArg && outputArg && relative(project, output).startsWith(".."), "usage: bun tools/animations/hop-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
mkdirSync(output, { recursive: true });
cpSync(join(input, "hero-models"), join(output, "hero-models"), { recursive: true, dereference: true });
chmodSync(join(output, "hero-models"), 0o755);

interface Hop { readonly pose: "shortHop" | "fullHop"; readonly frames: number; readonly rise: number }
const HOPS: readonly Hop[] = [{ pose: "shortHop", frames: 19, rise: 10 }, { pose: "fullHop", frames: 33, rise: 16 }];
const WINGS = new Set(["New Wings", "Mesh67"]);

const BEATS: Readonly<Record<string, readonly number[]>> = {
  wing: [-30, 55, -45, -20, 0],
  hip: [-45, 5, -20, -8, 0],
  knee: [80, 5, 50, 20, 0],
  ankle: [-20, 15, -10, -5, 0],
  shoulder: [30, -50, -35, -20, 0],
  elbow: [30, 20, 25, 15, 0],
  wrist: [0, 0, 0, 0, 0],
  chest: [20, -15, -10, 0, 0],
  head: [10, -10, -5, 0, 0],
  root: [6, -6, -3, 3, 0],
};

function beatTimes(hop: Hop): readonly number[] {
  return [0, Math.round(hop.rise * 0.4), hop.rise, hop.rise + Math.round((hop.frames - hop.rise) * 0.45), hop.frames];
}

function curve(values: readonly number[], times: readonly number[], frame: number): number {
  let at = 0;
  while (at < times.length - 2 && frame > (times[at + 1] ?? 0)) at++;
  const t0 = times[at] ?? 0, t1 = times[at + 1] ?? 1, u = (frame - t0) / Math.max(1, t1 - t0);
  const slope = (index: number) => {
    const before = Math.max(0, index - 1), after = Math.min(values.length - 1, index + 1);
    return ((values[after] ?? 0) - (values[before] ?? 0)) / Math.max(1, (times[after] ?? 0) - (times[before] ?? 0));
  };
  const p0 = values[at] ?? 0, p1 = values[at + 1] ?? 0, m0 = slope(at) * (t1 - t0), m1 = slope(at + 1) * (t1 - t0);
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
}

function pitch(q: Float32Array | Int32Array, degrees: number): Float32Array<ArrayBuffer> {
  const s = Math.sin(degrees * Math.PI / 360), c = Math.cos(degrees * Math.PI / 360);
  const [x = 0, y = 0, z = 0, w = 1] = q;
  return new Float32Array([c * x + s * z, c * y + s * w, c * z - s * x, c * w - s * y]);
}

const PUSH_FRAMES = 4;
const SQUAT_END_MS = 33;

function smooth(u: number): number { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); }

function lerp(a: ArrayLike<number>, b: ArrayLike<number>, t: number): Float32Array<ArrayBuffer> {
  return new Float32Array(Array.from(b, (value, index) => (1 - t) * (a[index] ?? 0) + t * value));
}

function nlerp(a: Float32Array | Int32Array, b: Float32Array, t: number): Float32Array<ArrayBuffer> {
  const dot = (a[0] ?? 0) * b[0]! + (a[1] ?? 0) * b[1]! + (a[2] ?? 0) * b[2]! + (a[3] ?? 0) * b[3]!, sign = dot < 0 ? -1 : 1;
  const q = Array.from(b, (value, index) => (1 - t) * sign * (a[index] ?? 0) + t * value);
  const length = Math.hypot(...q) || 1;
  return new Float32Array(q.map(value => value / length));
}

function atTime(track: mdx.AnimVector, frame: number, quaternion: boolean): Float32Array | Int32Array | undefined {
  const keys = track.Keys;
  const next = keys.findIndex(k => k.Frame >= frame);
  if (next < 0) return keys.at(-1)?.Vector;
  const upper = keys[next]!, lower = keys[next - 1];
  if (lower === undefined || upper.Frame === frame) return upper.Vector;
  const t = (frame - lower.Frame) / (upper.Frame - lower.Frame);
  return quaternion ? nlerp(lower.Vector, new Float32Array(upper.Vector), t) : lerp(lower.Vector, upper.Vector, t);
}

const fighter = fighters.get(Character.dreadlord)!;
ensure(fighter, "missing Dreadlord");
const rig = FIGHTER_RIGS.get(Character.dreadlord);
ensure(rig, "missing Dreadlord rig");
const source = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer());
const model = structuredClone(source);
const stand = source.Sequences.find(s => /^stand ready$/i.test(s.Name));
ensure(stand, "Dreadlord: missing stand ready");
const squat = source.Sequences.find(s => /jump\s*squat/i.test(s.Name));
ensure(squat, "Dreadlord: missing jump squat");
const before = new DrawnModel(generateMDX(source), 1);
const body = before.triangles(source.Sequences.indexOf(stand), 0, 1);
const heights = Array.from(body).filter((_, i) => i % 2 === 1);
const centre = (Math.min(...heights) + Math.max(...heights)) / 2;
const helper = ensureMotionHelper(model, "Jump Motion", [0, 0, centre], source.Sequences);
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (t, p) => originals.set(p, t));
const jointOf = new Map(Object.entries(rig.classic).map(([joint, name]) => [name, joint]));
const family = (node: mdx.Node | undefined): string | undefined => {
  if (node === undefined) return undefined;
  if (WINGS.has(node.Name)) return "wing";
  const joint = jointOf.get(node.Name);
  const kind = joint?.replace(/\..*$/, "");
  return kind === "root" || kind === "pelvis" ? undefined : kind;
};

let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
const bindings: string[] = [];
const replaced = new Set<number>();
for (const hop of HOPS) {
  const name = `Jump Motion ${hop.pose}`;
  const previous = source.Sequences.findIndex(s => s.Name === name);
  const start = previous >= 0 ? source.Sequences[previous]!.Interval[0] : cursor;
  const end = previous >= 0 ? source.Sequences[previous]!.Interval[1] : start + Math.round(hop.frames * 1000 / 60);
  cursor = end + 100;
  const index = previous >= 0 ? previous : model.Sequences.length;
  if (previous >= 0) replaced.add(previous);
  else model.Sequences.push({ ...stand, Name: name, Interval: new Uint32Array([start, end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
  const times = beatTimes(hop);
  const at = (frame: number) => start + Math.round(frame * 1000 / 60);
  let articulated = 0;
  tracks(model, (track, path) => {
    const donor = originals.get(path); if (!donor || onGlobalClock(donor)) return;
    const key = donor.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]); if (!key) return;
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const kind = match ? family(source[match[1] as "Bones" | "Helpers"][Number(match[2])]) : undefined;
    const beats = kind === undefined ? undefined : BEATS[kind];
    if (beats?.some(value => value !== 0)) articulated++;
    if (previous >= 0) track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
    for (let frame = 0; frame <= hop.frames; frame++) {
      const authored = beats === undefined ? key.Vector.slice() : pitch(key.Vector, curve(beats, times, frame));
      const squatPose = atTime({ ...donor, Keys: donor.Keys.filter(k => k.Frame >= squat.Interval[0] && k.Frame <= squat.Interval[1]) }, squat.Interval[0] + SQUAT_END_MS, path.endsWith(".Rotation"));
      const Vector = squatPose === undefined || frame >= PUSH_FRAMES ? authored : path.endsWith(".Rotation") ? nlerp(squatPose, new Float32Array(authored), smooth(frame / PUSH_FRAMES)) : lerp(squatPose, authored, smooth(frame / PUSH_FRAMES));
      track.Keys.push({ ...key, Frame: at(frame), Vector, ...(key.InTan ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {}) });
    }
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  });
  if (previous >= 0 && helper.Rotation) helper.Rotation.Keys = helper.Rotation.Keys.filter(k => k.Frame < start || k.Frame > end);
  for (let frame = 0; frame <= hop.frames; frame++) helper.Rotation?.Keys.push({ Frame: at(frame), Vector: pitch(new Float32Array([0, 0, 0, 1]), curve(BEATS.root!, times, frame)) });
  helper.Rotation?.Keys.sort((a, b) => a.Frame - b.Frame);
  ensure(articulated >= 8, `Dreadlord: ${hop.pose} articulates ${articulated} tracks`);
  bindings.push(`    ${hop.pose}: { index: ${index}, seconds: ${seconds(Math.fround((end - start) / 1000))} },`);
}

const bytes = encodeVerified(parseSource(generateMDX(model))), after = new DrawnModel(bytes, 1);
for (const [index, sequence] of source.Sequences.entries()) for (const fraction of [0, 0.5, 1]) {
  if (replaced.has(index)) continue;
  const time = (sequence.Interval[1] - sequence.Interval[0]) * fraction / 1000;
  const a = before.triangles(index, time, 1), b = after.triangles(index, time, 1);
  ensure(a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? Infinity)) < 0.001), `Dreadlord/${sequence.Name}: previous clip changed`);
}
mkdirSync(dirname(join(output, fighter.source)), { recursive: true });
chmodSync(join(output, fighter.source), 0o644);
await Bun.write(join(output, fighter.source), bytes); chmodSync(join(output, fighter.source), 0o644);
await Bun.write(join(project, "ts/src/game/presentation/hopClipInfo.ts"), [
  "// Generated by tools/animations/hop-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClipTable } from "../sim/heroes/hero";',
  "export const HOP_CLIPS = {", `  ${Character.dreadlord}: {`, ...bindings, "  },", "} as const satisfies Readonly<Record<number, HeroClipTable>>;", "",
].join("\n"));
console.log(`HOP_CLIPS_PASS Dreadlord: ${HOPS.length} hop clips, ${source.Sequences.length - replaced.size} unrelated clips preserved`);
