import type { model as mdx } from "war3-model";
import { generateMDX } from "../../ts/scripts/clipNodes";
import { parseModelMDX } from "../../ts/scripts/mdxCodec";

export interface ClipTurn {
  readonly sequence: number;
  readonly degrees: number;
}

type Track = mdx.AnimVector | undefined;

const isRoot = (node: mdx.Node | undefined): node is mdx.Node => node !== undefined && (node.Parent === undefined || node.Parent === null || node.Parent === -1);

const within = (track: Track, start: number, end: number): mdx.AnimKeyframe[] =>
  track === undefined || track.GlobalSeqId !== undefined && track.GlobalSeqId !== null && track.GlobalSeqId >= 0 ? [] : track.Keys.filter((key) => key.Frame >= start && key.Frame <= end);

function yawQuaternion(degrees: number, q: ArrayLike<number>): Float32Array {
  const half = (degrees * Math.PI) / 360, s = Math.sin(half), c = Math.cos(half);
  const [x = 0, y = 0, z = 0, w = 1] = Array.from(q);
  return Float32Array.of(c * x - s * y, c * y + s * x, c * z + s * w, c * w - s * z);
}

function yawVector(degrees: number, v: ArrayLike<number>, pivot: ArrayLike<number> = [0, 0]): Float32Array {
  const angle = (degrees * Math.PI) / 180, c = Math.cos(angle), s = Math.sin(angle);
  const [x = 0, y = 0, z = 0] = Array.from(v), px = pivot[0] ?? 0, py = pivot[1] ?? 0;
  const ax = px + x, ay = py + y;
  return Float32Array.of(c * ax - s * ay - px, s * ax + c * ay - py, z);
}

function yawExtent(degrees: number, extent: { MinimumExtent: Float32Array; MaximumExtent: Float32Array }): void {
  const [x0 = 0, y0 = 0] = extent.MinimumExtent, [x1 = 0, y1 = 0] = extent.MaximumExtent;
  const corners = [[x0, y0], [x0, y1], [x1, y0], [x1, y1]].map((corner) => yawVector(degrees, [...corner, 0]));
  extent.MinimumExtent[0] = Math.min(...corners.map((c) => c[0] ?? 0)); extent.MinimumExtent[1] = Math.min(...corners.map((c) => c[1] ?? 0));
  extent.MaximumExtent[0] = Math.max(...corners.map((c) => c[0] ?? 0)); extent.MaximumExtent[1] = Math.max(...corners.map((c) => c[1] ?? 0));
}

export function turnClip(model: mdx.Model, { sequence, degrees }: ClipTurn): string[] {
  const clip = model.Sequences[sequence];
  if (clip === undefined) throw new Error(`no sequence ${sequence}`);
  const [start = 0, end = 0] = clip.Interval;
  const turned: string[] = [];
  for (const node of model.Nodes.filter(isRoot)) {
    const rotations = within(node.Rotation, start, end), translations = within(node.Translation, start, end);
    if (rotations.length === 0 && translations.length === 0) continue;
    if (rotations.length === 0 || translations.length === 0) throw new Error(`${node.Name}: ${clip.Name} keys rotation but not translation, or the reverse`);
    for (const key of rotations) {
      key.Vector = yawQuaternion(degrees, key.Vector);
      if (key.InTan !== undefined) key.InTan = yawQuaternion(degrees, key.InTan);
      if (key.OutTan !== undefined) key.OutTan = yawQuaternion(degrees, key.OutTan);
    }
    for (const key of translations) {
      key.Vector = yawVector(degrees, key.Vector, node.PivotPoint);
      if (key.InTan !== undefined) key.InTan = yawVector(degrees, key.InTan);
      if (key.OutTan !== undefined) key.OutTan = yawVector(degrees, key.OutTan);
    }
    turned.push(node.Name);
  }
  if (turned.length === 0) throw new Error(`${clip.Name}: no root node keys its rotation`);
  yawExtent(degrees, clip);
  for (const geoset of model.Geosets) {
    const extent = geoset.Anims[sequence];
    if (extent !== undefined) yawExtent(degrees, extent);
  }
  return turned;
}

if (import.meta.main) {
  const [source, destination, ...turns] = process.argv.slice(2);
  if (source === undefined || destination === undefined || turns.length === 0) throw new Error("usage: bun tools/animations/turn-clips.ts IN.mdx OUT.mdx SEQUENCE=DEGREES...");
  const model = parseModelMDX(await Bun.file(source).arrayBuffer());
  for (const turn of turns) {
    const [sequence, degrees] = turn.split("=").map(Number);
    if (!Number.isInteger(sequence) || !Number.isFinite(degrees)) throw new Error(`bad turn ${turn}: want SEQUENCE=DEGREES`);
    const roots = turnClip(model, { sequence: sequence!, degrees: degrees! });
    console.log(`${model.Sequences[sequence!]?.Name}: turned ${degrees} degrees on ${roots.join(", ")}`);
  }
  await Bun.write(destination, generateMDX(model));
}
