import { chmodSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { quat, vec3 } from "gl-matrix";
import { DrawnModel, sampleAttack, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, AttackStyle, Character } from "../../ts/src/game/sim/codes";
import type { HeroClip, HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { SHADOW_HUNTER_MOVES } from "../../ts/src/game/sim/heroes/shadowHunterMoves";
import { ROSTER_ATTACK_CLIPS } from "../../ts/src/game/presentation/rosterAttackClipInfo";
import { SHADOW_HUNTER_AUTHORED_CLIPS } from "../../ts/src/game/presentation/heroes/shadowHunterClipInfo";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";

interface Gesture {
  lean?: number; chest?: number; head?: number; pelvis?: number;
  arm?: number; armYaw?: number; elbow?: number; wrist?: number; wristRoll?: number;
  free?: number; freeElbow?: number;
  frontHip?: number; frontKnee?: number; frontFoot?: number; backHip?: number; backKnee?: number; backFoot?: number;
  drop?: number; lunge?: number;
}
interface Phase { frame: number; gesture: Gesture; tip?: readonly [number, number] }
interface Authored { pose: HeroPose; style: AttackStyle; phases: readonly Phase[] }

const READY: Gesture = {};

function forwardSmash(): Authored {
  const move = SHADOW_HUNTER_MOVES.normals[AttackStyle.forwardSmash]!;
  const contact = move.startupFrames, total = move.totalFrames;
  const windUp: Gesture = { lean: -6, chest: -16, head: 10, pelvis: -4, arm: -200, elbow: 30, wrist: -20, free: -50, freeElbow: 40,
    frontHip: -12, frontKnee: 8, frontFoot: 0, backHip: 10, backKnee: 20, backFoot: 0, drop: -2, lunge: -8 };
  const strike = (chest: number, arm: number, drop: number): Gesture => ({ lean: 4, chest, head: -chest * 0.6, pelvis: 4, arm, elbow: 5, wrist: 10,
    free: -30, freeElbow: 30, frontHip: -30, frontKnee: 15, frontFoot: 0, backHip: 20, backKnee: 35, backFoot: 0, drop, lunge: 16 });
  return { pose: "forwardSmash", style: AttackStyle.forwardSmash, phases: [
    { frame: 0, gesture: READY },
    { frame: 7, gesture: { ...windUp, chest: -8, arm: -140, elbow: 45, frontHip: -6, frontKnee: 4, backHip: 4, backKnee: 8, lunge: -3, drop: -1 }, tip: [10, 175] },
    { frame: contact - 4, gesture: windUp, tip: [-45, 165] },
    { frame: contact - 1, gesture: { ...windUp, chest: -20, lean: -8 }, tip: [-55, 150] },
    { frame: contact, gesture: strike(4, -150, -3), tip: [135, 88] },
    { frame: contact + 1, gesture: strike(8, -110, -6), tip: [135, 45] },
    { frame: contact + 2, gesture: strike(12, -80, -9), tip: [132, 5] },
    { frame: contact + 7, gesture: strike(14, -75, -10), tip: [126, 0] },
    { frame: contact + 16, gesture: { ...strike(12, -65, -8), lunge: 14, frontKnee: 12 }, tip: [118, 4] },
    { frame: total - 10, gesture: { chest: 8, arm: -40, elbow: 20, frontHip: -10, frontKnee: 8, backHip: 8, backKnee: 10, drop: -2, lunge: 4 } },
    { frame: total, gesture: READY },
  ] };
}

const POSES: Readonly<Record<string, () => Authored>> = { forwardSmash };

function rotation(base: ArrayLike<number>, pitch: number, yaw = 0, roll = 0): Float32Array {
  const q = quat.create(); quat.rotateY(q, q, pitch * Math.PI / 180); quat.rotateZ(q, q, yaw * Math.PI / 180); quat.rotateX(q, q, roll * Math.PI / 180);
  quat.multiply(q, q, Float32Array.from(base)); quat.normalize(q, q); return new Float32Array(q);
}
function joint(name: string, g: Gesture): [number, number, number] {
  switch (name) {
    case "Attack Gesture": return [g.lean ?? 0, 0, 0];
    case "Bone_Chest": return [g.chest ?? 0, 0, 0];
    case "Bone_Head": return [g.head ?? 0, 0, 0];
    case "Bone_Pelvis": return [g.pelvis ?? 0, 0, 0];
    case "Bone_Arm1_R": return [g.arm ?? 0, g.armYaw ?? 0, 0];
    case "Bone_Arm2_R": return [g.elbow ?? 0, 0, 0];
    case "Bone_Hand_R": return [g.wrist ?? 0, 0, g.wristRoll ?? 0];
    case "Bone_Arm1_L": return [g.free ?? 0, 0, 0];
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

const prior: Record<string, HeroClip> = { ...ROSTER_ATTACK_CLIPS[Character.shadowHunter], ...SHADOW_HUNTER_AUTHORED_CLIPS };
let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
const bindings = new Map<string, HeroClip>(Object.entries(SHADOW_HUNTER_AUTHORED_CLIPS));
const authored: { pose: HeroPose; index: number; frames: number; phases: readonly Phase[] }[] = [];

for (const pose of selected) {
  const action = POSES[pose]!();
  const move = SHADOW_HUNTER_MOVES.normals[action.style]!, frames = move.totalFrames;
  const name = `Attack Gesture ${pose}`;
  const previous = prior[pose];
  let index = model.Sequences.findIndex(s => s.Name === name);
  if (index < 0 && previous !== undefined && /^Attack Gesture /.test(model.Sequences[previous.index]?.Name ?? "")) index = previous.index;
  let start: number;
  if (index >= 0) {
    const sequence = model.Sequences[index]!; start = sequence.Interval[0];
    ensure(sequence.Interval[1] === time(start, frames), `${name}: clip length differs from move frames`);
    tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(key => key.Frame < start || key.Frame > sequence.Interval[1]); });
  } else {
    index = model.Sequences.length; start = cursor; cursor = time(start, frames) + 100;
    model.Sequences.push({ ...stand, Name: name, Interval: new Uint32Array([start, time(start, frames)]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
      MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
  }
  tracks(model, (track, path) => {
    const donor = originals.get(path); if (!donor || onGlobalClock(donor)) return;
    const first = donor.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]) ?? donor.Keys.find(k => k.Frame === 0);
    if (!first) return;
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path), node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
    for (const phase of action.phases) {
      const [pitch, yaw, roll] = node ? joint(node.Name, phase.gesture) : [0, 0, 0];
      const Vector = node ? rotation(first.Vector, pitch, yaw, roll) : first.Vector.slice();
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
  const feet = [named("Foot Left Ref "), named("Foot Right Ref ")];
  for (let frame = 0; frame <= frames; frame++) {
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
    const loss = () => { apply(); const p = tipAt(); return (p[0]! - phase.tip![0]) ** 2 + (p[2]! - phase.tip![1]) ** 2 + 0.3 * p[1]! ** 2; };
    for (let pass = 0; pass < 4; pass++) for (const axis of [0, 3, 4, 1, 2, 5]) {
      let best = Infinity, bestAngle = angles[axis]!;
      const centre = angles[axis]!, span = pass < 2 ? 180 : 30, step = pass < 2 ? 10 : 2;
      for (let angle = centre - span; angle <= centre + span; angle += step) { angles[axis] = angle; const value = loss(); if (value < best) { best = value; bestAngle = angle; } }
      angles[axis] = bestAngle;
    }
    loss();
  }
  bindings.set(pose, { index, seconds: (time(start, frames) - start) / 1000, aligned: true });
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
  const panels: PoseFrame[] = [1, -1].flatMap(facing => { const sampled = sampleAttack(Character.shadowHunter, SHADOW_HUNTER_MOVES.normals[POSES[action.pose]!().style] ? POSES[action.pose]!().style : AttackStyle.forwardSmash, facing);
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
