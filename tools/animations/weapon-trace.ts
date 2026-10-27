import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Effect } from 'effect';
import type { Character } from '../../ts/src/game/sim/codes';
import type { Capsule } from '../../ts/src/game/sim/geometry/contactGeometry';
import { SELECTABLE_CHARACTERS, fighterSlug } from '../../ts/src/game/roster/kits';
import { LIMB_STRIKES, SPELL_STRIKES, type SampledMove, loadBody, sampleFighter } from '../../ts/scripts/wisp/animScoreSample';
import type { DrawnModel } from '../../ts/scripts/wisp/drawnModel';
import { assetsView, readManifest } from '../../ts/scripts/wisp/buildInputs';
import { FIGHTER_RIGS } from './rigs';

const GAP_LIMIT = 20.0;
const BODY_CENTRE: Point = [0, 60];
const USAGE = 'usage: bun tools/animations/weapon-trace.ts [--fighter SLUG]... [--assets DIR] [--shift FIGHTER:MOVE:DX]';

type Point = readonly [number, number];
type Weapon = { readonly name: string; readonly hand: number; readonly vertices: readonly number[] };
type Edge = { readonly grip: Point; readonly tip: Point };
type Shift = { readonly fighter: string; readonly move: string; readonly dx: number };
type Gap = { readonly gap: number; readonly frame: number; readonly at: Point };
type Row = { readonly fighter: string; readonly move: string; readonly weapons: string; readonly frames: readonly number[]; readonly tip: Gap; readonly reach: Gap; readonly by: 'weapon' | 'limb' | 'spell'; readonly shifted: boolean };

const fails = (row: Row) => row.by === 'weapon' && Math.max(row.tip.gap, row.reach.gap) > GAP_LIMIT;
const worst = (row: Row) => Math.max(row.tip.gap, row.reach.gap);

function segmentDistance(p: Point, a: Point, b: Point): number {
  const ux = b[0] - a[0], uz = b[1] - a[1], length = ux * ux + uz * uz;
  const t = length <= 1e-8 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * ux + (p[1] - a[1]) * uz) / length));
  return Math.hypot(p[0] - a[0] - ux * t, p[1] - a[1] - uz * t);
}
const outside = (p: Point, capsule: Capsule) => Math.max(0, segmentDistance(p, [capsule.x1, capsule.z1], [capsule.x2, capsule.z2]) - capsule.radius);
const fromCentre = (p: Point) => Math.hypot(p[0] - BODY_CENTRE[0], p[1] - BODY_CENTRE[1]);
function farEnd(capsule: Capsule): Point {
  const a: Point = [capsule.x1, capsule.z1], b: Point = [capsule.x2, capsule.z2];
  return fromCentre(b) >= fromCentre(a) ? b : a;
}

function rigWeapons(model: DrawnModel, character: Character): Weapon[] {
  const rig = FIGHTER_RIGS.get(character)?.classic;
  if (rig === undefined) return [];
  const nodes = model.nodes(), names = nodes.map(node => node.name);
  const wrists = (['wrist.R', 'wrist.L'] as const).map(joint => names.indexOf(rig[joint] ?? '')).filter(index => index >= 0);
  return (['weapon', 'weapon.L'] as const).flatMap(joint => {
    const name = rig[joint], node = name === undefined ? -1 : names.indexOf(name);
    if (name === undefined || node < 0) return [];
    let held: number | undefined;
    for (let at: number | undefined = node; at !== undefined && held === undefined; at = nodes[at]?.parent) if (wrists.includes(at)) held = at;
    const hand = held ?? (joint === 'weapon.L' ? wrists[1] ?? wrists[0] : wrists[0]);
    const vertices = Array.from(model.influencedBy(new Set([name]))).flatMap((inside, index) => inside === 1 ? [index] : []);
    return hand === undefined || vertices.length === 0 ? [] : [{ name, hand, vertices }];
  });
}

function edgeAt(model: DrawnModel, weapon: Weapon, seconds: number): Edge {
  const posed = model.posed(0, seconds, 1);
  const hand: Point = [posed.nodes[weapon.hand * 2] ?? 0, posed.nodes[weapon.hand * 2 + 1] ?? 0];
  let tip = hand, grip = hand, far = -1, near = Infinity;
  for (const index of weapon.vertices) {
    const point: Point = [posed.vertices[index * 2] ?? 0, posed.vertices[index * 2 + 1] ?? 0];
    const distance = Math.hypot(point[0] - hand[0], point[1] - hand[1]);
    if (distance > far) { far = distance; tip = point; }
    if (distance < near) { near = distance; grip = point; }
  }
  return { grip, tip };
}

function tipGap(frames: readonly number[], regions: readonly (readonly Capsule[])[], edges: readonly (readonly Edge[])[]): Gap {
  let found: Gap | undefined;
  frames.forEach((frame, index) => {
    const nearest = (edges[index] ?? []).map(edge => ({ gap: Math.min(...(regions[index] ?? []).map(capsule => outside(edge.tip, capsule))), frame, at: edge.tip }))
      .toSorted((a, b) => a.gap - b.gap)[0];
    if (nearest !== undefined && (found === undefined || nearest.gap > found.gap)) found = nearest;
  });
  return found ?? { gap: 0, frame: frames[0] ?? 0, at: [0, 0] };
}

