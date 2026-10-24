import type { model as mdx } from "war3-model";
import {
    about, add, apply, axisRotation, compose, dot, inverse, lerp3, length, negated, normalized, quat, quatDot, rotate, rotation, rotationDifference,
    Rig, scale, slerp, sub, translation, unitQuat, vec3, type Affine, type Basis, type Pose, type Quat, type Vec3,
} from "./lichking-rig";

export type Side = "R" | "L";
export interface Beat {
    readonly lean?: number; readonly twist?: number; readonly spin?: number; readonly rise?: number;
    readonly step?: readonly [number, number];
    readonly handR?: Vec3; readonly handL?: Vec3; readonly footR?: Vec3; readonly footL?: Vec3;
    readonly aim?: number;
}
export type Beats = ReadonlyMap<number, Beat>;
export interface AuthorOptions {
    readonly baseFrom?: string; readonly baseFrame?: number; readonly standingFrom?: readonly [string, number];
    readonly plant?: boolean; readonly looping?: boolean; readonly copyOf?: string;
}
export interface Strike { readonly source: string; readonly sourceFrame: number; readonly frame: number }
export interface ClipKey { readonly Frame: number; readonly Vector: Float32Array }
export interface BoneKeys { readonly Translation: readonly ClipKey[]; readonly Rotation: readonly ClipKey[] }
export interface Clip {
    readonly name: string; readonly frames: number; readonly looping: boolean; readonly source: string;
    readonly strike: Strike | null; readonly bones: ReadonlyMap<string, BoneKeys>;
}

const FRAME_MS = 1000 / 60;
const ARMS: Record<Side, readonly [string, string, string]> = { R: ["RLsh", "Relbow", "Rhand"], L: ["LLsh", "Lelbow", "Lhand"] };
const LEGS: Record<Side, readonly [string, string, string]> = { R: ["Rhip", "Rknee", "Rfoot"], L: ["Lhip", "Lknee", "Lfoot"] };
const SIDE: Record<Side, number> = { R: -1, L: 1 };
const TIP_REST: Vec3 = [143, -33, 66];

const roundHalfEven = (x: number) => {
    const floor = Math.floor(x), fraction = x - floor;
    return fraction > 0.5 || (fraction === 0.5 && floor % 2 !== 0) ? floor + 1 : floor;
};
/** A clip frame as the MDL exporter writes it: milliseconds rounded to six places, then truncated. */
export const ms = (frame: number) => Math.trunc(Number((frame * FRAME_MS).toFixed(6)));

type Curve = readonly (readonly [number, readonly number[]])[];
interface Action { readonly first: number; readonly last: number; readonly curves: ReadonlyMap<string, { readonly t: Curve; readonly q: Curve }> }

function imported(track: mdx.AnimVector | undefined, [start, end]: readonly [number, number], quaternion: boolean): Curve {
    const keys = new Map<number, readonly number[]>();
    for (const key of track?.Keys ?? []) {
        if (key.Frame < start || key.Frame > end) continue;
        const value = Array.from(key.Vector);
        keys.set(roundHalfEven((key.Frame - start) / FRAME_MS), quaternion && value[3]! < 0 ? value.map((v) => -v) : value);
    }
    return [...keys].sort((a, b) => a[0] - b[0]);
}

function evaluate(curve: Curve, frame: number): readonly number[] {
    const after = curve.findIndex(([at]) => at >= frame);
    if (after < 0) return curve.at(-1)![1];
    const [right, high] = curve[after]!;
    if (after === 0 || right === frame) return high;
    const [left, low] = curve[after - 1]!;
    const t = (frame - left) / (right - left);
    return low.map((value, i) => value + (high[i]! - value) * t);
}

/** Kwaliti's built-in clips as Blender imports them at 60 frames a second: keys on whole frames, rotations with w >= 0. */
export class Kit {
    readonly rig: Rig;
    private readonly actions = new Map<string, Action>();
    private readonly authored = new Map<string, readonly Pose[]>();

    constructor(source: mdx.Model) {
        this.rig = new Rig(source);
        for (const sequence of source.Sequences) {
            const interval = [sequence.Interval[0]!, sequence.Interval[1]!] as const;
            const curves = new Map(source.Bones.map((bone) => [bone.Name, {
                t: imported(bone.Translation, interval, false), q: imported(bone.Rotation, interval, true),
            }] as const));
            const frames = [...curves.values()].flatMap(({ t, q }) => [...t, ...q].map(([frame]) => frame));
            this.actions.set(sequence.Name, { first: Math.min(...frames), last: Math.max(...frames), curves });
        }
    }

