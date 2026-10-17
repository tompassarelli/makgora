import { mkdirSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { generateMDX, parseMDX, ModelRenderer, model as mdx } from 'war3-model';
import { DrawnModel } from '../../ts/scripts/wisp/drawnModel';
import { sheet, type PoseFrame } from '../../ts/scripts/wisp/hurtboxView';
import { fighters } from '../../ts/scripts/heroModelSource';
import { AttackPhase, Character } from '../../ts/src/game/sim/codes';
import { ensure, onGlobalClock, tracks } from './original-clips';
import { RAISED_FRAME, UPRIGHT_LIMIT_DEGREES, torsoLean } from '../../ts/scripts/wisp/victoryTorso';

type Arms = 'rest' | 'low' | 'raised' | 'pumped';
interface Beat { readonly frame: number; readonly arms: Arms; readonly chest: number; readonly head: number; readonly hop: number }
const CHEER: readonly Beat[] = [
    { frame: 0, arms: 'rest', chest: 0, head: 0, hop: 0 }, { frame: 8, arms: 'low', chest: 20, head: 12, hop: 0 },
    { frame: 18, arms: 'raised', chest: -15, head: -22, hop: 0.22 }, { frame: 28, arms: 'raised', chest: -15, head: -22, hop: 0 },
    { frame: 40, arms: 'pumped', chest: -8, head: -12, hop: 0 }, { frame: 50, arms: 'raised', chest: -15, head: -22, hop: 0 },
    { frame: 62, arms: 'pumped', chest: -8, head: -12, hop: 0 }, { frame: 72, arms: 'raised', chest: -15, head: -22, hop: 0 },
    { frame: 90, arms: 'rest', chest: 0, head: 0, hop: 0 },
];
const FRAMES = 90;
const BOUNCING: ReadonlySet<number> = new Set([Character.murloc]);
const BOUNCE: Readonly<Record<number, number>> = { 18: 0.4, 50: 0.35, 72: 0.35 };
const SIDES = [['Bone_Arm1_R', 'Bone_Arm2_R', 'Bone_Hand_R'], ['Bone_Arm1_L', 'Bone_Arm2_L', 'Bone_Hand_L']] as const;

const args = process.argv.slice(2);
const characters = args.flatMap((arg, index) => args[index - 1] === '--character' ? [Number(arg) as Character] : []);
const [assetsArg, outputArg] = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--character');
ensure(assetsArg && outputArg && characters.length > 0, 'usage: bun tools/animations/victory-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT --character ID [--character ID...]');
const [assets, output] = [resolve(assetsArg), resolve(outputArg)];
ensure(relative(resolve(import.meta.dir, '../..'), output).startsWith('..'), 'Victory clips stay private');

function rotated(q: ArrayLike<number>, y: number, z = 0, roll = 0): Float32Array<ArrayBuffer> {
    const a = y * Math.PI / 360, b = z * Math.PI / 360, c = roll * Math.PI / 360;
    const [yi, yj, yk, yl] = [-Math.sin(a) * Math.sin(b), Math.sin(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.cos(a) * Math.cos(b)];
    const [i, j, k, l] = [yl * Math.sin(c) + yi * Math.cos(c), yj * Math.cos(c) - yk * Math.sin(c), yk * Math.cos(c) + yj * Math.sin(c), yl * Math.cos(c) - yi * Math.sin(c)];
    const [x = 0, v = 0, w = 0, t = 1] = Array.from(q);
    const out = [l * x + i * t + j * w - k * v, l * v - i * w + j * t + k * x, l * w + i * v - j * x + k * t, l * t - i * x - j * v - k * w];
    const length = Math.hypot(...out);
    return new Float32Array(out.map(n => n / length));
}
const point = (matrix: ArrayLike<number>, p: ArrayLike<number>) => [0, 1, 2].map(r => matrix[r]! * p[0]! + matrix[4 + r]! * p[1]! + matrix[8 + r]! * p[2]! + matrix[12 + r]!);

for (const character of characters) {
    const fighter = fighters.get(character);
    ensure(fighter !== undefined, `No fighter ${character}`);
    const name = `${fighter.name} Victory`;
    const source = parseMDX(await Bun.file(join(assets, fighter.source)).arrayBuffer()), model = structuredClone(source);
    const existing = source.Sequences.findIndex(sequence => sequence.Name === name);
    const bouncing = BOUNCING.has(character);
    const beats = CHEER.map(beat => bouncing ? { ...beat, hop: BOUNCE[beat.frame] ?? 0 } : beat);
    const idle = (sequence: mdx.Sequence) => /^stand(\s*-?\s*1)?$/.test(sequence.Name.trim().toLowerCase());
    const stand = source.Sequences.find(sequence => sequence.Name.trim().toLowerCase() === 'stand') ?? source.Sequences.find(idle);
    ensure(stand !== undefined, `${fighter.name} has no Stand sequence`);
    const node = (wanted: string) => { const found = model.Nodes.find(candidate => candidate?.Name === wanted); ensure(found, `${fighter.name} has no ${wanted}; map its rig first`); return found; };
    const [chest, head, root] = [node('Bone_Chest'), node('Bone_Head'), node('Bone_Root')];
    const spine = model.Nodes.find(candidate => candidate?.Name === 'Bone_Waist') ?? chest;
    const arms = SIDES.map(side => side.map(node));
    ensure(root.Translation, `${fighter.name}'s Bone_Root has no translation track`);

    const cutoff = existing >= 0 ? source.Sequences[existing]!.Interval[0]! : Math.max(...source.Sequences.map(sequence => sequence.Interval[1]!)) + 100;
    const index = existing >= 0 ? existing : model.Sequences.length, end = cutoff + Math.round(FRAMES * 1000 / 60);
    ensure(existing < 0 || source.Sequences[existing]!.Interval[1] === end, `${name} has a different length; reauthor it at its own length`);
    const time = (frame: number) => cutoff + Math.round(frame * 1000 / 60);
    const inside = (key: { readonly Frame: number }) => key.Frame >= cutoff && key.Frame <= end;
    if (existing >= 0) tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(key => !inside(key)); });
    else model.Sequences.push({ ...stand, Name: name, Interval: new Uint32Array([cutoff, end]), NonLooping: false, MoveSpeed: 0, Rarity: 0,
        MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 400]), BoundsRadius: 450 });
    const originals = new Map<string, mdx.AnimVector>();
    tracks(source, (track, path) => originals.set(path, track));
    tracks(model, (track, path) => {
        const donor = originals.get(path);
        if (donor === undefined || onGlobalClock(donor)) return;
        const first = donor.Keys.find(key => key.Frame >= stand.Interval[0]! && key.Frame <= stand.Interval[1]!);
        if (first === undefined) return;
        const rotation = /\.Rotation$/.test(path) || track.LineType === mdx.LineType.Bezier;
        for (const { frame } of CHEER) track.Keys.push({ ...first, Frame: time(frame), Vector: first.Vector.slice(),
            ...(first.InTan ? { InTan: rotation ? first.Vector.slice() : new Float32Array(first.Vector.length), OutTan: rotation ? first.Vector.slice() : new Float32Array(first.Vector.length) } : {}) });
    });
    tracks(model, track => { if (!onGlobalClock(track)) track.Keys.sort((a, b) => a.Frame - b.Frame); });
    const rest = new Map<mdx.Node, Float32Array>();
    for (const joint of new Set([chest, head, spine, ...arms.flat()])) {
        ensure(joint.Rotation, `${fighter.name}'s ${joint.Name} has no rotation track`);
        if (!joint.Rotation.Keys.some(key => key.Frame === time(0))) { for (const { frame } of CHEER) joint.Rotation.Keys.push({ Frame: time(frame), Vector: new Float32Array([0, 0, 0, 1]), ...(joint.Rotation.LineType >= mdx.LineType.Hermite ? { InTan: new Float32Array([0, 0, 0, 1]), OutTan: new Float32Array([0, 0, 0, 1]) } : {}) }); joint.Rotation.Keys.sort((a, b) => a.Frame - b.Frame); }
        rest.set(joint, joint.Rotation.Keys.find(key => key.Frame === time(0))!.Vector.slice() as Float32Array);
    }
    const pose = (joint: mdx.Node, frame: number, y: number, z = 0, roll = 0) => {
        const key = joint.Rotation!.Keys.find(candidate => candidate.Frame === time(frame))!;
        key.Vector = rotated(rest.get(joint)!, y, z, roll);
        if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); }
    };

    const renderer = new ModelRenderer(model), data = Reflect.get(renderer, 'rendererData');
    const evaluate = (frame: number) => { renderer.setSequence(index); data.frame = time(frame); renderer.update(0); };
    const pivot = (joint: mdx.Node) => point(data.nodes[joint.ObjectId].matrix, model.PivotPoints[joint.ObjectId]!);
    evaluate(0);
    const shoulders = arms.map(([shoulder]) => pivot(shoulder!));
    const standing = new DrawnModel(generateMDX(source), 1).triangles(source.Sequences.indexOf(stand), 0, 1);
    let [highest, lowest] = [-Infinity, Infinity];
    for (let i = 1; i < standing.length; i += 2) { highest = Math.max(highest, standing[i]!); lowest = Math.min(lowest, standing[i]!); }
    const height = highest - lowest;
    const centre = (shoulders[0]![1]! + shoulders[1]![1]!) / 2;
    const span = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
    const reach = arms.map(([shoulder, elbow, hand]) => span(pivot(shoulder!), pivot(elbow!)) + span(pivot(elbow!), pivot(hand!)));
    const outward = (shoulder: readonly number[], side: number, share: number) => centre + Math.sign(shoulder[1]! - centre) * (Math.abs(shoulder[1]! - centre) + reach[side]! * share);
    const targets: Record<Exclude<Arms, 'rest'>, (shoulder: readonly number[], side: number) => readonly number[]> = {
        low: (shoulder, side) => [shoulder[0]!, outward(shoulder, side, 0.25), shoulder[2]! - reach[side]! * 0.9],
        raised: (shoulder, side) => [shoulder[0]!, outward(shoulder, side, bouncing ? 0.5 : 0.25), shoulder[2]! + reach[side]! * 0.92],
        pumped: (shoulder, side) => [shoulder[0]!, outward(shoulder, side, 0.55), shoulder[2]! + reach[side]! * 0.55],
    };
    const solved = new Map<string, number[]>();
    const below = (child: mdx.Node, ancestor: mdx.Node): boolean => { let at: mdx.Node | undefined = child; while (at !== undefined && at.Parent != null && at.Parent !== -1) { if (at.Parent === ancestor.ObjectId) return true; at = model.Nodes[at.Parent]; } return false; };
    const held = bouncing ? arms.flatMap(([, , hand], side) => model.Nodes.filter(candidate => candidate !== undefined && /^weapon ref$/i.test(candidate.Name.trim()) && below(candidate, hand!)).map(weapon => ({ side, hand: hand!, weapon }))).at(0) : undefined;
    const direction = (from: mdx.Node, to: mdx.Node) => { const [a, b] = [pivot(from), pivot(to)]; const d = [0, 1, 2].map(i => b[i]! - a[i]!); const length = Math.hypot(...d); return d.map(v => v / length); };
    const upright = held === undefined ? undefined : (() => { renderer.setSequence(source.Sequences.indexOf(stand)); data.frame = stand.Interval[0]!; renderer.update(0); return direction(held.hand, held.weapon); })();
    for (const beat of beats) {
        pose(chest, beat.frame, beat.chest); pose(head, beat.frame, beat.head);
        if (beat.arms === 'raised' || beat.arms === 'pumped') {
            const lean = () => torsoLean(model, index, time(beat.frame) - cutoff, renderer);
            const known = solved.get('rear');
            if (known !== undefined) pose(spine, beat.frame, known[0]! + (spine === chest ? beat.chest : 0));
            else if (lean() > UPRIGHT_LIMIT_DEGREES) {
                let best = Infinity, choice = 0;
                for (const [step, span] of [[10, 120], [2, 10], [1, 2]] as const) {
                    const centre = choice;
                    for (let value = centre - span; value <= centre + span; value += step) { pose(spine, beat.frame, value + (spine === chest ? beat.chest : 0)); const tilt = lean(); if (tilt < best) { best = tilt; choice = value; } }
                }
                pose(spine, beat.frame, choice + (spine === chest ? beat.chest : 0));
                solved.set('rear', [choice]);
            }
        }
        for (const [side, [shoulder, elbow, hand]] of arms.entries()) {
            if (beat.arms === 'rest') continue;
            const known = solved.get(`${beat.arms}${side}`);
            const angles = known ?? [0, 0, 0, 0, 0];
            const apply = () => { pose(shoulder!, beat.frame, angles[0]!, angles[1]!, angles[4]!); pose(elbow!, beat.frame, angles[2]!, angles[3]!); };
            if (known === undefined) {
                const target = targets[beat.arms](solved.has('rear') ? (evaluate(beat.frame), pivot(shoulder!)) : shoulders[side]!, side);
                const loss = () => { apply(); evaluate(beat.frame); const at = pivot(hand!); return Math.hypot(at[0]! - target[0]!, at[1]! - target[1]!, at[2]! - target[2]!); };
                const descend = (dimensions: number) => { for (let pass = 0; pass < 4; pass++) for (let dimension = 0; dimension < dimensions; dimension++) {
                    let best = Infinity, choice = 0;
                    for (let value = -180; value <= 180; value += pass === 0 ? 20 : pass === 1 ? 5 : 2) { angles[dimension] = value; const distance = loss(); if (distance < best) { best = distance; choice = value; } }
                    angles[dimension] = choice;
                } return loss(); };
                let best = descend(4), kept = angles.slice();
                for (const start of [[0, 0, 0, 0, 0], [-90, 0, 0, 0, 0], [90, 0, 0, 0, 0], [180, 0, 0, 0, 0], [0, 90, 0, 0, 0], [0, -90, 0, 0, 0], [0, 0, 0, 0, 90], [0, 0, 0, 0, -90], [180, 0, 0, 0, 90], [-180, 0, 0, 0, -90]]) {
                    if (best < reach[side]! * 0.25) break;
                    angles.splice(0, 5, ...start);
                    const attempt = descend(5);
                    if (attempt < best) { best = attempt; kept = angles.slice(); }
                }
                angles.splice(0, 5, ...kept);
                ensure(loss() < reach[side]! * 0.25, `${fighter.name}: ${beat.arms} hand ${side} misses its target by ${loss().toFixed(1)} of a ${reach[side]!.toFixed(1)} reach`);
                solved.set(`${beat.arms}${side}`, angles);
            }
            apply();
            if (held !== undefined && upright !== undefined && held.side === side) {
                const known = solved.get(`${beat.arms}grip`), grip = known ?? [0, 0];
                const turn = () => { pose(held.hand, beat.frame, grip[0]!, grip[1]!); evaluate(beat.frame); const now = direction(held.hand, held.weapon); return now[0]! * upright[0]! + now[1]! * upright[1]! + now[2]! * upright[2]!; };
                if (known === undefined) {
                    for (let pass = 0; pass < 3; pass++) for (let dimension = 0; dimension < 2; dimension++) {
                        let best = -Infinity, choice = 0;
                        for (let value = -180; value <= 180; value += pass === 0 ? 15 : pass === 1 ? 5 : 1) { grip[dimension] = value; const alignment = turn(); if (alignment > best) { best = alignment; choice = value; } }
                        grip[dimension] = choice;
                    }
                    ensure(turn() > 0.9, `${fighter.name}: ${beat.arms} grip keeps the weapon only ${turn().toFixed(2)} upright`);
                    solved.set(`${beat.arms}grip`, grip);
                }
                turn();
            }
        }
    }

    const raisedLean = torsoLean(model, index, Math.round(RAISED_FRAME * 1000 / 60), renderer);
    ensure(raisedLean <= UPRIGHT_LIMIT_DEGREES, `${fighter.name}: the raised cheer leans ${raisedLean.toFixed(0)} degrees from upright; rear its spine before the arms`);
    const unplanted = new DrawnModel(generateMDX(model), 1);
    for (const beat of beats) {
        const body = unplanted.triangles(index, beat.frame / 60, 1);
        let lowest = Infinity;
        for (let i = 1; i < body.length; i += 2) lowest = Math.min(lowest, body[i]!);
        const key = root.Translation.Keys.find(candidate => candidate.Frame === time(beat.frame));
        ensure(key !== undefined, `${fighter.name}: root key ${beat.frame} missing`);
        key.Vector[2] = key.Vector[2]! - lowest + beat.hop * height;
        if (key.InTan) { key.InTan = root.Translation.LineType === mdx.LineType.Bezier ? key.Vector.slice() : new Float32Array(3); key.OutTan = key.InTan.slice(); }
    }

    const outside = (value: mdx.Model) => { const copy = structuredClone(value); copy.Sequences = copy.Sequences.filter((_, at) => at !== index); tracks(copy, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(key => !inside(key)); }); return copy; };
    ensure(isDeepStrictEqual(outside(model), outside(source)), `${fighter.name}: the cheer changed another sequence`);
    const bytes = generateMDX(model), decoded = parseMDX(bytes);
    ensure(isDeepStrictEqual(parseMDX(generateMDX(decoded)), decoded), `${fighter.name}: MDX round trip changed the model`);

    const drawn = new DrawnModel(bytes, 1);
    const [resting, raised] = [drawn.triangles(index, 0, 1), drawn.triangles(index, 28 / 60, 1)];
    let moved = 0;
    for (let i = 0; i < Math.min(resting.length, raised.length); i += 2) moved = Math.max(moved, Math.hypot(raised[i]! - resting[i]!, raised[i + 1]! - resting[i + 1]!));
    ensure(resting.length === raised.length && moved > 3, `${fighter.name}: dead cheer, the drawn body moves ${moved.toFixed(1)} units`);
    const family = join(output, fighter.source.split('/')[0]!);
    mkdirSync(family, { recursive: true });
    await Bun.write(join(family, basename(fighter.source)), bytes);
    const panels: PoseFrame[] = [1, -1].flatMap(facing => CHEER.map(({ frame }) => ({ frame, phase: AttackPhase.active, x: 0, z: 0, facing, parts: [], strikes: [], clip: index, seconds: frame / 60 })));
    await Bun.write(join(output, `${fighter.name}-victory.png`), sheet(name, drawn, panels, CHEER.length).png);
    console.log(`VICTORY_CLIP ${fighter.name} sequence ${index} "${name}" ${FRAMES} frames, drawn body moves ${moved.toFixed(1)} of a ${height.toFixed(1)} reach, raised torso ${raisedLean.toFixed(0)} degrees from upright${solved.has('rear') ? ` after rearing ${spine.Name} ${solved.get('rear')![0]} degrees` : ''}; ${join(family, basename(fighter.source))}`);
}
