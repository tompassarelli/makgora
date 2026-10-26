import { mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ModelRenderer } from '../../ts/node_modules/war3-model';
import { originalClip } from '../../ts/src/generated/clips/fighterOriginalClipInfo';
import { Character } from '../../ts/src/game/sim/codes';
import { characterModelScale } from '../../ts/src/game/presentation/modelScale';
import { encodePng } from '../../ts/scripts/wisp/hurtboxView';
import { fighters } from '../../ts/scripts/heroModelSource';
import { FIGHTER_RIGS } from './rigs';
import { parseSource } from './original-clips';

const [auditArg, fighterArg, outArg, assetsArg, ...only] = process.argv.slice(2);
const project = resolve(import.meta.dir, '../..');
if (!auditArg || !fighterArg || !outArg || !assetsArg) throw new Error('usage: bun tools/animations/grip-zoom-strips.ts GRIP_AUDIT_JSON FIGHTER PRIVATE_OUTPUT PRIVATE_ASSETS [SEQUENCE]...');
const out = resolve(outArg);
if (!relative(project, out).startsWith('..')) throw new Error('Grip zoom strips stay in private storage');
mkdirSync(out, { recursive: true });

type Model = ReturnType<typeof parseSource>;
type RendererSample = { frame: number; nodes: { matrix: Float32Array }[]; geosetAlpha: number[] };
type Row = { fighter: string; sequence: string; samples: number; detached: number | null; intersecting: number | null; worstClearanceSeconds: number };
type View = { readonly name: string; readonly project: (x: number, y: number, z: number) => readonly [number, number, number] };
type Panel = { rgb: Uint8Array; contact: number; parts: Map<number, number>; bodyDepth: Float32Array; size: number };

const PIXELS_PER_UNIT = 4, MARGIN = 6, CROSSING_STEP = 3, SAMPLE_UNITS = 1, INSIDE_UNITS = 1;
const VIEWS: readonly View[] = [
  { name: 'side', project: (x, y, z) => [x, -z, -y] },
  { name: 'far side', project: (x, y, z) => [-x, -z, y] },
  { name: 'front', project: (x, y, z) => [-y, -z, x] },
  { name: 'top', project: (x, y, z) => [x, y, z] },
];
const AXES: readonly View[] = [...VIEWS.slice(0, 2), { name: 'back', project: (x, y, z) => [y, -z, -x] }, { name: 'bottom', project: (x, y, z) => [x, -y, -z] }, ...VIEWS.slice(2)];
const BODY = [150, 150, 165], ARM = [205, 205, 215], CONTACT = [255, 220, 0], BACKGROUND = 250;
const WEAPON_COLORS = [[225, 50, 30], [30, 90, 230]] as const;

const entry = [...fighters].find(([, fighter]) => fighter.name.replaceAll(' ', '') === fighterArg.replaceAll(' ', ''));
if (entry === undefined) throw new Error(`unknown fighter ${fighterArg}`);
const [character, fighter] = entry;
const rig = FIGHTER_RIGS.get(character)?.classic;
if (rig === undefined) throw new Error(`${fighter.name}: no Classic rig`);
const weaponGeosets = FIGHTER_RIGS.get(character)?.weaponGeosets ?? {};
const scale = characterModelScale(character as Character);
const source = parseSource(await Bun.file(join(assetsArg, fighter.source)).arrayBuffer());
const body = originalClip(character, 0);
if (body === undefined) throw new Error(`${fighter.name}: no shipped clips`);
const model: Model = parseSource(await Bun.file(join(assetsArg, 'original-clips-static-lights', 'imports', body.modelPath.replaceAll('\\', '/'))).arrayBuffer());
const renderer = new ModelRenderer(model);
renderer.setSequence(0);
const data = Reflect.get(renderer, 'rendererData') as RendererSample;
const nodeId = (name: string | undefined) => name === undefined ? -1 : model.Nodes.findIndex(node => node?.Name === name);
const parentOf = (id: number) => model.Nodes.findIndex(node => node !== undefined && node.ObjectId === model.Nodes[id]?.Parent);
const under = (id: number, ancestor: number): boolean => { for (let current = id; current >= 0; current = parentOf(current)) if (current === ancestor) return true; return false; };
const arms = (['shoulder.L', 'shoulder.R'] as const).map(joint => nodeId(rig[joint])).filter(id => id >= 0);
const weaponNodes = (['weapon', 'weapon.L'] as const).map(joint => weaponGeosets[joint] === undefined ? nodeId(rig[joint]) : -1);
const pelvis = nodeId(rig.pelvis);
const visible = model.Geosets.flatMap((geoset, index) => model.Materials[geoset.MaterialID]?.Layers.some(layer => Number(layer.FilterMode) <= 2) ? [index] : []);

