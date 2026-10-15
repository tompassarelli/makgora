import { chmodSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { quat, vec3 } from "gl-matrix";
import { DrawnModel, sampleAttack, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackStyle, Character } from "../../ts/src/game/sim/codes";
import type { HeroClip, HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { SHADOW_HUNTER_MOVES } from "../../ts/src/game/sim/heroes/shadowHunterMoves";
import { SHADOW_HUNTER_SPECIALS } from "../../ts/src/game/sim/heroes/shadowHunterSpecials";
import { SHADOW_HUNTER_AUTHORED_CLIPS } from "../../ts/src/game/presentation/heroes/shadowHunterClipInfo";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";

interface Gesture {
  lean?: number; chest?: number; chestTurn?: number; head?: number; pelvis?: number;
  arm?: number; armYaw?: number; elbow?: number; wrist?: number; wristRoll?: number;
  free?: number; freeYaw?: number; freeElbow?: number;
  frontHip?: number; frontKnee?: number; frontFoot?: number; backHip?: number; backKnee?: number; backFoot?: number;
  drop?: number; lunge?: number; spin?: number;
}
interface Phase { frame: number; gesture: Gesture; tip?: readonly [number, number] | readonly [number, number, number]; grip?: readonly [number, number] }
interface Authored { pose: HeroPose; style: AttackStyle; phases: readonly Phase[]; airborne?: boolean; frames?: number; looping?: boolean; forms?: readonly HeroPose[] }

const READY: Gesture = {};

function neutralSpecial(): Authored {
  const special = SHADOW_HUNTER_SPECIALS.neutral.ground!;
  const release = special.projectiles![0]!.spawnFrame, total = special.endFrame;
  const coil: Gesture = { lean: -8, chest: -6, chestTurn: 60, head: 10, pelvis: -6, free: -90, freeYaw: 130, freeElbow: 10,
    frontHip: 5, frontKnee: 30, frontFoot: 5, backHip: -50, backKnee: 65, backFoot: 15, lunge: -10 };
  const thrown: Gesture = { lean: 10, chest: 6, chestTurn: -20, head: -10, pelvis: 4, free: -85, freeYaw: 30, freeElbow: 5,
    frontHip: 35, frontKnee: 15, frontFoot: 25, backHip: -45, backKnee: 35, backFoot: -5, lunge: 14 };
  const behind = (x: number, z: number) => ({ tip: [x - 45, z - 8, 50], grip: [x, z] }) as const;
  return { pose: "neutralSpecial", style: AttackStyle.forwardSmash, frames: total, forms: ["neutralSpecialAir", "neutralSpecialFollowUp", "neutralSpecialFollowUpAir"], phases: [
    { frame: 0, gesture: READY },
    { frame: 7, gesture: { ...coil, chestTurn: 35, free: -90, freeYaw: 170, freeElbow: 20, backHip: -30, backKnee: 40, frontKnee: 15, lean: -4, lunge: -5 }, ...behind(-10, 45) },
    { frame: release - 5, gesture: coil, ...behind(-5, 50) },
    { frame: release - 3, gesture: { ...coil, chestTurn: 30, lean: 2, free: -105, freeYaw: 95, freeElbow: 20, backHip: -45, backKnee: 25, frontHip: 15, frontKnee: 15, lunge: 0 }, ...behind(-15, 45) },
    { frame: release - 1, gesture: thrown, ...behind(-25, 40) },
    { frame: release, gesture: { ...thrown, free: -80, freeYaw: 15, chestTurn: -30, lean: 12, lunge: 17 }, ...behind(-27, 37) },
    { frame: release + 6, gesture: { ...thrown, free: -40, freeYaw: -5, freeElbow: 10, chestTurn: -40, lean: 15, lunge: 19, backKnee: 40 }, ...behind(-22, 33) },
    { frame: release + 12, gesture: { ...thrown, free: -10, freeYaw: -20, freeElbow: 20, chestTurn: -30, lean: 9, lunge: 12, frontHip: 22, frontKnee: 10, frontFoot: 15, backHip: -30, backKnee: 25 }, tip: [-20, 15, 30], grip: [-5, 40] },
    { frame: total - 3, gesture: READY },
    { frame: total, gesture: READY },
  ] };
}

const POSES: Readonly<Record<string, () => Authored>> = { neutralSpecial };

function rotation(base: ArrayLike<number>, pitch: number, yaw = 0, roll = 0): Float32Array {
  const q = quat.create(); quat.rotateY(q, q, pitch * Math.PI / 180); quat.rotateZ(q, q, yaw * Math.PI / 180); quat.rotateX(q, q, roll * Math.PI / 180);
  quat.multiply(q, q, Float32Array.from(base)); quat.normalize(q, q); return new Float32Array(q);
}
function joint(name: string, g: Gesture): [number, number, number] {
  switch (name) {
    case "Attack Gesture": return [g.lean ?? 0, g.spin ?? 0, 0];
    case "Bone_Chest": return [g.chest ?? 0, g.chestTurn ?? 0, 0];
    case "Bone_Head": return [g.head ?? 0, 0, 0];
    case "Bone_Pelvis": return [g.pelvis ?? 0, 0, 0];
    case "Bone_Arm1_R": return [g.arm ?? 0, g.armYaw ?? 0, 0];
    case "Bone_Arm2_R": return [g.elbow ?? 0, 0, 0];
    case "Bone_Hand_R": return [g.wrist ?? 0, 0, g.wristRoll ?? 0];
    case "Bone_Arm1_L": return [g.free ?? 0, g.freeYaw ?? 0, 0];
    case "Bone_Arm2_L": return [g.freeElbow ?? 0, 0, 0];
    case "Bone_Leg1_L": return [g.frontHip ?? 0, 0, 0];
    case "Bone_Leg2_L": return [g.frontKnee ?? 0, 0, 0];
    case "Bone_Foot_L": return [g.frontFoot ?? 0, 0, 0];
    case "Bone_Leg1_R": return [g.backHip ?? 0, 0, 0];
    case "Bone_Leg2_R": return [g.backKnee ?? 0, 0, 0];
    case "Bone_Foot_R": return [g.backFoot ?? 0, 0, 0];
    default: return [0, 0, 0];
  }
}

const [inputArg, outputArg, ...selected] = process.argv.slice(2);
const project = resolve(import.meta.dir, "../..");
const input = resolve(inputArg ?? ""), output = resolve(outputArg ?? "");
ensure(inputArg && outputArg && relative(project, output).startsWith("..") && selected.length > 0 && selected.every(pose => pose in POSES),
  `usage: bun tools/animations/shadow-hunter-clips.ts PUBLISHED_HEROSHADOWHUNTER.mdx PRIVATE_OUTPUT POSE... (${Object.keys(POSES).join(", ")})`);
const source = parseSource(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
const named = (name: string) => { const node = model.Nodes.find(n => n?.Name === name); ensure(node, `missing ${name}`); return node; };
const standIndex = source.Sequences.findIndex(s => /^stand ready$/i.test(s.Name)); ensure(standIndex >= 0, "missing Stand Ready");
const stand = source.Sequences[standIndex]!;
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (track, path) => originals.set(path, track));
const renderer = new ModelRenderer(model), data = Reflect.get(renderer, "rendererData") as { frame: number; nodes: { matrix: Float32Array }[] };
const hand = named("Bone_Hand_R"), tipNode = named("Weapon Ref"), root = named("Bone_Root");
const tipPivot = model.PivotPoints[tipNode.ObjectId]!;
const tipAt = () => { const p = vec3.fromValues(tipPivot[0]!, tipPivot[1]!, tipPivot[2]!); vec3.transformMat4(p, p, data.nodes[tipNode.ObjectId]!.matrix as unknown as Float32Array); return p; };
const footRest = Math.min(model.PivotPoints[model.Nodes.find(n => n?.Name === "Foot Left Ref ")!.ObjectId]![2]!, model.PivotPoints[model.Nodes.find(n => n?.Name === "Foot Right Ref ")!.ObjectId]![2]!);
const time = (start: number, frame: number) => start + Math.round(frame * 1000 / 60);

let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
const bindings = new Map<string, HeroClip>(Object.entries(SHADOW_HUNTER_AUTHORED_CLIPS));
const authored: { pose: HeroPose; index: number; frames: number; phases: readonly Phase[] }[] = [];

for (const pose of selected) {
  const action = POSES[pose]!();
  const frames = action.frames ?? SHADOW_HUNTER_MOVES.normals[action.style]!.totalFrames;
  const name = `Attack Gesture ${pose}`;
  let index = model.Sequences.findIndex(s => s.Name === name);
  let start: number;
  if (index >= 0) {
    const sequence = model.Sequences[index]!; start = sequence.Interval[0];
    ensure(sequence.Interval[1] === time(start, frames), `${name}: clip length differs from move frames`);
    tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(key => key.Frame < start || key.Frame > sequence.Interval[1]); });
  } else {
    index = model.Sequences.length; start = cursor; cursor = time(start, frames) + 100;
    model.Sequences.push({ ...stand, Name: name, Interval: new Uint32Array([start, time(start, frames)]), NonLooping: !action.looping, MoveSpeed: 0, Rarity: 0,
      MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
  }
  tracks(model, (track, path) => {
    const donor = originals.get(path); if (!donor || onGlobalClock(donor)) return;
    const first = donor.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]) ?? donor.Keys.find(k => k.Frame === 0);
    if (!first) return;
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path), node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
    let previous: Float32Array | undefined;
    for (const phase of action.phases) {
      const [pitch, yaw, roll] = node ? joint(node.Name, phase.gesture) : [0, 0, 0];
      const Vector = node ? rotation(first.Vector, pitch, yaw, roll) : first.Vector.slice();
      if (node && previous && Vector.reduce((sum, v, i) => sum + v * previous![i]!, 0) < 0) Vector.forEach((v, i) => { Vector[i] = -v; });
      previous = Vector;
      const tangent = () => match || track.LineType === mdx.LineType.Bezier ? Vector.slice() : new Float32Array(Vector.length);
      track.Keys.push({ ...first, Frame: time(start, phase.frame), Vector, ...first.InTan ? { InTan: tangent(), OutTan: tangent() } : {} });
    }
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  });
  const rootBase = originals.get(`.Bones.${source.Bones.findIndex(b => b.Name === "Bone_Root")}.Translation`)!.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1])!.Vector;
  for (const phase of action.phases) {
    const key = root.Translation!.Keys.find(k => k.Frame === time(start, phase.frame))!;
    key.Vector = new Float32Array([rootBase[0]! + (phase.gesture.lunge ?? 0), rootBase[1]!, rootBase[2]! + (phase.gesture.drop ?? 0)]);
    if (key.InTan) { key.InTan = new Float32Array(3); key.OutTan = new Float32Array(3); }
  }
  renderer.setSequence(index);
  const arm = named("Bone_Arm1_R"), elbow = named("Bone_Arm2_R");
  const baseOf = (node: mdx.Node) => originals.get(`.Bones.${source.Bones.findIndex(b => b.Name === node.Name)}.Rotation`)!.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1])!.Vector;
  for (const phase of action.phases) if (phase.tip) {
    const at = time(start, phase.frame);
    const keys = [arm, elbow, hand].map(n => n.Rotation!.Keys.find(k => k.Frame === at)!);
    const angles = [phase.gesture.arm ?? 0, phase.gesture.armYaw ?? 0, 0, phase.gesture.elbow ?? 0, phase.gesture.wrist ?? 0, phase.gesture.wristRoll ?? 0];
    const apply = () => {
      keys[0]!.Vector = rotation(baseOf(arm), angles[0]!, angles[1]!, angles[2]!);
      keys[1]!.Vector = rotation(baseOf(elbow), angles[3]!, 0, 0);
      keys[2]!.Vector = rotation(baseOf(hand), angles[4]!, 0, angles[5]!);
      for (const key of keys) if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); }
      data.frame = at; renderer.update(0);
    };
    const gripAt = () => { const pivot = model.PivotPoints[hand.ObjectId]!, p = vec3.fromValues(pivot[0]!, pivot[1]!, pivot[2]!); vec3.transformMat4(p, p, data.nodes[hand.ObjectId]!.matrix as unknown as Float32Array); return p; };
    const loss = () => { apply(); const p = tipAt(), g = phase.grip ? gripAt() : undefined;
      return (p[0]! - phase.tip![0]) ** 2 + (p[2]! - phase.tip![1]) ** 2 + (phase.tip![2] === undefined ? 0.3 * p[1]! ** 2 : (p[1]! - phase.tip![2]) ** 2) + (g ? (g[0]! - phase.grip![0]) ** 2 + (g[2]! - phase.grip![1]) ** 2 : 0); };
    for (let pass = 0; pass < 4; pass++) for (const axis of [0, 3, 4, 1, 2, 5]) {
      let best = Infinity, bestAngle = angles[axis]!;
      const centre = angles[axis]!, span = pass < 2 ? 180 : 30, step = pass < 2 ? 10 : 2;
      for (let angle = centre - span; angle <= centre + span; angle += step) { angles[axis] = angle; const value = loss(); if (value < best) { best = value; bestAngle = angle; } }
      angles[axis] = bestAngle;
    }
    loss();
  }
  const feet = [named("Foot Left Ref "), named("Foot Right Ref ")];
  for (let frame = 0; frame <= frames && !action.airborne; frame++) {
    const Frame = time(start, frame);
    renderer.setSequence(index); data.frame = Frame; renderer.update(0);
    const floor = Math.min(...feet.map(node => { const pivot = model.PivotPoints[node.ObjectId]!, p = vec3.fromValues(pivot[0]!, pivot[1]!, pivot[2]!); vec3.transformMat4(p, p, data.nodes[node.ObjectId]!.matrix as unknown as Float32Array); return p[2]!; })) - footRest;
    let key = root.Translation!.Keys.find(k => k.Frame === Frame);
    if (!key) {
      data.frame = Frame; renderer.setSequence(index);
      const before = root.Translation!.Keys.filter(k => k.Frame <= Frame).at(-1)!, after = root.Translation!.Keys.find(k => k.Frame >= Frame)!;
      const t = after.Frame === before.Frame ? 0 : (Frame - before.Frame) / (after.Frame - before.Frame);
      key = { ...before, Frame, Vector: Float32Array.from(before.Vector, (v, i) => v + (after.Vector[i]! - v) * t), ...before.InTan ? { InTan: new Float32Array(3), OutTan: new Float32Array(3) } : {} };
      root.Translation!.Keys.push(key); root.Translation!.Keys.sort((a, b) => a.Frame - b.Frame);
    }
    key.Vector = Float32Array.from(key.Vector, (v, i) => i === 2 ? v - floor : v);
  }
  for (const form of [pose, ...action.forms ?? []]) bindings.set(form, { index, seconds: (time(start, frames) - start) / 1000, aligned: true });
  authored.push({ pose: action.pose, index, frames, phases: action.phases });
}

