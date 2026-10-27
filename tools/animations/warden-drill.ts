import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet } from "../../ts/scripts/wisp/hurtboxView";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { AttackPhase, AttackStyle, Character } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/roster/kits";
import { WARDEN_BODY } from "../../ts/src/game/fighters/warden/moves";
import type { StrikeCapsule } from "../../ts/src/game/sim/heroMoves";
import { encodeVerified, ensure, parseSource } from "./original-clips";
import { fighters } from "../../ts/scripts/heroModelSource";
import { INPUTS_STORE, readPins } from "../../ts/scripts/wisp/buildInputs";

const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/warden-drill.ts SHIPPED_ASSETS PRIVATE_OUTPUT");
mkdirSync(output, { recursive: true });
cpSync(join(input, "hero-models"), join(output, "hero-models"), { recursive: true, dereference: true });
chmodSync(join(output, "hero-models"), 0o755);

const PRISTINE_DRILL = "251d4228e26996f30ff70249791ca029eac6153ddf488117acaf6a89ff044445";
const TILT = 45;
const TURNS = 1;
type Quat = Float32Array<ArrayBuffer>;
const about = (axis: readonly [number, number, number], degrees: number): Quat => {
  const half = degrees * Math.PI / 360, s = Math.sin(half), length = Math.hypot(...axis) || 1;
  return new Float32Array([axis[0] / length * s, axis[1] / length * s, axis[2] / length * s, Math.cos(half)]);
};
const times = (a: ArrayLike<number>, b: ArrayLike<number>): Quat => {
  const [x = 0, y = 0, z = 0, w = 1] = Array.from(a), [u = 0, v = 0, s = 0, t = 1] = Array.from(b);
  return new Float32Array([w*u+x*t+y*s-z*v, w*v-x*s+y*t+z*u, w*s+x*v-y*u+z*t, w*t-x*u-y*v-z*s]);
};
const blend = (a: ArrayLike<number>, b: ArrayLike<number>, t: number): Quat => {
  const sign = Array.from(a).reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0) < 0 ? -1 : 1;
  const q = Array.from(a, (v, i) => v * (1 - t) + sign * (b[i] ?? 0) * t), length = Math.hypot(...q) || 1;
  return new Float32Array(q.map(v => v / length));
};
const smooth = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };
const sample = (keys: readonly mdx.AnimKeyframe[], frame: number): Quat => {
  const after = keys.findIndex(k => k.Frame >= frame);
  if (after < 0) return new Float32Array(keys.at(-1)?.Vector ?? [0, 0, 0, 1]);
  const next = keys[after]!, previous = keys[after - 1];
  if (!previous || next.Frame === frame) return new Float32Array(next.Vector);
  return blend(previous.Vector, next.Vector, (frame - previous.Frame) / (next.Frame - previous.Frame));
};

