import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { generateMDX, parseMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackStyle, AttackPhase } from "../../ts/src/game/sim/codes";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { KOBOLD_MOVES } from "../../ts/src/game/sim/heroes/koboldMoves";
import { KOBOLD_CLIPS } from "../../ts/src/game/sim/heroes/koboldClips";

function ensure(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function tracks(value: unknown, visit: (track: mdx.AnimVector, path: string) => void, path = "") {
  if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return;
  if ("Keys" in value && Array.isArray(value.Keys)) { visit(value as mdx.AnimVector, path); return; }
  for (const [key, child] of Object.entries(value)) if (key !== "Nodes") tracks(child, visit, `${path}.${key}`);
}
const globalClock = (track: mdx.AnimVector) => track.GlobalSeqId != null && track.GlobalSeqId !== -1 && track.GlobalSeqId !== 0xffffffff;
const [input, output] = process.argv.slice(2, 4).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/kobold-clips.ts AUTHORED_KOBOLD.mdx PRIVATE_OUTPUT");
const source = parseMDX(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
ensure(source.Sequences[0]?.Name === "Stand -1" && source.Sequences.some(s => s.Name === "Kobold jab") && source.Nodes.some(n => n.Name === "Candle"), "Expected the authored classic Kobold (stock rig plus murloc-clips.ts --kobold clips)");
const stand = source.Sequences[0]!;

interface Gesture { chest?: number; pelvis?: number; arm?: number; armTwist?: number; elbow?: number; leftArm?: number; leftElbow?: number; head?: number;
  thigh?: number; knee?: number; leftThigh?: number; leftKnee?: number; lean?: number; yaw?: number; spin?: number; step?: number; rise?: number }
interface Beat { frame: number; gesture: Gesture; target?: readonly [number, number] }
interface Strike { prep: Gesture; hit: Gesture; follow: Gesture; prepAt?: number; followAt?: number; settle?: number; mid?: readonly Beat[]; follows?: readonly [number, number]; even?: boolean; over?: readonly [number, number]; late?: number; hitAt?: readonly [number, number] }
interface Action { pose: HeroPose; frames: number; contact: number; beats: Beat[]; hold?: boolean }
const ready: Gesture = {};
const blend = (a: Gesture, b: Gesture, t: number): Gesture => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])]
  .map(k => [k, (a[k as keyof Gesture] ?? 0) * (1 - t) + (b[k as keyof Gesture] ?? 0) * t]));
const seq = (pose: HeroPose) => { const clip = (KOBOLD_CLIPS as Record<string, { index: number; seconds: number }>)[pose]; ensure(clip, `${pose}: no clip`); return clip; };

function strikeBeats(style: AttackStyle, s: Strike): Beat[] {
  const move = KOBOLD_MOVES.normals[style]; ensure(move, `missing timing ${style}`);
  const contact = move.startupFrames, end = move.totalFrames, strike = move.regions[0]!.hit.strike!;
  const hitAt: readonly [number, number] = s.hitAt ?? [strike.x2, strike.z2], last = s.mid?.at(-1);
  const followAt = s.followAt ?? Math.max(contact, last?.frame ?? contact) + (s.late ?? 2);
  const over = s.over ?? [6, 0], from = last?.target ?? hitAt;
  const follows: readonly [number, number] = s.follows ?? [from[0] + over[0], from[1] + over[1]];
  const span = end - followAt, at = (t: number) => followAt + Math.max(1, Math.round(span * t));
  const beats: Beat[] = [{ frame: 0, gesture: ready }, { frame: s.prepAt ?? Math.max(1, contact - Math.max(2, Math.round(contact * 0.4))), gesture: s.prep },
    { frame: contact, gesture: s.hit, target: hitAt }, ...(s.mid ?? []), { frame: followAt, gesture: s.follow, target: follows },
    ...(s.even ? [0.25, 0.5, 0.75].map(t => ({ frame: at(t), gesture: blend(s.follow, ready, t) }))
      : [{ frame: at(0.3), gesture: blend(s.follow, ready, 0.45) }, { frame: at(0.62), gesture: blend(s.follow, ready, 0.85) }, { frame: at(0.85), gesture: blend(s.follow, ready, 0.97) }]), { frame: end, gesture: ready }];
  return beats.filter((x, i) => beats.findIndex(o => o.frame === x.frame) === i).sort((x, y) => x.frame - y.frame);
}