function influences(geoset: Model['Geosets'][number], vertex: number): [number, number][] {
  if (geoset.SkinWeights) return [0, 1, 2, 3].map((slot): [number, number] => [geoset.SkinWeights![vertex * 8 + slot]!, geoset.SkinWeights![vertex * 8 + 4 + slot]! / 255]).filter(([, weight]) => weight > 0);
  const group = geoset.Groups[geoset.VertexGroup[vertex]!] ?? [];
  return group.map((id): [number, number] => [id, 1 / group.length]);
}

const classes = new Map(visible.map(index => {
  const geoset = model.Geosets[index]!;
  return [index, Uint8Array.from({ length: geoset.Vertices.length / 3 }, (_, vertex) => {
    const weights = influences(geoset, vertex);
    for (const [slot, joint] of (['weapon', 'weapon.L'] as const).entries()) {
      if (weaponGeosets[joint] === index) return 2 + slot;
      if (weaponNodes[slot]! >= 0 && weights.some(([id, weight]) => id === weaponNodes[slot] && weight >= 0.5)) return 2 + slot;
    }
    const dominant = weights.toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
    return arms.some(arm => under(dominant, arm)) ? 1 : 0;
  })];
}));

function pose(seconds: number) {
  data.frame = seconds * 1000;
  renderer.update(0);
  const m = data.nodes[pelvis]!.matrix, p = model.PivotPoints[pelvis]!;
  const center = [0, 1, 2].map(axis => (m[axis]! * p[0]! + m[4 + axis]! * p[1]! + m[8 + axis]! * p[2]! + m[12 + axis]!) * scale);
  return visible.filter(index => (data.geosetAlpha[index] ?? 1) > 0).map(index => {
    const geoset = model.Geosets[index]!, count = geoset.Vertices.length / 3, points = new Float32Array(count * 3);
    for (let vertex = 0; vertex < count; vertex++) {
      const x = geoset.Vertices[vertex * 3]!, y = geoset.Vertices[vertex * 3 + 1]!, z = geoset.Vertices[vertex * 3 + 2]!;
      for (const [id, weight] of influences(geoset, vertex)) {
        const n = data.nodes[id]!.matrix;
        for (let axis = 0; axis < 3; axis++) points[vertex * 3 + axis]! += (n[axis]! * x + n[4 + axis]! * y + n[8 + axis]! * z + n[12 + axis]!) * weight * scale;
      }
      for (let axis = 0; axis < 3; axis++) points[vertex * 3 + axis]! -= center[axis]!;
    }
    return { faces: geoset.Faces, points, kinds: classes.get(index)!, nodes: Int32Array.from({ length: count }, (_, vertex) => influences(geoset, vertex).toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? -1) };
  });
}

