import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { AttackStyle } from "../../ts/src/game/sim/codes";
import { MOUNTAIN_KING_MOVES } from "../../ts/src/game/fighters/mountain-king/moves";
import { blenderOptions, blenderSkeleton } from "./blender-keys";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";

const POSES = { neutralAir: AttackStyle.neutralAir, forwardAir: AttackStyle.forwardAir } as const;
type Pose = keyof typeof POSES;
const HAMMERS = [{ side: "R", hand: "Bone_Hand_R", bone: "1Cylinder04" }, { side: "L", hand: "Bone_Hand_L", bone: "1Cylinder03" }] as const;
const TRAIL = "BlizParticleBashTrail";
const TRAIL_LINGER = 2;

const [inputArg, outputArg, poseArg] = process.argv.slice(2), { rig, keys } = blenderOptions(process.argv);
const project = resolve(import.meta.dir, "../..");
ensure(inputArg && outputArg && poseArg && poseArg in POSES && Boolean(rig) !== Boolean(keys) && relative(project, resolve(outputArg)).startsWith(".."),
  "usage: bun tools/animations/mountain-king-aerials.ts SHIPPED_MOUNTAIN_KING.mdx PRIVATE_OUTPUT neutralAir|forwardAir (--rig RIG.json | --keys KEYS.json)");
const pose = poseArg as Pose, input = resolve(inputArg), output = resolve(outputArg);
const source = parseSource(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
const index = source.Sequences.findIndex(s => s.Name === `Attack Gesture ${pose}`), sequence = source.Sequences[index];
const stand = source.Sequences.find(s => s.Name === "Stand Ready");
ensure(sequence && stand && source.Nodes.some(n => n?.Name === TRAIL), "Expected the shipped classic Mountain King with his roster gestures");
const move = MOUNTAIN_KING_MOVES.normals[POSES[pose]];
ensure(move, `${pose}: missing move timing`);
const [start, end] = [sequence.Interval[0]!, sequence.Interval[1]!], frames = Math.round((end - start) * 60 / 1000), at = (frame: number) => start + Math.round(frame * 1000 / 60);
ensure(at(frames) === end, `${pose}: clip length is not a whole number of frames`);
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (track, path) => originals.set(path, track));
const skeleton = blenderSkeleton(source, originals, stand, onGlobalClock);

function hammerHead(hand: string, bone: string): number[] {
  const node = source.Nodes.find(n => n?.Name === bone)!, grip = source.PivotPoints[source.Nodes.find(n => n?.Name === hand)!.ObjectId]!;
  const points = source.Geosets.flatMap(g => Array.from({ length: g.Vertices.length / 3 }, (_, v) => v)
    .filter(v => { const group = g.Groups[g.VertexGroup[v]!]!; return group.length === 1 && group[0] === node.ObjectId; })
    .map(v => [g.Vertices[3 * v]!, g.Vertices[3 * v + 1]!, g.Vertices[3 * v + 2]!]));
  const reach = (p: number[]) => Math.hypot(p[0]! - grip[0]!, p[1]! - grip[1]!, p[2]! - grip[2]!), far = Math.max(...points.map(reach));
  const head = points.filter(p => reach(p) >= 0.6 * far);
  return [0, 1, 2].map(axis => head.reduce((sum, p) => sum + p[axis]!, 0) / head.length);
}

if (rig) {
  await skeleton.writeRig(rig, { frames, contact: move.startupFrames, active: move.activeFrames });
  const written = await Bun.file(rig).json();
  await Bun.write(rig, JSON.stringify({ ...written, pose, hammers: HAMMERS.map(h => ({ ...h, head: hammerHead(h.hand, h.bone) })) }));
  console.log(`MOUNTAIN_KING_RIG ${pose} ${rig}`);
  process.exit(0);
}

const baked = await skeleton.readKeys(keys!, frames);
tracks(model, (track, path) => {
  if (onGlobalClock(track) || baked(path, 0) === undefined || !originals.has(path)) return;
  const like = track.Keys.find(k => k.Frame >= start && k.Frame <= end) ?? track.Keys[0]!;
  track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
  for (let frame = 0; frame <= frames; frame++) {
    const Vector = baked(path, frame)!;
    track.Keys.push({ ...like, Frame: at(frame), Vector, ...like.InTan ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {} });
  }
  track.Keys.sort((a, b) => a.Frame - b.Frame);
});

const trail = model.ParticleEmitters2.find(e => e.Name === TRAIL)!.Visibility as mdx.AnimVector;
ensure(trail && typeof trail === "object" && trail.LineType === mdx.LineType.DontInterp, `${TRAIL}: expected a stepped visibility track`);
const lit = (frame: number, on: number): mdx.AnimKeyframe => ({ Frame: at(frame), Vector: new Float32Array([on]) });
trail.Keys = [...trail.Keys.filter(k => k.Frame < start || k.Frame > end),
  lit(0, 0), lit(move.startupFrames - 1, 1), lit(Math.min(frames, move.startupFrames + move.activeFrames + TRAIL_LINGER), 0)].sort((a, b) => a.Frame - b.Frame);

const bytes = encodeVerified(parseSource(generateMDX(model))), before = new DrawnModel(generateMDX(source), 1), after = new DrawnModel(bytes, 1);
for (const [other, s] of source.Sequences.entries()) if (other !== index) for (const t of [0, 0.5, 1]) {
  const time = (s.Interval[1]! - s.Interval[0]!) * t / 1000, a = before.triangles(other, time, 1), b = after.triangles(other, time, 1);
  ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), `${s.Name}: an unrelated clip changed`);
}
const target = join(output, "heromountainking.mdx");
mkdirSync(dirname(target), { recursive: true }); await Bun.write(target, bytes); chmodSync(target, 0o644);
console.log(`MOUNTAIN_KING_AERIAL ${pose}: ${frames + 1} keys spliced into ${sequence.Name} (index ${index}), trail on frames ${move.startupFrames - 1}-${move.startupFrames + move.activeFrames + TRAIL_LINGER - 1}, ${source.Sequences.length - 1} other clips unchanged -> ${target}`);