    action(name: string): Action {
        const action = this.actions.get(name);
        if (action === undefined) throw new Error(`Lich King has no built-in ${name}`);
        return action;
    }

    remember(name: string, frames: readonly Pose[]): void {
        this.authored.set(name, frames);
    }

    sample(name: string, frame: number): Pose {
        const authored = this.authored.get(name);
        const pose = authored === undefined ? this.builtIn(name, frame) : authored[Math.min(Math.max(0, frame), authored.length - 1)]!;
        this.rig.set(pose);
        return pose;
    }

    private builtIn(name: string, frame: number): Pose {
        const pose = new Map<string, Basis>();
        for (const [bone, { t, q }] of this.action(name).curves) {
            pose.set(bone, { t: vec3(evaluate(t, frame)), q: unitQuat(quat(evaluate(q, frame))), s: [1, 1, 1] });
        }
        return pose;
    }

    tip(): Vec3 {
        return apply(this.rig.matrix("Weapon"), TIP_REST);
    }
}

function blend(a: Pose, b: Pose, t: number): Pose {
    return new Map([...a].map(([name, x]) => {
        const y = b.get(name)!;
        return [name, { t: lerp3(x.t, y.t, t), q: slerp(x.q, y.q, t), s: lerp3(x.s, y.s, t) }];
    }));
}

const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;

interface Goal<T> { readonly at: T; readonly weight: number }
interface Params {
    readonly lean: number; readonly twist: number; readonly spin: number; readonly rise: number; readonly step: readonly [number, number];
    readonly handR?: Goal<Vec3>; readonly handL?: Goal<Vec3>; readonly footR?: Goal<Vec3>; readonly footL?: Goal<Vec3>;
    readonly aim?: Goal<number>;
}

function goal<T>(a: T | undefined, b: T | undefined, t: number, between: (a: T, b: T, t: number) => T): Goal<T> | undefined {
    if (a === undefined && b === undefined) return undefined;
    return { at: between(a ?? b!, b ?? a!, t), weight: b === undefined ? 1 - t : a === undefined ? t : 1 };
}

function paramsAt(beats: Beats, frame: number): Params {
    const frames = [...beats.keys()].sort((a, b) => a - b);
    const left = Math.max(...frames.filter((k) => k <= frame)), right = Math.min(...frames.filter((k) => k >= frame));
    const t = left === right ? 0 : ease((frame - left) / (right - left));
    const a = beats.get(left)!, b = beats.get(right)!;
    const [sa, sb] = [a.step ?? [0, 0], b.step ?? [0, 0]];
    return {
        lean: mix(a.lean ?? 0, b.lean ?? 0, t), twist: mix(a.twist ?? 0, b.twist ?? 0, t), spin: mix(a.spin ?? 0, b.spin ?? 0, t),
        rise: mix(a.rise ?? 0, b.rise ?? 0, t), step: [mix(sa[0], sb[0], t), mix(sa[1], sb[1], t)],
        handR: goal(a.handR, b.handR, t, lerp3), handL: goal(a.handL, b.handL, t, lerp3),
        footR: goal(a.footR, b.footR, t, lerp3), footL: goal(a.footL, b.footL, t, lerp3),
        aim: goal(a.aim, b.aim, t, mix),
    };
}

function aimBone(rig: Rig, bone: string, endpoint: Vec3, target: Vec3): void {
    const pivot = rig.position(bone);
    rig.transform(bone, about(pivot, rotation(rotationDifference(sub(endpoint, pivot), sub(target, pivot)))));
}

function solve(rig: Rig, [upper, lower, end]: readonly [string, string, string], target: Vec3, pole: Vec3): void {
    const [start, joint, endAt] = [rig.position(upper), rig.position(lower), rig.position(end)];
    const a = length(sub(joint, start)), b = length(sub(endAt, joint));
    const direction = normalized(sub(target, start));
    const distance = Math.min(Math.max(length(sub(target, start)), Math.abs(a - b) + 0.01), a + b - 0.01);
    let across = sub(pole, start);
    across = sub(across, scale(direction, dot(across, direction)));
    if (length(across) < 1e-3) across = [0, 1, 0];
    const along = (a * a - b * b + distance * distance) / (2 * distance);
    const bend = add(add(start, scale(direction, along)), scale(normalized(across), Math.sqrt(Math.max(0, a * a - along * along))));
    aimBone(rig, upper, joint, bend);
    aimBone(rig, lower, rig.position(end), add(start, scale(direction, distance)));
}

