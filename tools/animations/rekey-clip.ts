import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { model as mdx } from "war3-model";
import { generateModelMDX as generateMDX } from "../../ts/scripts/mdxCodec";
import { fighters } from "../../ts/scripts/heroModelSource";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { capture, type PoseFrame, sampleAttack, sheet } from "../../ts/scripts/wisp/hurtboxView";
import { clipFor } from "../../ts/src/game/presentation/fighterClips";
import { advanceFighterPose, createFighterPose } from "../../ts/src/game/presentation/fighterPose";
import { HERO_STRIKE_MOMENTS } from "../../ts/src/game/presentation/heroStrikeMomentInfo";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { beginFighterAttack } from "../../ts/src/game/sim/attacks";
import { AttackPhase, AttackStyle, type Character } from "../../ts/src/game/sim/codes";
import { createFighter } from "../../ts/src/game/sim/fighter";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { createRoster, neutralControls } from "../../ts/src/game/sim/roster";
import { advanceFighter } from "../../ts/src/game/sim/step";
import { blenderOptions, blenderSkeleton } from "./blender-keys";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";
import { FIGHTER_RIGS } from "./rigs";

const USAGE = "usage: bun tools/animations/rekey-clip.ts PRIVATE_ASSETS PRIVATE_OUTPUT --character ID --pose POSE [--limb L|R] (--rig RIG.json | --keys KEYS.json)";
const LIMB_INSIDE = 0.9;
const FLOOR_SINK = 0.03;

const argv = process.argv.slice(2);
const option = (name: string) => { const at = argv.indexOf(name); return at < 0 ? undefined : argv[at + 1]; };
const [assetsArg, outputArg] = argv;
const assets = resolve(assetsArg ?? ""), output = resolve(outputArg ?? ""), project = resolve(import.meta.dir, "../..");
const character = Number(option("--character")) as Character, pose = option("--pose") as HeroPose, side = option("--limb") ?? "R";
const { rig: rigOutput, keys: bakedKeys } = blenderOptions(argv);
ensure(assetsArg && outputArg && relative(project, output).startsWith("..") && pose && (side === "L" || side === "R") && (rigOutput === undefined) !== (bakedKeys === undefined), USAGE);
const fighter = fighters.get(character), rig = FIGHTER_RIGS.get(character), style = AttackStyle[pose as keyof typeof AttackStyle];
ensure(fighter && rig, `no fighter or canonical rig for character ${character}`);
ensure(style !== undefined, `${pose}: not an attack style`);

const clip = clipFor(character, pose), moment = HERO_STRIKE_MOMENTS[character]?.[style];
ensure(clip.aligned === true || moment?.clip !== clip.index, `${fighter.name} ${pose}: clip ${clip.index} plays strike-aligned, so re-keyed frames would retime it`);
const frames = sampleAttack(character, style, 1, pose.endsWith("Air"));
ensure(frames.every((f) => f.clip === clip.index), `${fighter.name} ${pose}: the move does not play clip ${clip.index} throughout`);
const active = frames.flatMap((f, i) => f.phase === AttackPhase.active && f.strikes.length > 0 ? [i] : []);
ensure(active.length > 0, `${fighter.name} ${pose}: no active hit region`);

const source = parseSource(await Bun.file(join(assets, fighter.source)).arrayBuffer()), model = structuredClone(source);
function readyClip(attack: AttackStyle): number {
  const f = createFighter(character, 0.0, 1), world = createRoster(1, [f]), shown = createFighterPose(), input = neutralControls();
  beginFighterAttack(world, 0, attack, false);
  advanceFighterPose(shown, f, world, input, false, false, true, false);
  while (f.attack.style === attack) { advanceFighter(world, 0, 0, input, 0.0); advanceFighterPose(shown, f, world, input, false, false, false, false); }
  const after = capture(f, shown);
  ensure(after.seconds === 0, `${pose}: ready starts ${after.seconds}s into clip ${after.clip}`);
  return after.clip;
}
const stand = source.Sequences[readyClip(style)];
ensure(stand, `${fighter.name}: missing the ready clip shown after ${pose}`);
const sequence = model.Sequences[clip.index];
ensure(sequence, `${fighter.name}: no clip ${clip.index}`);
const scale = characterModelScale(character);
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (track, path) => originals.set(path, track));
const blender = blenderSkeleton(source, originals, stand, onGlobalClock);
const regions = (f: PoseFrame) => f.strikes.map((s) => ({ x1: (s.x1 - f.x) / scale, z1: (s.z1 - f.z) / scale, x2: (s.x2 - f.x) / scale, z2: (s.z2 - f.z) / scale, radius: s.radius / scale }));

