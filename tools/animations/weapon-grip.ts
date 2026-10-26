import { basename, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { mat4, quat, vec3 } from '../../ts/node_modules/gl-matrix';
import { ModelRenderer, model as mdx } from '../../ts/node_modules/war3-model';
import { generateModelMDX } from '../../ts/scripts/mdxCodec';
import { Character } from '../../ts/src/game/sim/codes';
import { characterModelScale } from '../../ts/src/game/presentation/modelScale';
import { FIGHTER_RIGS } from './rigs';
import { ensure, parseSource, tracks } from './original-clips';

const [inputArg, outputArg, characterArg, firstArg] = process.argv.slice(2);
const project = resolve(import.meta.dir, '../..');
ensure(inputArg && outputArg && characterArg && firstArg, 'usage: bun tools/animations/weapon-grip.ts SHIPPED.mdx PRIVATE_OUTPUT CHARACTER FIRST_AUTHORED_SEQUENCE');
const output = resolve(outputArg);
ensure(relative(project, output).startsWith('..'), 'Weapon grip output stays in private storage');
const character = Number(characterArg) as Character, first = Number(firstArg);
const rig = FIGHTER_RIGS.get(character);
ensure(rig?.classic.weapon, `Character ${characterArg} has no Classic weapon joint`);
const scale = characterModelScale(character), radius = 2.5 / scale;

const source = parseSource(await Bun.file(inputArg).arrayBuffer()), model = structuredClone(source);
const renderer = new ModelRenderer(source), data = Reflect.get(renderer, 'rendererData') as { frame: number; nodes: { matrix: mat4 }[] };
const node = (name: string) => { const found = source.Nodes.find(n => n?.Name === name); ensure(found, `Missing ${name}`); return found; };
const weapon = node(rig.classic.weapon), parent = source.Nodes[weapon.Parent ?? -1];
ensure(parent, `${weapon.Name} has no parent joint`);
ensure(weapon.Rotation?.LineType === mdx.LineType.Linear && weapon.Translation?.LineType === mdx.LineType.Linear && !weapon.Scaling?.Keys.length, `${weapon.Name}: expected linear rotation and translation without scaling`);
const pose = (index: number, frame: number) => { renderer.setSequence(index); data.frame = frame; renderer.update(0); };
const at = (n: mdx.Node) => vec3.transformMat4(vec3.create(), source.PivotPoints[n.ObjectId] as vec3, data.nodes[n.ObjectId]!.matrix);
const ready = source.Sequences.findIndex(sequence => /stand ready/i.test(sequence.Name));
ensure(ready >= 0, 'Missing Stand Ready');
pose(ready, source.Sequences[ready]!.Interval[0]);
const hand = (['wrist.R', 'wrist.L'] as const).map(joint => rig.classic[joint]).filter(name => name !== undefined).map(node)
  .sort((a, b) => vec3.distance(at(a), at(weapon)) - vec3.distance(at(b), at(weapon)))[0]!;
const grip = vec3.transformMat4(vec3.create(), at(hand), mat4.invert(mat4.create(), data.nodes[weapon.ObjectId]!.matrix)!);
const pivot = source.PivotPoints[weapon.ObjectId] as vec3;

const rekeyed: string[] = [], changed = new Set<number>();
for (let index = first; index < source.Sequences.length; index++) {
  const sequence = source.Sequences[index]!, [start, end] = sequence.Interval;
  const frames = [...new Set([...Array.from({ length: Math.floor((end - start) * 60 / 1000) + 1 }, (_, f) => start + Math.round(f * 1000 / 60)), end])].filter(frame => frame <= end);
  let worst = 0;
  const writes = frames.map(frame => {
    pose(index, frame);
    const world = data.nodes[weapon.ObjectId]!.matrix, offset = vec3.subtract(vec3.create(), at(hand), vec3.transformMat4(vec3.create(), grip, world));
    const gap = vec3.length(offset); worst = Math.max(worst, gap);
    const moved = mat4.multiply(mat4.create(), mat4.fromTranslation(mat4.create(), vec3.scale(offset, offset, Math.max(0, 1 - radius / Math.max(gap, 1e-6)))), world);
    const local = mat4.multiply(mat4.create(), mat4.invert(mat4.create(), data.nodes[parent.ObjectId]!.matrix)!, moved);
    const rotation = quat.normalize(quat.create(), mat4.getRotation(quat.create(), local)), turned = vec3.transformQuat(vec3.create(), pivot, rotation);
    return { frame, rotation: Float32Array.from(rotation), translation: Float32Array.from([local[12]! - pivot[0]! + turned[0]!, local[13]! - pivot[1]! + turned[1]!, local[14]! - pivot[2]! + turned[2]!]) };
  });
  if (worst <= radius) continue;
  const target = model.Nodes[weapon.ObjectId]!;
  for (const [track, value] of [[target.Rotation!, 'rotation'], [target.Translation!, 'translation']] as const) {
    track.Keys = [...track.Keys.filter(k => k.Frame < start || k.Frame > end), ...writes.map(write => ({ Frame: write.frame, Vector: write[value] }))].sort((a, b) => a.Frame - b.Frame);
  }
  rekeyed.push(`${sequence.Name} ${(worst * scale).toFixed(1)}`); changed.add(index);
}

const before = new Map<string, mdx.AnimVector>(); tracks(source, (track, path) => before.set(path, track));
const weaponTracks = new Set([model.Nodes[weapon.ObjectId]!.Rotation, model.Nodes[weapon.ObjectId]!.Translation]);
tracks(model, (track, path) => {
  const original = before.get(path); ensure(original, `Unexpected track ${path}`);
  for (const [index, sequence] of model.Sequences.entries()) {
    if (changed.has(index) && weaponTracks.has(track)) continue;
    const inside = (k: mdx.AnimKeyframe) => k.Frame >= sequence.Interval[0] && k.Frame <= sequence.Interval[1];
    ensure(isDeepStrictEqual(track.Keys.filter(inside), original.Keys.filter(inside)), `${path}: ${sequence.Name} changed`);
  }
});
const bytes = generateModelMDX(model);
ensure(isDeepStrictEqual(parseSource(bytes).Nodes[weapon.ObjectId], model.Nodes[weapon.ObjectId]), 'Re-keyed weapon does not round trip');
await Bun.write(join(output, basename(inputArg)), bytes);
console.log(`WEAPON_GRIP ${rekeyed.length} clips re-keyed to hold ${weapon.Name} within ${(radius * scale).toFixed(1)} of ${hand.Name} (worst gap before: ${rekeyed.join(', ')}); ${output}`);
