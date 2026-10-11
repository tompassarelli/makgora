import { model as mdx } from "../clipNodes";

export interface TrackJitter {
  readonly node: string;
  readonly property: "Translation" | "Rotation" | "Scaling";
  readonly frame: number;
  readonly excess: number;
}

export interface ClipJitter {
  readonly translation: number;
  readonly scaling: number;
  readonly rotation: number;
  readonly worst: TrackJitter | undefined;
}

export const JITTER_LIMITS = { translation: 1.0, scaling: 0.02, rotation: 2.0 } as const;

/** Keys this close (three 60 Hz frames) that the curve leaves reverse direction faster than a pose can read: a shake. */
export const JITTER_SPAN_MS = 50;

const STEPS = 8;

type Quat = readonly [number, number, number, number];

function slerp(a: Quat, b: Quat, t: number): Quat {
  let [bx, by, bz, bw] = b;
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let s0 = 1 - t, s1 = t;
  if (1 - cos > 1e-6) {
    const omega = Math.acos(cos), sin = Math.sin(omega);
    s0 = Math.sin((1 - t) * omega) / sin;
    s1 = Math.sin(t * omega) / sin;
  }
  return [s0 * a[0] + s1 * bx, s0 * a[1] + s1 * by, s0 * a[2] + s1 * bz, s0 * a[3] + s1 * bw];
}

const angle = (a: Quat, b: Quat) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180 / Math.PI;

function curve(a: number, outTan: number, inTan: number, b: number, t: number, type: mdx.LineType): number {
  const u = 1 - t;
  if (type === mdx.LineType.Bezier) return u * u * u * a + 3 * t * u * u * outTan + 3 * t * t * u * inTan + t * t * t * b;
  const tt = t * t;
  return a * (tt * (2 * t - 3) + 1) + outTan * (tt * (t - 2) + t) + inTan * (tt * (t - 1)) + b * (tt * (3 - 2 * t));
}

/** How far a curved key segment leaves its keys: vectors past the span of their two keys, rotations off the arc between them. */
function segmentExcess(left: mdx.AnimVectorKey, right: mdx.AnimVectorKey, type: mdx.LineType, rotation: boolean): number {
  const a = left.Vector, b = right.Vector, outTan = left.OutTan ?? a, inTan = right.InTan ?? b;
  let worst = 0;
  for (let step = 1; step < STEPS; step++) {
    const t = step / STEPS;
    if (rotation) {
      const qa = Array.from(a) as unknown as Quat, qb = Array.from(b) as unknown as Quat;
      const curved = slerp(slerp(qa, qb, t), slerp(Array.from(outTan) as unknown as Quat, Array.from(inTan) as unknown as Quat, t), 2 * t * (1 - t));
      worst = Math.max(worst, angle(curved, slerp(qa, qb, t)));
      continue;
    }
    for (let axis = 0; axis < a.length; axis++) {
      const value = curve(a[axis] ?? 0, outTan[axis] ?? 0, inTan[axis] ?? 0, b[axis] ?? 0, t, type);
      worst = Math.max(worst, value - Math.max(a[axis] ?? 0, b[axis] ?? 0), Math.min(a[axis] ?? 0, b[axis] ?? 0) - value);
    }
  }
  return worst;
}

const NODE_GROUPS = ["Bones", "Helpers"] as const;

/** The worst curved-key excursion between close keys inside [from, to] milliseconds of a model's own timeline, per track kind. */
export function clipJitter(model: mdx.Model, from: number, to: number): ClipJitter {
  const totals = { translation: 0, scaling: 0, rotation: 0 };
  let worst: TrackJitter | undefined;
  let worstRatio = 0;
  for (const group of NODE_GROUPS) for (const node of model[group]) {
    for (const property of ["Translation", "Rotation", "Scaling"] as const) {
      const track = node[property] as mdx.AnimVector | undefined;
      if (track === undefined || track.GlobalSeqId !== null && track.GlobalSeqId !== undefined && track.GlobalSeqId >= 0) continue;
      if (track.LineType !== mdx.LineType.Hermite && track.LineType !== mdx.LineType.Bezier) continue;
      const keys = track.Keys;
      for (let index = 1; index < keys.length; index++) {
        const left = keys[index - 1]!, right = keys[index]!;
        if (right.Frame <= from || left.Frame >= to || right.Frame === left.Frame || right.Frame - left.Frame > JITTER_SPAN_MS) continue;
        const excess = segmentExcess(left, right, track.LineType, property === "Rotation");
        const kind = property === "Translation" ? "translation" : property === "Scaling" ? "scaling" : "rotation";
        totals[kind] = Math.max(totals[kind], excess);
        const ratio = excess / JITTER_LIMITS[kind];
        if (ratio > worstRatio) { worstRatio = ratio; worst = { node: node.Name, property, frame: left.Frame, excess }; }
      }
    }
  }
  return { ...totals, worst };
}

export const jitters = (jitter: ClipJitter) =>
  jitter.translation > JITTER_LIMITS.translation || jitter.scaling > JITTER_LIMITS.scaling || jitter.rotation > JITTER_LIMITS.rotation;
