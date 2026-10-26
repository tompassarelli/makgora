import { mkdirSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ModelRenderer, model as mdx } from 'war3-model';
import { mat4, vec3 } from 'gl-matrix';
import { fighters } from '../../ts/scripts/heroModelSource';
import { followers, limbJoint } from '../../ts/scripts/wisp/victoryJoints';
import type { Character } from '../../ts/src/game/sim/codes';
import { carriedKey, carryOffset } from './carry';
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from './original-clips';

const args = process.argv.slice(2);
const option = (name: string) => args.flatMap((arg, index) => args[index - 1] === name ? [arg] : []);
const [character] = option('--character').map(Number) as Character[];
const names = option('--sequence');
const [assetsArg, outputArg] = args.filter((arg, index) => !arg.startsWith('--') && !args[index - 1]?.startsWith('--'));
ensure(assetsArg && outputArg && character !== undefined && names.length > 0, 'usage: bun tools/animations/carry-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT --character ID --sequence NAME [--sequence NAME...]');
const [assets, output] = [resolve(assetsArg), resolve(outputArg)];
ensure(relative(resolve(import.meta.dir, '../..'), output).startsWith('..'), 'Carried clips stay private');

const fighter = fighters.get(character);
ensure(fighter !== undefined, `No fighter ${character}`);
const source = parseSource(await Bun.file(join(assets, fighter.source)).arrayBuffer()), model = structuredClone(source);
const ancestors = (node: mdx.Node): mdx.Node[] => node.Parent == null || node.Parent === -1 ? [node] : [node, ...ancestors(model.Nodes[node.Parent]!)];
const [carried] = followers(model).flatMap(({ node, side }) => {
    const hand = limbJoint(model, 'hand', side);
    return hand === undefined || ancestors(node).includes(hand) ? [] : [{ node, hand }];
});
ensure(carried !== undefined, `${fighter.name} carries no free weapon; name it in victoryJoints.ts`);
const { node, hand } = carried;
ensure(node.Rotation && node.Translation && !onGlobalClock(node.Rotation) && !onGlobalClock(node.Translation), `${fighter.name}: ${node.Name} has no sequence rotation and translation tracks`);
const stand = [/^stand ready$/i, /^stand$/i].map(pattern => source.Sequences.findIndex(sequence => pattern.test(sequence.Name))).find(index => index >= 0) ?? -1;
ensure(stand >= 0, `${fighter.name} has no Stand Ready or Stand`);

const renderer = new ModelRenderer(model), data = Reflect.get(renderer, 'rendererData');
const evaluate = (index: number, frame: number) => { renderer.setSequence(index); data.frame = frame; renderer.update(0); };
evaluate(stand, source.Sequences[stand]!.Interval[0]!);
const offset = carryOffset(data, hand, node);
const drivers = [...new Set([...ancestors(hand), ...ancestors(node).slice(1)])];
const pivot = (at: mdx.Node) => vec3.transformMat4(vec3.create(), model.PivotPoints[at.ObjectId]! as vec3, data.nodes[at.ObjectId].matrix);
const grip = () => vec3.distance(pivot(node), vec3.transformMat4(vec3.create(), model.PivotPoints[node.ObjectId]! as vec3, mat4.multiply(mat4.create(), data.nodes[hand.ObjectId].matrix, offset)));

const intervals = names.map(name => {
    const index = model.Sequences.findIndex(sequence => sequence.Name === name);
    ensure(index >= 0, `${fighter.name} has no ${name}`);
    const [start, end] = model.Sequences[index]!.Interval as unknown as [number, number];
    const frames = new Set([start, end]);
    for (const driver of drivers) for (const track of [driver.Rotation, driver.Translation, driver.Scaling]) if (track && !onGlobalClock(track)) for (const key of track.Keys) if (key.Frame >= start && key.Frame <= end) frames.add(key.Frame);
    const keys = [...frames].sort((a, b) => a - b).map(frame => { evaluate(index, frame); return { frame, ...carriedKey(model, data, node, hand, offset) }; });
    return { name, index, start, end, keys };
});
for (const { start, end, keys } of intervals) for (const [track, field] of [[node.Rotation, 'rotation'], [node.Translation, 'translation']] as const) {
    const outside = track.Keys.filter(key => key.Frame < start || key.Frame > end), at = outside.findIndex(key => key.Frame > end);
    const inside = keys.map(key => ({ Frame: key.frame, Vector: key[field], ...(track.LineType > mdx.LineType.Linear ? { InTan: field === 'rotation' ? key[field].slice() : new Float32Array(3), OutTan: field === 'rotation' ? key[field].slice() : new Float32Array(3) } : {}) }));
    track.Keys = at < 0 ? [...outside, ...inside] : [...outside.slice(0, at), ...inside, ...outside.slice(at)];
}

const within = (frame: number) => intervals.some(({ start, end }) => frame >= start && frame <= end);
const untouched = (value: mdx.Model) => { const copy = structuredClone(value); tracks(copy, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(key => !within(key.Frame)); }); return copy; };
ensure(isDeepStrictEqual(untouched(model), untouched(source)), `${fighter.name}: carrying ${node.Name} changed another sequence`);
const bytes = encodeVerified(model);
const report = intervals.map(({ name, index, start, end }) => {
    let gap = 0;
    for (let frame = start; frame <= end; frame += 1000 / 60) { evaluate(index, Math.min(end, Math.round(frame))); gap = Math.max(gap, grip()); }
    ensure(gap < 0.5, `${fighter.name}/${name}: ${node.Name} drifts ${gap.toFixed(2)} from ${hand.Name}`);
    return `${name} (largest drift ${gap.toFixed(3)})`;
});
const family = join(output, fighter.source.split('/')[0]!);
mkdirSync(family, { recursive: true });
await Bun.write(join(family, basename(fighter.source)), bytes);
console.log(`CARRY_CLIPS ${fighter.name} ${node.Name} follows ${hand.Name} through ${report.join(', ')}; ${join(family, basename(fighter.source))}`);
