import { mkdirSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { quat } from 'gl-matrix';
import { model as mdx } from 'war3-model';
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from './original-clips';

type FrameMap = readonly (readonly [number, number])[];
type Aim = { readonly target: string; readonly source: string; readonly frames: FrameMap };

const FRAME_MS = 1000 / 24;
const UPPER_BODY = ['Bone_Chest', 'Rifle01'];
const AIMS: readonly Aim[] = [
    { target: 'Aerial Forward', source: 'Forward Tilt', frames: [[0, 0], [4, 4], [5, 6], [6, 8], [12, 16], [26, 28], [31, 30]] },
    { target: 'Aerial Back', source: 'Aerial Forward', frames: [[0, 0], [1, 3], [3, 5], [18, 6], [24, 11], [26, 12], [32, 26], [37, 31]] },
];

const [assetsArg, outputArg] = process.argv.slice(2);
ensure(assetsArg && outputArg, 'usage: bun tools/animations/rifleman-aerial-aim.ts PRIVATE_ASSETS PRIVATE_OUTPUT');
const [assets, output] = [resolve(assetsArg), resolve(outputArg)];
ensure(relative(resolve(import.meta.dir, '../..'), output).startsWith('..'), 'Aimed clips stay private');

const family = 'animation-assets', file = 'RiflemanFighter.mdx';
const source = parseSource(await Bun.file(join(assets, family, file)).arrayBuffer()), model = structuredClone(source);
const interval = (value: mdx.Model, name: string) => {
    const sequence = value.Sequences.find(candidate => candidate.Name === name);
    ensure(sequence !== undefined, `Rifleman has no ${name}`);
    const [start, end] = sequence.Interval as unknown as [number, number];
    return { start, end, frames: Math.round((end - start) / FRAME_MS) };
};
const parent = (node: mdx.Node) => node.Parent == null || node.Parent === -1 ? undefined : model.Nodes[node.Parent];
const within = (node: mdx.Node, root: mdx.Node): boolean => node === root || (parent(node) !== undefined && within(parent(node)!, root));
const roots = UPPER_BODY.map(name => { const node = model.Nodes.find(candidate => candidate?.Name === name); ensure(node !== undefined, `Rifleman has no ${name}`); return node; });
const moved = model.Nodes.filter(node => node !== undefined && roots.some(root => within(node, root)));

function mapped(frames: FrameMap, frame: number): number {
    const at = frames.findIndex(([target]) => target >= frame);
    ensure(at >= 0, `frame ${frame} is past the frame map`);
    if (at === 0) return frames[0]![1];
    const [[t0, s0], [t1, s1]] = [frames[at - 1]!, frames[at]!];
    return s0 + (s1 - s0) * (frame - t0) / (t1 - t0);
}

function sample(track: mdx.AnimVector, start: number, end: number, ms: number, rotation: boolean): Float32Array<ArrayBuffer> {
    const keys = track.Keys.filter(key => key.Frame >= start && key.Frame <= end);
    ensure(keys.length > 0 && keys[0]!.Frame === start && keys.at(-1)!.Frame === end, `track is not keyed at both ends of ${start}-${end}`);
    const after = keys.findIndex(key => key.Frame >= ms);
    if (after <= 0) return new Float32Array(keys[Math.max(after, 0)]!.Vector);
    const [a, b] = [keys[after - 1]!, keys[after]!], t = (ms - a.Frame) / (b.Frame - a.Frame);
    if (rotation) return new Float32Array(quat.slerp(quat.create(), a.Vector as unknown as quat, b.Vector as unknown as quat, t));
    return new Float32Array(a.Vector.map((value, index) => value + (b.Vector[index]! - value) * t));
}

const sourceNodes: ReadonlyMap<string | undefined, mdx.Node | undefined> = new Map(source.Nodes.map(node => [node?.Name, node]));
const rifleAt = (name: string, frame: number) => { const { start, end } = interval(source, name); return sample(sourceNodes.get('Rifle01')!.Rotation!, start, end, start + frame * FRAME_MS, true) as unknown as quat; };
ensure(Math.abs(quat.dot(rifleAt('Aerial Forward', 5), rifleAt('Forward Tilt', 6))) < 0.999, 'Aerial Forward already aims like Forward Tilt: run this on the stock-authored model only');
const changed = AIMS.map(({ target, source: origin, frames }) => {
    const to = interval(model, target), of = interval(source, origin);
    ensure(frames[0]![0] === 0 && frames.at(-1)![0] === to.frames, `${target}'s frame map must span 0-${to.frames}`);
    ensure(frames.every(([, at]) => at >= 0 && at <= of.frames), `${target}'s frame map leaves ${origin}'s 0-${of.frames}`);
    for (const node of moved) for (const [field, rotation] of [['Rotation', true], ['Translation', false], ['Scaling', false]] as const) {
        const track = node[field], from = sourceNodes.get(node.Name)?.[field];
        if (track === undefined || from === undefined) continue;
        ensure(!onGlobalClock(track) && track.LineType === mdx.LineType.Linear && from.LineType === mdx.LineType.Linear, `${node.Name} ${field} is not a linear sequence track`);
        const inside = Array.from({ length: to.frames + 1 }, (_, frame) => ({
            Frame: Math.min(to.end, to.start + Math.round(frame * FRAME_MS)),
            Vector: sample(from, of.start, of.end, Math.min(of.end, of.start + mapped(frames, frame) * FRAME_MS), rotation),
        }));
        const at = track.Keys.findIndex(key => key.Frame > to.end);
        const outside = track.Keys.filter(key => key.Frame < to.start || key.Frame > to.end);
        const before = outside.filter(key => key.Frame < to.start);
        track.Keys = at < 0 ? [...before, ...inside] : [...before, ...inside, ...outside.slice(before.length)];
    }
    return to;
});

const inside = (frame: number) => changed.some(({ start, end }) => frame >= start && frame <= end);
const untouched = (value: mdx.Model) => { const copy = structuredClone(value); tracks(copy, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(key => !inside(key.Frame)); }); return copy; };
ensure(isDeepStrictEqual(untouched(model), untouched(source)), 'Aiming the aerials changed another sequence');
const bytes = encodeVerified(model);
mkdirSync(join(output, family), { recursive: true });
for (const name of readdirSync(join(assets, family))) await Bun.write(join(output, family, name), name === file ? bytes : Bun.file(join(assets, family, name)));
console.log(`RIFLEMAN_AERIAL_AIM ${AIMS.map(aim => `${aim.target} upper body from ${aim.source}`).join(', ')}; ${moved.length} nodes; ${join(output, family, file)}`);