const tiltStrike = (bend: number, lift: number): Strike => ({
  prep: { chest: -12 + bend * 0.3, yaw: 40, arm: 35, elbow: -30, leftArm: -40, lean: -8, step: -4, head: -12, thigh: -12, leftThigh: 12, knee: -10 },
  hit: { chest: 14 + bend, yaw: -15, arm: -90 - lift, leftArm: 30, leftElbow: -30, lean: 10, step: 9, head: -10 - lift * 0.3, thigh: 32 + bend * 0.5, knee: -30 - bend, leftThigh: -22 },
  follow: { chest: 20 + bend, yaw: -40, arm: -80 - lift, leftArm: 45, leftElbow: -30, lean: 13, step: 11, head: -10, thigh: 34 + bend * 0.5, knee: -32 - bend, leftThigh: -26 },
});
const strikes: readonly [HeroPose, AttackStyle, Strike][] = [
  ["jab", AttackStyle.jab, {
    prep: { chest: -10, arm: -40, elbow: -80, leftArm: -30, lean: -6, step: -3, head: -15, thigh: -10, leftThigh: 10 }, prepAt: 1,
    hit: { chest: 24, arm: -95, elbow: 0, leftArm: 20, lean: 10, step: 6, head: -8, thigh: 25, knee: -25, leftThigh: -15 },
    follow: { chest: 28, arm: -90, leftArm: 22, lean: 11, step: 7, head: -7, thigh: 26, knee: -26, leftThigh: -16 }, late: 1, over: [7, -1], even: true }],
  ["jab2", AttackStyle.jab2, {
    prep: { chest: 6, yaw: 35, arm: 30, elbow: -40, leftArm: -50, lean: -5, step: -4, head: -10, thigh: -15, leftThigh: 15, knee: -15 }, prepAt: 2,
    hit: { chest: 12, yaw: -25, arm: -80, elbow: 10, leftArm: 45, lean: 12, step: 9, head: -18, thigh: 35, knee: -35, leftThigh: -25 },
    follow: { chest: 10, yaw: -35, arm: -100, leftArm: 50, lean: 14, step: 11, head: -20, thigh: 38, knee: -38, leftThigh: -28 }, late: 1, over: [5, 2] }],
  ["forwardTilt", AttackStyle.forwardTilt, { ...tiltStrike(0, 0), over: [6, -1] }],
  ["forwardTiltUp", AttackStyle.forwardTiltUp, { ...tiltStrike(-18, 40), over: [5, 3] }],
  ["forwardTiltDown", AttackStyle.forwardTiltDown, { ...tiltStrike(28, -20), over: [6, -3] }],
  ["upTilt", AttackStyle.upTilt, {
    prep: { chest: 28, arm: -20, elbow: -30, leftArm: -20, lean: 4, head: -5, thigh: 40, knee: -55, leftThigh: 40, leftKnee: -55 }, prepAt: 2,
    hit: { chest: -12, arm: -175, leftArm: -150, lean: -4, head: -30, thigh: 5, leftThigh: 0, rise: 3 },
    follow: { chest: -34, arm: -245, leftArm: -200, lean: -16, step: -4, head: -42, thigh: -10, leftThigh: 15, rise: 2 }, over: [-24, -6] }],
  ["downTilt", AttackStyle.downTilt, {
    prep: { chest: 35, arm: -175, elbow: -20, leftArm: -40, lean: 4, step: -3, head: -25, thigh: 55, knee: -75, leftThigh: 45, leftKnee: -70 }, prepAt: 2,
    hit: { chest: 55, arm: -60, leftArm: 20, lean: 22, step: 8, head: -40, thigh: 70, knee: -95, leftThigh: -25, leftKnee: -20 },
    follow: { chest: 58, arm: -50, leftArm: 25, lean: 25, step: 11, head: -40, thigh: 72, knee: -95, leftThigh: -30, leftKnee: -20 }, over: [7, -1] }],
  ["dashAttack", AttackStyle.dashAttack, {
    prep: { chest: -15, arm: -175, elbow: -20, leftArm: -160, lean: -12, step: -3, head: -20, thigh: -30, leftThigh: 35, knee: -30 }, prepAt: 3,
    hit: { chest: 15, arm: -100, leftArm: -110, lean: 55, step: 16, head: -45, thigh: -45, knee: -20, leftThigh: -60, leftKnee: -30 },
    follow: { chest: 18, arm: -95, leftArm: -105, lean: 62, step: 26, head: -50, thigh: -50, knee: -25, leftThigh: -65, leftKnee: -35 }, over: [7, -2] }],
  ["forwardSmash", AttackStyle.forwardSmash, {
    prep: { chest: -28, arm: -215, elbow: -30, leftArm: -200, leftElbow: -30, lean: -14, step: -6, head: -28, thigh: -18, leftThigh: 22, knee: -20 }, prepAt: 8,
    mid: [{ frame: 11, gesture: { chest: -32, arm: -225, elbow: -35, leftArm: -210, leftElbow: -35, lean: -16, step: -7, head: -30, thigh: -20, leftThigh: 24, knee: -22 } }],
    hit: { chest: 28, arm: -110, leftArm: -105, lean: 16, step: 13, head: -12, thigh: 45, knee: -45, leftThigh: -32 },
    follow: { chest: 40, arm: -75, leftArm: -75, lean: 20, step: 14, head: -16, thigh: 50, knee: -52, leftThigh: -35 }, over: [3, -10], even: true }],
  ["upSmash", AttackStyle.upSmash, {
    prep: { chest: 38, arm: -15, elbow: -30, leftArm: -10, lean: 6, head: -8, thigh: 75, knee: -100, leftThigh: 75, leftKnee: -100 }, prepAt: 6,
    mid: [{ frame: 8, gesture: { chest: 42, arm: -10, elbow: -30, leftArm: -5, lean: 7, head: -8, thigh: 80, knee: -105, leftThigh: 80, leftKnee: -105 } }],
    hit: { chest: -15, arm: -180, leftArm: -175, lean: -4, head: -32, thigh: -5, leftThigh: 5, rise: 10 },
    follow: { chest: -22, arm: -195, leftArm: -190, lean: -10, head: -38, thigh: -12, leftThigh: 18, knee: -20, rise: 16 }, over: [-2, 8] }],
  ["downSmash", AttackStyle.downSmash, {
    prep: { chest: 18, arm: -175, elbow: -20, leftArm: -60, lean: -4, head: -15, thigh: 45, knee: -60, leftThigh: 40, leftKnee: -55, spin: 30 }, prepAt: 7,
    hit: { chest: 50, arm: -70, leftArm: 30, lean: 12, head: -30, thigh: 60, knee: -85, leftThigh: 50, leftKnee: -80, spin: -10 },
    mid: [{ frame: 14, gesture: { chest: 50, arm: -70, leftArm: 30, lean: 12, head: -30, thigh: 60, knee: -85, leftThigh: 50, leftKnee: -80, spin: 180 }, target: [-70, 9] }],
    follow: { chest: 52, arm: -60, leftArm: 35, lean: 14, head: -30, thigh: 60, knee: -85, leftThigh: 50, leftKnee: -80, spin: 215 }, over: [-6, -2] }],
];
const only = process.argv.find(a => a.startsWith("--only="))?.slice(7).split(",");
const actions: Action[] = strikes.filter(([pose]) => !only || only.includes(pose)).map(([pose, style, strike]) => {
  const move = KOBOLD_MOVES.normals[style]!;
  return { pose, frames: move.totalFrames, contact: move.startupFrames, beats: strikeBeats(style, strike) };
});
const charge: Gesture = { chest: -30, arm: -220, elbow: -32, leftArm: -205, leftElbow: -32, lean: -15, step: -6, head: -30, thigh: -20, leftThigh: 24, knee: -22 };
const crouch: Gesture = { chest: -60, lean: 20, head: 15, arm: 20, elbow: -60, leftArm: -40, thigh: -80, knee: 120, leftThigh: -80, leftKnee: 120 };
if (!only || only.includes("smashCharge")) actions.push({ pose: "smashCharge", frames: 30, contact: 8, hold: true, beats: [{ frame: 0, gesture: charge }, { frame: 30, gesture: charge }] });
if (!only || only.includes("crouch")) actions.push({ pose: "crouch", frames: 30, contact: 8, hold: true, beats: [{ frame: 0, gesture: crouch }, { frame: 30, gesture: crouch }] });

