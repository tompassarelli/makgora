import type { model as mdx } from "war3-model";

export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];
export interface Affine { readonly m: readonly number[]; readonly t: Vec3 }
export interface Basis { readonly t: Vec3; readonly q: Quat; readonly s: Vec3 }
export type Pose = ReadonlyMap<string, Basis>;

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3) => Math.sqrt(dot(a, a));
export const normalized = (a: Vec3): Vec3 => scale(a, 1 / length(a));
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const IDENTITY_QUAT: Quat = [0, 0, 0, 1];
export const quatDot = (a: Quat, b: Quat) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
export const negated = (q: Quat): Quat => [-q[0], -q[1], -q[2], -q[3]];
export const vec3 = (v: readonly number[]): Vec3 => [v[0]!, v[1]!, v[2]!];
export const quat = (v: readonly number[]): Quat => [v[0]!, v[1]!, v[2]!, v[3]!];
export const unitQuat = (q: Quat): Quat => {
    const n = Math.sqrt(quatDot(q, q));
    return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
};

export function slerp(a: Quat, b: Quat, t: number): Quat {
    let cosom = quatDot(a, b);
    const end = cosom < 0 ? negated(b) : b;
    cosom = Math.abs(cosom);
    let [wa, wb] = [1 - t, t];
    if (1 - cosom > 0.0001) {
        const omega = Math.acos(cosom), sinom = Math.sin(omega);
        [wa, wb] = [Math.sin((1 - t) * omega) / sinom, Math.sin(t * omega) / sinom];
    }
    return [wa * a[0] + wb * end[0], wa * a[1] + wb * end[1], wa * a[2] + wb * end[2], wa * a[3] + wb * end[3]];
}

const axisAngle = (axis: Vec3, angle: number): Quat => {
    const s = Math.sin(angle / 2);
    return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
};

function orthogonal(v: Vec3): Vec3 {
    const axis = Math.abs(v[0]) < Math.abs(v[1]) ? (Math.abs(v[0]) < Math.abs(v[2]) ? 0 : 2) : (Math.abs(v[1]) < Math.abs(v[2]) ? 1 : 2);
    const unit: Vec3 = [axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0];
    return normalized(cross(v, unit));
}

export function rotationDifference(from: Vec3, to: Vec3): Quat {
    const a = normalized(from), b = normalized(to);
    const axis = cross(a, b), size = length(axis);
    if (size > 1e-6) return axisAngle(scale(axis, 1 / size), Math.acos(Math.min(1, Math.max(-1, dot(a, b)))));
    return dot(a, b) > 0 ? IDENTITY_QUAT : axisAngle(orthogonal(a), Math.PI);
}

export function quatMatrix([x, y, z, w]: Quat): number[] {
    return [
        1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
        2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
        2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
    ];
}