const fighter = fighters.get(Character.warden)!, move = heroDefinition(Character.warden)?.moves.normals[AttackStyle.downAir];
ensure(fighter && move, "missing Warden down air");
const sourceBytes = await Bun.file(join(input, fighter.source)).arrayBuffer();
const shard = readPins()["hero-models"];
const pinned = join(INPUTS_STORE, "hero-models", typeof shard === "object" ? shard.warden ?? "" : "", basename(fighter.source));
ensure(existsSync(pinned) && Buffer.from(sourceBytes).equals(readFileSync(pinned)), `${join(input, fighter.source)} is not this checkout's pinned Warden model; rebuild from the pinned assets (bun wisp inputs path assets)`);
const source = parseSource(sourceBytes);
const model = structuredClone(source);
const index = model.Sequences.findIndex(s => s.Name === "Drill Down Air");
ensure(index >= 0, "Warden has no Drill Down Air clip to re-author");
const [start = 0, end = 0] = model.Sequences[index]!.Interval;
const frames = move.totalFrames, first = move.startupFrames, last = first + move.activeFrames;
ensure(Math.round(frames * 1000 / 60) === end - start, "Drill Down Air length no longer matches the move");
const at = (frame: number) => Math.round(start + frame * 1000 / 60);
const nodes = [...model.Bones, ...model.Helpers];
const pristine = parseSource(await Bun.file(join(INPUTS_STORE, "hero-models", PRISTINE_DRILL, basename(fighter.source))).arrayBuffer());
for (const node of nodes) {
  const original = [...pristine.Bones, ...pristine.Helpers].find(n => n.Name === node.Name);
  for (const track of ["Translation", "Rotation", "Scaling"] as const) {
    const target = node[track], from = original?.[track];
    if (!target || !from) continue;
    const inside = (k: mdx.AnimKeyframe) => k.Frame >= start && k.Frame <= end;
    target.Keys = [...target.Keys.filter(k => k.Frame < start), ...from.Keys.filter(inside), ...target.Keys.filter(k => k.Frame > end)];
  }
}
const named = (name: string) => { const node = nodes.find(n => n.Name === name); ensure(node, `missing ${name}`); return node; };
const pivot = (node: mdx.Node) => Array.from(model.PivotPoints[node.ObjectId] ?? [0, 0, 0]);

const dive = (frame: number) => smooth(frame / first) * (1 - smooth((frame - last) / (frames - last)));
const turn = (frame: number) => {
  const active = Math.max(0, Math.min(1, (frame - first) / (last - first)));
  const settle = smooth((frame - last) / (frames - last));
  return -40 * smooth(frame / first) + 360 * TURNS * active + 40 * settle;
};
const spinRate = (frame: number) => Math.abs(turn(frame + 0.5) - turn(frame - 0.5)) / (360 * TURNS / (last - first));

const drill = named("Drill Motion");
const spine = ["Bone_Pelvis", "Bone_Foot_R", "Bone_Foot_L"].map(name => pivot(named(name))[0] ?? 0);
drill.PivotPoint = model.PivotPoints[drill.ObjectId] = new Float32Array([spine.reduce((sum, x) => sum + x, 0) / spine.length, 0, (WARDEN_BODY.z1 + WARDEN_BODY.z2) / 2 / characterModelScale(Character.warden)]);
const rewrite = (node: mdx.Node, pose: (frame: number, base: Quat) => Quat) => {
  const track = node.Rotation;
  ensure(track, `${node.Name} needs a rotation track`);
  const inside = track.Keys.filter(k => k.Frame >= start && k.Frame <= end);
  const base = inside.length ? inside : [{ Frame: start, Vector: new Float32Array([0, 0, 0, 1]) }];
  const keys = Array.from({ length: frames + 1 }, (_, frame) => {
    const Vector = pose(frame, sample(base, at(frame)));
    return { Frame: at(frame), Vector, ...(track.LineType > 1 ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {}) };
  });
  track.Keys = [...track.Keys.filter(k => k.Frame < start), ...keys, ...track.Keys.filter(k => k.Frame > end)];
};

rewrite(drill, frame => times(about([0, 1, 0], -TILT * dive(frame)), about([0, 0, 1], turn(frame))));

const SPINDLE: Record<string, readonly [number, number, number?]> = { Bone_Root: [0, 0], Bone_Pelvis: [0, 0], Bone_Chest: [6, 0], Bone_Head: [-10, 0],
  Bone_Leg1_R: [0, 7], Bone_Leg2_R: [0, 0], Bone_Foot_R: [50, 0], Bone_Leg1_L: [0, -7], Bone_Leg2_L: [0, 0], Bone_Foot_L: [50, 0] };
