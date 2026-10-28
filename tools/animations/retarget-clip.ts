import { join, resolve } from "node:path";
import { quat } from "gl-matrix";
import type { model as mdx } from "war3-model";
import { fighters } from "../../ts/scripts/heroModelSource";
import { sampleAttack } from "../../ts/scripts/wisp/hurtboxView";
import { clipFor } from "../../ts/src/game/presentation/fighterClips";
import { AttackStyle, type Character } from "../../ts/src/game/sim/codes";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { ensure, onGlobalClock, parseSource } from "./original-clips";
import { FIGHTER_RIGS } from "./rigs";

const USAGE = "usage: bun tools/animations/retarget-clip.ts PRIVATE_ASSETS RIG.json KEYS.json RETARGET.json";

type Q = [number, number, number, number];
type V = [number, number, number];
interface Cloth { readonly lag: number; readonly weight: number; readonly overlap: number }
interface Clear { readonly follow: string; readonly weight: number; readonly lift: V }
interface Retarget {
  readonly from: Character;
  readonly to: Character;
  readonly pose: HeroPose;
  readonly carry: readonly string[];
  readonly cloth: Readonly<Record<string, Cloth>>;
  readonly clear: Readonly<Record<string, Clear>>;
}
interface RigNode { readonly name: string; readonly parent: number; readonly pivot: V; readonly rotation: Q | null; readonly translation: V | null }
interface Rig { readonly frames: number; readonly nodes: readonly RigNode[] }

const [assetsArg, rigArg, keysArg, retargetArg] = process.argv.slice(2);
ensure(assetsArg && rigArg && keysArg && retargetArg, USAGE);
const plan = await Bun.file(resolve(retargetArg)).json() as Retarget;
const rig = await Bun.file(resolve(rigArg)).json() as Rig;
const style = AttackStyle[plan.pose as keyof typeof AttackStyle];
const source = fighters.get(plan.from), target = fighters.get(plan.to), fromRig = FIGHTER_RIGS.get(plan.from), toRig = FIGHTER_RIGS.get(plan.to);
ensure(source && target && fromRig && toRig && style !== undefined, `no fighter, rig or attack style for ${plan.from} -> ${plan.to} ${plan.pose}`);

const model = parseSource(await Bun.file(join(resolve(assetsArg), source.source)).arrayBuffer());
const clip = clipFor(plan.from, plan.pose), sequence = model.Sequences[clip.index];
ensure(sequence, `${source.name}: no clip ${clip.index}`);
const [start = 0, end = 0] = sequence.Interval;
const sourceFrames = sampleAttack(plan.from, style, 1, plan.pose.endsWith("Air")), targetFrames = sampleAttack(plan.to, style, 1, plan.pose.endsWith("Air"));
ensure(sourceFrames.length === targetFrames.length && targetFrames.length === rig.frames, `${source.name} plays ${sourceFrames.length} frames, ${target.name} ${targetFrames.length}, the rig ${rig.frames}: give both the same frame data first`);

const sourceNodes = new Map<string, mdx.Node>(), duplicated = new Set<string>();
for (const node of model.Nodes) if (node) { if (sourceNodes.has(node.Name)) duplicated.add(node.Name); sourceNodes.set(node.Name, node); }
const jointNames = (classic: Readonly<Record<string, string>>) => new Map(Object.entries(classic));
const fromJoints = jointNames(fromRig.classic), toJoints = jointNames(toRig.classic);
const carried = new Map<string, string>([
  ...[...toJoints].flatMap(([joint, name]) => joint.startsWith("weapon") || !fromJoints.has(joint) ? [] : [[name, fromJoints.get(joint)!] as const]),
  ...plan.carry.map((name) => [name, name] as const),
]);
for (const [to, from] of carried) ensure(!duplicated.has(from) && sourceNodes.has(from), `${source.name}: no single node ${from} for ${to}`);

function sample(track: mdx.AnimVector | undefined, at: number, rest: readonly number[]): number[] {
  const inside = track === undefined || onGlobalClock(track) ? [] : track.Keys.filter((k) => k.Frame >= start && k.Frame <= end);
  if (inside.length === 0) return [...rest];
  const next = inside.findIndex((k) => k.Frame >= at), b = inside[next < 0 ? inside.length - 1 : next]!, a = next > 0 ? inside[next - 1]! : b;
  const weight = b.Frame === a.Frame ? 0 : (at - a.Frame) / (b.Frame - a.Frame);
  if (a.Vector.length === 4) return Array.from(quat.slerp(quat.create(), a.Vector as unknown as quat, b.Vector as unknown as quat, weight));
  return Array.from(a.Vector, (v, i) => v + ((b.Vector[i] ?? v) - v) * weight);
}
const at = (frame: number) => Math.min(end, start + Math.round((sourceFrames[frame]?.seconds ?? clip.seconds) * 1000));
const hipHeight = (nodes: (name: string) => V | undefined, joints: Map<string, string>) =>
  (nodes(joints.get("hip.L") ?? "")?.[2] ?? 0) - (nodes(joints.get("ankle.L") ?? "")?.[2] ?? 0);