function extremes(): Record<string, number[][]> {
  const byNode = new Map<number, number[][]>();
  for (const geoset of source.Geosets) for (let v = 0; v < geoset.Vertices.length / 3; v++) {
    const node = geoset.SkinWeights ? geoset.SkinWeights[v * 8]! : geoset.Groups[geoset.VertexGroup[v] ?? 0]?.[0];
    if (node === undefined) continue;
    byNode.set(node, [...byNode.get(node) ?? [], Array.from(geoset.Vertices.subarray(v * 3, v * 3 + 3))]);
  }
  return Object.fromEntries([...byNode].map(([node, points]) => [source.Nodes[node]!.Name,
    [0, 1, 2].flatMap((axis) => [points.reduce((a, b) => b[axis]! < a[axis]! ? b : a), points.reduce((a, b) => b[axis]! > a[axis]! ? b : a)])]));
}

if (rigOutput) {
  await blender.writeRig(rigOutput, { frames: frames.length, contact: active[0]!, active: active.length, limb: side, joints: rig.classic, regions: frames.map(regions), points: extremes() });
  console.log(`REKEY_RIG ${fighter.name} ${pose} clip ${clip.index}: ${frames.length} frames, active ${active[0]}-${active.at(-1)} ${rigOutput}`);
  process.exit(0);
}

const [start = 0, end = 0] = sequence.Interval;
const times = [...frames.map((f) => start + Math.round(f.seconds * 1000)), start + Math.round(clip.seconds * 1000)];
ensure(times.every((t, i) => t <= end && (i === 0 || t > times[i - 1]!)), `${fighter.name} ${pose}: the move's clip times ${times.join(",")} leave clip ${clip.index} (${start}-${end})`);
const baked = await blender.readKeys(bakedKeys!, frames.length);
tracks(model, (track, path) => {
  if (!/^\.(Bones|Helpers)\.\d+\.(Rotation|Translation)$/.test(path) || onGlobalClock(track)) return;
  const template = track.Keys.find((k) => k.Frame >= start && k.Frame <= end);
  const keyed = times.map((Frame, frame) => ({ Frame, Vector: baked(path, frame)! }));
  if (end > times.at(-1)!) keyed.push({ Frame: end, Vector: keyed.at(-1)!.Vector });
  track.Keys = [...track.Keys.filter((k) => k.Frame < start || k.Frame > end),
    ...keyed.map(({ Frame, Vector }) => ({ ...template, Frame, Vector, ...(track.LineType >= 2 ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {}) }))].sort((a, b) => a.Frame - b.Frame);
});

const bytes = encodeVerified(parseSource(generateMDX(model)));
const before = new DrawnModel(generateMDX(source), 1), after = new DrawnModel(bytes, 1);
for (const [index, other] of source.Sequences.entries()) for (const fraction of [0, 0.5, 1]) {
  if (index === clip.index) continue;
  const time = (other.Interval[1] - other.Interval[0]) * fraction / 1000, a = before.triangles(index, time, 1), b = after.triangles(index, time, 1);
  ensure(a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? Infinity)) < 0.001), `${fighter.name}/${other.Name}: an unrelated clip changed`);
}

