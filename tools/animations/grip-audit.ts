import { mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { mat4, vec3 } from '../../ts/node_modules/gl-matrix';
import { ModelRenderer } from '../../ts/node_modules/war3-model';
import { originalClip } from '../../ts/src/generated/clips/fighterOriginalClipInfo';
import { Character } from '../../ts/src/game/sim/codes';
import { characterModelScale } from '../../ts/src/game/presentation/modelScale';
import { FIGHTER_RIGS } from './hd-rigs';
import { fighters, parseSource } from './original-clips';

const [assetsArg, outArg] = process.argv.slice(2);
const project = resolve(import.meta.dir, '../..');
if (!assetsArg || !outArg) throw new Error('usage: bun tools/animations/grip-audit.ts PRIVATE_ASSETS PRIVATE_OUTPUT');
const assets = resolve(assetsArg), out = resolve(outArg);
if (!relative(project, out).startsWith('..')) throw new Error('Grip audit output stays in private storage');
mkdirSync(out, { recursive: true });

type Point = readonly [number, number, number];
type NodeSample = { readonly matrix: Float32Array };
type RendererSample = { frame: number; nodes: NodeSample[] };
type RigJoint = 'pelvis' | 'chest' | 'head' | 'hip.L' | 'knee.L' | 'ankle.L' | 'hip.R' | 'knee.R' | 'ankle.R' | 'wrist.L' | 'wrist.R' | 'weapon' | 'weapon.L';
type Row = { fighter: string; look: string; sequence: string; samples: number; detached: number | null; intersecting: number | null; maxGap: number | null; minClearance: number | null; unavailable: string };
type Capsule = { name: string; a: NonNullable<ReturnType<typeof nodeNamed>>; b: NonNullable<ReturnType<typeof nodeNamed>>; radius: number };

function nodeNamed(model: ReturnType<typeof parseSource>, name: string) {
  return model.Nodes.find(node => node?.Name === name);
}
function point(value: ArrayLike<number>): Point { return [value[0]!, value[1]!, value[2]!]; }
function transform(value: ArrayLike<number>, matrix: ArrayLike<number>): Point {
  return point(vec3.transformMat4(vec3.create(), value as vec3, matrix as mat4));
}
function add(a: Point, b: Point): Point { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a: Point, b: Point): Point { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mul(a: Point, scalar: number): Point { return [a[0] * scalar, a[1] * scalar, a[2] * scalar]; }
function dot(a: Point, b: Point): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function distance(a: Point, b: Point): number { return Math.hypot(...sub(a, b)); }
function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  const u = sub(b, a), v = sub(d, c), w = sub(a, c), aa = dot(u, u), bb = dot(u, v), cc = dot(v, v), dd = dot(u, w), ee = dot(v, w), denominator = aa * cc - bb * bb;
  let s = denominator > 1e-8 ? Math.max(0, Math.min(1, (bb * ee - cc * dd) / denominator)) : 0;
  let t = cc > 1e-8 ? Math.max(0, Math.min(1, (bb * s + ee) / cc)) : 0;
  s = aa > 1e-8 ? Math.max(0, Math.min(1, (bb * t - dd) / aa)) : 0;
  return distance(add(a, mul(u, s)), add(c, mul(v, t)));
}
function nodePosition(model: ReturnType<typeof parseSource>, data: RendererSample, node: NonNullable<ReturnType<typeof nodeNamed>>, scale: number): Point {
  return mul(transform(model.PivotPoints[node.ObjectId]!, data.nodes[node.ObjectId]!.matrix), scale);
}
function bodyNode(rig: (typeof FIGHTER_RIGS extends ReadonlyMap<number, infer V> ? V : never), joint: RigJoint, look: string) {
  const name = look === 'classic' ? rig.classic[joint] : rig.pairs.find(pair => pair[0] === joint)?.[1];
  return name;
}
function verticesForNode(model: ReturnType<typeof parseSource>, objectId: number): Point[] {
  const weighted: { point: Point; weight: number }[] = [];
  for (const geoset of model.Geosets) for (let index = 0; index < geoset.Vertices.length / 3; index++) {
    let weight = 0;
    if (geoset.SkinWeights) {
      for (let slot = 0; slot < 4; slot++) if (geoset.SkinWeights[index * 8 + slot] === objectId) weight += geoset.SkinWeights[index * 8 + 4 + slot]! / 255;
    } else {
      const group = geoset.Groups[geoset.VertexGroup[index]!];
      if (group?.includes(objectId)) weight = 1 / group.length;
    }
    if (weight > 0) weighted.push({ point: point(geoset.Vertices.slice(index * 3, index * 3 + 3)), weight });
  }
  return weighted.filter(vertex => vertex.weight >= 0.1).map(vertex => vertex.point);
}

const rows: Row[] = [], unavailable: string[] = [];
for (const [character, rig] of FIGHTER_RIGS) {
  const weaponJoints = (['weapon', 'weapon.L'] as const).filter(joint => rig.classic[joint] !== undefined);
  if (weaponJoints.length === 0) continue;
  const fighter = fighters.get(character);
  if (fighter === undefined) throw new Error(`Missing fighter source ${character}`);
  const source = parseSource(await Bun.file(join(assets, fighter.source)).arrayBuffer());
  const clips = source.Sequences.map((sequence, index) => ({ sequence, clip: originalClip(character, index) }));
  const readyIndex = source.Sequences.findIndex(sequence => /stand ready/i.test(sequence.Name));
  const calibrationClip = clips[readyIndex]?.clip ?? clips[0]?.clip;
  if (calibrationClip === undefined) throw new Error(`${fighter.name}: no calibration clip`);
  const scale = characterModelScale(character as Character);
  for (const look of ['classic', 'definitive'] as const) {
    const firstClip = clips.find(entry => entry.clip !== undefined)?.clip;
    if (firstClip === undefined) throw new Error(`${fighter.name}/${look}: no shipped clips`);
    const bodyPath = firstClip.modelPath.replaceAll('\\', '/');
    const imports = join(assets, 'original-clips-static-lights', 'imports');
    const classicPath = join(imports, bodyPath);
    const definitivePath = join(imports, '_de.w3mod', bodyPath);
    const modelPath = look === 'definitive' && await Bun.file(definitivePath).exists() ? definitivePath : classicPath;
    const model = parseSource(await Bun.file(modelPath).arrayBuffer());
    const renderer = new ModelRenderer(model);
    renderer.setSequence(0);
    const data = Reflect.get(renderer, 'rendererData') as RendererSample;
    const seek = (seconds: number) => { data.frame = seconds * 1000; renderer.update(0); };
    const capsules: Capsule[] = [];
    const jointPairs: readonly (readonly [RigJoint, RigJoint, number])[] = [
      ['pelvis', 'chest', 0.22], ['head', 'head', 0.12], ['hip.L', 'knee.L', 0.16], ['knee.L', 'ankle.L', 0.13], ['hip.R', 'knee.R', 0.16], ['knee.R', 'ankle.R', 0.13],
    ];
    for (const [aJoint, bJoint, factor] of jointPairs) {
      const aName = bodyNode(rig, aJoint, look), bName = bodyNode(rig, bJoint, look);
      const a = aName === undefined ? undefined : nodeNamed(model, aName), b = bName === undefined ? undefined : nodeNamed(model, bName);
      if (a === undefined || b === undefined) continue;
      const chestName = bodyNode(rig, 'chest', look), chest = chestName === undefined ? undefined : nodeNamed(model, chestName);
      if (aJoint === bJoint && chest === undefined) continue;
      const length = aJoint === bJoint ? distance(nodePosition(model, data, a, scale), nodePosition(model, data, chest!, scale)) : distance(nodePosition(model, data, a, scale), nodePosition(model, data, b, scale));
      capsules.push({ name: `${aJoint}-${bJoint}`, a, b, radius: Math.max(3, Math.min(22, length * factor)) });
    }
    const weapons = [];
    seek(calibrationClip.startSeconds);
    for (const joint of weaponJoints) {
      const weaponName = bodyNode(rig, joint, look), handJoints: readonly RigJoint[] = ['wrist.R', 'wrist.L'];
      const weapon = weaponName === undefined ? undefined : nodeNamed(model, weaponName);
      const hand = handJoints.map(handJoint => {
        const name = bodyNode(rig, handJoint, look);
        return name === undefined ? undefined : nodeNamed(model, name);
      }).filter((node): node is NonNullable<typeof node> => node !== undefined).sort((a, b) => distance(nodePosition(model, data, a, scale), nodePosition(model, data, weapon!, scale)) - distance(nodePosition(model, data, b, scale), nodePosition(model, data, weapon!, scale)))[0];
      if (weapon === undefined || hand === undefined) { unavailable.push(`${fighter.name}/${look}/${joint}: missing weapon or wrist node`); continue; }
      const inverse = mat4.invert(mat4.create(), data.nodes[weapon.ObjectId]!.matrix);
      if (inverse === null) { unavailable.push(`${fighter.name}/${look}/${joint}: singular weapon matrix`); continue; }
      const grip = transform(mul(nodePosition(model, data, hand, 1 / scale), 1), inverse);
      const vertices = verticesForNode(model, weapon.ObjectId);
      if (vertices.length === 0) { unavailable.push(`${fighter.name}/${look}/${joint}: no weapon weighted vertices`); continue; }
      const tip = vertices.toSorted((a, b) => distance(b, grip) - distance(a, grip))[0]!;
      weapons.push({ joint, weapon, hand, grip, tip });
    }
    for (const { sequence, clip } of clips) {
      if (clip === undefined) throw new Error(`${fighter.name}/${look}/${sequence.Name}: sequence is not shipped`);
      const count = Math.ceil((clip.endSeconds - clip.startSeconds) * 60) + 1;
      let detached = 0, intersecting = 0, maxGap = 0, minClearance = Infinity;
      for (let frame = 0; frame < count; frame++) {
        const time = Math.min(clip.endSeconds, clip.startSeconds + frame / 60);
        seek(time);
        let frameDetached = false, frameIntersecting = false;
        for (const weapon of weapons) {
          const matrix = data.nodes[weapon.weapon.ObjectId]!.matrix;
          const grip = mul(transform(weapon.grip, matrix), scale), tip = mul(transform(weapon.tip, matrix), scale), hand = nodePosition(model, data, weapon.hand, scale);
          const gap = distance(grip, hand);
          maxGap = Math.max(maxGap, gap);
          frameDetached ||= gap > 4;
          const bladeStart = add(grip, mul(sub(tip, grip), 0.2));
          for (const capsule of capsules) {
            const clearance = segmentDistance(bladeStart, tip, nodePosition(model, data, capsule.a, scale), nodePosition(model, data, capsule.b, scale)) - capsule.radius;
            minClearance = Math.min(minClearance, clearance);
            frameIntersecting ||= clearance < 0;
          }
        }
        detached += Number(frameDetached);
        intersecting += Number(frameIntersecting);
      }
      const issue = weapons.length === weaponJoints.length ? '' : `${weapons.length}/${weaponJoints.length} props measured`;
      rows.push({ fighter: fighter.name, look, sequence: sequence.Name, samples: count, detached: weapons.length === 0 ? null : detached, intersecting: weapons.length === 0 || capsules.length === 0 ? null : intersecting, maxGap: Number.isFinite(maxGap) ? maxGap : null, minClearance: Number.isFinite(minClearance) ? minClearance : null, unavailable: issue });
    }
    console.log(`${fighter.name} ${look}: ${clips.length} sequences, ${weapons.length}/${weaponJoints.length} props, ${rows.filter(row => row.fighter === fighter.name && row.look === look).reduce((sum, row) => sum + row.samples, 0)} samples`);
  }
}

const summary = rows.reduce((totals, row) => ({ rows: totals.rows + 1, samples: totals.samples + row.samples, detached: totals.detached + (row.detached ?? 0), intersecting: totals.intersecting + (row.intersecting ?? 0), unavailableRows: totals.unavailableRows + Number(row.unavailable !== '' || row.detached === null || row.intersecting === null) }), { rows: 0, samples: 0, detached: 0, intersecting: 0, unavailableRows: 0 });
const lines = ['fighter\tlook\tsequence\tsamples\tframes detached\tframes intersecting\tmax grip gap\tmin capsule clearance\tunavailable', ...rows.map(row => [row.fighter, row.look, row.sequence, row.samples, row.detached ?? 'unavailable', row.intersecting ?? 'unavailable', row.maxGap?.toFixed(3) ?? 'unavailable', row.minClearance?.toFixed(3) ?? 'unavailable', row.unavailable].join('\t'))];
await Bun.write(join(out, 'grip-audit.tsv'), `${lines.join('\n')}\n`);
await Bun.write(join(out, 'grip-audit.json'), `${JSON.stringify({ method: '60 Hz samples including the final endpoint; grip point calibrated from Stand Ready; farthest weighted vertex as weapon tip; fixed joint-following capsules with radii scaled from adjacent joints; geometric rows are candidates pending visual acceptance', summary, unavailable, rows }, null, 2)}\n`);
console.log(lines[0]);
console.log(`TOTAL ${JSON.stringify(summary)}`);
console.log(`OUTPUT ${out}`);
if (unavailable.length > 0 || summary.unavailableRows > 0) process.exitCode = 2;