function matrixQuat(m: readonly number[]): Quat {
    const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m as [number, number, number, number, number, number, number, number, number];
    const trace = m00 + m11 + m22;
    if (trace > 0) {
        const s = 2 * Math.sqrt(trace + 1);
        return [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
    }
    if (m00 > m11 && m00 > m22) {
        const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
        return [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
    }
    if (m11 > m22) {
        const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
        return [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
    }
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    return [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
}

const linear = (m: readonly number[], v: Vec3): Vec3 =>
    [m[0]! * v[0] + m[1]! * v[1] + m[2]! * v[2], m[3]! * v[0] + m[4]! * v[1] + m[5]! * v[2], m[6]! * v[0] + m[7]! * v[1] + m[8]! * v[2]];
const multiply3 = (a: readonly number[], b: readonly number[]) =>
    Array.from({ length: 9 }, (_, i) => {
        const row = Math.floor(i / 3), column = i % 3;
        return a[row * 3]! * b[column]! + a[row * 3 + 1]! * b[3 + column]! + a[row * 3 + 2]! * b[6 + column]!;
    });

function invert3(m: readonly number[]): number[] {
    const [a, b, c, d, e, f, g, h, i] = m as [number, number, number, number, number, number, number, number, number];
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    return [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det,
        (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
}

export const apply = (x: Affine, v: Vec3): Vec3 => add(linear(x.m, v), x.t);
export const rotate = (x: Affine, v: Vec3): Vec3 => linear(x.m, v);
export const compose = (a: Affine, b: Affine): Affine => ({ m: multiply3(a.m, b.m), t: apply(a, b.t) });
export const inverse = (x: Affine): Affine => {
    const m = invert3(x.m);
    return { m, t: scale(linear(m, x.t), -1) };
};
export const translation = (t: Vec3): Affine => ({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t });
export const rotation = (q: Quat): Affine => ({ m: quatMatrix(q), t: [0, 0, 0] });
export const about = (pivot: Vec3, x: Affine): Affine => compose(translation(pivot), compose(x, translation(scale(pivot, -1))));
export function axisRotation(degrees: number, axis: "Y" | "Z"): Affine {
    const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return { m: axis === "Y" ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1], t: [0, 0, 0] };
}

export class Rig {
    private readonly bones: readonly mdx.Bone[];
    private readonly byName = new Map<string, mdx.Bone>();
    private readonly pivots: readonly Vec3[];
    private basis = new Map<string, Basis>();
    private worlds = new Map<number, Affine>();

    constructor(source: mdx.Model) {
        this.bones = source.Bones;
        for (const bone of this.bones) this.byName.set(bone.Name, bone);
        this.pivots = source.PivotPoints.map((point) => [point[0]!, point[1]!, point[2]!] as const);
    }

    get names(): readonly string[] {
        return this.bones.map((bone) => bone.Name);
    }

    pose(): Pose {
        return new Map(this.basis);
    }

    set(pose: Pose): void {
        this.basis = new Map(pose);
        this.worlds.clear();
    }

    matrix(name: string): Affine {
        return this.world(this.bone(name));
    }

    position(name: string): Vec3 {
        const bone = this.bone(name);
        return apply(this.world(bone), this.pivots[bone.ObjectId]!);
    }

    transform(name: string, x: Affine): void {
        const bone = this.bone(name);
        const local = compose(inverse(this.parentWorld(bone)), compose(x, this.world(bone)));
        const columns = [0, 1, 2].map((c) => length([local.m[c]!, local.m[3 + c]!, local.m[6 + c]!]));
        const unit = local.m.map((value, i) => value / columns[i % 3]!);
        const pivot = this.pivots[bone.ObjectId]!;
        this.basis.set(name, { t: add(sub(local.t, pivot), linear(local.m, pivot)), q: matrixQuat(unit), s: [columns[0]!, columns[1]!, columns[2]!] });
        this.worlds.clear();
    }

    private bone(name: string): mdx.Bone {
        const bone = this.byName.get(name);
        if (bone === undefined) throw new Error(`rig has no bone ${name}`);
        return bone;
    }

    private parentWorld(bone: mdx.Bone): Affine {
        const parent = this.bones.find((candidate) => candidate.ObjectId === bone.Parent);
        return parent === undefined ? translation([0, 0, 0]) : this.world(parent);
    }

    private world(bone: mdx.Bone): Affine {
        const known = this.worlds.get(bone.ObjectId);
        if (known !== undefined) return known;
        const basis = this.basis.get(bone.Name) ?? { t: [0, 0, 0], q: IDENTITY_QUAT, s: [1, 1, 1] };
        const m = multiply3(quatMatrix(unitQuat(basis.q)), [basis.s[0], 0, 0, 0, basis.s[1], 0, 0, 0, basis.s[2]]);
        const pivot = this.pivots[bone.ObjectId]!;
        const local: Affine = { m, t: sub(add(pivot, basis.t), linear(m, pivot)) };
        const world = compose(this.parentWorld(bone), local);
        this.worlds.set(bone.ObjectId, world);
        return world;
    }
}
