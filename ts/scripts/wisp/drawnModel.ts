import { ModelRenderer, type model as mdx } from "war3-model";
import { parseModelMDX } from "wisp/scripts/wisp/models";

interface SkinningState {
  frame: number;
  readonly nodes: readonly { readonly matrix: Float32Array }[];
  readonly geosetAlpha: readonly number[];
}


function isSkinningState(value: unknown): value is SkinningState {
  if (typeof value !== "object" || value === null) return false;
  return typeof Reflect.get(value, "frame") === "number" && Array.isArray(Reflect.get(value, "nodes")) && Array.isArray(Reflect.get(value, "geosetAlpha"));
}

function skinningState(renderer: ModelRenderer): SkinningState {
  const data: unknown = Reflect.get(renderer, "rendererData");
  if (!isSkinningState(data)) throw new Error("war3-model renderer has no posed skinning state");
  return data;
}

export class DrawnModel {
  private readonly renderer: ModelRenderer;
  private readonly model: mdx.Model;
  private readonly visible: number[];

  constructor(bytes: ArrayBuffer, private readonly scale: number) {
    this.model = parseModelMDX(bytes);
    this.renderer = new ModelRenderer(this.model);

    this.visible = this.model.Geosets.flatMap((geoset, index) => {
      const material = this.model.Materials[geoset.MaterialID];
      return material !== undefined && material.Layers.some((layer) => Number(layer.FilterMode) <= 2) ? [index] : [];
    });
  }


  nodes(): readonly { readonly name: string; readonly parent: number | undefined }[] {
    return Array.from(this.model.Nodes, (node) => ({ name: node?.Name ?? "", parent: node?.Parent ?? undefined }));
  }






  private pose(sequence: number, seconds: number): SkinningState {
    const data = skinningState(this.renderer);
    this.renderer.setSequence(sequence);
    const interval = this.model.Sequences[sequence]?.Interval ?? [0, 0];
    data.frame = Math.min(interval[1] ?? 0, (interval[0] ?? 0) + seconds * 1000.0);
    this.renderer.update(0);
    return data;
  }

  private skinned(geoset: mdx.Geoset, vertex: number, data: SkinningState, facing: number): readonly [number, number] {
    const skin = geoset.SkinWeights;
    const source = geoset.Vertices;
    const group = skin === undefined ? geoset.Groups[geoset.VertexGroup[vertex] ?? 0] ?? [] : Array.from(skin.subarray(vertex * 8, vertex * 8 + 4));
    const vx = source[vertex * 3] ?? 0, vy = source[vertex * 3 + 1] ?? 0, vz = source[vertex * 3 + 2] ?? 0;
    let x = 0.0, z = 0.0;
    for (const [influence, node] of group.entries()) {
      const m = data.nodes[node]?.matrix;
      if (m === undefined) continue;
      const weight = skin === undefined ? 1 : (skin[vertex * 8 + 4 + influence] ?? 0) / 255;
      x += ((m[0] ?? 0) * vx + (m[4] ?? 0) * vy + (m[8] ?? 0) * vz + (m[12] ?? 0)) * weight;
      z += ((m[2] ?? 0) * vx + (m[6] ?? 0) * vy + (m[10] ?? 0) * vz + (m[14] ?? 0)) * weight;
    }
    const count = skin === undefined ? Math.max(1, group.length) : 1;
    return [(facing * x * this.scale) / count, (z * this.scale) / count];
  }

  private nodePivots(data: SkinningState, facing: number): Float32Array {
    const nodes = new Float32Array(this.model.Nodes.length * 2);
    this.model.Nodes.forEach((node, id) => {
      const m = data.nodes[id]?.matrix, p = node?.PivotPoint;
      if (m === undefined || p === undefined) return;
      const [px = 0, py = 0, pz = 0] = p;
      nodes[id * 2] = facing * ((m[0] ?? 0) * px + (m[4] ?? 0) * py + (m[8] ?? 0) * pz + (m[12] ?? 0)) * this.scale;
      nodes[id * 2 + 1] = ((m[2] ?? 0) * px + (m[6] ?? 0) * py + (m[10] ?? 0) * pz + (m[14] ?? 0)) * this.scale;
    });
    return nodes;
  }

  posed(sequence: number, seconds: number, facing: number): { readonly vertices: Float32Array; readonly drawn: Uint8Array; readonly faces: Uint32Array; readonly nodes: Float32Array } {
    const data = this.pose(sequence, seconds);
    const vertices: number[] = [], drawn: number[] = [], faces: number[] = [];
    for (const index of this.visible) {
      const geoset = this.model.Geosets[index];
      if (geoset === undefined) continue;
      const shown = (data.geosetAlpha[index] ?? 1) > 0.0;
      const base = vertices.length / 2;
      for (let vertex = 0; vertex < geoset.Vertices.length / 3; vertex++) {
        vertices.push(...this.skinned(geoset, vertex, data, facing));
        drawn.push(shown ? 1 : 0);
      }
      if (shown) for (const corner of geoset.Faces) faces.push(base + corner);
    }
    return { vertices: Float32Array.from(vertices), drawn: Uint8Array.from(drawn), faces: Uint32Array.from(faces), nodes: this.nodePivots(data, facing) };
  }

  influencedBy(names: ReadonlySet<string>): Uint8Array {
    const nodes = new Set(this.model.Nodes.flatMap((node, id) => names.has(node?.Name ?? "") ? [id] : []));
    const out: number[] = [];
    for (const index of this.visible) {
      const geoset = this.model.Geosets[index];
      if (geoset === undefined) continue;
      const skin = geoset.SkinWeights;
      for (let vertex = 0; vertex < geoset.Vertices.length / 3; vertex++) {
        const group = skin === undefined ? geoset.Groups[geoset.VertexGroup[vertex] ?? 0] ?? [] : Array.from(skin.subarray(vertex * 8, vertex * 8 + 4)).filter((_, influence) => (skin[vertex * 8 + 4 + influence] ?? 0) > 0);
        out.push(group.some((node) => nodes.has(node)) ? 1 : 0);
      }
    }
    return Uint8Array.from(out);
  }

  sequenceStart(index: number): number | undefined {
    return this.model.Sequences[index]?.Interval[0];
  }

  sequenceName(index: number): string | undefined {
    return this.model.Sequences[index]?.Name;
  }


  triangles(sequence: number, seconds: number, facing: number): Float32Array {
    const data = this.pose(sequence, seconds);
    const out: number[] = [];
    for (const index of this.visible) {
      if ((data.geosetAlpha[index] ?? 1) <= 0.0) continue;
      const geoset = this.model.Geosets[index];
      if (geoset === undefined) continue;
      const skinned = new Float32Array((geoset.Vertices.length / 3) * 2);
      for (let vertex = 0; vertex < geoset.Vertices.length / 3; vertex++) skinned.set(this.skinned(geoset, vertex, data, facing), vertex * 2);
      for (const corner of geoset.Faces) out.push(skinned[corner * 2] ?? 0, skinned[corner * 2 + 1] ?? 0);
    }
    return Float32Array.from(out);
  }
}
