import { generateMDX, parseMDX, type model as mdx } from "war3-model";
import { join } from "node:path";
import { about, add, lerp3, length, normalized, rotation, rotationDifference, Rig, scale, slerp, sub, unitQuat, type Basis, type Quat, type Vec3 } from "./lichking-rig";

type Side = "R" | "L";
interface Beat {
  readonly drop?: number; readonly shift?: number; readonly lean?: number;
  readonly footR?: Vec3; readonly footL?: Vec3; readonly handR?: Vec3; readonly handL?: Vec3; readonly aimR?: Vec3; readonly aimL?: Vec3;
}
type Beats = Readonly<Record<number, Beat>>;

const out = process.argv[2];
if (!out) throw new Error("usage: bun tools/animations/illidan-down-smash.ts PRIVATE_OUTPUT");
const file = join(out, "DemonHunterFighter.mdx");
const model = parseMDX(await Bun.file(file).arrayBuffer());
const nodes: mdx.Node[] = [...model.Bones, ...model.Helpers];
const rig = new Rig({ Bones: nodes, PivotPoints: model.PivotPoints } as unknown as mdx.Model);
const LEGS: Record<Side, readonly [string, string, string]> = { R: ["Bone_Leg1_R", "Bone_Leg2_R", "Bone_Foot_R"], L: ["Bone_Leg1_L", "Bone_Leg2_L", "Bone_Foot_L"] };
const ARMS: Record<Side, readonly [string, string, string]> = { R: ["Bone_Arm1_R", "Bone_Arm2_R", "Bone_Hand_R"], L: ["Bone_Arm1_L", "Bone_Arm2_L", "Bone_Hand_L"] };
const TIPS: Record<Side, string> = { R: "Plane36", L: "Plane22" };
const SIDE: Record<Side, number> = { R: -1, L: 1 };
// Illidan's clips are keyed at Blender's 24 frames a second, so clip frame N sits at N * 1000 / 24 ms into its sequence.
const FRAME_MS = 1000 / 24;
const SKELETON = new Set(["Bone_Pelvis", "Bone_Chest", "Bone_Head", ...Object.values(LEGS).flat(), ...Object.values(ARMS).flat()]);
const posed = (node: mdx.Node) => SKELETON.has(node.Name);

function track(node: mdx.Node, channel: "Translation" | "Rotation" | "Scaling"): mdx.AnimVector | undefined {
  const t = (node as unknown as Record<string, mdx.AnimVector | number | undefined>)[channel];
  return typeof t === "object" ? t : undefined;
}

function sampleAt(t: mdx.AnimVector | undefined, [start, end]: readonly [number, number], ms: number, rest: readonly number[]): number[] {
  const keys = t?.Keys.filter(k => k.Frame >= start && k.Frame <= end) ?? [];
  if (keys.length === 0) return [...rest];
  const after = keys.findIndex(k => k.Frame >= ms);
  if (after < 0) return Array.from(keys.at(-1)!.Vector);
  if (after === 0 || keys[after]!.Frame === ms) return Array.from(keys[after]!.Vector);
  const a = keys[after - 1]!, b = keys[after]!, u = (ms - a.Frame) / (b.Frame - a.Frame);
  if (a.Vector.length === 4) return [...slerp(Array.from(a.Vector) as unknown as Quat, Array.from(b.Vector) as unknown as Quat, u)];
  return Array.from(a.Vector, (v, i) => v + (b.Vector[i]! - v) * u);
}

function sample(interval: readonly [number, number], ms: number): Map<string, Basis> {
  return new Map(nodes.map(n => [n.Name, {
    t: sampleAt(track(n, "Translation"), interval, ms, [0, 0, 0]) as unknown as Vec3,
    q: unitQuat(sampleAt(track(n, "Rotation"), interval, ms, [0, 0, 0, 1]) as unknown as Quat),
    s: sampleAt(track(n, "Scaling"), interval, ms, [1, 1, 1]) as unknown as Vec3,
  }]));
}

function aim(name: string, end: Vec3, target: Vec3): void {
  const pivot = rig.position(name);
  rig.transform(name, about(pivot, rotation(rotationDifference(sub(end, pivot), sub(target, pivot)))));
}

