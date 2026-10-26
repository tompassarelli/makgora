import { mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { model as mdx } from 'war3-model';
import { generateModelMDX as generateMDX, parseModelMDX as parseMDX } from '../../ts/scripts/mdxCodec';
import { DrawnModel } from '../../ts/scripts/wisp/drawnModel';
import { sheet, type PoseFrame } from '../../ts/scripts/wisp/hurtboxView';
import { fighters } from '../../ts/scripts/heroModelSource';
import { AttackPhase, Character } from '../../ts/src/game/sim/codes';
import { ensure, onGlobalClock, rotated, tracks } from './original-clips';

type Turn = readonly [number, number?, number?];
interface Beat { readonly frame: number; readonly bones: Readonly<Record<string, Turn>> }
const NAME = 'Thrall Victory', FRAMES = 90;
const rear = (hammer: number, fist: number, lift: number): Beat['bones'] => ({
    'Bone Wolf Waist': [-5 * lift], 'Bone Wolf Neck': [-18 * lift],
    'Bone Front L Leg': [-25 * lift], 'Bone Front R Leg': [-25 * lift], 'Bone Back L Leg': [10 * lift], 'Bone Back R Leg': [10 * lift],
    'Bone_Chest': [-12], 'Bone_Head': [-18], 'Bone Rider R Arm': [0, 0, hammer], 'Bone Rider R Wrist': [20], 'Bone Rider L Arm': [0, 0, fist],
});
const CHEER: readonly Beat[] = [
    { frame: 0, bones: {} },
    { frame: 10, bones: { 'Bone_Chest': [15], 'Bone_Head': [8], 'Bone Rider R Arm': [-20], 'Bone Front L Leg': [25], 'Bone Front R Leg': [25], 'Bone Back L Leg': [20], 'Bone Back R Leg': [20] } },
    { frame: 24, bones: rear(-140, 120, 1) }, { frame: 40, bones: rear(-105, 85, 0.4) },
    { frame: 54, bones: rear(-140, 120, 1) }, { frame: 68, bones: rear(-105, 85, 0.4) },
    { frame: 80, bones: rear(-140, 120, 0.6) }, { frame: 90, bones: {} },
];

const [assetsArg, outputArg] = process.argv.slice(2);
ensure(assetsArg && outputArg, 'usage: bun tools/animations/thrall-victory.ts PRIVATE_ASSETS PRIVATE_OUTPUT');
const [assets, output] = [resolve(assetsArg), resolve(outputArg)];
ensure(relative(resolve(import.meta.dir, '../..'), output).startsWith('..'), 'Victory clips stay private');
const fighter = fighters.get(Character.thrall);
ensure(fighter !== undefined, 'Thrall is not a fighter');

const source = parseMDX(await Bun.file(join(assets, fighter.source)).arrayBuffer()), model = structuredClone(source);
const stand = source.Sequences.find(sequence => sequence.Name.trim().toLowerCase() === 'stand');
ensure(stand !== undefined, 'Thrall has no Stand sequence');
const existing = source.Sequences.findIndex(sequence => sequence.Name === NAME);
const cutoff = existing >= 0 ? source.Sequences[existing]!.Interval[0]! : Math.max(...source.Sequences.map(sequence => sequence.Interval[1]!)) + 100;
const index = existing >= 0 ? existing : model.Sequences.length, end = cutoff + Math.round(FRAMES * 1000 / 60);
ensure(existing < 0 || source.Sequences[existing]!.Interval[1] === end, `${NAME} has a different length; reauthor it at its own length`);
const time = (frame: number) => cutoff + Math.round(frame * 1000 / 60);
const inside = (key: { readonly Frame: number }) => key.Frame >= cutoff && key.Frame <= end;
if (existing >= 0) tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(key => !inside(key)); });
else model.Sequences.push({ ...stand, Name: NAME, Interval: new Uint32Array([cutoff, end]), NonLooping: false, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 400]), BoundsRadius: 450 });

