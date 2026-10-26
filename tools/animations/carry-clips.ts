import { mkdirSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ModelRenderer, model as mdx } from 'war3-model';
import { mat4, vec3 } from 'gl-matrix';
import { fighters } from '../../ts/scripts/heroModelSource';
import type { Character } from '../../ts/src/game/sim/codes';
import { carriedKey, carryOffset } from './carry';
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from './original-clips';
import { FIGHTER_RIGS } from './rigs';

const args = process.argv.slice(2);
const option = (name: string) => args.flatMap((arg, index) => args[index - 1] === name ? [arg] : []);
const [character] = option('--character').map(Number) as Character[];
const names = option('--sequence');
const [assetsArg, outputArg] = args.filter((arg, index) => !arg.startsWith('--') && !args[index - 1]?.startsWith('--'));
ensure(assetsArg && outputArg && character !== undefined && names.length > 0, 'usage: bun tools/animations/carry-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT --character ID --sequence NAME [--sequence NAME...]');
const [assets, output] = [resolve(assetsArg), resolve(outputArg)];
ensure(relative(resolve(import.meta.dir, '../..'), output).startsWith('..'), 'Carried clips stay private');

const fighter = fighters.get(character), rig = FIGHTER_RIGS.get(character);
ensure(fighter !== undefined && rig !== undefined, `No fighter ${character}`);
const source = parseSource(await Bun.file(join(assets, fighter.source)).arrayBuffer()), model = structuredClone(source);
const named = (name: string | undefined) => name === undefined ? undefined : model.Nodes.find(node => node?.Name === name);
const ancestors = (node: mdx.Node): mdx.Node[] => node.Parent == null || node.Parent === -1 ? [node] : [node, ...ancestors(model.Nodes[node.Parent]!)];
const wrists = [named(rig.classic['wrist.R']), named(rig.classic['wrist.L'])];
const carried = ([['weapon', 0], ['weapon.L', 1]] as const).flatMap(([joint, side]) => {
    const node = named(rig.classic[joint]);
    if (node === undefined) return [];
    const hand = wrists.find(wrist => wrist !== undefined && ancestors(node).includes(wrist)) ?? wrists[side];
    ensure(hand !== undefined, `${fighter.name}: ${node.Name} has no hand`);
    ensure(node.Rotation && node.Translation && !onGlobalClock(node.Rotation) && !onGlobalClock(node.Translation), `${fighter.name}: ${node.Name} has no sequence rotation and translation tracks`);
    return [{ node, hand }];
});
ensure(carried.length > 0, `${fighter.name} has no weapon in its rig`);
const stand = [/^stand ready$/i, /^stand$/i].map(pattern => source.Sequences.findIndex(sequence => pattern.test(sequence.Name))).find(index => index >= 0) ?? -1;
ensure(stand >= 0, `${fighter.name} has no Stand Ready or Stand`);
const [standStart, standEnd] = source.Sequences[stand]!.Interval as unknown as [number, number];

const renderer = new ModelRenderer(model), data = Reflect.get(renderer, 'rendererData');
const evaluate = (index: number, frame: number) => { renderer.setSequence(index); data.frame = frame; renderer.update(0); };
evaluate(stand, standStart);
const props = carried.map(({ node, hand }) => ({ node, hand, offset: carryOffset(data, hand, node), scaling: new Float32Array(mat4.getScaling(vec3.create(), carryOffset(data, model.Nodes[node.Parent!]!, node))) }));
const drivers = [...new Set(props.flatMap(({ node, hand }) => [...ancestors(hand), ...ancestors(node).slice(1)]))];
const pivot = (at: mdx.Node, matrix: mat4) => vec3.transformMat4(vec3.create(), model.PivotPoints[at.ObjectId]! as vec3, matrix);
const grip = ({ node, hand, offset }: (typeof props)[number]) => vec3.distance(pivot(node, data.nodes[node.ObjectId].matrix), pivot(node, mat4.multiply(mat4.create(), data.nodes[hand.ObjectId].matrix, offset)));

