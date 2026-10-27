import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AttackStyle, Character } from '../../ts/src/game/sim/codes';
import type { Capsule } from '../../ts/src/game/sim/geometry/contactGeometry';
import type { MoveRegion } from '../../ts/src/game/sim/heroMoves';
import type { AuthoredSpecial } from '../../ts/src/game/sim/specials/schema';
import { FIGHTER_ULTIMATES } from '../../ts/src/game/sim/ultimates';
import { SPECIAL_FIT_PREFIX, ULTIMATE_FIT_PREFIX, type WeaponRegionFits } from '../../ts/src/game/sim/weaponRegions';
import { heroDefinition } from '../../ts/src/game/roster/kits';
import { SCORED_NORMALS, type RegionOwner, type SampledMove } from '../../ts/scripts/wisp/animScoreSample';

export type Point = readonly [number, number];
export type Edge = { readonly grip: Point; readonly tip: Point };
export type MoveFit = { readonly key: string; readonly frames: Readonly<Record<number, readonly (readonly number[])[]>> };

export const BODY_CENTRE: Point = [0, 60];
const FIGHTERS = resolve(import.meta.dir, '../../ts/src/game/fighters');
const ULTIMATES = resolve(import.meta.dir, '../../ts/src/game/sim/ultimates.ts');
const MATCH_TOLERANCE = 0.5;

export function segmentDistance(p: Point, a: Point, b: Point): number {
  const ux = b[0] - a[0], uz = b[1] - a[1], length = ux * ux + uz * uz;
  const t = length <= 1e-8 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * ux + (p[1] - a[1]) * uz) / length));
  return Math.hypot(p[0] - a[0] - ux * t, p[1] - a[1] - uz * t);
}
export const fromCentre = (p: Point) => Math.hypot(p[0] - BODY_CENTRE[0], p[1] - BODY_CENTRE[1]);
export function farEnd(capsule: Capsule): Point {
  const a: Point = [capsule.x1, capsule.z1], b: Point = [capsule.x2, capsule.z2];
  return fromCentre(b) >= fromCentre(a) ? b : a;
}
const isPath = (capsule: Capsule) => 'path' in capsule && capsule.path === true;

type Special = Readonly<AuthoredSpecial>;
function specialPath(node: Special | undefined, owner: RegionOwner, path: readonly (string | number)[]): (string | number)[] | undefined {
  if (node === undefined) return undefined;
  if (node === owner) return [...path];
  const children: [Special | undefined, (string | number)[]][] = [
    [node.ex, ['ex']],
    ...(node.variants ?? []).map((variant, index): [Special, (string | number)[]] => [variant, ['variants', index]]),
    ...(node.followUps ?? []).map((followUp, index): [Special, (string | number)[]] => [followUp.special, ['followUps', index, 'special']]),
  ];
  for (const [child, step] of children) {
    const found = specialPath(child, owner, [...path, ...step]);
    if (found !== undefined) return found;
  }
  return undefined;
}

function ownerKey(character: Character, move: string, owner: RegionOwner): string | undefined {
  const hero = heroDefinition(character);
  const entry = SCORED_NORMALS.find(candidate => candidate.move === move);
  if (entry !== undefined && hero?.moves.normals[entry.style] === owner) return Object.entries(AttackStyle).find(([, style]) => style === entry.style)?.[0];
  for (const slot of ['neutral', 'side', 'up', 'down'] as const) {
    const kit = hero?.specials?.[slot];
    const forms: [Special | undefined, string][] = [[kit?.ground, 'ground'], [kit?.air, 'air'], [kit?.recall, 'recall'], [kit?.marked?.special, 'marked.special']];
    for (const [form, name] of forms) {
      const found = specialPath(form, owner, []);
      if (found !== undefined) return [`${SPECIAL_FIT_PREFIX}${slot}.${name}`, ...found].join('.');
    }
  }
  const ultimate = specialPath(FIGHTER_ULTIMATES[character], owner, []);
  return ultimate === undefined ? undefined : [ULTIMATE_FIT_PREFIX, ...ultimate].join('.');
}

const authoredAt = (owner: RegionOwner, frame: number): Capsule[] =>
  (owner.regions ?? []).flatMap((region: MoveRegion) => frame >= region.firstFrame && frame <= region.lastFrame && region.hit.strike !== undefined ? [region.hit.strike] : []);

function chooseEdge(edges: readonly Edge[], capsules: readonly Capsule[]): Edge | undefined {
  const cost = (edge: Edge) => capsules.reduce((sum, capsule) => sum + segmentDistance(farEnd(capsule), edge.grip, edge.tip), 0);
  return edges.toSorted((a, b) => cost(a) - cost(b))[0];
}

function onBlade(capsules: readonly Capsule[], edge: Edge): (readonly number[])[] {
  const swept = capsules.filter(capsule => !isPath(capsule));
  const reaches = swept.flatMap(capsule => [fromCentre([capsule.x1, capsule.z1]), fromCentre([capsule.x2, capsule.z2])]);
  const near = Math.min(...reaches), far = Math.max(...reaches);
  const along = (p: Point, isFar: boolean): Point => {
    const t = far - near < 1 ? (isFar ? 1 : 0) : (fromCentre(p) - near) / (far - near);
    return [Math.round(edge.grip[0] + (edge.tip[0] - edge.grip[0]) * t), Math.round(edge.grip[1] + (edge.tip[1] - edge.grip[1]) * t)];
  };
  return capsules.map(capsule => {
    if (isPath(capsule)) return [capsule.x1, capsule.z1, capsule.x2, capsule.z2];
    const a: Point = [capsule.x1, capsule.z1], b: Point = [capsule.x2, capsule.z2], bFar = fromCentre(b) >= fromCentre(a);
    return [...along(a, !bFar), ...along(b, bFar)];
  });
}

