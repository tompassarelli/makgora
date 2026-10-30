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

interface Variant { readonly lean: number; readonly head: number; readonly pelvis: number; readonly sweep: number; readonly elbow: number; readonly hand: number; readonly splay: number; readonly swing: number; readonly bob: number; readonly slide: number; readonly slideR: number; readonly drop: number; readonly lateral: number; readonly alternate: number; readonly cross: number; readonly counter: number; readonly pelvisYaw: number; readonly crouch: number; readonly knee: number; readonly shin: number; readonly handGuard: number }
const GAIT = { alternate: 0, cross: 0, counter: 0, pelvisYaw: 0, crouch: 0, knee: 0, shin: 0, handGuard: 0 };
const VARIANTS: Readonly<Record<string, Variant>> = {
  low: { lean: 52, head: .55, pelvis: .4, sweep: 78, elbow: 8, hand: 46, splay: 14, swing: .35, bob: 2, slide: 0, slideR: 0, drop: 0, lateral: 0, ...GAIT },
  fox: { lean: 42, head: .5, pelvis: .35, sweep: 66, elbow: 10, hand: 38, splay: 16, swing: .4, bob: 2, slide: 0, slideR: 0, drop: 0, lateral: 0, ...GAIT },
  long: { lean: 34, head: .45, pelvis: .3, sweep: 58, elbow: 14, hand: 30, splay: 18, swing: .5, bob: 1.5, slide: 0, slideR: 0, drop: 0, lateral: 0, ...GAIT },
  take2: { lean: 72, head: .62, pelvis: .3, sweep: 88, elbow: 2, hand: 90, splay: -14, swing: .3, bob: 1.5, slide: 26, slideR: 38, drop: 14, lateral: 12, ...GAIT },
  stalker2: { lean: 40, head: .3, pelvis: .45, sweep: 46, elbow: 14, hand: 90, splay: 16, swing: 0, bob: 1.5, slide: 0, slideR: 0, drop: 0, lateral: 0, alternate: 40, cross: 22, counter: 14, pelvisYaw: 8, crouch: 12, knee: 34, shin: 30, handGuard: -20 },
  stalker: { lean: 40, head: .3, pelvis: .45, sweep: 46, elbow: 14, hand: 20, splay: 16, swing: 0, bob: 1.5, slide: 0, slideR: 0, drop: 0, lateral: 0, alternate: 40, cross: 22, counter: 14, pelvisYaw: 8, crouch: 12, knee: 34, shin: 30 },
};
const v = { ...VARIANTS[variantArg], ...JSON.parse(process.env.ILLIDAN_VARIANT ?? "{}") } as Variant;
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
const LEGS = ["L", "R"] as const;
const CONTROLLED = ["Bone_Pelvis", "Bone_Chest", "Bone_Head", ...ARMS.flatMap(({ side }) => [`Bone_Arm1_${side}`, `Bone_Arm2_${side}`, `Bone_Hand_${side}`]), ...LEGS.flatMap(side => [`Bone_Leg1_${side}`, `Bone_Leg2_${side}`, `Bone_Foot_${side}`])];
const smooth = (t: number) => ease(Math.min(1, Math.max(0, t)));
const worldHeight = (name: string) => data.nodes[id(name)]!.matrix[14]!;

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
  const feet = (target: ModelRenderer, targetData: typeof data) => frames.map(frame => { targetData.frame = frame; target.update(0); return Object.fromEntries(LEGS.map(side => [side, { x: targetData.nodes[id(`Bone_Foot_${side}`)]!.matrix[12]!, z: targetData.nodes[id(`Bone_Foot_${side}`)]!.matrix[14]! }])) as Record<"L" | "R", { x: number; z: number }>; });
  const stock = feet(renderer, data);
  const lift = Object.fromEntries(LEGS.map(side => { const z = stock.map(f => f[side].z); const low = Math.min(...z); return [side, { low, span: Math.max(...z) - low }]; })) as Record<"L" | "R", { low: number; span: number }>;
  const raised = (side: "L" | "R", i: number) => (stock[i]![side].z - lift[side].low) / lift[side].span;
  const planted = (side: "L" | "R", i: number) => raised(side, i) < .25;
  const stanceHeight = (table: typeof stock) => { const z = table.flatMap((f, i) => LEGS.filter(side => planted(side, i)).map(side => f[side].z)); return z.reduce((a, b) => a + b, 0) / Math.max(1, z.length); };
  const stockHeight = stanceHeight(stock);
  const inRootOf = (s: Record<string, quat>, bone: string) => quat.multiply(quat.create(), quat.invert(quat.create(), s.Bone_Root!), s[bone]!);
  const mean = Object.fromEntries(ARMS.map(({ side }) => [side, sampled.reduce((sum, s) => sum + pitch(inRootOf(s, `Bone_Arm1_${side}`)), 0) / sampled.length]));
  const swingOf = (s: Record<string, quat>, side: string) => pitch(inRootOf(s, `Bone_Arm1_${side}`)) - mean[side]!;
  const reach = Object.fromEntries(ARMS.map(({ side }) => [side, Math.max(1e-6, ...sampled.map(s => Math.abs(swingOf(s, side))))]));
  const stride = (s: Record<string, quat>) => pitch(inRootOf(s, "Bone_Leg1_L")) - pitch(inRootOf(s, "Bone_Leg1_R"));
  const strideReach = Math.max(1e-6, ...sampled.map(s => Math.abs(stride(s))));
  const results = new Map<string, quat[]>(CONTROLLED.map(n => [n, []]));
  sampled.forEach((s, i) => {
    const u = 1, build = ramp ? .55 + .45 * ease(Math.min(1, i / 6)) : 1;
    const root = s.Bone_Root!;
    const target = new Map<string, quat>();
    const lean = v.lean * build + v.bob * Math.sin(2 * Math.PI * 2 * i / (frames.length - 1));
    const twist = stride(s) / strideReach;
    target.set("Bone_Pelvis", times(root, turn("y", v.pelvis * lean), turn("z", v.pelvisYaw * twist * build)));
    target.set("Bone_Chest", times(root, turn("y", lean), turn("z", -v.counter * twist * build)));
    target.set("Bone_Head", times(root, turn("y", v.head * lean)));
    for (const side of LEGS) {
      const swingWeight = smooth((raised(side, i) - .3) / .4) * build;
      const thigh = (v.crouch + v.knee * swingWeight) * (ramp ? build : 1);
      const shin = (v.crouch * 2 + v.shin * swingWeight) * (ramp ? build : 1);
      target.set(`Bone_Leg1_${side}`, times(turn("y", -thigh), s[`Bone_Leg1_${side}`]!));
      target.set(`Bone_Leg2_${side}`, times(turn("y", shin - thigh), s[`Bone_Leg2_${side}`]!));
      target.set(`Bone_Foot_${side}`, s[`Bone_Foot_${side}`]!);
    }
    for (const { side, sign } of ARMS) {
      const raw = swingOf(s, side);
      const swing = v.alternate === 0 ? v.swing * raw : v.alternate * raw / reach[side]!;
      const guard = v.alternate === 0 ? 0 : (1 - raw / reach[side]!) / 2;
      const a = v.sweep + swing, e = a + v.elbow, h = e + (v.alternate === 0 ? v.hand : v.hand + (v.handGuard - v.hand) * guard);
      const splay = (extra: number) => turn("x", sign * -(v.splay + extra - v.cross * guard));
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
  if (v.crouch !== 0 || v.knee !== 0) {
    const fresh = new ModelRenderer(model);
    const freshData = Reflect.get(fresh, "rendererData") as typeof data;
    fresh.setSequence(index);
    const after = feet(fresh, freshData);
    const drop = stanceHeight(after) - stockHeight;
    const track = node("Bone_Pelvis").Translation as mdx.AnimVector;
    for (const key of track.Keys) if (key.Frame >= start && key.Frame <= end) { const vector = key.Vector as Float32Array; vector[2] = vector[2]! - drop; }
    console.log("ILLIDAN_LEAN pelvis drop", drop.toFixed(2));
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