const TUCKED: Record<string, readonly [number, number, number?]> = { Bone_Arm1_R: [0, 9], Bone_Arm1_L: [0, -9], Bone_Arm2_R: [0, 4], Bone_Arm2_L: [0, -4], Bone_Hand_R: [0, 0], Bone_Hand_L: [0, 0] };
const [standing = 0, standingEnd = 0] = model.Sequences.find(s => s.Name === "Stand - 1")?.Interval ?? [];
const standPose = (node: mdx.Node) => sample(node.Rotation?.Keys.filter(k => k.Frame >= standing && k.Frame <= standingEnd) ?? [], standing);
for (const [name, [pitch, roll, yaw = 0], tucked] of [...Object.entries(SPINDLE).map(([n, p]) => [n, p, false] as const), ...Object.entries(TUCKED).map(([n, p]) => [n, p, true] as const)]) {
  const node = named(name), rest = tucked ? standPose(node) : new Float32Array([0, 0, 0, 1]);
  rewrite(node, (frame, base) => {
    return blend(base, times(about([0, 0, 1], yaw), times(about([1, 0, 0], roll), times(about([0, 1, 0], pitch), rest))), dive(frame));
  });
}

const SKIRT: Record<string, number> = { Mesh06: 0, Mesh29: 1, Mesh30: 2, Mesh45: 0, Mesh48: 1, Mesh34: 2, Mesh46: 0, Mesh47: 1, Mesh36: 2, Mesh05: 0, Mesh09: 1, Mesh35: 2,
  Mesh41: 0, Mesh44: 1, Mesh32: 2, Mesh33: 2, Mesh42: 0, Mesh43: 1, Mesh37: 2, Mesh38: 2 };
const HOOD: Record<string, number> = { Mesh18: 0, Mesh24: 1, Mesh02: 2, Object01: 3 };
const TRAIL = [180, 25, 18, 10], HOOD_TRAIL = [-10, -10, -8, -6], SQUEEZE = 0.55;
const settle = (frame: number) => frame <= last ? 0 : Math.sin((frame - last) * 0.9) * Math.exp(-(frame - last) / 4);
for (const [name, depth] of Object.entries({ ...SKIRT, ...HOOD })) {
  const node = named(name), [px = 0, py = 0] = pivot(node), length = Math.hypot(px + 8, py) || 1;
  const radial = [(px + 8) / length, py / length, 0] as const, tangent = [py / length, -(px + 8) / length, 0] as const, phase = Math.atan2(py, px + 8);
  rewrite(node, (frame, base) => {
    const lagged = Math.max(0, frame - depth * 1.2), spin = Math.min(1, spinRate(lagged)), reach = dive(lagged);
    const flutter = Math.sin(frame * 1.7 - depth * 1.3 + phase) * (1 + depth) * reach;
    const lift = ((name in HOOD ? HOOD_TRAIL : TRAIL)[depth] ?? 0) * reach + 2 * flutter + 10 * settle(lagged);
    const wrap = 5 * spin * reach + 3 * spin * Math.sin(turn(lagged) * Math.PI / 90 + phase);
    const twist = -18 * spin * reach - 4 * flutter;
    return times(about(radial, wrap), times(about([0, 0, 1], twist), times(about(tangent, lift), blend(base, [0, 0, 0, 1], reach))));
  });
}
for (const [name, depth] of Object.entries(SKIRT)) {
  if (depth > 0) continue;
  const node = named(name), track = node.Scaling ?? { LineType: node.Rotation!.LineType, Keys: [] };
  const keys = Array.from({ length: frames + 1 }, (_, frame) => {
    const squeeze = 1 - SQUEEZE * dive(frame), Vector = new Float32Array([squeeze, squeeze, 1]);
    return { Frame: at(frame), Vector, ...(track.LineType > 1 ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {}) };
  });
  node.Scaling = { ...track, Keys: [...track.Keys.filter(k => k.Frame < start), ...keys, ...track.Keys.filter(k => k.Frame > end)] };
}
const FEATHERS: Record<string, number> = { Mesh22: 1, Mesh13: -1 };
for (const [name, side] of Object.entries(FEATHERS)) {
  rewrite(named(name), (frame, base) => times(about([1, 0, 0], side * (24 + 3 * Math.sin(frame * 1.7)) * dive(frame)), base));
}