function reachGap(frames: readonly number[], regions: readonly (readonly Capsule[])[], edges: readonly (readonly Edge[])[]): Gap {
  const path = edges.flat();
  let found: Gap | undefined;
  frames.forEach((frame, index) => {
    for (const capsule of regions[index] ?? []) {
      const end = farEnd(capsule);
      const gap = Math.max(0, Math.min(...path.map(edge => segmentDistance(end, edge.grip, edge.tip))) - capsule.radius);
      if (found === undefined || gap > found.gap) found = { gap, frame, at: end };
    }
  });
  return found ?? { gap: 0, frame: frames[0] ?? 0, at: [0, 0] };
}

function traceMove(model: DrawnModel, fighter: string, weapons: readonly Weapon[], sampled: SampledMove, shift: Shift | undefined): Row | undefined {
  const { firstActive, lastActive } = sampled.sample;
  const frames = Array.from({ length: lastActive - firstActive + 1 }, (_, index) => firstActive + index).filter(frame => (sampled.strikes[frame]?.length ?? 0) > 0);
  if (frames.length === 0) return undefined;
  const shifted = shift !== undefined && shift.fighter === fighter && shift.move === sampled.move;
  const regions = frames.map((frame, index) => (sampled.strikes[frame] ?? []).map((capsule, slot) =>
    shifted && index === 0 && slot === 0 ? { ...capsule, x1: capsule.x1 + shift.dx, x2: capsule.x2 + shift.dx } : capsule));
  const edges = frames.map(frame => weapons.map(weapon => edgeAt(model, weapon, sampled.seconds[frame] ?? 0)));
  return {
    fighter, move: sampled.move, weapons: weapons.map(weapon => weapon.name).join('+'), frames,
    tip: tipGap(frames, regions, edges), reach: reachGap(frames, regions, edges),
    by: LIMB_STRIKES[fighter]?.includes(sampled.move) === true ? 'limb' : SPELL_STRIKES[fighter]?.includes(sampled.move) === true ? 'spell' : 'weapon', shifted,
  };
}

function parseArgs(args: readonly string[]): { fighters: Character[]; assets: string | undefined; shift: Shift | undefined } {
  const fighters: Character[] = [];
  let assets: string | undefined, shift: Shift | undefined;
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index], value = args[index + 1];
    if (value === undefined) throw new Error(USAGE);
    if (flag === '--assets') assets = resolve(value);
    else if (flag === '--fighter') {
      const character = SELECTABLE_CHARACTERS.find(candidate => fighterSlug(candidate) === value.toLowerCase());
      if (character === undefined) throw new Error(`no fighter named ${value}; ${USAGE}`);
      fighters.push(character);
    } else if (flag === '--shift') {
      const [fighter = '', move = '', dx = ''] = value.split(':');
      if (!Number.isFinite(Number(dx)) || value.split(':').length !== 3) throw new Error(USAGE);
      shift = { fighter, move, dx: Number(dx) };
    } else throw new Error(USAGE);
  }
  return { fighters: fighters.length === 0 ? [...SELECTABLE_CHARACTERS] : fighters, assets, shift };
}

const point = (at: Point) => `${at[0].toFixed(1)},${at[1].toFixed(1)}`;
const HEADER = ['fighter', 'move', 'weapons', 'active', 'tip outside', 'tip frame', 'tip x,z', 'region overreach', 'overreach frame', 'overreach x,z', 'strike by', 'shifted', 'verdict'];
const tsvRow = (row: Row) => [
  row.fighter, row.move, row.weapons, `${row.frames[0]}-${row.frames.at(-1)}`, row.tip.gap.toFixed(1), row.tip.frame, point(row.tip.at),
  row.reach.gap.toFixed(1), row.reach.frame, point(row.reach.at), row.by, row.shifted ? 'yes' : 'no', fails(row) ? 'FAIL' : 'pass',
].join('\t');

const { fighters, assets: assetsArg, shift } = parseArgs(process.argv.slice(2));
const assets = assetsArg ?? assetsView(await Effect.runPromise(readManifest()));
const rows: Row[] = [], unarmed: string[] = [];
for (const character of fighters) {
  const body = await loadBody(assets, character);
  const weapons = rigWeapons(body, character);
  if (weapons.length === 0) { unarmed.push(fighterSlug(character)); continue; }
  for (const sampled of sampleFighter(body, character)) {
    const row = traceMove(body, fighterSlug(character), weapons, sampled, shift);
    if (row !== undefined) rows.push(row);
  }
}
const sorted = rows.toSorted((a, b) => Number(fails(b)) - Number(fails(a)) || worst(b) - worst(a));
const out = resolve(import.meta.dir, '../../build/anim-score');
const table = join(out, shift === undefined ? 'classic-weapons.tsv' : 'classic-weapons-shifted.tsv');
mkdirSync(out, { recursive: true });
await Bun.write(table, `${[HEADER.join('\t'), ...sorted.map(tsvRow)].join('\n')}\n`);
const failing = sorted.filter(fails).length;
console.log([HEADER.join('\t'), ...sorted.map(tsvRow)].join('\n'));
console.log(`${rows.length} weapon moves over ${fighters.length - unarmed.length} armed fighters; ${failing} miss their weapon by more than ${GAP_LIMIT} units; unarmed: ${unarmed.join(', ') || 'none'}; ${table}`);
if (failing > 0) process.exitCode = 1;