const drawn = new DrawnModel(bytes, scale);
const graph = drawn.nodes(), knee = graph.findIndex((node) => node.name === rig.classic[`knee.${side}`]);
ensure(knee >= 0, `${fighter.name}: the rig names no ${side} knee`);
const below = (id: number | undefined): boolean => id !== undefined && (id === knee || below(graph[id]?.parent));
const legVertices = drawn.influencedBy(new Set(graph.flatMap((node, id) => below(id) ? [node.name] : [])));
const distance = (x: number, z: number, s: PoseFrame["strikes"][number]) => {
  const dx = s.x2 - s.x1, dz = s.z2 - s.z1, t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (z - s.z1) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - s.x1 - dx * t, z - s.z1 - dz * t) - s.radius;
};
const outside: string[] = [];
for (const at of active) {
  const f = frames[at]!, { vertices, drawn: shown } = drawn.posed(clip.index, f.seconds, 1);
  const strikes = f.strikes.map((s) => ({ ...s, x1: s.x1 - f.x, z1: s.z1 - f.z, x2: s.x2 - f.x, z2: s.z2 - f.z }));
  const leg = Array.from(legVertices.entries()).filter(([v, on]) => on === 1 && shown[v] === 1).map(([v]) => [vertices[v * 2]!, vertices[v * 2 + 1]!] as const);
  const inside = leg.filter(([x, z]) => strikes.some((s) => distance(x, z, s) <= 0)).length / Math.max(1, leg.length);
  const tip = leg.reduce((far, point) => point[0] > far[0] ? point : far, [-Infinity, 0] as readonly [number, number]);
  const tipIn = strikes.some((s) => distance(tip[0], tip[1], s) <= 0);
  console.log(`REKEY_LIMB ${fighter.name} ${pose} frame ${at}: ${(inside * 100).toFixed(1)}% of the ${side} lower leg inside the hit region, foot tip (${tip[0].toFixed(1)}, ${tip[1].toFixed(1)}) ${tipIn ? "inside" : "outside"}, leg x ${Math.min(...leg.map((p) => p[0])).toFixed(1)}..${tip[0].toFixed(1)} z ${Math.min(...leg.map((p) => p[1])).toFixed(1)}..${Math.max(...leg.map((p) => p[1])).toFixed(1)}`);
  if (inside < LIMB_INSIDE || !tipIn) outside.push(`the ${side} lower leg leaves the hit region on frame ${at}`);
}
const standPose = new DrawnModel(generateMDX(source), scale).triangles(source.Sequences.indexOf(stand), 0, 1).filter((_, i) => i % 2 === 1);
const standFloor = Math.min(...standPose), sink = FLOOR_SINK * (Math.max(...standPose) - standFloor);
for (const [at, f] of frames.entries()) {
  const lowest = Math.min(...drawn.triangles(clip.index, f.seconds, 1).filter((_, i) => i % 2 === 1));
  if (lowest < standFloor - sink) outside.push(`frame ${at} sinks ${(standFloor - lowest).toFixed(1)} below the stand's lowest point`);
}
const step = Math.ceil(frames.length / 14), local = (f: PoseFrame) => f.strikes.map((s) => ({ ...s, x1: s.x1 - f.x, z1: s.z1 - f.z, x2: s.x2 - f.x, z2: s.z2 - f.z }));
const shown = [...new Set([...frames.keys()].filter((at) => at % step === 0 || active.includes(at)))];
await Bun.write(join(output, `${fighter.name}-${pose}.png`), sheet(`${fighter.name} ${pose}`, drawn,
  [1, -1].flatMap((facing) => shown.map((at) => ({ ...frames[at]!, facing, x: 0, z: 0, parts: [], strikes: facing === 1 ? local(frames[at]!) : [] }))), shown.length).png);
if (outside.length > 0) await Bun.write(join(output, `${fighter.name}-${pose}.rejected.mdx`), bytes);
ensure(outside.length === 0, `${fighter.name} ${pose}: ${outside.join("; ")}`);

const path = join(output, fighter.source);
mkdirSync(dirname(path), { recursive: true });
await Bun.write(path, bytes); chmodSync(path, 0o644);
console.log(`REKEY_CLIP ${fighter.name} ${pose}: re-keyed clip ${clip.index} in place over ${frames.length} move frames; every other clip unchanged; ${path}`);