function rotateAbout(rig: Rig, bone: string, degrees: number, axis: "Y" | "Z" = "Y"): void {
    rig.transform(bone, about(rig.position(bone), axisRotation(degrees, axis)));
}

function aimWeapon(kit: Kit, aim: Goal<number>): void {
    const grip = kit.rig.position("Rhand");
    const now = sub(kit.tip(), grip);
    const angle = aim.at * Math.PI / 180;
    const target: Vec3 = [Math.cos(angle) * length(now), now[1], Math.sin(angle) * length(now)];
    const q = slerp([0, 0, 0, 1], rotationDifference(now, target), aim.weight);
    kit.rig.transform("Rhand", about(grip, rotation(q)));
}

function placeFeet(rig: Rig, p: Params, planted: Record<Side, Vec3>, body: Affine, plant: boolean): void {
    const hip = rig.position("Root");
    for (const side of ["R", "L"] as const) {
        const target = side === "R" ? p.footR : p.footL;
        if (target === undefined && !plant) continue;
        const goal = target === undefined ? planted[side] : lerp3(planted[side], plant ? target.at : apply(body, target.at), target.weight);
        solve(rig, LEGS[side], goal, add(hip, rotate(body, [60, SIDE[side] * 14, 0])));
    }
}

function reachHands(rig: Rig, p: Params, ride: Affine): void {
    const chest = rig.position("Chest");
    for (const side of ["R", "L"] as const) {
        const target = side === "R" ? p.handR : p.handL;
        if (target === undefined) continue;
        const here = rig.position(ARMS[side][2]);
        solve(rig, ARMS[side], lerp3(here, apply(ride, target.at), target.weight), add(chest, rotate(ride, [-30, SIDE[side] * 40, -20])));
    }
}

function pose(kit: Kit, p: Params, base: Pose, standing: Pose, plant: boolean): void {
    const rig = kit.rig;
    rig.set(blend(base, standing, p.rise));
    const planted = { R: rig.position(LEGS.R[2]), L: rig.position(LEGS.L[2]) };
    const chestBefore = rig.matrix("Chest");
    const pivot = rig.position("Root");
    if (p.spin) rotateAbout(rig, "Root", p.spin);
    const [dx, dz] = p.step;
    rig.transform("Root", translation([dx, 0, dz]));
    if (p.lean) rotateAbout(rig, "Stomach", p.lean);
    if (p.twist) rotateAbout(rig, "Chest", -p.twist, "Z");
    const ride = compose(rig.matrix("Chest"), inverse(chestBefore));
    const body = compose(translation([dx, 0, dz]), about(pivot, axisRotation(p.spin, "Y")));
    placeFeet(rig, p, planted, body, plant);
    reachHands(rig, p, ride);
    if (p.aim !== undefined) aimWeapon(kit, p.aim);
}

function keyed(frames: readonly Pose[], names: readonly string[]): Map<string, BoneKeys> {
    return new Map(names.map((name) => {
        let previous: Quat | undefined;
        const rotations = frames.map((frame, f) => {
            let q = frame.get(name)!.q;
            if (previous !== undefined && quatDot(previous, q) < 0) q = negated(q);
            previous = q;
            return { Frame: ms(f), Vector: new Float32Array(q) };
        });
        return [name, { Translation: frames.map((frame, f) => ({ Frame: ms(f), Vector: new Float32Array(frame.get(name)!.t) })), Rotation: rotations }];
    }));
}

export function author(kit: Kit, name: string, beats: Beats, options: AuthorOptions = {}): Clip {
    const { baseFrom = "Stand Ready", baseFrame = 0, standingFrom, plant = true, looping = false, copyOf } = options;
    const last = Math.max(...beats.keys());
    const base = kit.sample(baseFrom, baseFrame);
    const standing = standingFrom === undefined ? base : kit.sample(...standingFrom);
    const frames: Pose[] = [];
    for (let frame = 0; frame <= last; frame++) {
        pose(kit, paramsAt(beats, frame), base, standing, plant);
        frames.push(kit.rig.pose());
    }
    kit.remember(name, frames);
    return { name, frames: last, looping, source: copyOf ?? "Stand Ready", strike: null, bones: keyed(frames, kit.rig.names) };
}

