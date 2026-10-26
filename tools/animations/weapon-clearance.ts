import { mat4, vec3 } from "gl-matrix";
import { ModelRenderer, model as mdx } from "war3-model";
import type { FighterRig } from "./canonical-rig";
import { LIMB_CAPSULES, bladeStart, capsuleRadius, distance, segmentDistance, type Point } from "./limb-capsules";

const GRIP_GAP = 4;

type Posed = { frame: number; nodes: { matrix: Float32Array }[] };
type Held = { weapon: number; hand: number; grip: Point; tip: Point };

export function weaponClearance(source: mdx.Model, rig: FighterRig, stand: number, scale: number): (model: mdx.Model, sequence: number, frames: readonly number[]) => number {
  const id = (name: string | undefined) => name === undefined ? undefined : source.Nodes.find((node) => node?.Name === name)?.ObjectId;
  const renderer = new ModelRenderer(source), posed = Reflect.get(renderer, "rendererData") as Posed;
  renderer.setSequence(stand); posed.frame = source.Sequences[stand]!.Interval[0]!; renderer.update(0);
  const at = (state: Posed, pivots: ArrayLike<number>[], node: number, local?: Point): Point => {
    const v = vec3.transformMat4(vec3.create(), (local ?? pivots[node]!) as vec3, state.nodes[node]!.matrix as mat4);
    return [v[0]! * scale, v[1]! * scale, v[2]! * scale];
  };
  const chest = id(rig.classic.chest);
  const capsules = LIMB_CAPSULES.flatMap(([a, b, factor]) => {
    const from = id(rig.classic[a]), to = a === b ? chest : id(rig.classic[b]);
    if (from === undefined || to === undefined) return [];
    return [{ a: from, b: a === b ? from : to, radius: capsuleRadius(distance(at(posed, source.PivotPoints, from), at(posed, source.PivotPoints, to)), factor) }];
  });
  const held = ([["weapon", "wrist.R"], ["weapon.L", "wrist.L"]] as const).flatMap(([joint, wrist]): Held[] => {
    const weapon = id(rig.classic[joint]), hand = id(rig.classic[wrist]);
    if (weapon === undefined || hand === undefined || rig.weaponGeosets?.[joint] !== undefined) return [];
    const inverse = mat4.invert(mat4.create(), posed.nodes[weapon]!.matrix as mat4);
    if (inverse === null) return [];
    const world = vec3.transformMat4(vec3.create(), source.PivotPoints[hand]! as vec3, posed.nodes[hand]!.matrix as mat4);
    const local = vec3.transformMat4(vec3.create(), world, inverse), grip: Point = [local[0]!, local[1]!, local[2]!];
    const vertices = source.Geosets.flatMap((geoset) => Array.from({ length: geoset.Vertices.length / 3 }, (_, v) => v).filter((v) => {
      const group = geoset.Groups[geoset.VertexGroup[v]!];
      return geoset.SkinWeights ? [0, 1, 2, 3].some((k) => geoset.SkinWeights![v * 8 + k] === weapon && geoset.SkinWeights![v * 8 + 4 + k]! >= 26) : !!group?.includes(weapon) && 1 / group.length >= 0.1;
    }).map((v): Point => [geoset.Vertices[v * 3]!, geoset.Vertices[v * 3 + 1]!, geoset.Vertices[v * 3 + 2]!]));
    if (vertices.length === 0) return [];
    return [{ weapon, hand, grip, tip: vertices.toSorted((a, b) => distance(b, grip) - distance(a, grip))[0]! }];
  });
  return (model, sequence, frames) => {
    if (held.length === 0 || capsules.length === 0) return Infinity;
    const shown = new ModelRenderer(model), state = Reflect.get(shown, "rendererData") as Posed;
    shown.setSequence(sequence);
    let least = Infinity;
    for (const frame of frames) {
      state.frame = frame; shown.update(0);
      for (const { weapon, hand, grip, tip } of held) {
        const g = at(state, model.PivotPoints, weapon, grip), t = at(state, model.PivotPoints, weapon, tip);
        const loose = distance(g, at(state, model.PivotPoints, hand)) - GRIP_GAP;
        if (loose > 0) least = Math.min(least, -loose);
        for (const c of capsules) least = Math.min(least, segmentDistance(bladeStart(g, t), t, at(state, model.PivotPoints, c.a), at(state, model.PivotPoints, c.b)) - c.radius);
      }
    }
    return least;
  };
}
