import { mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { mat4, vec3 } from '../../ts/node_modules/gl-matrix';
import { ModelRenderer } from '../../ts/node_modules/war3-model';
import { originalClip } from '../../ts/src/generated/clips/fighterOriginalClipInfo';
import { Character } from '../../ts/src/game/sim/codes';
import { characterModelScale } from '../../ts/src/game/presentation/modelScale';
import { FIGHTER_RIGS } from './rigs';
import { parseSource } from './original-clips';
import { fighters } from '../../ts/scripts/heroModelSource';
import { LIMB_CAPSULES, add, bladeStart, capsuleRadius, distance, mul, segmentDistance, sub, type Point } from './limb-capsules';

const [assetsArg, outArg] = process.argv.slice(2);
const project = resolve(import.meta.dir, '../..');
if (!assetsArg || !outArg) throw new Error('usage: bun tools/animations/grip-audit.ts PRIVATE_ASSETS PRIVATE_OUTPUT');
const assets = resolve(assetsArg), out = resolve(outArg);
if (!relative(project, out).startsWith('..')) throw new Error('Grip audit output stays in private storage');
mkdirSync(out, { recursive: true });

type NodeSample = { readonly matrix: Float32Array };
type RendererSample = { frame: number; nodes: NodeSample[] };
type RigJoint = 'pelvis' | 'chest' | 'head' | 'hip.L' | 'knee.L' | 'ankle.L' | 'hip.R' | 'knee.R' | 'ankle.R' | 'wrist.L' | 'wrist.R' | 'weapon' | 'weapon.L';
type Row = { fighter: string; look: string; sequence: string; samples: number; detached: number | null; detachedBy: string; intersecting: number | null; maxGap: number | null; minClearance: number | null; worstGapSeconds: number; worstClearanceSeconds: number; unavailable: string };
type Capsule = { name: string; a: NonNullable<ReturnType<typeof nodeNamed>>; b: NonNullable<ReturnType<typeof nodeNamed>>; radius: number };

function nodeNamed(model: ReturnType<typeof parseSource>, name: string) {
  return model.Nodes.find(node => node?.Name === name);
}
function descendsFrom(model: ReturnType<typeof parseSource>, node: NonNullable<ReturnType<typeof nodeNamed>>, ancestor: NonNullable<ReturnType<typeof nodeNamed>>): boolean {
  for (let current = node; (current.Parent ?? -1) >= 0;) {
    const parent = model.Nodes.find(candidate => candidate?.ObjectId === current.Parent);
    if (parent === undefined) return false;
    if (parent === ancestor) return true;
    current = parent;
  }
  return false;
}
function point(value: ArrayLike<number>): Point { return [value[0]!, value[1]!, value[2]!]; }
function transform(value: ArrayLike<number>, matrix: ArrayLike<number>): Point {
  return point(vec3.transformMat4(vec3.create(), value as vec3, matrix as mat4));
}
function nodePosition(model: ReturnType<typeof parseSource>, data: RendererSample, node: NonNullable<ReturnType<typeof nodeNamed>>, scale: number): Point {
  return mul(transform(model.PivotPoints[node.ObjectId]!, data.nodes[node.ObjectId]!.matrix), scale);
}
function bodyNode(rig: (typeof FIGHTER_RIGS extends ReadonlyMap<number, infer V> ? V : never), joint: RigJoint) {
  return rig.classic[joint];
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
function geosetMesh(model: ReturnType<typeof parseSource>, index: number) {
  const geoset = model.Geosets[index];
  if (geoset === undefined) return undefined;
  const bones = new Set<number>(), count = geoset.Vertices.length / 3;
  for (let vertex = 0; vertex < count; vertex++) {
    if (geoset.SkinWeights) { for (let slot = 0; slot < 4; slot++) if (geoset.SkinWeights[vertex * 8 + 4 + slot]! > 0) bones.add(geoset.SkinWeights[vertex * 8 + slot]!); }
    else for (const bone of geoset.Groups[geoset.VertexGroup[vertex]!] ?? []) bones.add(bone);
  }
  const node = bones.size === 1 ? model.Nodes[[...bones][0]!] : undefined;
  if (node === undefined) return undefined;
  return { node, vertices: Array.from({ length: count }, (_, vertex) => point(geoset.Vertices.slice(vertex * 3, vertex * 3 + 3))) };
}

const rows: Row[] = [], unavailable: string[] = [];
for (const [character, rig] of FIGHTER_RIGS) {
  const weaponJoints = (['weapon', 'weapon.L'] as const).filter(joint => rig.classic[joint] !== undefined);
  if (weaponJoints.length === 0) continue;
  const fighter = fighters.get(character);
  if (fighter === undefined) throw new Error(`Missing fighter source ${character}`);
  const source = parseSource(await Bun.file(join(assets, fighter.source)).arrayBuffer());
  const clips = source.Sequences.map((sequence, index) => ({ sequence, clip: originalClip(character, index) }));
  const calibrationIndex = [/stand ready/i, /^stand$/i].map(name => source.Sequences.findIndex(sequence => name.test(sequence.Name.trim()))).find(index => index >= 0) ?? 0;
  const calibrationClip = clips[calibrationIndex]?.clip;
  if (calibrationClip === undefined) throw new Error(`${fighter.name}: no calibration clip`);
  const scale = characterModelScale(character as Character);
  {
    const look = 'classic';
    const firstClip = clips.find(entry => entry.clip !== undefined)?.clip;
    if (firstClip === undefined) throw new Error(`${fighter.name}/${look}: no shipped clips`);
    const bodyPath = firstClip.modelPath.replaceAll('\\', '/');
    const imports = join(assets, 'original-clips-static-lights', 'imports');
    const modelPath = join(imports, bodyPath);
    const model = parseSource(await Bun.file(modelPath).arrayBuffer());
    const renderer = new ModelRenderer(model);
    renderer.setSequence(0);
    const data = Reflect.get(renderer, 'rendererData') as RendererSample;
    const seek = (seconds: number) => { data.frame = seconds * 1000; renderer.update(0); };
    const capsules: Capsule[] = [];
    for (const [aJoint, bJoint, factor] of LIMB_CAPSULES) {
      const aName = bodyNode(rig, aJoint), bName = bodyNode(rig, bJoint);
      const a = aName === undefined ? undefined : nodeNamed(model, aName), b = bName === undefined ? undefined : nodeNamed(model, bName);
      if (a === undefined || b === undefined) continue;
      const chestName = bodyNode(rig, 'chest'), chest = chestName === undefined ? undefined : nodeNamed(model, chestName);
      if (aJoint === bJoint && chest === undefined) continue;
      const length = aJoint === bJoint ? distance(nodePosition(model, data, a, scale), nodePosition(model, data, chest!, scale)) : distance(nodePosition(model, data, a, scale), nodePosition(model, data, b, scale));
      capsules.push({ name: `${aJoint}-${bJoint}`, a, b, radius: capsuleRadius(length, factor) });
    }
    const weapons = [];
    seek(calibrationClip.startSeconds);
    for (const joint of weaponJoints) {
      const weaponName = bodyNode(rig, joint), handJoints: readonly RigJoint[] = ['wrist.R', 'wrist.L'];
      const geoset = rig.weaponGeosets?.[joint], mesh = geoset === undefined ? undefined : geosetMesh(model, geoset);
      if (geoset !== undefined && mesh === undefined) { unavailable.push(`${fighter.name}/${look}/${joint}: geoset ${geoset} is not skinned to one bone`); continue; }
      const weapon = mesh?.node ?? (weaponName === undefined ? undefined : nodeNamed(model, weaponName));
      const hands = handJoints.map(handJoint => {
        const name = bodyNode(rig, handJoint);
        return name === undefined ? undefined : nodeNamed(model, name);
      }).filter((node): node is NonNullable<typeof node> => node !== undefined);
      const hand = weapon === undefined ? undefined : hands.find(node => descendsFrom(model, weapon, node)) ?? hands.sort((a, b) => distance(nodePosition(model, data, a, scale), nodePosition(model, data, weapon, scale)) - distance(nodePosition(model, data, b, scale), nodePosition(model, data, weapon, scale)))[0];
      if (weapon === undefined || hand === undefined) { unavailable.push(`${fighter.name}/${look}/${joint}: missing weapon or wrist node`); continue; }
      const inverse = mat4.invert(mat4.create(), data.nodes[weapon.ObjectId]!.matrix);
      if (inverse === null) { unavailable.push(`${fighter.name}/${look}/${joint}: singular weapon matrix`); continue; }
      const grip = transform(nodePosition(model, data, hand, 1), inverse);
      const vertices = mesh?.vertices ?? verticesForNode(model, weapon.ObjectId);
      if (vertices.length === 0) { unavailable.push(`${fighter.name}/${look}/${joint}: no weapon weighted vertices`); continue; }
      const tip = vertices.toSorted((a, b) => distance(b, grip) - distance(a, grip))[0]!;
      weapons.push({ joint, weapon, hand, grip, tip });
    }
    for (const { sequence, clip } of clips) {
      if (clip === undefined) throw new Error(`${fighter.name}/${look}/${sequence.Name}: sequence is not shipped`);
      const count = Math.ceil((clip.endSeconds - clip.startSeconds) * 60) + 1;
      const propDetached = new Map(weapons.map(weapon => [weapon.joint, 0]));
      let detached = 0, intersecting = 0, maxGap = 0, minClearance = Infinity, worstGapSeconds = clip.startSeconds, worstClearanceSeconds = clip.startSeconds;
      for (let frame = 0; frame < count; frame++) {
        const time = Math.min(clip.endSeconds, clip.startSeconds + frame / 60);
        seek(time);
        let frameDetached = false, frameIntersecting = false;
        for (const weapon of weapons) {
          const matrix = data.nodes[weapon.weapon.ObjectId]!.matrix;
          if (Math.cbrt(Math.abs(mat4.determinant(matrix as mat4))) < 0.5) continue;
          const grip = mul(transform(weapon.grip, matrix), scale), tip = mul(transform(weapon.tip, matrix), scale), hand = nodePosition(model, data, weapon.hand, scale);
          const gap = distance(grip, hand);
          if (gap > maxGap) { maxGap = gap; worstGapSeconds = time; }
          frameDetached ||= gap > 4;
          if (gap > 4) propDetached.set(weapon.joint, (propDetached.get(weapon.joint) ?? 0) + 1);
          for (const capsule of capsules) {
            const clearance = segmentDistance(bladeStart(grip, tip), tip, nodePosition(model, data, capsule.a, scale), nodePosition(model, data, capsule.b, scale)) - capsule.radius;
            if (clearance < minClearance) { minClearance = clearance; worstClearanceSeconds = time; }
            frameIntersecting ||= clearance < 0;
          }
        }
        detached += Number(frameDetached);
        intersecting += Number(frameIntersecting);
      }
      const issue = weapons.length === weaponJoints.length ? '' : `${weapons.length}/${weaponJoints.length} props measured`;
      rows.push({ fighter: fighter.name, look, sequence: sequence.Name, samples: count, detached: weapons.length === 0 ? null : detached, detachedBy: [...propDetached].map(([joint, frames]) => `${joint} ${frames}`).join(", "), intersecting: weapons.length === 0 || capsules.length === 0 ? null : intersecting, maxGap: Number.isFinite(maxGap) ? maxGap : null, minClearance: Number.isFinite(minClearance) ? minClearance : null, worstGapSeconds, worstClearanceSeconds, unavailable: issue });
    }
    console.log(`${fighter.name} ${look}: ${clips.length} sequences, ${weapons.length}/${weaponJoints.length} props, ${rows.filter(row => row.fighter === fighter.name && row.look === look).reduce((sum, row) => sum + row.samples, 0)} samples`);
  }
}

const summary = rows.reduce((totals, row) => ({ rows: totals.rows + 1, samples: totals.samples + row.samples, detached: totals.detached + (row.detached ?? 0), intersecting: totals.intersecting + (row.intersecting ?? 0), unavailableRows: totals.unavailableRows + Number(row.unavailable !== '' || row.detached === null || row.intersecting === null) }), { rows: 0, samples: 0, detached: 0, intersecting: 0, unavailableRows: 0 });
const lines = ['fighter\tlook\tsequence\tsamples\tframes detached\tdetached by prop\tframes intersecting\tmax grip gap\tmin capsule clearance\tunavailable', ...rows.map(row => [row.fighter, row.look, row.sequence, row.samples, row.detached ?? 'unavailable', row.detachedBy, row.intersecting ?? 'unavailable', row.maxGap?.toFixed(3) ?? 'unavailable', row.minClearance?.toFixed(3) ?? (row.intersecting === 0 ? 'hidden' : 'unavailable'), row.unavailable].join('\t'))];
await Bun.write(join(out, 'grip-audit.tsv'), `${lines.join('\n')}\n`);
await Bun.write(join(out, 'grip-audit.json'), `${JSON.stringify({ method: '60 Hz samples including the final endpoint; grip point calibrated from Stand Ready, else Stand; farthest weighted vertex as weapon tip; a weapon whose bone is scaled below half size is hidden and unmeasured; fixed joint-following capsules with radii scaled from adjacent joints; geometric rows are candidates pending visual acceptance', summary, unavailable, rows }, null, 2)}\n`);
console.log(lines[0]);
console.log(`TOTAL ${JSON.stringify(summary)}`);
console.log(`OUTPUT ${out}`);
if (unavailable.length > 0 || summary.unavailableRows > 0) process.exitCode = 2;
