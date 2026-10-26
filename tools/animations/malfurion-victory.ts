import { mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ModelRenderer, model as mdx } from 'war3-model';
import { generateModelMDX as generateMDX, parseModelMDX as parseMDX } from '../../ts/scripts/mdxCodec';
import { DrawnModel } from '../../ts/scripts/wisp/drawnModel';
import { sheet, type PoseFrame } from '../../ts/scripts/wisp/hurtboxView';
import { anatomyFindings } from '../../ts/scripts/wisp/victoryAnatomy';
import { fighters } from '../../ts/scripts/heroModelSource';
import { AttackPhase, Character } from '../../ts/src/game/sim/codes';
import { ensure, onGlobalClock, tracks } from './original-clips';
import { bodyPoseReader, standSequence } from './victory-pose';

const FRAMES = 90, CLOAK_STRETCH_LIMIT = 2, SHEET_FRAMES = [0, 15, 30, 45, 60, 75];
const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(name); return at < 0 ? undefined : resolve(args[at + 1] ?? ''); };
const [assetsArg, outputArg] = args.filter((arg, at) => !arg.startsWith('--') && !args[at - 1]?.startsWith('--'));
const rigOutput = option('--rig'), bakedKeys = option('--keys');
ensure(assetsArg && outputArg && (rigOutput === undefined) !== (bakedKeys === undefined), 'usage: bun tools/animations/malfurion-victory.ts PRIVATE_ASSETS PRIVATE_OUTPUT --rig RIG.json | --keys KEYS.json');
const [assets, output] = [resolve(assetsArg), resolve(outputArg)];
ensure(relative(resolve(import.meta.dir, '../..'), output).startsWith('..'), 'Victory clips stay private');
const fighter = fighters.get(Character.malfurion);
ensure(fighter !== undefined, 'Malfurion is not a fighter');
const NAME = `${fighter.name} Victory`;

const source = parseMDX(await Bun.file(join(assets, fighter.source)).arrayBuffer()), model = structuredClone(source);
const stand = source.Sequences[standSequence(source)];
ensure(stand !== undefined, 'Malfurion has no Stand sequence');
const existing = source.Sequences.findIndex(sequence => sequence.Name === NAME);
const start = existing >= 0 ? source.Sequences[existing]!.Interval[0]! : Math.max(...source.Sequences.map(sequence => sequence.Interval[1]!)) + 100;
const time = (frame: number) => start + Math.round(frame * 1000 / 60);
const index = existing >= 0 ? existing : model.Sequences.length, end = time(FRAMES);
ensure(existing < 0 || source.Sequences[existing]!.Interval[1] === end, `${NAME} has a different length; reauthor it at its own length`);
if (existing < 0) model.Sequences.push({ ...stand, Name: NAME, Interval: new Uint32Array([start, end]), NonLooping: false, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 400]), BoundsRadius: 450 });
const skeleton = (['Bones', 'Helpers'] as const).flatMap(kind => model[kind].map(node => node));
const restKey = (track: mdx.AnimVector | undefined) => track && !onGlobalClock(track) ? track.Keys.find(key => key.Frame >= stand.Interval[0]! && key.Frame <= stand.Interval[1]!)?.Vector : undefined;

if (rigOutput !== undefined) {
    const at = (track: mdx.AnimVector | undefined) => { const vector = restKey(track); return vector ? Array.from(vector) : null; };
    await Bun.write(rigOutput, JSON.stringify({ frames: FRAMES, nodes: skeleton.map(node => ({
        name: node.Name, parent: skeleton.findIndex(other => other.ObjectId === node.Parent), pivot: Array.from(source.PivotPoints[node.ObjectId]!),
        rotation: at(node.Rotation), translation: at(node.Translation), scaling: at(node.Scaling),
    })) }));
    console.log(`MALFURION_VICTORY_RIG ${rigOutput}`);
    process.exit(0);
}

const authored = await Bun.file(bakedKeys!).json() as { frames: number; lift: number[]; nodes: { rotation: number[][]; translation: number[][] }[] };
ensure(authored.frames === FRAMES && authored.lift.length === FRAMES + 1 && authored.nodes.length === skeleton.length, `Blender keys cover ${authored.frames} frames of ${authored.nodes.length} nodes, the victory ${FRAMES} of ${skeleton.length}`);
const inside = (key: { readonly Frame: number }) => key.Frame >= start && key.Frame <= end;
for (const [at, node] of skeleton.entries()) for (const kind of ['Rotation', 'Translation'] as const) {
    const track = node[kind];
    if (!track || onGlobalClock(track)) continue;
    const baked = authored.nodes[at]![kind === 'Rotation' ? 'rotation' : 'translation'];
    track.Keys = [...track.Keys.filter(key => !inside(key)), ...baked.map((vector, frame) => {
        const Vector = Float32Array.from(vector);
        return { Frame: time(frame), Vector, ...(track.LineType >= mdx.LineType.Hermite ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {}) };
    })].sort((a, b) => a.Frame - b.Frame);
}
const root = model.Nodes.find(node => node?.Name === 'Bone_RootArchDruid')?.Translation;
ensure(root, "Malfurion's Bone_RootArchDruid has no translation track");
const unplanted = new DrawnModel(generateMDX(model), 1);
for (let frame = 0; frame <= FRAMES; frame++) {
    const body = unplanted.triangles(index, frame / 60, 1);
    let lowest = Infinity;
    for (let i = 1; i < body.length; i += 2) lowest = Math.min(lowest, body[i]!);
    root.Keys.find(key => key.Frame === time(frame))!.Vector[2]! += authored.lift[frame]! - lowest;
}

