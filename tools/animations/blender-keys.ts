import { resolve } from "node:path";
import type { model as mdx } from "war3-model";

type Track = mdx.AnimVector;
type Baked = { frames: number; nodes: { rotation: number[][]; translation: number[][] }[] };

export interface BlenderSkeleton {
  writeRig(path: string, timing: { readonly frames: number; readonly contact: number; readonly active: number; readonly [field: string]: unknown }): Promise<void>;
  readKeys(path: string, frames: number): Promise<(path: string, frame: number) => Float32Array<ArrayBuffer> | undefined>;
}

export function blenderSkeleton(source: mdx.Model, originals: ReadonlyMap<string, Track>, stand: mdx.Sequence, globalClock: (track: Track) => boolean): BlenderSkeleton {
  const skeleton = (["Bones", "Helpers"] as const).flatMap(kind => source[kind].map((node, i) => ({ node, path: `.${kind}.${i}` })));
  const restKey = (path: string) => {
    const track = originals.get(path);
    return track && !globalClock(track) ? Array.from((track.Keys.find(k => k.Frame >= stand.Interval[0]! && k.Frame <= stand.Interval[1]!) ?? track.Keys[0]!).Vector) : null;
  };
  return {
    async writeRig(path, timing) {
      await Bun.write(path, JSON.stringify({ ...timing, nodes: skeleton.map(({ node, path }) => ({ name: node.Name, parent: skeleton.findIndex(s => s.node.ObjectId === node.Parent),
        pivot: Array.from(source.PivotPoints[node.ObjectId]!), rotation: restKey(`${path}.Rotation`), translation: restKey(`${path}.Translation`) })) }));
    },
    async readKeys(path, frames) {
      const baked = await Bun.file(path).json() as Baked;
      if (baked.frames !== frames || baked.nodes.length !== skeleton.length) throw new Error(`Blender keys cover ${baked.frames} frames of ${baked.nodes.length} nodes, the move ${frames} of ${skeleton.length}`);
      for (const [at, { node, path }] of skeleton.entries()) for (const channel of ["Rotation", "Translation"] as const) {
        const rest = restKey(`${path}.${channel}`) ?? (channel === "Rotation" ? [0, 0, 0, 1] : [0, 0, 0]);
        const keys = baked.nodes[at]![channel === "Rotation" ? "rotation" : "translation"];
        if (!originals.has(`${path}.${channel}`) && keys.some(v => v.some((x, i) => Math.abs(x - rest[i]!) >= 1e-4))) throw new Error(`${node.Name}: Blender keyed ${channel} on a node with no ${channel} track`);
      }
      return (track, frame) => {
        const [, kind, index, channel] = /^\.(Bones|Helpers)\.(\d+)\.(Rotation|Translation)$/.exec(track) ?? [];
        if (!kind) return undefined;
        return Float32Array.from(baked.nodes[skeleton.findIndex(s => s.path === `.${kind}.${index}`)]![channel === "Rotation" ? "rotation" : "translation"][frame]!);
      };
    },
  };
}

export function blenderOptions(argv: readonly string[]): { rig?: string; keys?: string } {
  const option = (name: string) => { const at = argv.indexOf(name); return at < 0 ? undefined : resolve(argv[at + 1] ?? ""); };
  return { rig: option("--rig"), keys: option("--keys") };
}