export function fitMove(character: Character, sampled: SampledMove, frames: readonly number[], edges: readonly (readonly Edge[])[]): MoveFit | string {
  const owner = sampled.regionOwners[frames[0] ?? 0];
  if (owner === undefined || owner.beam !== undefined || frames.some(frame => sampled.regionOwners[frame] !== owner)) return 'its regions come from more than one move, a beam or no authored list';
  const key = ownerKey(character, sampled.move, owner);
  if (key === undefined) return 'its regions belong to no normal, special or ultimate of this fighter';
  const out: Record<number, (readonly number[])[]> = {};
  for (const [index, frame] of frames.entries()) {
    const region = sampled.regionFrames[frame] ?? -1, authored = authoredAt(owner, region), seen = sampled.strikes[frame] ?? [];
    if (authored.length !== seen.length) return `frame ${frame} samples ${seen.length} regions where the move authors ${authored.length}`;
    const dx = (seen[0]?.x1 ?? 0) - (authored[0]?.x1 ?? 0), dz = (seen[0]?.z1 ?? 0) - (authored[0]?.z1 ?? 0);
    const shifted = authored.every((capsule, slot) => {
      const drawn = seen[slot];
      return drawn !== undefined && [drawn.x1 - capsule.x1 - dx, drawn.z1 - capsule.z1 - dz, drawn.x2 - capsule.x2 - dx, drawn.z2 - capsule.z2 - dz].every(gap => Math.abs(gap) <= MATCH_TOLERANCE);
    });
    if (!shifted) return `frame ${frame} draws its regions somewhere other than the authored capsules moved together`;
    const edge = chooseEdge(edges[index] ?? [], seen.filter(capsule => !isPath(capsule)));
    if (edge === undefined) return `frame ${frame} has no traced weapon`;
    const local: Edge = { grip: [edge.grip[0] - dx, edge.grip[1] - dz], tip: [edge.tip[0] - dx, edge.tip[1] - dz] };
    out[region] = onBlade(authored, local);
  }
  return { key, frames: out };
}

function kitOf(character: Character): { folder: string; name: string } {
  const named = Object.entries(Character).find(([, value]) => value === character)?.[0];
  for (const folder of readdirSync(FIGHTERS)) {
    const kit = join(FIGHTERS, folder, 'kit.ts');
    if (!existsSync(kit)) continue;
    const text = readFileSync(kit, 'utf8');
    const hero = /export const (\w+)_HERO\b/.exec(text)?.[1];
    if (hero !== undefined && text.includes(`character: Character.${named},`)) return { folder: join(FIGHTERS, folder), name: `${hero}_WEAPON_REGIONS` };
  }
  throw new Error(`no fighter folder declares Character.${named}`);
}

const renderFits = (name: string, fits: WeaponRegionFits) => [
  '// Generated by `bun tools/animations/weapon-trace.ts --fit` from each active frame\'s traced weapon grip and tip; regenerate instead of editing.',
  `export const ${name}: { readonly [move: string]: { readonly [frame: number]: readonly (readonly number[])[] } } = {`,
  ...Object.keys(fits).sort().flatMap(key => [
    `  ${/^\w+$/.test(key) ? key : JSON.stringify(key)}: {`,
    ...Object.entries(fits[key] ?? {}).map(([frame, capsules]) => [Number(frame), capsules ?? []] as const).sort((a, b) => a[0] - b[0])
      .map(([frame, capsules]) => `    ${frame}: [${capsules.map(capsule => `[${capsule.join(', ')}]`).join(', ')}],`),
    '  },',
  ]),
  '};',
  '',
].join('\n');

function wireKit(folder: string, name: string): void {
  const kit = join(folder, 'kit.ts');
  let text = readFileSync(kit, 'utf8');
  if (text.includes(name)) return;
  const moves = /moves: (\w+_MOVES)\b/.exec(text)?.[1], specials = /specials: (\w+_SPECIALS)\b/.exec(text)?.[1];
  if (moves === undefined) throw new Error(`${kit} names no moves table to fit`);
  text = text.replace(`moves: ${moves}`, `moves: fitMoves(${moves}, ${name})`);
  if (specials !== undefined) text = text.replace(`specials: ${specials}`, `specials: fitSpecials(${specials}, ${name})`);
  const lines = text.split('\n'), last = lines.findLastIndex(line => line.startsWith('import '));
  lines.splice(last + 1, 0, `import { fitMoves${specials === undefined ? '' : ', fitSpecials'} } from "../../sim/weaponRegions";`, `import { ${name} } from "./weaponRegions";`);
  writeFileSync(kit, lines.join('\n'));
}

export async function writeFits(character: Character, moves: readonly MoveFit[]): Promise<string> {
  const { folder, name } = kitOf(character);
  const file = join(folder, 'weaponRegions.ts');
  const existing: WeaponRegionFits = existsSync(file) ? (await import(file))[name] ?? {} : {};
  const fits: Record<string, MoveFit['frames']> = { ...existing } as Record<string, MoveFit['frames']>;
  for (const move of moves) fits[move.key] = move.frames;
  writeFileSync(file, renderFits(name, fits));
  wireKit(folder, name);
  if (moves.some(move => move.key.startsWith(ULTIMATE_FIT_PREFIX)) && !readFileSync(ULTIMATES, 'utf8').includes(name))
    throw new Error(`${file} fits the ultimate; apply it with fitUltimate(..., ${name}) in ts/src/game/sim/ultimates.ts`);
  return file;
}