export function strikeFrame(kit: Kit, action: string, angle: number): readonly [number, number] {
    const { first, last } = kit.action(action);
    const direction: Vec3 = [Math.cos(angle * Math.PI / 180), 0, Math.sin(angle * Math.PI / 180)];
    let [best, reach] = [first, -1e9];
    for (let frame = first; frame <= last; frame++) {
        kit.sample(action, frame);
        const here = dot(sub(kit.tip(), [0, 0, 110]), direction);
        if (here > reach) [best, reach] = [frame, here];
    }
    return [best - first, last - first];
}

export function lieFrame(kit: Kit): number {
    const { first, last } = kit.action("Death");
    const heights = Array.from({ length: last - first + 1 }, (_, i) => {
        kit.sample("Death", first + i);
        return kit.rig.position("Chest")[2];
    });
    const floor = Math.min(...heights) + 1;
    return heights.findIndex((z) => z <= floor);
}

const TICK = 60 / 1000;
const deviation = (a: readonly number[], b: readonly number[], sign: number) => Math.max(...a.map((value, i) => Math.abs(value - sign * b[i]!)));

function exported(curve: Curve, rotation: boolean): ClipKey[] {
    const value = (frame: number) => rotation ? unitQuat(quat(evaluate(curve, frame))) : evaluate(curve, frame);
    const sampled = new Map<number, readonly number[]>(curve.map(([frame]) => [frame, value(frame)]));
    const subdivide = (left: number, right: number): void => {
        const middle = roundHalfEven((left + right) / (2 * TICK)) * TICK;
        if (middle - left < TICK - 1e-9 || right - middle < TICK - 1e-9) return;
        const start = quat(sampled.get(left)!), end = quat(sampled.get(right)!);
        const error = Math.max(...[0.25, 0.5, 0.75].map((fraction) => {
            const actual = value(left + (right - left) * fraction), expected = slerp(start, end, fraction);
            return Math.min(deviation(actual, expected, 1), deviation(actual, expected, -1));
        }));
        if (error <= 0.0001) return;
        sampled.set(middle, value(middle));
        subdivide(left, middle);
        subdivide(middle, right);
    };
    if (rotation) curve.forEach(([frame], i) => i > 0 && subdivide(curve[i - 1]![0], frame));
    const out = new Map<number, ClipKey>();
    for (const [frame, vector] of [...sampled].sort((a, b) => a[0] - b[0])) out.set(ms(frame), { Frame: ms(frame), Vector: new Float32Array(vector) });
    return [...out.values()];
}

function warped(curve: Curve, first: number, hit: number, warp: (x: number) => number, rotation: boolean): ClipKey[] {
    const keys = new Map<number, readonly number[]>(curve);
    if (curve.length > 1) keys.set(first + hit, evaluate(curve, first + hit));
    return exported([...keys].sort((a, b) => a[0] - b[0]).map(([frame, value]) => [warp(frame - first), value] as const), rotation);
}

export function reuse(kit: Kit, name: string, builtIn: string, startup: number, total: number, options: { readonly angle?: number; readonly hit?: number } = {}): Clip {
    const action = kit.action(builtIn);
    let [hit, span] = [options.hit, action.last - action.first];
    if (hit === undefined) [hit, span] = strikeFrame(kit, builtIn, options.angle ?? 0);
    const strike = hit;
    const warp = (x: number) => x <= strike ? x * startup / Math.max(1, strike) : startup + (x - strike) * (total - startup) / Math.max(1, span - strike);
    const bones = new Map([...action.curves].map(([bone, { t, q }]) => [bone, {
        Translation: warped(t, action.first, strike, warp, false), Rotation: warped(q, action.first, strike, warp, true),
    }] as const));
    return { name, frames: total, looping: false, source: builtIn, strike: { source: builtIn, sourceFrame: strike, frame: startup }, bones };
}

export function swing(startup: number, active: number, total: number, beats: {
    readonly wind: Beat; readonly strike: Beat; readonly follow: Beat;
    readonly windAt?: number; readonly followAt?: number; readonly settle?: readonly [number, Beat]; readonly start?: Beat;
}): Beats {
    const start = beats.start ?? {};
    const keys = new Map<number, Beat>([[0, start]]);
    keys.set(beats.windAt ?? Math.max(1, startup - 3), beats.wind);
    keys.set(startup, beats.strike);
    keys.set(startup + active - 1, beats.strike);
    keys.set(beats.followAt ?? Math.min(total - 8, startup + active + 5), beats.follow);
    keys.set(total, start);
    if (beats.settle !== undefined) keys.set(beats.settle[0], beats.settle[1]);
    return keys;
}

export const zero = (firstActive: number) => firstActive - 1;
