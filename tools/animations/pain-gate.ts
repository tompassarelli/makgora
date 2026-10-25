import { parseMDX } from "war3-model";
import type { Character } from "../../ts/src/game/sim/codes";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { FIGHTER_RIGS } from "./rigs";

export const PAIN_GAIN = [0.7, 0.9, 1.3] as const;
export const HIGH_STRETCH = [0.8, 1, 1.2] as const;

const HEIGHTS = ["low", "middle", "high"] as const;
const STRENGTHS = ["small", "medium", "large"] as const;
const SMALL_SHARE = 0.6;
const ROW_SEPARATION = 6;
const WEAPON_CLEARANCE = 2;

type Point = readonly [number, number];

export interface PainMeasure {
  readonly head: Point;
  readonly hand: Point;
  readonly floor: number;
  readonly weaponLow: number | undefined;
}

export class PainBody {
  private readonly drawn: DrawnModel;
  private readonly head: Uint8Array;
  private readonly weapon: Uint8Array;
  private readonly hand: number;
  readonly armed: boolean;

  constructor(bytes: ArrayBuffer, character: Character) {
    const rig = FIGHTER_RIGS.get(character)?.classic;
    if (rig === undefined) throw new Error(`no rig for character ${character}`);
    this.drawn = new DrawnModel(bytes, 1);
    const nodes = this.drawn.nodes();
    const id = (name: string | undefined) => nodes.findIndex(node => node.name === name);
    const held = new Set([rig.weapon, rig["weapon.L"]].flatMap(name => name === undefined ? [] : [id(name)]).filter(node => node >= 0));
    const under = (roots: ReadonlySet<number>, node: number): boolean => node >= 0 && (roots.has(node) || under(roots, nodes[node]?.parent ?? -1));
    const carried = (node: number) => under(held, node);
    const head = new Set([id(rig.head)].filter(node => node >= 0));
    this.armed = held.size > 0;
    this.weapon = this.drawn.influencedBy(new Set(nodes.flatMap((node, at) => carried(at) ? [node.name] : [])));
    this.head = this.drawn.influencedBy(new Set(nodes.flatMap((node, at) => under(head, at) && !carried(at) ? [node.name] : [])));
    this.hand = id(rig["wrist.R"] ?? rig["wrist.L"]);
  }

  floor(sequence: number, seconds: number): number {
    return this.measure(sequence, seconds).floor;
  }

  measure(sequence: number, seconds: number): PainMeasure {
    const { vertices, drawn, nodes } = this.drawn.posed(sequence, seconds, 1);
    let floor = Infinity, weaponLow = Infinity, headX = 0, headZ = 0, headCount = 0;
    for (let vertex = 0; vertex < drawn.length; vertex++) {
      if (drawn[vertex] !== 1) continue;
      const x = vertices[vertex * 2] ?? 0, z = vertices[vertex * 2 + 1] ?? 0;
      if (this.weapon[vertex] === 1) weaponLow = Math.min(weaponLow, z);
      else floor = Math.min(floor, z);
      if (this.head[vertex] === 1) { headX += x; headZ += z; headCount++; }
    }
    return {
      head: headCount === 0 ? [0, 0] : [headX / headCount, headZ / headCount],
      hand: [nodes[this.hand * 2] ?? 0, nodes[this.hand * 2 + 1] ?? 0],
      floor,
      weaponLow: Number.isFinite(weaponLow) ? weaponLow : undefined,
    };
  }
}

export function standIndex(bytes: ArrayBuffer): number {
  const names = parseMDX(bytes).Sequences.map(sequence => sequence.Name);
  const stand = names.findIndex(name => /^stand ready$/i.test(name));
  return stand >= 0 ? stand : names.findIndex(name => /^stand(?:\s*-?\s*\d+)?$/i.test(name));
}

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function painGate(bytes: ArrayBuffer, character: Character, idle: number, cells: readonly number[]): { readonly pass: boolean; readonly report: string } {
  if (cells.length !== 9) throw new Error(`pain gate needs nine cells, got ${cells.length}`);
  const body = new PainBody(bytes, character);
  const rest = body.measure(idle, 0);
  const posed = cells.map(cell => body.measure(cell, 0));
  const failures: string[] = [];
  const lines = [`idle head (${rest.head.map(v => v.toFixed(1)).join(",")}) hand (${rest.hand.map(v => v.toFixed(1)).join(",")}) floor ${rest.floor.toFixed(1)}`];
  for (const [cell, pose] of posed.entries()) {
    const height = Math.floor(cell / 3), strength = cell % 3, name = `${HEIGHTS[height]}-${STRENGTHS[strength]}`;
    const head = distance(pose.head, rest.head), hand = distance(pose.hand, rest.hand);
    const clearance = pose.weaponLow === undefined ? undefined : pose.weaponLow - pose.floor;
    let line = `${name}: head Δ ${head.toFixed(1)} hand Δ ${hand.toFixed(1)} body floor ${pose.floor.toFixed(1)}${clearance === undefined ? "" : ` weapon above floor ${clearance.toFixed(1)}`}`;
    if (clearance !== undefined && clearance < WEAPON_CLEARANCE) failures.push(`${name} weapon touches the floor`);
    if (strength === 0) {
      const medium = posed[cell + 1]!;
      const headShare = head / Math.max(1e-6, distance(medium.head, rest.head)), handShare = hand / Math.max(1e-6, distance(medium.hand, rest.hand));
      const others = [0, 1, 2].filter(row => row !== height).map(row => distance(pose.head, posed[row * 3]!.head));
      line += ` | small/medium head ${(headShare * 100).toFixed(0)}% hand ${(handShare * 100).toFixed(0)}% head vs other rows' small ${others.map(v => v.toFixed(1)).join("/")}`;
      if (headShare < SMALL_SHARE || handShare < SMALL_SHARE) failures.push(`${name} below ${SMALL_SHARE * 100}% of medium`);
      if (others.some(v => v < ROW_SEPARATION)) failures.push(`${name} head within ${ROW_SEPARATION} of another row's small cell`);
    }
    lines.push(line);
  }
  lines.push(failures.length === 0 ? "PAIN_GATE PASS" : `PAIN_GATE FAIL: ${failures.join("; ")}`);
  return { pass: failures.length === 0, report: lines.join("\n") };
}

if (import.meta.main) {
  const [path, fighter] = Bun.argv.slice(2);
  if (path === undefined || fighter === undefined) throw new Error("usage: bun tools/animations/pain-gate.ts MODEL.mdx CHARACTER");
  const { contactDamageClips } = await import("../../ts/src/game/presentation/damagePose");
  const character = Number(fighter) as Character;
  const bytes = await Bun.file(path).arrayBuffer();
  const cells = (contactDamageClips(character) ?? []).map(clip => clip.index);
  const { pass, report } = painGate(bytes, character, standIndex(bytes), cells);
  console.log(report);
  process.exit(pass ? 0 : 1);
}
