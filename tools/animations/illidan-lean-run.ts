import { chmodSync, cpSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { mat4, quat } from "../../ts/node_modules/gl-matrix";
import { ModelRenderer, generateMDL, type model as mdx } from "war3-model";
import { generateModelMDX, parseModelMDX } from "../../ts/scripts/mdxCodec";
import { ensure } from "./original-clips";

const [assetsArg, outputArg, variantArg] = process.argv.slice(2);
ensure(assetsArg && outputArg && variantArg, "usage: bun tools/animations/illidan-lean-run.ts PRIVATE_ASSETS PRIVATE_OUTPUT VARIANT");
const [assets, output] = [assetsArg, outputArg].map(p => resolve(p));
ensure(relative(resolve(import.meta.dir, "../.."), output).startsWith(".."), "Illidan art stays outside the checkout");

interface Variant { readonly lean: number; readonly head: number; readonly pelvis: number; readonly sweep: number; readonly elbow: number; readonly hand: number; readonly splay: number; readonly swing: number; readonly bob: number; readonly slide: number; readonly slideR: number; readonly drop: number; readonly lateral: number }
const VARIANTS: Readonly<Record<string, Variant>> = {
  low: { lean: 52, head: .55, pelvis: .4, sweep: 78, elbow: 8, hand: 46, splay: 14, swing: .35, bob: 2, slide: 0, slideR: 0, drop: 0, lateral: 0 },
  fox: { lean: 42, head: .5, pelvis: .35, sweep: 66, elbow: 10, hand: 38, splay: 16, swing: .4, bob: 2, slide: 0, slideR: 0, drop: 0, lateral: 0 },
  long: { lean: 34, head: .45, pelvis: .3, sweep: 58, elbow: 14, hand: 30, splay: 18, swing: .5, bob: 1.5, slide: 0, slideR: 0, drop: 0, lateral: 0 },
  take2: { lean: 72, head: .62, pelvis: .3, sweep: 88, elbow: 2, hand: 90, splay: -14, swing: .3, bob: 1.5, slide: 26, slideR: 38, drop: 14, lateral: 12 },
};
const v = VARIANTS[variantArg];
ensure(v, `${variantArg}: variants are ${Object.keys(VARIANTS).join(", ")}`);

const rad = (degrees: number) => degrees * Math.PI / 180;
const turn = (axis: "x" | "y", degrees: number) => quat.setAxisAngle(quat.create(), axis === "x" ? [1, 0, 0] : [0, 1, 0], rad(degrees));
const times = (...parts: quat[]) => parts.reduce((total, part) => quat.multiply(quat.create(), total, part), quat.create());
const ease = (t: number) => t * t * (3 - 2 * t);

mkdirSync(output, { recursive: true });
cpSync(join(assets, "illidan-animation"), output, { recursive: true, dereference: true });
for (const file of ["DemonHunterFighter.mdx", "demonhunter-fighter.mdl", "clips.json", "bindings.json"]) chmodSync(join(output, file), 0o644);
const sourceBytes = await Bun.file(join(output, "DemonHunterFighter.mdx")).arrayBuffer();
const model = parseModelMDX(sourceBytes) as mdx.Model;
const node = (name: string) => {
  const found = model.Nodes.find(n => n?.Name === name);
  ensure(found, `${name}: not in Illidan's rig`);
  return found;
};
const id = (name: string) => node(name).ObjectId;

const renderer = new ModelRenderer(model);
const data = Reflect.get(renderer, "rendererData") as { frame: number; nodes: { matrix: Float32Array }[] };
const worldRotation = (name: string) => {
  const m = data.nodes[id(name)]!.matrix;
  const scale = (column: number) => Math.hypot(m[column]!, m[column + 1]!, m[column + 2]!) || 1;
  const rotation = mat4.fromValues(m[0]! / scale(0), m[1]! / scale(0), m[2]! / scale(0), 0, m[4]! / scale(4), m[5]! / scale(4), m[6]! / scale(4), 0, m[8]! / scale(8), m[9]! / scale(8), m[10]! / scale(8), 0, 0, 0, 0, 1);
  return mat4.getRotation(quat.create(), rotation);
};

const pitch = (rotation: quat) => {
  const [x, y, z, w] = [rotation[0]!, rotation[1]!, rotation[2]!, rotation[3]!];
  return Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y)) * 180 / Math.PI;
};

const ARMS = [{ side: "R", sign: -1 }, { side: "L", sign: 1 }] as const;
const CONTROLLED = ["Bone_Pelvis", "Bone_Chest", "Bone_Head", ...ARMS.flatMap(({ side }) => [`Bone_Arm1_${side}`, `Bone_Arm2_${side}`, `Bone_Hand_${side}`]), "Bone_Leg1_L", "Bone_Leg1_R"];