function render(meshes: ReturnType<typeof pose>, view: View, half: number): Panel {
  const size = Math.ceil(half * 2 * PIXELS_PER_UNIT), pixels = size * size;
  const rgb = new Uint8Array(pixels * 3).fill(BACKGROUND), nearest = new Float32Array(pixels).fill(-Infinity), bodyDepth = new Float32Array(pixels).fill(-Infinity), weaponDepth = new Float32Array(pixels).fill(-Infinity);
  const kind = new Uint8Array(pixels), bodyNode = new Int32Array(pixels);
  for (const { faces, points, kinds, nodes } of meshes) {
    const screen = (vertex: number) => {
      const [u, v, depth] = view.project(points[vertex * 3]!, points[vertex * 3 + 1]!, points[vertex * 3 + 2]!);
      return [(u + half) * PIXELS_PER_UNIT, (v + half) * PIXELS_PER_UNIT, depth] as const;
    };
    for (let face = 0; face + 2 < faces.length; face += 3) {
      const corners = [faces[face]!, faces[face + 1]!, faces[face + 2]!];
      const weaponHits = corners.filter(vertex => kinds[vertex]! >= 2);
      const faceKind = weaponHits.length >= 2 ? kinds[weaponHits[0]!]! : corners.filter(vertex => kinds[vertex] === 0).length >= 2 ? 0 : 1;
      const [a, b, c] = corners.map(screen) as [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-6) continue;
      for (let y = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))); y <= Math.min(size - 1, Math.ceil(Math.max(a[1], b[1], c[1]))); y++)
        for (let x = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))); x <= Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], c[0]))); x++) {
          const w0 = ((b[0] - x) * (c[1] - y) - (b[1] - y) * (c[0] - x)) / area, w1 = ((c[0] - x) * (a[1] - y) - (c[1] - y) * (a[0] - x)) / area, w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const depth = w0 * a[2] + w1 * b[2] + w2 * c[2], pixel = y * size + x;
          if (faceKind >= 2) weaponDepth[pixel] = Math.max(weaponDepth[pixel]!, depth);
          else if (faceKind === 0 && depth > bodyDepth[pixel]!) { bodyDepth[pixel] = depth; bodyNode[pixel] = nodes[corners[0]!]!; }
          if (depth <= nearest[pixel]!) continue;
          nearest[pixel] = depth;
          kind[pixel] = faceKind + 1;
        }
    }
  }
  const gap = (pixel: number) => weaponDepth[pixel]! - bodyDepth[pixel]!;
  const crossing = new Uint8Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel++) for (const next of [pixel + 1, pixel + size]) {
    if (next >= pixels || next % size === 0 && next === pixel + 1) continue;
    const here = gap(pixel), there = gap(next);
    if (Number.isFinite(here) && Number.isFinite(there) && Math.sign(here) !== Math.sign(there) && Math.abs(here - there) <= CROSSING_STEP) crossing[pixel] = crossing[next] = 1;
  }
  let contact = 0;
  const parts = new Map<number, number>();
  for (let pixel = 0; pixel < pixels; pixel++) {
    if (kind[pixel] === 0) continue;
    const touching = crossing[pixel] === 1;
    contact += Number(touching);
    if (touching) parts.set(bodyNode[pixel]!, (parts.get(bodyNode[pixel]!) ?? 0) + 1);
    const color = touching ? CONTACT : kind[pixel]! >= 3 ? WEAPON_COLORS[kind[pixel]! - 3]! : kind[pixel] === 2 ? ARM : BODY;
    const shade = touching ? 1 : Math.max(0.45, Math.min(1, 0.75 + nearest[pixel]! / (half * 2)));
    for (let channel = 0; channel < 3; channel++) rgb[pixel * 3 + channel] = Math.round(color[channel]! * shade);
  }
  return { rgb, contact, parts, bodyDepth, size };
}

function penetration(meshes: ReturnType<typeof pose>, half: number): number {
  const maps = AXES.map(view => ({ view, ...render(meshes, view, half) }));
  let deepest = 0;
  const inside = (x: number, y: number, z: number) => Math.min(...maps.map(({ view, bodyDepth, size }) => {
    const [u, v, depth] = view.project(x, y, z), column = Math.round((u + half) * PIXELS_PER_UNIT), row = Math.round((v + half) * PIXELS_PER_UNIT);
    return column < 0 || row < 0 || column >= size || row >= size ? -Infinity : bodyDepth[row * size + column]! - depth;
  }));
  for (const { faces, points, kinds } of meshes) for (let face = 0; face + 2 < faces.length; face += 3) {
    const corners = [faces[face]!, faces[face + 1]!, faces[face + 2]!];
    if (corners.filter(vertex => kinds[vertex]! >= 2).length < 2) continue;
    const at = (vertex: number, axis: number) => points[vertex * 3 + axis]!;
    const edge = Math.max(...[0, 1, 2].map(k => Math.hypot(...[0, 1, 2].map(axis => at(corners[k]!, axis) - at(corners[(k + 1) % 3]!, axis)))));
    const steps = Math.max(1, Math.ceil(edge / SAMPLE_UNITS));
    for (let i = 0; i <= steps; i++) for (let j = 0; i + j <= steps; j++) {
      const [w0, w1] = [i / steps, j / steps], w2 = 1 - w0 - w1;
      const point = [0, 1, 2].map(axis => w0 * at(corners[0]!, axis) + w1 * at(corners[1]!, axis) + w2 * at(corners[2]!, axis)) as [number, number, number];
      deepest = Math.max(deepest, inside(...point));
    }
  }
  return deepest;
}