const intervals = names.map(name => {
    const index = model.Sequences.findIndex(sequence => sequence.Name === name);
    ensure(index >= 0, `${fighter.name} has no ${name}`);
    const [start, end] = model.Sequences[index]!.Interval as unknown as [number, number];
    const frames = new Set([start, end]);
    for (const driver of drivers) for (const track of [driver.Rotation, driver.Translation, driver.Scaling]) if (track && !onGlobalClock(track)) for (const key of track.Keys) if (key.Frame >= start && key.Frame <= end) frames.add(key.Frame);
    const keys = props.map(prop => [...frames].sort((a, b) => a - b).map(frame => { evaluate(index, frame); return { frame, ...carriedKey(model, data, prop.node, prop.hand, prop.offset) }; }));
    return { name, index, start, end, keys };
});
const rekey = (track: mdx.AnimVector, start: number, end: number, inside: readonly { readonly Frame: number; readonly Vector: Float32Array }[], rotation = false) => {
    const outside = track.Keys.filter(key => key.Frame < start || key.Frame > end), at = outside.findIndex(key => key.Frame > end);
    const keys = inside.map(key => ({ ...key, ...(track.LineType > mdx.LineType.Linear ? { InTan: rotation ? key.Vector.slice() : new Float32Array(key.Vector.length), OutTan: rotation ? key.Vector.slice() : new Float32Array(key.Vector.length) } : {}) }));
    track.Keys = at < 0 ? [...outside, ...keys] : [...outside.slice(0, at), ...keys, ...outside.slice(at)];
};
const hold = (track: mdx.AnimVector, start: number, end: number, vector: Float32Array) => {
    if (track.Keys.every(key => key.Frame < start || key.Frame > end || key.Vector.every((value, at) => Math.abs(value - vector[at]!) < 1e-6))) return;
    rekey(track, start, end, [{ Frame: start, Vector: vector }, { Frame: end, Vector: vector }]);
};
for (const { start, end, keys } of intervals) for (const [prop, { node, scaling }] of props.entries()) {
    for (const [track, field] of [[node.Rotation!, 'rotation'], [node.Translation!, 'translation']] as const) rekey(track, start, end, keys[prop]!.map(key => ({ Frame: key.frame, Vector: key[field] })), field === 'rotation');
    if (node.Scaling !== undefined && !onGlobalClock(node.Scaling)) hold(node.Scaling, start, end, scaling);
}
const shown = model.GeosetAnims.flatMap(anim => {
    const alpha = anim.Alpha;
    if (typeof alpha === 'number' || onGlobalClock(alpha)) return [];
    const held = alpha.Keys.filter(key => key.Frame >= standStart && key.Frame <= standEnd).map(key => key.Vector[0]!);
    ensure(held.every(value => value === held[0]), `${fighter.name}: geoset ${anim.GeosetId} fades during Stand Ready`);
    const value = new Float32Array([held[0] ?? 1]);
    for (const { start, end } of intervals) hold(alpha, start, end, value);
    return [`geoset ${anim.GeosetId} ${value[0] === 0 ? 'hidden' : 'shown'}`];
});

const within = (frame: number) => intervals.some(({ start, end }) => frame >= start && frame <= end);
const untouched = (value: mdx.Model) => { const copy = structuredClone(value); tracks(copy, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(key => !within(key.Frame)); }); return copy; };
ensure(isDeepStrictEqual(untouched(model), untouched(source)), `${fighter.name}: carrying its weapons changed another sequence`);
const bytes = encodeVerified(model);
const report = intervals.map(({ name, index, start, end }) => {
    const gaps = props.map(prop => {
        let gap = 0;
        for (let frame = start; frame <= end; frame += 1000 / 60) { evaluate(index, Math.min(end, Math.round(frame))); gap = Math.max(gap, grip(prop)); }
        ensure(gap < 0.5, `${fighter.name}/${name}: ${prop.node.Name} drifts ${gap.toFixed(2)} from ${prop.hand.Name}`);
        return `${prop.node.Name} ${gap.toFixed(3)}`;
    });
    return `${name} (largest drift ${gaps.join(', ')})`;
});
const family = join(output, fighter.source.split('/')[0]!);
mkdirSync(family, { recursive: true });
await Bun.write(join(family, basename(fighter.source)), bytes);
console.log(`CARRY_CLIPS ${fighter.name} ${props.map(({ node, hand }) => `${node.Name} follows ${hand.Name}`).join(', ')} through ${report.join(', ')}; Stand Ready visibility: ${shown.join(', ') || 'no animated geosets'}; ${join(family, basename(fighter.source))}`);