function rotated(q: ArrayLike<number>, y: number, z = 0) {
  const a = y * Math.PI / 360, b = z * Math.PI / 360;
  const [i, j, k, l] = [-Math.sin(a) * Math.sin(b), Math.sin(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.cos(a) * Math.cos(b)];
  const [x = 0, v = 0, w = 0, t = 1] = Array.from(q);
  const out = [l! * x + i! * t + j! * w - k! * v, l! * v - i! * w + j! * t + k! * x, l! * w + i! * v - j! * x + k! * t, l! * t - i! * x - j! * v - k! * w];
  const length = Math.hypot(...out); return new Float32Array(out.map(n => n / length));
}
function joint(name: string, g: Gesture): [number, number] {
  if (name === "Bone_Chest") return [g.chest ?? 0, g.yaw ?? 0];
  if (name === "Bone_Pelvis") return [g.pelvis ?? 0, 0];
  if (name === "Bone_Arm1_R") return [g.arm ?? 0, g.armTwist ?? 0];
  if (name === "Bone_Arm2_R") return [g.elbow ?? 0, 0];
  if (name === "Bone_Arm1_L") return [g.leftArm ?? 0, 0];
  if (name === "Bone_Arm2_L") return [g.leftElbow ?? 0, 0];
  if (name === "Bone_Head") return [g.head ?? 0, 0];
  if (name === "Bone_Leg1_R") return [g.thigh ?? 0, 0];
  if (name === "Bone_Leg1_L") return [g.leftThigh ?? 0, 0];
  if (name === "Bone_Leg2_R") return [g.knee ?? 0, 0];
  if (name === "Bone_Leg2_L") return [g.leftKnee ?? g.knee ?? 0, 0];
  if (name === "Bone_Root") return [g.lean ?? 0, g.spin ?? 0];
  if (name === "Candle") return [-((g.lean ?? 0) + (g.chest ?? 0) + (g.head ?? 0)), 0];
  return [0, 0];
}

const originals = new Map<string, mdx.AnimVector>(); tracks(source, (t, p) => originals.set(p, t));
const pickNode = model.Nodes.find(n => n.Name === "PickAxe")!, handNode = model.Nodes.find(n => n.Name === "Bone_Hand_R")!;
const handPivot = model.PivotPoints[handNode.ObjectId]!;
let tip: [number, number, number] = [0, 0, 0], tipDistance = -1;
for (const geoset of model.Geosets) {
  const groups = geoset.Groups;
  for (let v = 0; v < geoset.Vertices.length / 3; v++) {
    const group = groups[geoset.VertexGroup[v]!]!;
    if (group.length !== 1 || group[0] !== pickNode.ObjectId) continue;
    const p: [number, number, number] = [geoset.Vertices[v * 3]!, geoset.Vertices[v * 3 + 1]!, geoset.Vertices[v * 3 + 2]!];
    const d = Math.hypot(p[0] - handPivot[0]!, p[1] - handPivot[1]!, p[2] - handPivot[2]!);
    if (d > tipDistance) { tipDistance = d; tip = p; }
  }
}
ensure(tipDistance > 10, "Kobold pick head not found");
const ease = (t: number) => t * t * (3 - 2 * t);
const along = (beats: readonly Beat[], frame: number, value: (g: Gesture) => number) => {
  const after = beats.findIndex(b => b.frame >= frame); if (after <= 0) return value(beats[Math.max(0, after)]!.gesture);
  const a = beats[after - 1]!, b = beats[after]!; return value(a.gesture) + (value(b.gesture) - value(a.gesture)) * ease((frame - a.frame) / (b.frame - a.frame));
};
const replaced: [number, number][] = [];
const records: { pose: string; index: number; frames: number; contact: number; beats: number[]; tipMiss: number[] }[] = [];
for (const action of actions) {
  const index = seq(action.pose).index, sequence = model.Sequences[index]!;
  ensure(sequence.Name === `Kobold ${action.pose}`, `${action.pose}: sequence ${index} is ${sequence.Name}`);
  const [start, end] = [sequence.Interval[0]!, sequence.Interval[1]!];
  ensure(Math.abs(end - start - Math.round(action.frames * 1000 / 60)) <= 1, `${action.pose}: clip length changed`);
  replaced.push([start, end]);
  const time = (frame: number) => start + Math.round(frame * 1000 / 60);
  tracks(model, (track, path) => {
    const donor = originals.get(path); if (!donor || globalClock(donor)) return;
    const first = donor.Keys.find(k => k.Frame >= stand.Interval[0]! && k.Frame <= stand.Interval[1]!); if (!first) return;
    track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
    for (const beat of action.beats) {
      let Vector = first.Vector.slice();
      if (node) { const [y, z] = joint(node.Name, beat.gesture); Vector = rotated(first.Vector, y, z); }
      const tangent = () => match || track.LineType === mdx.LineType.Bezier ? Vector.slice() : new Float32Array(Vector.length);
      track.Keys.push({ ...first, Frame: time(beat.frame), Vector, ...(first.InTan ? { InTan: tangent(), OutTan: tangent() } : {}) });
    }
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  });
  const renderer = new ModelRenderer(model), data = Reflect.get(renderer, "rendererData"); renderer.setSequence(index);
  const arm = model.Nodes.find(n => n.Name === "Bone_Arm1_R")!, elbow = model.Nodes.find(n => n.Name === "Bone_Arm2_R")!;
  const donor = (n: mdx.Node) => source.Nodes[n.ObjectId]!.Rotation!.Keys.find(k => k.Frame >= stand.Interval[0]! && k.Frame <= stand.Interval[1]!)!.Vector;
  const tipMiss: number[] = [];
  for (const beat of action.beats) if (beat.target) {
    data.frame = time(beat.frame);
    const armKey = arm.Rotation!.Keys.find(k => k.Frame === time(beat.frame))!, elbowKey = elbow.Rotation!.Keys.find(k => k.Frame === time(beat.frame))!;
    const authored = [beat.gesture.arm ?? 0, beat.gesture.armTwist ?? 0, beat.gesture.elbow ?? 0, 0], angles = authored.slice();
    const loss = () => {
      armKey.Vector = rotated(donor(arm), angles[0]!, angles[1]!); elbowKey.Vector = rotated(donor(elbow), angles[2]!, angles[3]!);
      if (armKey.InTan) { armKey.InTan = armKey.Vector.slice(); armKey.OutTan = armKey.Vector.slice(); }
      if (elbowKey.InTan) { elbowKey.InTan = elbowKey.Vector.slice(); elbowKey.OutTan = elbowKey.Vector.slice(); }
      renderer.update(0); const m = data.nodes[pickNode.ObjectId].matrix;
      const x = m[0] * tip[0] + m[4] * tip[1] + m[8] * tip[2] + m[12], z = m[2] * tip[0] + m[6] * tip[1] + m[10] * tip[2] + m[14];
      return (x - beat.target![0]) ** 2 + (z - beat.target![1]) ** 2 + 0.04 * angles.reduce((sum, a, i) => sum + (a - authored[i]!) ** 2, 0);
    };
    for (let pass = 0; pass < 3; pass++) for (let dim = 0; dim < 4; dim++) {
      let best = Infinity, bestAngle = angles[dim]!;
      for (let value = authored[dim]! - 150; value <= authored[dim]! + 150; value += pass === 0 ? 15 : 5) { angles[dim] = value; const d = loss(); if (d < best) { best = d; bestAngle = value; } }
      angles[dim] = bestAngle;
    }
    tipMiss.push(Math.round(Math.sqrt(loss()) * 10) / 10);
  }
  const root = model.Nodes.find(n => n.Name === "Bone_Root")!;
  ensure(root.Translation, "Kobold root has no translation");
  const rootDonor = originals.get(`.Nodes.${root.ObjectId}.Translation`) ?? source.Nodes[root.ObjectId]!.Translation!;
  const rootFirst = rootDonor.Keys.find(k => k.Frame >= stand.Interval[0]! && k.Frame <= stand.Interval[1]!)!;
  root.Translation.Keys = root.Translation.Keys.filter(k => k.Frame < start || k.Frame > end);
  const frames = action.hold ? [0, action.frames] : Array.from({ length: action.frames + 1 }, (_, f) => f);
  for (const frame of frames) root.Translation.Keys.push({ ...rootFirst, Frame: time(frame), Vector: rootFirst.Vector.slice(),
    ...(rootFirst.InTan ? { InTan: new Float32Array(3), OutTan: new Float32Array(3) } : {}) });
  root.Translation.Keys.sort((a, b) => a.Frame - b.Frame);
  const drawn = new DrawnModel(generateMDX(model), 1);
  const floors = frames.map(frame => { const t = drawn.triangles(index, frame / 60, 1); let lowest = Infinity; for (let i = 1; i < t.length; i += 2) lowest = Math.min(lowest, t[i]!); return lowest; });
  const restFloor = (() => { const t = drawn.triangles(0, 0, 1); let lowest = Infinity; for (let i = 1; i < t.length; i += 2) lowest = Math.min(lowest, t[i]!); return lowest; })();
  for (const [i, frame] of frames.entries()) {
    const key = root.Translation.Keys.find(k => k.Frame === time(frame))!;
    key.Vector[0] = key.Vector[0]! + along(action.beats, frame, g => g.step ?? 0);
    key.Vector[2] = key.Vector[2]! - (floors[i]! - restFloor) + along(action.beats, frame, g => g.rise ?? 0);
    if (key.InTan) { key.InTan = root.Translation.LineType === mdx.LineType.Bezier ? key.Vector.slice() : new Float32Array(3); key.OutTan = key.InTan.slice(); }
  }
  records.push({ pose: action.pose, index, frames: action.frames, contact: action.contact, beats: action.beats.map(b => b.frame), tipMiss });
}

const outside = (m: mdx.Model) => { const copy = structuredClone(m);
  tracks(copy, track => { if (!globalClock(track)) track.Keys = track.Keys.filter(k => !replaced.some(([a, b]) => k.Frame >= a && k.Frame <= b)); }); return copy; };
ensure(isDeepStrictEqual(outside(model), outside(source)), "Re-authoring changed a sequence outside the Kobold ground set");
const bytes = generateMDX(model), decoded = parseMDX(bytes);
ensure(isDeepStrictEqual(parseMDX(generateMDX(decoded)), decoded), "MDX round trip changed model");
mkdirSync(output, { recursive: true }); await Bun.write(join(output, "kobold.mdx"), bytes);

const finalDrawn = new DrawnModel(bytes, 0.62);
for (const [i, action] of actions.entries()) {
  const index = records[i]!.index;
  const first = finalDrawn.triangles(index, 0, 1), contact = finalDrawn.triangles(index, action.contact / 60, 1);
  let moved = 0; for (let v = 0; v < first.length; v++) moved = Math.max(moved, Math.abs(first[v]! - contact[v]!));
  ensure(action.hold || moved > 3, `${action.pose}: dead gesture`);
  const panelFrames = action.hold ? [0, action.frames] : action.beats.map(b => b.frame);
  const panels: PoseFrame[] = [1, -1].flatMap(facing => panelFrames.map(frame => ({ frame, phase: frame < action.contact ? AttackPhase.startup : frame <= action.contact + 4 ? AttackPhase.active : AttackPhase.recovery,
    x: 0, z: 0, facing, parts: [], strikes: [], clip: index, seconds: frame / 60 })));
  await Bun.write(join(output, `Kobold-${action.pose}.png`), sheet(`Kobold ${action.pose}`, finalDrawn, panels, panelFrames.length).png);
}
await Bun.write(join(output, "kobold-ground.json"), JSON.stringify({ tip, records }, null, 2) + "\n");
console.log(`KOBOLD_CLIPS_PASS ${records.length} ground clips re-authored at their indices; other sequences unchanged; ${output}`);
