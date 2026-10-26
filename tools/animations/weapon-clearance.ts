import { mat4, quat, vec3 } from "gl-matrix";
import { ModelRenderer, model as mdx } from "war3-model";
import type { FighterRig } from "./canonical-rig";
import { LIMB_CAPSULES, bladeStart, capsuleRadius, distance, segmentDistance, type Point } from "./limb-capsules";

type Posed = { frame: number; nodes: { matrix: Float32Array }[] };
type Held = { weapon: number; hand: number; grip: Point; tip: Point };
type Capsule = { a: number; b: number; radius: number };
type Body = { capsules: Capsule[]; held: Held[] };
type Turn = { axis: readonly [number, number, number]; degrees: number };

const GRIP_GAP = 4;
const TURN_AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;
const TURN_DEGREES = [4, 8, 12, 16, 20, 25, 30, 36, 42, 50, 60, 70, 80, 90];
const EASE_FRAMES = 4;
export const WEAPON_CLEAR_MARGIN = 2;

const at = (state: Posed, pivots: ArrayLike<number>[], node: number, scale: number, local?: Point): Point => {
  const v = vec3.transformMat4(vec3.create(), (local ?? pivots[node]!) as vec3, state.nodes[node]!.matrix as mat4);
  return [v[0]! * scale, v[1]! * scale, v[2]! * scale];
};

export function calibrationSequence(model: mdx.Model): number {
  return [/stand ready/i, /^stand$/i].map((name) => model.Sequences.findIndex((sequence) => name.test(sequence.Name.trim()))).find((index) => index >= 0) ?? 0;
}