function solve([upper, lower, tip]: readonly [string, string, string], target: Vec3, pole: Vec3): void {
  const start = rig.position(upper), joint = rig.position(lower), end = rig.position(tip);
  const a = length(sub(joint, start)), b = length(sub(end, joint));
  const direction = normalized(sub(target, start));
  const distance = Math.min(Math.max(length(sub(target, start)), Math.abs(a - b) + 0.01), a + b - 0.01);
  let across = sub(pole, start);
  across = sub(across, scale(direction, across[0] * direction[0] + across[1] * direction[1] + across[2] * direction[2]));
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const bend = add(add(start, scale(direction, along)), scale(normalized(across), Math.sqrt(Math.max(0, a * a - along * along))));
  aim(upper, joint, bend);
  aim(lower, rig.position(tip), add(start, scale(direction, distance)));
}

const ease = (t: number) => t * t * (3 - 2 * t);
function beatAt(beats: Beats, frame: number): { beat: Beat; next: Beat; t: number } {
  const frames = Object.keys(beats).map(Number).sort((a, b) => a - b);
  const left = Math.max(...frames.filter(k => k <= frame)), right = Math.min(...frames.filter(k => k >= frame));
  return { beat: beats[left]!, next: beats[right]!, t: left === right ? 0 : ease((frame - left) / (right - left)) };
}

function pose(base: Map<string, Basis>, beats: Beats, frame: number): void {
  rig.set(base);
  const { beat, next, t } = beatAt(beats, frame);
  const num = (k: "drop" | "shift" | "lean") => (beat[k] ?? 0) * (1 - t) + (next[k] ?? 0) * t;
  const planted = { R: rig.position("Bone_Foot_R"), L: rig.position("Bone_Foot_L") };
  const hands = { R: rig.position("Bone_Hand_R"), L: rig.position("Bone_Hand_L") };
  const move: Vec3 = [num("shift"), 0, -num("drop")];
  for (const name of ["Bone_Pelvis", "Bone_Chest"]) rig.transform(name, { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: move });
  const chest = rig.position("Bone_Chest");
  const lean = num("lean") * Math.PI / 180;
  rig.transform("Bone_Chest", about(chest, { m: [Math.cos(lean), 0, Math.sin(lean), 0, 1, 0, -Math.sin(lean), 0, Math.cos(lean)], t: [0, 0, 0] }));
  const goal = (k: keyof Beat, rest: Vec3): Vec3 => {
    const a = beat[k] as Vec3 | undefined, b = next[k] as Vec3 | undefined;
    return lerp3(a ?? rest, b ?? rest, t);
  };
  for (const s of ["R", "L"] as const) {
    const hip = rig.position(LEGS[s][0]);
    solve(LEGS[s], goal(`foot${s}`, planted[s]), add(hip, [40, SIDE[s] * 12, 10]));
  }
  for (const s of ["R", "L"] as const) {
    const target = goal(`hand${s}`, add(hands[s], move));
    if (beat[`hand${s}`] !== undefined || next[`hand${s}`] !== undefined) solve(ARMS[s], target, add(rig.position("Bone_Chest"), [-25, SIDE[s] * 45, -10]));
    const a = beat[`aim${s}`], b = next[`aim${s}`];
    if (a !== undefined || b !== undefined) {
      const tip = rig.position(TIPS[s]);
      aim(ARMS[s][2], tip, lerp3(a ?? tip, b ?? tip, t));
    }
  }
}