const renderer = new ModelRenderer(model), data = Reflect.get(renderer, 'rendererData') as { frame: number; nodes: { matrix: Float32Array }[] };
const evaluate = (sequence: number, frame: number) => { renderer.setSequence(sequence); data.frame = model.Sequences[sequence]!.Interval[0]! + Math.round(frame * 1000 / 60); renderer.update(0); };
const cloak = model.Geosets[0]!;
const skinned = () => {
    const out = new Float32Array(cloak.Vertices.length);
    for (let vertex = 0; vertex < cloak.Vertices.length / 3; vertex++) {
        const group = cloak.Groups[cloak.VertexGroup[vertex]!]!, [x, y, z] = cloak.Vertices.subarray(vertex * 3, vertex * 3 + 3);
        for (const node of group) { const m = data.nodes[node]!.matrix; for (let r = 0; r < 3; r++) out[vertex * 3 + r]! += (m[r]! * x! + m[4 + r]! * y! + m[8 + r]! * z! + m[12 + r]!) / group.length; }
    }
    return out;
};
const edge = (p: Float32Array, a: number, b: number) => Math.hypot(p[a * 3]! - p[b * 3]!, p[a * 3 + 1]! - p[b * 3 + 1]!, p[a * 3 + 2]! - p[b * 3 + 2]!);
evaluate(standSequence(model), 0);
const rest = skinned(), read = bodyPoseReader(model, renderer, 'Malfurion'), restPose = read();
let stretch = 0, stretchFrame = 0;
const samples = Array.from({ length: FRAMES + 1 }, (_, frame) => {
    evaluate(index, frame);
    const posed = skinned();
    for (let face = 0; face < cloak.Faces.length; face += 3) for (const [i, j] of [[0, 1], [1, 2], [2, 0]] as const) {
        const [a, b] = [cloak.Faces[face + i]!, cloak.Faces[face + j]!], length = edge(rest, a, b);
        if (length >= 2 && edge(posed, a, b) / length > stretch) [stretch, stretchFrame] = [edge(posed, a, b) / length, frame];
    }
    return { frame, pose: read() };
});
ensure(stretch <= CLOAK_STRETCH_LIMIT, `Malfurion: frame ${stretchFrame} stretches a cloak edge ${stretch.toFixed(2)} times its stand length; keep the upper arms nearer the body`);
const breaks = anatomyFindings(restPose, samples);
ensure(breaks.length === 0, `Malfurion: the cheer breaks the body: ${breaks.map(finding => `frame ${finding.frame} arm ${finding.side} ${finding.joint} ${finding.rule} (${finding.value})`).join('; ')}`);

const outside = (value: mdx.Model) => { const copy = structuredClone(value); copy.Sequences = copy.Sequences.filter((_, at) => at !== index); tracks(copy, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(key => !inside(key)); }); return copy; };
ensure(isDeepStrictEqual(outside(model), outside(source)), 'Malfurion: the cheer changed another sequence');
const bytes = generateMDX(model), decoded = parseMDX(bytes);
ensure(isDeepStrictEqual(parseMDX(generateMDX(decoded)), decoded), 'Malfurion: MDX round trip changed the model');
const target = join(output, fighter.source);
mkdirSync(dirname(target), { recursive: true });
await Bun.write(target, bytes);
const panels: PoseFrame[] = [1, -1].flatMap(facing => SHEET_FRAMES.map(frame => ({ frame, phase: AttackPhase.active, x: 0, z: 0, facing, parts: [], strikes: [], clip: index, seconds: frame / 60 })));
await Bun.write(join(output, 'Malfurion-victory.png'), sheet(NAME, new DrawnModel(bytes, 1), panels, SHEET_FRAMES.length).png);
console.log(`VICTORY_CLIP Malfurion sequence ${index} "${NAME}" ${FRAMES} frames from Blender keys, cloak stretch ${stretch.toFixed(2)} at frame ${stretchFrame}, 0 anatomy findings; ${target}`);