const bytes = encodeVerified(parseSource(generateMDX(model)));
const before = new DrawnModel(generateMDX(source), 1), after = new DrawnModel(bytes, 1);
let preserved = 0;
for (const [index, sequence] of source.Sequences.entries()) if (!authored.some(a => a.index === index)) for (const part of [0, 0.5, 1]) {
  const at = (sequence.Interval[1] - sequence.Interval[0]) * part / 1000, a = before.triangles(index, at, 1), b = after.triangles(index, at, 1);
  ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), `${sequence.Name}: earlier clip changed`); preserved++;
}
mkdirSync(output, { recursive: true });
const target = join(output, "heroshadowhunter.mdx"); await Bun.write(target, bytes); chmodSync(target, 0o644);
for (const action of authored) {
  const panels: PoseFrame[] = [1, -1].flatMap(facing => { const sampled = sampleAttack(Character.shadowHunter, POSES[action.pose]!().frames === undefined ? POSES[action.pose]!().style : AttackStyle.forwardSmash, facing);
    return action.phases.map(p => ({ ...sampled[Math.min(p.frame, sampled.length - 1)]!, frame: p.frame, clip: action.index, seconds: p.frame / 60 })); });
  await Bun.write(join(output, `${action.pose}.png`), sheet(`Shadow Hunter ${action.pose}`, after, panels, action.phases.length).png);
}
const lines = [...bindings].sort(([a], [b]) => a.localeCompare(b)).map(([pose, clip]) => `  ${pose}: { index: ${clip.index}, seconds: ${seconds(clip.seconds)}${clip.aligned ? ", aligned: true" : ""} },`);
await Bun.write(join(project, "ts/src/game/presentation/heroes/shadowHunterClipInfo.ts"), [
  "// Generated by tools/animations/shadow-hunter-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";',
  'import type { HeroClipTable } from "../../sim/heroes/hero";',
  "export const SHADOW_HUNTER_AUTHORED_CLIPS: HeroClipTable = {", ...lines, "};", "",
].join("\n"));
console.log(`SHADOW_HUNTER_CLIPS_PASS ${authored.map(a => `${a.pose}@${a.index}`).join(" ")}; ${preserved} earlier pose samples retained; ${target}`);