const bone = (name: string) => { const found = model.Nodes.find(node => node?.Name === name); ensure(found?.Rotation, `Thrall has no ${name} rotation track`); return found; };
const posed = new Set(CHEER.flatMap(beat => Object.keys(beat.bones)));
for (const name of posed) bone(name);
const originals = new Map<string, mdx.AnimVector>();
tracks(source, (track, path) => originals.set(path, track));
tracks(model, (track, path) => {
    const donor = originals.get(path);
    if (donor === undefined || onGlobalClock(donor)) return;
    const held = donor.Keys.find(key => key.Frame >= stand.Interval[0]! && key.Frame <= stand.Interval[1]!);
    const identity = /^\.(Bones|Helpers)\.\d+\.(Rotation|Translation|Scaling)$/.test(path) ? new Float32Array(path.endsWith('Rotation') ? [0, 0, 0, 1] : path.endsWith('Scaling') ? [1, 1, 1] : [0, 0, 0]) : undefined;
    const first = held ?? (identity && { Frame: stand.Interval[0]!, Vector: identity, ...(track.LineType > mdx.LineType.Linear ? { InTan: identity.slice(), OutTan: identity.slice() } : {}) });
    if (!first) return;
    const rotation = /\.Rotation$/.test(path) || track.LineType === mdx.LineType.Bezier;
    for (const { frame } of CHEER) track.Keys.push({ ...first, Frame: time(frame), Vector: first.Vector.slice(),
        ...(first.InTan ? { InTan: rotation ? first.Vector.slice() : new Float32Array(first.Vector.length), OutTan: rotation ? first.Vector.slice() : new Float32Array(first.Vector.length) } : {}) });
    track.Keys.sort((a, b) => a.Frame - b.Frame);
});
for (const name of posed) {
    const node = bone(name), keys = node.Rotation!.Keys;
    const rest = keys.find(key => key.Frame === time(0));
    ensure(rest, `Thrall's ${name} has no stand rotation to pose from`);
    const base = rest.Vector.slice();
    for (const beat of CHEER) {
        const [y, z = 0, roll = 0] = beat.bones[name] ?? [0];
        const key = keys.find(candidate => candidate.Frame === time(beat.frame))!;
        key.Vector = rotated(base, y, z, roll);
        if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); }
    }
}

const center = bone('Bone Center');
ensure(center.Translation, "Thrall's Bone Center has no translation track");
const unplanted = new DrawnModel(generateMDX(model), 1);
for (const beat of CHEER) {
    const body = unplanted.triangles(index, beat.frame / 60, 1);
    let lowest = Infinity;
    for (let i = 1; i < body.length; i += 2) lowest = Math.min(lowest, body[i]!);
    const key = center.Translation.Keys.find(candidate => candidate.Frame === time(beat.frame));
    ensure(key !== undefined, `Thrall: Bone Center key ${beat.frame} missing`);
    key.Vector[2] = key.Vector[2]! - lowest;
}

const outside = (value: mdx.Model) => { const copy = structuredClone(value); copy.Sequences = copy.Sequences.filter((_, at) => at !== index); tracks(copy, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(key => !inside(key)); }); return copy; };
ensure(isDeepStrictEqual(outside(model), outside(source)), 'Thrall: the cheer changed another sequence');
const bytes = generateMDX(model), decoded = parseMDX(bytes);
ensure(isDeepStrictEqual(parseMDX(generateMDX(decoded)), decoded), 'Thrall: MDX round trip changed the model');

const drawn = new DrawnModel(bytes, 1);
const [resting, raised] = [drawn.triangles(index, 0, 1), drawn.triangles(index, 24 / 60, 1)];
let moved = 0;
for (let i = 0; i < Math.min(resting.length, raised.length); i += 2) moved = Math.max(moved, Math.hypot(raised[i]! - resting[i]!, raised[i + 1]! - resting[i + 1]!));
ensure(resting.length === raised.length && moved > 3, `Thrall: dead cheer, the drawn body moves ${moved.toFixed(1)} units`);
const target = join(output, fighter.source);
mkdirSync(dirname(target), { recursive: true });
await Bun.write(target, bytes);
const panels: PoseFrame[] = [1, -1].flatMap(facing => CHEER.map(({ frame }) => ({ frame, phase: AttackPhase.active, x: 0, z: 0, facing, parts: [], strikes: [], clip: index, seconds: frame / 60 })));
await Bun.write(join(output, 'Thrall-victory.png'), sheet(NAME, drawn, panels, CHEER.length).png);
console.log(`VICTORY_CLIP Thrall sequence ${index} "${NAME}" ${FRAMES} frames, drawn body moves ${moved.toFixed(1)} units; ${target}`);