const sourcePivot = (name: string) => { const node = sourceNodes.get(name); return node ? Array.from(model.PivotPoints[node.ObjectId]!) as V : undefined; };
const targetPivot = (name: string) => rig.nodes.find((n) => n.name === name)?.pivot;
const ratio = hipHeight(targetPivot, toJoints) / hipHeight(sourcePivot, fromJoints);

const identity: Q = [0, 0, 0, 1];
const mul = (a: readonly number[], b: readonly number[]): Q => Array.from(quat.multiply(quat.create(), a as unknown as quat, b as unknown as quat)) as Q;
const inv = (a: readonly number[]): Q => Array.from(quat.invert(quat.create(), a as unknown as quat)) as Q;
const toward = (a: readonly number[], weight: number): Q => Array.from(quat.slerp(quat.create(), identity as unknown as quat, a as unknown as quat, weight)) as Q;
const euler = ([x, y, z]: V): Q => Array.from(quat.fromEuler(quat.create(), x, y, z)) as Q;
const angle = (a: readonly number[]) => 2 * Math.acos(Math.min(1, Math.abs(a[3] ?? 1)));

const frames = rig.frames + 1;
const rotation: Q[][] = rig.nodes.map((n) => Array.from({ length: frames }, () => (n.rotation ?? identity).slice() as Q));
const translation: V[][] = rig.nodes.map((n) => Array.from({ length: frames }, () => (n.translation ?? [0, 0, 0]).slice() as V));
const index = new Map(rig.nodes.map((n, i) => [n.name, i]));
for (const [to, from] of carried) {
  const i = index.get(to); ensure(i !== undefined, `${target.name}: no node ${to}`);
  const node = sourceNodes.get(from)!;
  for (let f = 0; f < frames; f++) {
    rotation[i]![f] = sample(node.Rotation, at(f), identity) as Q;
    if (rig.nodes[i]!.translation !== null) {
      const moved = sample(node.Translation, at(f), [0, 0, 0]);
      translation[i]![f] = moved.map((v) => v * ratio) as V;
    }
  }
}

const ancestry = (i: number): number[] => { const chain: number[] = []; for (let p = rig.nodes[i]!.parent; p >= 0; p = rig.nodes[p]!.parent) chain.unshift(p); return chain; };
const orientation = (chain: readonly number[], f: number) => chain.reduce<Q>((q, p) => mul(q, rotation[p]![Math.max(0, f)]!), identity);
const depth = (i: number) => ancestry(i).filter((p) => plan.cloth[rig.nodes[p]!.name] !== undefined).length;
const clothNodes = Object.keys(plan.cloth).map((name) => { const i = index.get(name); ensure(i !== undefined, `${target.name}: no cloth node ${name}`); return i; }).sort((a, b) => depth(a) - depth(b));
for (const i of clothNodes) {
  const { lag, weight, overlap } = plan.cloth[rig.nodes[i]!.name]!, chain = ancestry(i), delay = lag + overlap * depth(i);
  const clear = plan.clear[rig.nodes[i]!.name], follow = clear === undefined ? undefined : index.get(clear.follow);
  ensure(clear === undefined || follow !== undefined, `${target.name}: no node ${clear?.follow} for ${rig.nodes[i]!.name} to clear`);
  const rest = rig.nodes[follow ?? 0]!.rotation ?? identity;
  const bent = rotation[i]!.map((own, f) => {
    const trail = toward(mul(inv(orientation(chain, f)), orientation(chain, f - delay)), weight);
    if (follow === undefined || clear === undefined) return mul(trail, own);
    const swing = mul(rotation[follow]![f]!, inv(rest)), amount = Math.min(1, angle(swing) / (Math.PI / 2));
    return mul(mul(trail, toward(swing, clear.weight)), mul(toward(euler(clear.lift), amount), own));
  });
  rotation[i] = bent;
}

await Bun.write(resolve(keysArg), JSON.stringify({ frames: rig.frames, nodes: rig.nodes.map((_, i) => ({ rotation: rotation[i], translation: translation[i] })) }));
console.log(`RETARGET ${source.name} -> ${target.name} ${plan.pose}: ${carried.size} body nodes copied from clip ${clip.index} over  frames, translation scaled ${ratio.toFixed(3)}, ${clothNodes.length} cloth nodes trailed; ${resolve(keysArg)}`);
