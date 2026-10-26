export type Point = readonly [number, number, number];
export type CapsuleJoint = 'pelvis' | 'chest' | 'head' | 'hip.L' | 'knee.L' | 'ankle.L' | 'hip.R' | 'knee.R' | 'ankle.R';

export const LIMB_CAPSULES: readonly (readonly [CapsuleJoint, CapsuleJoint, number])[] = [
  ['pelvis', 'chest', 0.22], ['head', 'head', 0.12], ['hip.L', 'knee.L', 0.16], ['knee.L', 'ankle.L', 0.13], ['hip.R', 'knee.R', 0.16], ['knee.R', 'ankle.R', 0.13],
];

export function capsuleRadius(length: number, factor: number): number {
  return Math.max(3, Math.min(22, length * factor));
}

export function add(a: Point, b: Point): Point { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function sub(a: Point, b: Point): Point { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function mul(a: Point, scalar: number): Point { return [a[0] * scalar, a[1] * scalar, a[2] * scalar]; }
export function dot(a: Point, b: Point): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function distance(a: Point, b: Point): number { return Math.hypot(...sub(a, b)); }

export function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  const u = sub(b, a), v = sub(d, c), w = sub(a, c), aa = dot(u, u), bb = dot(u, v), cc = dot(v, v), dd = dot(u, w), ee = dot(v, w), denominator = aa * cc - bb * bb;
  let s = denominator > 1e-8 ? Math.max(0, Math.min(1, (bb * ee - cc * dd) / denominator)) : 0;
  let t = cc > 1e-8 ? Math.max(0, Math.min(1, (bb * s + ee) / cc)) : 0;
  s = aa > 1e-8 ? Math.max(0, Math.min(1, (bb * t - dd) / aa)) : 0;
  return distance(add(a, mul(u, s)), add(c, mul(v, t)));
}

export function bladeStart(grip: Point, tip: Point): Point {
  return add(grip, mul(sub(tip, grip), 0.2));
}