function extent(meshes: ReturnType<typeof pose>): number {
  let reach = 0;
  for (const { points } of meshes) for (let index = 0; index < points.length; index++) reach = Math.max(reach, Math.abs(points[index]!));
  return reach + MARGIN;
}

const { rows } = await Bun.file(auditArg).json() as { rows: Row[] };
const flagged = rows.filter(row => row.fighter === fighter.name && (only.length > 0 ? only.includes(row.sequence) : (row.detached ?? 0) > 0 || (row.intersecting ?? 0) > 0));
const lines = ['sequence\tframes\tframes with a blade crossing the body surface\tbody parts crossed most\tframes with a blade more than ${INSIDE_UNITS} unit inside the body\tdeepest blade point inside the body\tstrip seconds\tstrip'];
for (const row of flagged) {
  const index = source.Sequences.findIndex(sequence => sequence.Name === row.sequence);
  const clip = originalClip(character, index);
  if (clip === undefined) throw new Error(`${fighter.name}/${row.sequence}: sequence is not shipped`);
  const count = Math.ceil((clip.endSeconds - clip.startSeconds) * 60) + 1;
  const crossed = new Map<number, number>();
  let touching = 0, buried = 0, deepest = 0, worst = 0, worstSeconds = row.worstClearanceSeconds;
  for (let frame = 0; frame < count; frame++) {
    const seconds = Math.min(clip.endSeconds, clip.startSeconds + frame / 60), meshes = pose(seconds), half = extent(meshes);
    const panels = VIEWS.map(view => render(meshes, view, half)), contact = Math.max(...panels.map(panel => panel.contact));
    for (const panel of panels) for (const [node, pixels] of panel.parts) crossed.set(node, (crossed.get(node) ?? 0) + pixels);
    const depth = penetration(meshes, half);
    touching += Number(contact > 0);
    buried += Number(depth > INSIDE_UNITS);
    if (depth > deepest || deepest === 0 && contact > worst) { deepest = depth; worst = contact; worstSeconds = seconds; }
  }
  const meshes = pose(worstSeconds), half = extent(meshes), size = Math.ceil(half * 2 * PIXELS_PER_UNIT);
  const sheet = new Uint8Array(size * VIEWS.length * size * 3);
  VIEWS.forEach((view, column) => {
    const { rgb } = render(meshes, view, half);
    for (let y = 0; y < size; y++) sheet.set(rgb.subarray(y * size * 3, (y + 1) * size * 3), (y * size * VIEWS.length + column * size) * 3);
  });
  const name = join(out, `${row.sequence.replaceAll(/[^A-Za-z0-9]+/g, '-')}.png`);
  await Bun.write(name, encodePng(size * VIEWS.length, size, sheet));
  const caption = `${fighter.name} ${row.sequence} at ${worstSeconds.toFixed(3)} s: blade crosses the body surface in ${touching}/${count} frames, lies over ${INSIDE_UNITS} unit inside it in ${buried}, deepest ${deepest.toFixed(1)} units; ${VIEWS.map(view => view.name).join(', ')}`;
  const labelled = Bun.spawnSync(['magick', name, '-background', '#101522', '-fill', 'white', '-font', 'DejaVu-Sans', '-pointsize', '16', '-gravity', 'south', '-splice', '0x26', '-annotate', '+0+4', caption, name]);
  if (labelled.exitCode !== 0) throw new Error(`magick: ${labelled.stderr.toString()}`);
  lines.push([row.sequence, count, touching, [...crossed].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([node]) => model.Nodes[node]?.Name ?? node).join(', '), buried, deepest.toFixed(2), worstSeconds.toFixed(3), name].join('\t'));
  console.log(lines.at(-1));
}
await Bun.write(join(out, 'grip-zoom.tsv'), `${lines.join('\n')}\n`);
console.log(`OUTPUT ${out}`);