function heldBody(source: mdx.Model, rig: FighterRig, stand: number, scale: number): Body {
  const id = (name: string | undefined) => name === undefined ? undefined : source.Nodes.find((node) => node?.Name === name)?.ObjectId;
  const renderer = new ModelRenderer(source), posed = Reflect.get(renderer, "rendererData") as Posed;
  renderer.setSequence(stand); posed.frame = source.Sequences[stand]!.Interval[0]!; renderer.update(0);
  const chest = id(rig.classic.chest);
  const capsules = LIMB_CAPSULES.flatMap(([a, b, factor]) => {
    const from = id(rig.classic[a]), to = a === b ? chest : id(rig.classic[b]);
    if (from === undefined || to === undefined) return [];
    return [{ a: from, b: a === b ? from : to, radius: capsuleRadius(distance(at(posed, source.PivotPoints, from, scale), at(posed, source.PivotPoints, to, scale)), factor) }];
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
  return { capsules, held };
}

function clearance(body: Body, model: mdx.Model, state: Posed, scale: number, only?: Held): number {
  let least = Infinity;
  for (const held of only ? [only] : body.held) {
    const g = at(state, model.PivotPoints, held.weapon, scale, held.grip), t = at(state, model.PivotPoints, held.weapon, scale, held.tip);
    for (const c of body.capsules) least = Math.min(least, segmentDistance(bladeStart(g, t), t, at(state, model.PivotPoints, c.a, scale), at(state, model.PivotPoints, c.b, scale)) - c.radius);
  }
  return least;
}

export function weaponClearance(source: mdx.Model, rig: FighterRig, stand: number, scale: number): (model: mdx.Model, sequence: number, frames: readonly number[]) => number {
  const body = heldBody(source, rig, stand, scale);
  return (model, sequence, frames) => {
    if (body.held.length === 0 || body.capsules.length === 0) return Infinity;
    const shown = new ModelRenderer(model), state = Reflect.get(shown, "rendererData") as Posed;
    shown.setSequence(sequence);
    let least = Infinity;
    for (const frame of frames) {
      state.frame = frame; shown.update(0);
      least = Math.min(least, clearance(body, model, state, scale));
      for (const { weapon, hand, grip } of body.held) {
        const loose = distance(at(state, model.PivotPoints, weapon, scale, grip), at(state, model.PivotPoints, hand, scale)) - GRIP_GAP;
        if (loose > 0) least = Math.min(least, -loose);
      }
    }
    return least;
  };
}

export function clearWeapon(model: mdx.Model, rig: FighterRig, scale: number, sequence: number, margin: number): number {
  const body = heldBody(model, rig, calibrationSequence(model), scale);
  const renderer = new ModelRenderer(model), state = Reflect.get(renderer, "rendererData") as Posed;
  renderer.setSequence(sequence);
  const [start, end] = model.Sequences[sequence]!.Interval as unknown as [number, number];
  const frames = Math.ceil((end - start) * 60 / 1000), time = (frame: number) => Math.min(end, start + Math.round(frame * 1000 / 60));
  const pose = (frame: number) => { state.frame = time(frame); renderer.update(0); };
  const looping = !model.Sequences[sequence]!.NonLooping;
  let least = Infinity;
  for (const held of body.held) {
    const hand = model.Nodes[held.hand]!, track = hand.Rotation;
    const measure = () => Array.from({ length: frames + 1 }, (_, frame) => { pose(frame); return clearance(body, model, state, scale, held); });
    const before = measure();
    if (before.every((gap) => gap >= margin)) { least = Math.min(least, ...before); continue; }
    if (track === undefined || track.GlobalSeqId != null && track.GlobalSeqId >= 0 && track.GlobalSeqId !== 0xffffffff) throw new Error(`${model.Sequences[sequence]!.Name}: weapon hand ${hand.Name} has no clip rotation track`);
    const parent = hand.Parent ?? -1;
    const rest = Array.from({ length: frames + 1 }, (_, frame) => {
      pose(frame);
      const world = mat4.getRotation(quat.create(), state.nodes[held.hand]!.matrix as mat4);
      const up = parent >= 0 ? quat.invert(quat.create(), mat4.getRotation(quat.create(), state.nodes[parent]!.matrix as mat4)) : quat.create();
      return { world, up };
    });
    const copy = (key: mdx.AnimKeyframe): mdx.AnimKeyframe => ({ ...key, Vector: key.Vector.slice(), ...key.InTan ? { InTan: key.InTan.slice(), OutTan: key.OutTan!.slice() } : {} });
    const original = track.Keys.filter((key) => key.Frame >= start && key.Frame <= end).map(copy);
    const weights = (turned: readonly number[]) => Array.from({ length: frames + 1 }, (_, frame) => {
      const near = Math.min(...turned.map((t) => Math.abs(t - frame)), ...looping ? turned.map((t) => frames - Math.abs(t - frame)) : []);
      return near > EASE_FRAMES ? 0 : near === 0 ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * near / (EASE_FRAMES + 1));
    });
    type Run = { turned: number[]; turn?: Turn };
    const apply = (runs: readonly Run[]) => {
      track.Keys = [...track.Keys.filter((key) => key.Frame < start || key.Frame > end), ...original.map(copy)];
      const spins = runs.flatMap((run) => run.turn ? [{ turn: run.turn, weight: weights(run.turned) }] : []);
      for (let frame = 0; frame <= frames; frame++) {
        if (!spins.some(({ weight }) => [frame - 1, frame, frame + 1].some((f) => (weight[f] ?? 0) > 0))) continue;
        const spin = spins.reduce((total, { turn, weight }) => quat.multiply(quat.create(), quat.setAxisAngle(quat.create(), turn.axis as unknown as vec3, turn.degrees * weight[frame]! * Math.PI / 180), total), quat.create());
        const local = quat.multiply(quat.create(), rest[frame]!.up, quat.multiply(quat.create(), spin, rest[frame]!.world));
        const Frame = time(frame), Vector = new Float32Array(quat.normalize(local, local) as unknown as ArrayLike<number>);
        const key = { Frame, Vector, ...track.LineType > mdx.LineType.Linear ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {} };
        track.Keys = track.Keys.filter((k) => k.Frame < start || k.Frame > end || k.Frame !== Frame && (k.Frame <= time(frame - 1) || k.Frame >= time(frame + 1)));
        track.Keys.push(key);
      }
      track.Keys.sort((a, b) => a.Frame - b.Frame);
    };
    const runs: Run[] = [];
    for (const [frame, gap] of before.entries()) if (gap < margin) {
      const last = runs.at(-1);
      if (last && frame - last.turned.at(-1)! <= 2) last.turned.push(frame); else runs.push({ turned: [frame] });
    }
    for (const run of runs) {
      let best: { turn: Turn; reached: number } | undefined;
      for (let widen = 0; widen < 4 && best === undefined; widen++) {
        if (widen > 0) run.turned = [...new Set(run.turned.flatMap((t) => [t - 1, t, t + 1]))].filter((t) => t >= 0 && t <= frames);
        const window = Array.from({ length: frames + 1 }, (_, frame) => frame).filter((frame) => weights(run.turned)[frame]! > 0 && !runs.some((other) => other.turn === undefined && other !== run && other.turned.includes(frame)));
        for (const degrees of TURN_DEGREES) {
          for (const axis of TURN_AXES) {
            run.turn = { axis, degrees }; apply(runs);
            const gaps = measure(), reached = Math.min(...window.map((frame) => gaps[frame]!));
            if (reached >= margin && (best === undefined || reached > best.reached)) best = { turn: run.turn, reached };
          }
          if (best !== undefined) break;
        }
      }
      if (best === undefined) throw new Error(`${model.Sequences[sequence]!.Name}: no hand turn up to ${TURN_DEGREES.at(-1)} degrees keeps ${hand.Name}'s weapon ${margin} units clear near frame ${run.turned[0]}`);
      run.turn = best.turn;
    }
    apply(runs);
    const reached = Math.min(...measure());
    if (reached < margin) throw new Error(`${model.Sequences[sequence]!.Name}: ${hand.Name}'s weapon still comes ${reached.toFixed(2)} from the body`);
    least = Math.min(least, reached);
  }
  return least;
}