function author(name: string, beats: Beats, baseFrom: string): void {
  const sequence = model.Sequences.find(s => s.Name === name)!;
  const interval = [sequence.Interval[0]!, sequence.Interval[1]!] as const;
  const source = model.Sequences.find(s => s.Name === baseFrom)!;
  const base = sample([source.Interval[0]!, source.Interval[1]!], source.Interval[0]!);
  const last = Math.round((interval[1] - interval[0]) / FRAME_MS);
  const keyed = new Map<string, { t: number[][]; q: number[][] }>();
  for (let frame = 0; frame <= last; frame++) {
    pose(base, beats, frame);
    const now = rig.pose();
    for (const node of nodes.filter(posed)) {
      const b = now.get(node.Name)!;
      const entry = keyed.get(node.Name) ?? { t: [], q: [] };
      const previous = entry.q.at(-1);
      const q = [...unitQuat(b.q)];
      if (previous && previous.reduce((sum, v, i) => sum + v * q[i]!, 0) < 0) q.forEach((v, i) => { q[i] = -v; });
      entry.t.push([...b.t]);
      entry.q.push(q);
      keyed.set(node.Name, entry);
    }
  }
  for (const node of nodes.filter(posed)) {
    const values = keyed.get(node.Name)!;
    for (const [channel, list] of [["Translation", values.t], ["Rotation", values.q]] as const) {
      const t = track(node, channel);
      if (t === undefined || t.GlobalSeqId != null) throw new Error(`${node.Name} has no clip ${channel} track`);
      const kept = t.Keys.filter(k => k.Frame < interval[0] || k.Frame > interval[1]);
      const fresh = list.map((v, frame) => {
        const vector = new Float32Array(v);
        return { Frame: Math.min(interval[1], interval[0] + Math.round(frame * FRAME_MS)), Vector: vector, ...(t.LineType > 1 ? { InTan: vector, OutTan: vector } : {}) };
      });
      t.Keys = [...kept, ...fresh].sort((a, b) => a.Frame - b.Frame);
    }
  }
  console.log("DOWN_SMASH_CLIP", name, last, "frames");
}

const foot = (s: Side) => rig.position(LEGS[s][2]);
const smash = model.Sequences.find(s => s.Name === "Down Smash")!;
rig.set(sample([smash.Interval[0]!, smash.Interval[1]!], smash.Interval[0]!));
const rest = { R: foot("R"), L: foot("L") };
const hip = rig.position("Bone_Leg1_R");
const legLength = length(sub(rig.position("Bone_Leg2_R"), hip)) + length(sub(rest.R, rig.position("Bone_Leg2_R")));
const floor = rest.R[2];
const crouch: Beat = {
  drop: 26, shift: -10, lean: 16,
  footR: [rest.R[0] - 6, rest.R[1] + 6, floor + 6], footL: [rest.L[0] + 4, rest.L[1], floor],
  handR: [6, -34, 70], aimR: [30, -40, 150], handL: [-24, 34, 70], aimL: [-50, 40, 150],
};
const splitDrop = hip[2] - floor - 6;
const split = (reach: number, sink: number, shift: number): Beat => ({
  drop: splitDrop + sink, shift, lean: 14,
  footR: [hip[0] + shift + reach, rest.R[1] - 4, floor], footL: [hip[0] + shift - reach, rest.L[1] + 4, floor + 4],
  handR: [shift + 34, -44, 66 - sink], aimR: [shift + 80, -50, 150 - sink], handL: [shift - 36, 44, 66 - sink], aimL: [shift - 84, 50, 150 - sink],
});
const contact = split(legLength * 0.84, 0, 18);
const peak = split(legLength * 0.98, 6, 26);
const hold = split(legLength * 0.94, 4, 24);
const risen = { ...split(legLength * 0.62, -32, 12), lean: 8, handR: [40, -30, 60] as Vec3, aimR: [120, -30, 40] as Vec3, handL: [-10, 30, 64] as Vec3, aimL: [-90, 30, 30] as Vec3 };

author("Down Smash", { 0: {}, 3: crouch, 5: contact, 7: peak, 9: hold, 25: risen, 42: {} }, "Down Smash");
author("Down Smash Charge", { 0: crouch, 24: crouch }, "Down Smash");
author("Down Smash Release", { 0: crouch, 2: contact, 4: peak, 7: hold, 20: risen, 34: {} }, "Down Smash");
const bytes = generateMDX(model);
await Bun.write(file, bytes);
console.log("ILLIDAN_DOWN_SMASH", file, bytes.byteLength, "bytes; leg", legLength.toFixed(1), "floor", floor.toFixed(1));