const bytes = encodeVerified(parseSource(generateMDX(model)));
const before = new DrawnModel(generateMDX(source), 1), after = new DrawnModel(bytes, 1);
for (const [clip, sequence] of source.Sequences.entries()) {
  if (clip === index) continue;
  for (const t of [0, 0.5, 1]) {
    const time = (sequence.Interval[1] - sequence.Interval[0]) * t / 1000;
    const a = before.triangles(clip, time, 1), b = after.triangles(clip, time, 1);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? Infinity)) < 0.001), `${sequence.Name}: previous clip changed`);
  }
}
const scale = characterModelScale(Character.warden), drawn = new DrawnModel(bytes, scale);
const [pelvis, right, left] = ["Bone_Pelvis", "Bone_Foot_R", "Bone_Foot_L"].map(name => named(name).ObjectId) as [number, number, number];
const report = [1, -1].flatMap(facing => Array.from({ length: last - first + 1 }, (_, i) => first + i).map(frame => {
  const posed = drawn.posed(index, frame / 60, facing).nodes, at = (id: number, axis: number) => posed[id * 2 + axis] ?? 0;
  const x = (at(right, 0) + at(left, 0)) / 2 - at(pelvis, 0), z = at(pelvis, 1) - (at(right, 1) + at(left, 1)) / 2;
  const angle = Math.atan2(facing * x, z) * 180 / Math.PI;
  ensure(Math.abs(angle - TILT) <= 5, `frame ${frame} facing ${facing}: feet ${angle.toFixed(1)} degrees off vertical, not ${TILT}`);
  return angle;
}));
const outside = (x: number, z: number, s: StrikeCapsule) => {
  const dx = s.x2 - s.x1, dz = s.z2 - s.z1, t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (z - s.z1) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - s.x1 - t * dx, z - s.z1 - t * dz) - s.radius;
};
const hits = [...new Set(move.regions.map(region => region.firstFrame))];
const gaps = [1, -1].flatMap(facing => hits.map(frame => {
  const posed = drawn.posed(index, frame / 60, facing).nodes, strikes = move.regions.filter(r => r.firstFrame === frame).flatMap(r => r.hit.strike ? [r.hit.strike] : []);
  const gap = Math.min(...[right, left].flatMap(id => strikes.map(s => outside(facing * (posed[id * 2] ?? 0), posed[id * 2 + 1] ?? 0, s))));
  ensure(gap <= 0, `frame ${frame} facing ${facing}: her nearest foot is ${gap.toFixed(1)} units outside the hit regions`);
  return gap;
}));
chmodSync(join(output, fighter.source), 0o644);
await Bun.write(join(output, fighter.source), bytes);
const moments = [0, 3, first, 8, 9, 10, 11, 12, last, 16, 20, frames];
await Bun.write(join(output, "warden-drill-silhouettes.png"), sheet("Warden drill", drawn,
  [1, -1].flatMap(facing => moments.map(frame => ({ frame, facing, clip: index, seconds: frame / 60,
    phase: frame < first ? AttackPhase.startup : frame <= last ? AttackPhase.active : AttackPhase.recovery, x: 0, z: 0, parts: [], strikes: [] }))), moments.length).png);
console.log(`WARDEN_DRILL_PASS index ${index}, ${frames} frames, tilt ${TILT}, ${TURNS} turns, ${Object.keys(SKIRT).length} skirt and ${Object.keys(HOOD).length} hood bones; feet ${Math.min(...report).toFixed(1)} to ${Math.max(...report).toFixed(1)} degrees off vertical toward her facing on active frames, nearest foot at least ${(-Math.max(...gaps)).toFixed(1)} units inside the hit regions on each hit`);