function rewrite(name: "Locomotion Run" | "Locomotion Initial Dash Burst", ramp: boolean) {
  const index = model.Sequences.findIndex(s => s.Name === name);
  ensure(index >= 0, `${name}: not in the shipped model`);
  const [start = 0, end = 0] = model.Sequences[index]!.Interval;
  const chest = node("Bone_Chest").Rotation as mdx.AnimVector;
  const frames = chest.Keys.filter(k => k.Frame >= start && k.Frame <= end).map(k => k.Frame);
  renderer.setSequence(index);
  const sampled = frames.map(frame => {
    data.frame = frame;
    renderer.update(0);
    return Object.fromEntries(["Bone_Root", ...CONTROLLED].map(bone => [bone, worldRotation(bone)])) as Record<string, quat>;
  });
  const inRootOf = (s: Record<string, quat>, bone: string) => quat.multiply(quat.create(), quat.invert(quat.create(), s.Bone_Root!), s[bone]!);
  const mean = Object.fromEntries(ARMS.map(({ side }) => [side, sampled.reduce((sum, s) => sum + pitch(inRootOf(s, `Bone_Arm1_${side}`)), 0) / sampled.length]));
  const results = new Map<string, quat[]>(CONTROLLED.map(n => [n, []]));
  sampled.forEach((s, i) => {
    const u = 1, build = ramp ? .55 + .45 * ease(Math.min(1, i / 6)) : 1;
    const root = s.Bone_Root!;
    const target = new Map<string, quat>();
    const lean = v.lean * build + v.bob * Math.sin(2 * Math.PI * 2 * i / (frames.length - 1));
    target.set("Bone_Pelvis", times(root, turn("y", v.pelvis * lean)));
    target.set("Bone_Chest", times(root, turn("y", lean)));
    target.set("Bone_Head", times(root, turn("y", v.head * lean)));
    target.set("Bone_Leg1_L", s.Bone_Leg1_L!);
    target.set("Bone_Leg1_R", s.Bone_Leg1_R!);
    for (const { side, sign } of ARMS) {
      const swing = v.swing * (pitch(inRootOf(s, `Bone_Arm1_${side}`)) - mean[side]!);
      const a = v.sweep + swing, e = a + v.elbow, h = e + v.hand;
      const splay = (extra: number) => turn("x", sign * -(v.splay + extra));
      target.set(`Bone_Arm1_${side}`, times(root, turn("y", a), splay(0)));
      target.set(`Bone_Arm2_${side}`, times(root, turn("y", e), splay(-4)));
      target.set(`Bone_Hand_${side}`, times(root, turn("y", h), splay(-8)));
    }
    const world = new Map<string, quat>();
    for (const bone of CONTROLLED) {
      const old = s[bone]!, goal = target.get(bone)!;
      world.set(bone, quat.slerp(quat.create(), old, quat.dot(old, goal) < 0 ? quat.scale(quat.create(), goal, -1) : goal, u));
    }
    for (const bone of CONTROLLED) {
      const parent = model.Nodes.find(n => n?.ObjectId === node(bone).Parent);
      ensure(parent, `${bone}: no parent`);
      const parentWorld = world.get(parent.Name) ?? (parent.Name === "Bone_Root" ? root : undefined);
      ensure(parentWorld, `${bone}: parent is neither controlled nor the root`);
      results.get(bone)!.push(quat.normalize(quat.create(), quat.multiply(quat.create(), quat.invert(quat.create(), parentWorld), world.get(bone)!)));
    }
  });
  for (const bone of CONTROLLED) {
    const track = node(bone).Rotation as mdx.AnimVector;
    ensure(track.LineType === 1, `${bone}: expects linear rotation keys`);
    const fresh = frames.map((frame, i) => ({ Frame: frame, Vector: Float32Array.from(results.get(bone)![i]!) }) as mdx.AnimKeyframe);
    let previous: Float32Array | undefined;
    for (const key of fresh) {
      const vector = key.Vector as Float32Array;
      if (previous && previous.reduce((dot, value, axis) => dot + value * vector[axis]!, 0) < 0) for (let axis = 0; axis < 4; axis++) vector[axis] = -vector[axis]!;
      previous = vector;
    }
    track.Keys = [...track.Keys.filter(k => k.Frame < start || k.Frame > end), ...fresh].sort((a, b) => a.Frame - b.Frame);
  }
  for (const blade of ["blade_base", "stand_blade_L"]) {
    const track = node(blade).Translation as mdx.AnimVector | undefined;
    ensure(track, `${blade}: no translation track`);
    for (const key of track.Keys) if (key.Frame >= start && key.Frame <= end) { const vector = key.Vector as Float32Array; vector[0] = vector[0]! + v.slide + (blade === "blade_base" ? v.slideR : 0); vector[1] = vector[1]! + v.lateral; vector[2] = vector[2]! + v.drop; }
  }
  console.log("ILLIDAN_LEAN", name, variantArg, frames.length, "keys per bone");
}

rewrite("Locomotion Run", false);
rewrite("Locomotion Initial Dash Burst", true);
const bytes = generateModelMDX(model);
ensure(parseModelMDX(bytes).Sequences.length === model.Sequences.length, "MDX lost sequences");
await Bun.write(join(output, "DemonHunterFighter.mdx"), bytes);
await Bun.write(join(output, "demonhunter-fighter.mdl"), generateMDL(parseModelMDX(bytes)));
console.log("ILLIDAN_LEAN_PASS", variantArg, output);
