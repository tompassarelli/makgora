import { chmodSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, Character } from "../../ts/src/game/sim/codes";
import { DRAWN_STRIDES } from "../../ts/src/game/presentation/drawnStrideInfo";
import { drawnStrideSource, measureDrawnStride } from "../../ts/scripts/wisp/drawnMotion";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";
import { HIGH_STRETCH, PAIN_GAIN, PainBody, painGate } from "./pain-gate";

const [input, output] = process.argv.slice(2, 4).map(p => resolve(p));
const painOnly = process.argv.includes("pain");
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/sylvanas-clips.ts STOCK_SYLVANAS.mdx|SHIPPED_SYLVANAS.mdx PRIVATE_OUTPUT [pain]");
mkdirSync(join(output, "hero-models"), { recursive: true });
const originalBytes = await Bun.file(input).arrayBuffer();
const source = parseSource(originalBytes);
ensure(painOnly ? source.Sequences.some(s => s.Name === "Sylvanas pain00") : source.Sequences.length === 11, painOnly ? "Use the shipped Sylvanas model" : "Use the unmodified stock Sylvanas model");
const model = structuredClone(source), stand = source.Sequences[9];
ensure(stand?.Name === "Stand Ready", "Sylvanas stock sequence order changed");

interface Gesture {
  readonly chest?: number; readonly head?: number; readonly bow?: number; readonly elbow?: number;
  readonly grip?: number; readonly knee?: number; readonly twist?: number; readonly lean?: number;
  readonly roll?: number; readonly yaw?: number; readonly tuck?: number; readonly height?: number;
  readonly wrist?: number; readonly hip?: number; readonly shin?: number;
}
interface Phase { readonly at: number; readonly pose: Gesture }
interface Action { readonly name: string; readonly frames: number; readonly phases: readonly Phase[]; readonly air?: boolean; readonly hold?: boolean; readonly contact?: number; readonly pain?: boolean }
const actions: Action[] = [];
const add = (name: string, frames: number, phases: readonly Phase[], options: Partial<Action> = {}) => actions.push({ name, frames, phases, ...options });
const phase = (at: number, pose: Gesture = {}): Phase => ({ at, pose });
const strike = (name: string, frames: number, first: number, last: number, coil: Gesture, hit: Gesture, exit: Gesture = {}, air = false) =>
  add(name, frames, [phase(0), phase(Math.max(0, first - 3), coil), phase(first, hit), phase(last, { ...hit, bow: (hit.bow ?? 0) + 12 }), phase(Math.min(frames - 1, last + 9), exit), phase(frames)], { air });


const LEAN_JAB = 8, LEAN_TILT = 16;
strike("jab", 18, 3, 4, { bow: 85, grip: 75, elbow: 30, chest: -25, twist: -18, knee: -40 }, { bow: -62, elbow: -12, chest: 18, knee: 8, yaw: 15, lean: LEAN_JAB });
strike("jab2", 20, 4, 5, { bow: 85, grip: 75, elbow: 30, chest: -25, twist: -18, knee: -40 }, { bow: -66, elbow: -14, chest: 20, twist: 10, knee: 10, yaw: 30, lean: LEAN_JAB });
strike("jab3", 24, 5, 6, { bow: 85, grip: 75, elbow: 30, chest: -25, twist: -18 }, { bow: -58, elbow: -16, chest: 20, twist: 18, knee: 10 });
strike("forwardTilt", 31, 8, 10, { bow: 85, grip: 75, elbow: 30, chest: -25, twist: -18, knee: -40 }, { bow: -88, elbow: -16, chest: 26, twist: 28, knee: 22, yaw: 10, lean: LEAN_TILT });
strike("forwardTiltUp", 31, 8, 10, { bow: 60, grip: 70, elbow: 25, chest: -18, yaw: -60 }, { bow: -85, elbow: -18, chest: 14, grip: 30, knee: 12, yaw: 25 });
strike("forwardTiltDown", 31, 8, 10, { bow: 70, grip: 70, elbow: 25, chest: -18, knee: -20, yaw: -60 }, { bow: -28, elbow: 18, chest: 55, knee: 50, tuck: 0.18 });
strike("upTilt", 30, 7, 10, { bow: 28, chest: 20, knee: 18 }, { bow: -160, elbow: -20, chest: -22, grip: -25, knee: 6 });
strike("downTilt", 27, 6, 8, { bow: 75, grip: 70, elbow: 20, chest: -15, yaw: 90 }, { bow: -28, elbow: 18, chest: 55, knee: 50, tuck: 0.18 });
strike("dashAttack", 35, 9, 11, { bow: 70, grip: 70, elbow: 25, chest: -25, yaw: -60 }, { bow: -82, elbow: -20, chest: 30, lean: LEAN_TILT + 6, knee: 28, yaw: 35 });
strike("forwardSmash", 49, 16, 18, { bow: 35, grip: -105, chest: -28, twist: -32, knee: 20 }, { bow: -82, grip: 35, elbow: -24, chest: 25, twist: 34, knee: 16 }, { bow: -72, chest: 14, knee: 12 });
strike("upSmash", 47, 14, 17, { bow: 20, chest: 30, knee: 38 }, { bow: -180, grip: -135, elbow: -18, chest: -26, knee: 0 });
add("downSmash", 47, [phase(0), phase(10, { bow: -130, knee: 30, chest: -18 }), phase(13, { bow: -15, chest: 42, knee: 40 }), phase(15, { bow: -15, chest: 42, knee: 40 }), phase(16, { bow: -15, yaw: 180, chest: 42, knee: 40 }), phase(18, { bow: -15, yaw: 180, chest: 42, knee: 40 }), phase(34, { yaw: 300 }), phase(47, { yaw: 360 })]);
add("neutralAir", 28, [phase(0), phase(3, { bow: 35, grip: -30, twist: -35, knee: 30 }), phase(5, { bow: -65, yaw: 0, chest: 15, knee: 24 }), phase(8, { bow: -65, yaw: 180, chest: 15, knee: 30 }), phase(15, { yaw: 300, knee: 20 }), phase(28, { yaw: 360 })], { air: true });
strike("forwardAir", 35, 9, 11, { bow: 40, chest: -20, knee: 25 }, { bow: -80, elbow: -20, chest: 25, twist: 20, knee: 32 }, { chest: 12, bow: -65 }, true);
strike("backAir", 32, 7, 9, { bow: -35, chest: 22 }, { bow: -85, chest: -15, yaw: 180, knee: 32 }, { yaw: 180 }, true);
strike("upAir", 31, 7, 10, { bow: -25, chest: 20, knee: 36 }, { bow: -165, elbow: -18, chest: -24, knee: 10 }, {}, true);
add("downAir", 43, [phase(0), phase(8, { bow: -155, grip: -110, chest: -20, knee: 45 }), phase(11, { bow: -150, grip: -110, chest: -12, roll: 180, knee: 15 }), phase(14, { bow: -150, grip: -110, chest: -12, roll: 180, knee: 15 }), phase(26, { bow: -90, chest: 12, roll: 270, knee: 30 }), phase(43, { roll: 360 })], { air: true });
strike("neutralSpecial", 40, 15, 17, { grip: -110, bow: -40, chest: -12, twist: -25, knee: 12 }, { grip: 30, bow: -65, chest: 10, twist: 20, knee: 8 });
strike("sideSpecial", 48, 17, 19, { bow: 30, grip: 25, chest: -18, twist: -20 }, { bow: 25, grip: -105, chest: 25, twist: 22, knee: 20 });
add("upSpecial", 31, [phase(0), phase(6, { chest: 25, knee: 55, bow: 20, tuck: 0.15 }), phase(7, { chest: -18, bow: -125, grip: -130, knee: 0 }), phase(20, { chest: -24, bow: -155, grip: -155, knee: 28 }), phase(31, { chest: 10, knee: 35, bow: -65 })], { air: true });
add("downSpecial", 52, [phase(0), phase(12, { bow: 20, grip: 25, chest: -18, knee: 20 }), phase(15, { bow: 30, grip: -100, chest: 20, knee: 25 }), phase(30, { bow: 25, grip: -90, chest: 14, knee: 20 }), phase(31, { bow: 20, grip: -35, chest: -20, twist: -24 }), phase(52)]);

const roll = (sign: number, down = false) => [phase(0, { roll: down ? sign * 90 : 0 }), phase(4, { roll: sign * 35, tuck: 0.2, knee: 60, bow: -70 }), phase(11, { roll: sign * 135, tuck: 0.3, knee: 80, bow: -100 }), phase(21, { roll: sign * 275, tuck: 0.3, knee: 75, bow: -90 }), phase(29, { roll: sign * 355, knee: 30 }), phase(35, { roll: sign * 360 })];
add("turn", 8, [phase(0, { yaw: 180 }), phase(3, { yaw: 110, lean: -15, knee: 20 }), phase(8)]);
add("stop", 8, [phase(0, { lean: -20, knee: 15 }), phase(3, { lean: -25, knee: 30 }), phase(8)]);
add("jumpSquat", 3, [phase(0), phase(2, { knee: 65, chest: 30, tuck: 0.22 }), phase(3, { knee: 70, chest: 32, tuck: 0.24 })]);
add("jump", 22, [phase(0, { knee: 65, chest: 30 }), phase(4, { knee: 0, chest: -20, bow: -100, grip: -95 }), phase(12, { knee: 50, bow: -120, chest: -10 }), phase(22, { knee: 40, bow: -60 })], { air: true });
add("fall", 30, [phase(0, { knee: 40, bow: -70, grip: -55, chest: 15 }), phase(15, { knee: 50, bow: -55, grip: -70, chest: 20 }), phase(30, { knee: 40, bow: -70, grip: -55, chest: 15 })], { air: true });
add("landing", 12, [phase(0, { knee: 55, chest: 35, tuck: 0.18 }), phase(4, { knee: 65, chest: 40, tuck: 0.23 }), phase(12)]);
add("crouch", 30, [phase(0, { knee: 65, chest: 30, tuck: 0.22 }), phase(30, { knee: 65, chest: 30, tuck: 0.22 })], { hold: true });
add("shield", 30, [phase(0, { bow: -75, grip: -85, chest: -15, knee: 25 }), phase(30, { bow: -75, grip: -85, chest: -15, knee: 25 })], { hold: true });
add("airDodge", 49, [phase(0), phase(4, { lean: -32, knee: 75, bow: -100, grip: -70, tuck: 0.2 }), phase(27, { lean: -32, knee: 75, bow: -100, grip: -70, tuck: 0.2 }), phase(49, { lean: -10, knee: 35 })], { air: true });
add("tech", 26, [phase(0, { roll: 85, knee: 55 }), phase(8, { roll: 50, tuck: 0.3, knee: 75 }), phase(17, { roll: -10, knee: 35 }), phase(26)]);
for (const [name, sign, frames, down] of [["rollForward", -1, 31, false], ["rollBackward", 1, 31, false], ["techForward", -1, 40, true], ["techBackward", 1, 40, true], ["getUpRollForward", -1, 35, true], ["getUpRollBackward", 1, 35, true], ["ledgeRoll", -1, 36, true]] as const)
  add(name, frames, roll(sign, down).map(p => ({ ...p, at: p.at * frames / 35 })));
add("spotDodge", 22, [phase(0), phase(2, { lean: -35, knee: 60, bow: -85, tuck: 0.18 }), phase(15, { lean: -35, knee: 60, bow: -85, tuck: 0.18 }), phase(22)]);
add("knockdown", 60, [phase(0, { roll: 90, knee: 35, bow: -40 }), phase(60, { roll: 90, knee: 35, bow: -40 })], { hold: true });
add("getUp", 30, [phase(0, { roll: 90, knee: 35 }), phase(9, { roll: 70, knee: 70 }), phase(23, { roll: 15, knee: 35 }), phase(30)]);
add("getUpAttack", 49, [phase(0, { roll: 90, knee: 35 }), phase(10, { roll: 60, bow: -135, knee: 60 }), phase(16, { roll: 15, bow: -65, chest: 25 }), phase(19, { roll: 15, yaw: 180, bow: -65, chest: 25 }), phase(30, { yaw: 180, knee: 25 }), phase(49, { yaw: 360 })]);
add("ledgeHang", 30, [phase(0, { bow: -145, grip: -170, chest: -12, knee: 30, height: -65 }), phase(30, { bow: -145, grip: -170, chest: -12, knee: 30, height: -65 })], { air: true, hold: true });
add("ledgeClimb", 25, [phase(0, { lean: 65, height: -60, grip: -150 }), phase(11, { lean: 30, height: -15, knee: 50 }), phase(25)]);
add("ledgeAttack", 40, [phase(0, { lean: 65, height: -60, grip: -150 }), phase(12, { lean: 20, height: -10, bow: -155 }), phase(20, { bow: -45, chest: 30, knee: 20 }), phase(40)]);

const held: Gesture = { chest: 12, head: -8, grip: -72, elbow: -15, bow: -35, knee: 9, twist: -8 };
const captive: Gesture = { chest: -24, head: -18, grip: -18, elbow: 46, bow: -32, knee: 16, twist: 12 };
add("grab", 31, [phase(0), phase(4, { ...held, chest: -12, grip: -30 }), phase(6, held), phase(7, held), phase(31)]);
add("grabHold", 60, [phase(0, held), phase(60, held)], { hold: true, air: true });
add("grabbed", 60, [phase(0, captive), phase(60, captive)], { hold: true, air: true });
const paired = (name: string, first: Gesture, coil: Gesture, hit: Gesture, last: Gesture = {}) =>
  add(name, 60, [phase(0, first), phase(18, coil), phase(30, hit), phase(36, hit), phase(60, last)], { air: true, contact: 0.5 });
add("pummel", 68, [phase(0, held), phase(54, held), phase(57, { ...held, chest: -14, bow: -85, twist: -22 }), phase(60, { ...held, chest: 30, bow: -105, elbow: 30, twist: 24 }), phase(62, { ...held, chest: 30, bow: -105, elbow: 30, twist: 24 }), phase(68, held)], { air: true, contact: 1.0 });
add("victimPummel", 68, [phase(0, captive), phase(59, captive), phase(60, { ...captive, chest: 48, head: -40, grip: -45, knee: 28 }), phase(62, { ...captive, chest: 48, head: -40, grip: -45, knee: 28 }), phase(68, captive)], { air: true, contact: 1.0 });
paired("throwForward", held, { ...held, chest: -18, grip: -38, twist: -28 }, { ...held, chest: 36, grip: -100, elbow: -8, bow: -72, twist: 30 });
paired("victimThrowForward", captive, { ...captive, chest: 36 }, { ...captive, chest: -46, head: -34, grip: -95, bow: -65, knee: 40, twist: -16 });
paired("throwBack", held, { ...held, chest: -14, grip: -118, bow: -70, twist: -32 }, { ...held, chest: -32, grip: -180, bow: -148, twist: 70, knee: 24 });
paired("victimThrowBack", captive, { ...captive, chest: -28, grip: -110, knee: 48 }, { ...captive, chest: -68, grip: -156, bow: -130, knee: 68, twist: -50 });
paired("throwUp", held, { ...held, chest: 30, grip: -46, knee: 32 }, { ...held, chest: -22, grip: -168, elbow: -5, bow: -140, head: -25, knee: 0 });
paired("victimThrowUp", captive, { ...captive, chest: 35, knee: 55 }, { ...captive, chest: -45, grip: -160, bow: -130, head: -35, knee: 5 });
paired("throwDown", held, { ...held, chest: -22, grip: -140, knee: 15 }, { ...held, chest: 58, grip: -45, bow: 25, knee: 48 });
paired("victimThrowDown", captive, { ...captive, chest: -24, grip: -118, knee: 45 }, { ...captive, chest: 76, head: -8, grip: -40, bow: 36, knee: 70, twist: 25 });
for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
  const gain = PAIN_GAIN[strength]!, stretch = HIGH_STRETCH[strength]!;
  const g: Gesture = height === 0 ? { knee: 100 * gain, shin: 55 * gain, hip: 20 * gain, tuck: 0.16 * gain, chest: 12 * gain, head: -20 * gain, lean: 14 * gain, bow: -70 * gain, wrist: 50, grip: -70 * gain, elbow: 20 }
    : height === 1 ? { chest: 50 * gain, head: 28 * gain, twist: 28 * gain, bow: 35 * gain, wrist: 40, grip: 55 * gain, elbow: 55 * gain, knee: 24 * gain, lean: 6 * gain }
    : { hip: -22 * stretch, chest: -25 * stretch, head: -40 * stretch, lean: -6 * stretch, knee: -10 * stretch, bow: -70 * stretch, wrist: -45, grip: -110 * stretch, elbow: 15 * stretch };
  add(`pain${height}${strength}`, 24, [phase(0, g), phase(3, g), phase(12, Object.fromEntries(Object.entries(g).map(([k,v]) => [k,v * 0.85]))), phase(24, Object.fromEntries(Object.entries(g).map(([k,v]) => [k,v * 0.75])))], { air: true, pain: true });
}

function poseAt(action: Action, frame: number): Gesture {
  const a = action.phases.findLast(p => p.at <= frame) ?? action.phases[0]!;
  const b = action.phases.find(p => p.at >= frame) ?? action.phases.at(-1)!;
  const t = a.at === b.at ? 0 : (frame - a.at) / (b.at - a.at);
  return Object.fromEntries([...new Set([...Object.keys(a.pose), ...Object.keys(b.pose)])].map(k => [k, (a.pose[k as keyof Gesture] ?? 0) * (1-t) + (b.pose[k as keyof Gesture] ?? 0) * t]));
}
function rotate(q: Float32Array | Int32Array, pitch: number, yaw = 0): Float32Array<ArrayBuffer> {
  const y = pitch * Math.PI / 360, z = yaw * Math.PI / 360;
  const a = [-Math.sin(y)*Math.sin(z), Math.sin(y)*Math.cos(z), Math.cos(y)*Math.sin(z), Math.cos(y)*Math.cos(z)];
  const [x=0,v=0,w=0,s=1] = q;
  const out = new Float32Array([a[3]!*x+a[0]!*s+a[1]!*w-a[2]!*v,a[3]!*v-a[0]!*w+a[1]!*s+a[2]!*x,a[3]!*w+a[0]!*v-a[1]!*x+a[2]!*s,a[3]!*s-a[0]!*x-a[1]!*v-a[2]!*w]);
  const norm = Math.hypot(...out); for (let i=0;i<4;i++) out[i] = out[i]! / norm;
  return out;
}
function joint(name: string, g: Gesture): [number,number] {
  if(name === "Bone_Chest") return [g.chest ?? 0, g.twist ?? 0];
  if(name === "Bone_Head") return [g.head ?? 0, 0];
  if(name === "Bone_Arm1_L") return [g.bow ?? 0, 0];
  if(name === "Bone_Arm1_R") return [g.grip ?? 0, 0];
  if(name === "Bone_Arm2_L") return [g.elbow ?? 0, 0];
  if(name === "Bone_Hand_L") return [g.wrist ?? 0, 0];
  if(name === "Bone_Pelvis") return [g.hip ?? 0, 0];
  if(name === "Bone_Arm2_R") return [-(g.elbow ?? 0)*0.5, 0];
  if(name === "Bone_Leg1_L") return [-(g.knee ?? 0)*0.85,0];
  if(name === "Bone_Leg1_R") return [-(g.knee ?? 0)*0.35,0];
  if(name === "Bone_Leg2_L") return [(g.knee ?? 0) + (g.shin ?? 0),0];
  if(name === "Bone_Leg2_R") return [g.knee ?? 0,0];
  return [0,0];
}
const painActions = actions.filter(a => a.pain);
const keyAt = (track: mdx.AnimVector, Frame: number) => { const key = track.Keys.find(k => k.Frame === Frame); ensure(key, `missing key at ${Frame}`); return key; };
function snapPain(cells: readonly number[], motion: mdx.AnimVector) {
  const body = new PainBody(generateMDX(model), Character.sylvanas), rest = body.floor(9, 0);
  for (const [cell, index] of cells.entries()) {
    const action = painActions[cell]!, [start, end] = model.Sequences[index]!.Interval as unknown as [number, number];
    for (let f = 0; f <= action.frames; f++) keyAt(motion, Math.round(start + f * (end - start) / action.frames)).Vector[2]! -= body.floor(index, f / 60) - rest;
  }
}
function requirePainGate(bytes: ArrayBuffer, cells: readonly number[]) {
  const { pass, report } = painGate(bytes, Character.sylvanas, 9, cells);
  console.log(report);
  ensure(pass, "Sylvanas pain gate failed");
}
async function painSheets(bytes: ArrayBuffer, cells: readonly number[]) {
  const drawn = new DrawnModel(bytes, 1);
  for (const [cell, index] of cells.entries()) {
    const action = painActions[cell]!, moments = action.phases.map(p => Math.round(p.at));
    const capture = sheet(`Sylvanas ${action.name}`, drawn, [1, -1].flatMap(facing => moments.map(frame => ({ frame, facing, clip: index, seconds: frame / 60, phase: AttackPhase.active, x: 0, z: 0, parts: [], strikes: [] }))), moments.length);
    await Bun.write(join(output, `${action.name}.png`), capture.png);
  }
}
if (painOnly) {
  const motion = model.Helpers.find(h => h.Name === "Sylvanas Motion");
  ensure(motion?.Rotation && motion.Translation && motion.Scaling, "Shipped Sylvanas has no motion helper");
  const cells = painActions.map(action => {
    const index = model.Sequences.findIndex(s => s.Name === `Sylvanas ${action.name}`);
    ensure(index >= 0, `${action.name}: shipped sequence missing`);
    const [start, end] = model.Sequences[index]!.Interval as unknown as [number, number];
    ensure(end - start === Math.round(action.frames * 1000 / 60), `${action.name}: timing changed`);
    const frameAt = (f: number) => Math.round(start + f * (end - start) / action.frames);
    tracks(model, (track, path) => {
      const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
      if (!match || onGlobalClock(track)) return;
      const node = model[match[1] as "Bones" | "Helpers"][Number(match[2])]!;
      if (node.Name.endsWith(" Motion")) return;
      const first = track.Keys.find(k => k.Frame >= stand.Interval[0]! && k.Frame <= stand.Interval[1]!); if (!first) return;
      for (let f = 0; f <= action.frames; f++) {
        const [pitch, yaw] = joint(node.Name, poseAt(action, f)), key = keyAt(track, frameAt(f)), Vector = rotate(first.Vector, pitch, yaw);
        key.Vector = Vector; if (key.InTan) key.InTan = Vector.slice(); if (key.OutTan) key.OutTan = Vector.slice();
      }
    });
    for (let f = 0; f <= action.frames; f++) {
      const g = poseAt(action, f), Frame = frameAt(f);
      keyAt(motion.Rotation!, Frame).Vector = rotate(new Float32Array([0, 0, 0, 1]), (g.roll ?? 0) + (g.lean ?? 0), g.yaw ?? 0);
      keyAt(motion.Scaling!, Frame).Vector = new Float32Array([1, 1, 1 - (g.tuck ?? 0)]);
      keyAt(motion.Translation!, Frame).Vector = new Float32Array([0, 0, g.height ?? 0]);
    }
    return index;
  });
  snapPain(cells, motion.Translation!);
  const bytes = encodeVerified(parseSource(generateMDX(model))), before = new DrawnModel(originalBytes, 1), after = new DrawnModel(bytes, 1), authored = new Set(cells);
  for (const [index, sequence] of source.Sequences.entries()) if (!authored.has(index)) for (const part of [0, 0.5, 1]) {
    const time = (sequence.Interval[1]! - sequence.Interval[0]!) * part / 1000, a = before.triangles(index, time, 1), b = after.triangles(index, time, 1);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), `${sequence.Name}: shipped pose changed`);
  }
  await painSheets(bytes, cells);
  const modelPath = join(output, "evilsylvanas.mdx"); await Bun.write(modelPath, bytes); chmodSync(modelPath, 0o644);
  requirePainGate(bytes, cells);
  console.log(`SYLVANAS_PAIN_PASS: 9 pain cells re-authored in place; ${source.Sequences.length - cells.length} other sequences unchanged; ${bytes.byteLength} model bytes`);
  process.exit(0);
}
const id = model.Nodes.length;
const helper: mdx.Helper = { Name: "Sylvanas Motion", ObjectId:id, Parent:null, Flags:0, PivotPoint:new Float32Array([0,0,55]),
  Rotation:{LineType:1,GlobalSeqId:-1,Keys:[]}, Translation:{LineType:1,GlobalSeqId:-1,Keys:[]}, Scaling:{LineType:1,GlobalSeqId:-1,Keys:[]} };
for(const node of [...model.Bones,...model.Helpers,...model.Attachments]) if(node.Parent == null) node.Parent=id;
model.Helpers.push(helper);model.Nodes.push(helper);model.PivotPoints.push(helper.PivotPoint);
for(const s of source.Sequences) for(const Frame of s.Interval) {
  helper.Rotation!.Keys.push({Frame,Vector:new Float32Array([0,0,0,1])});
  helper.Translation!.Keys.push({Frame,Vector:new Float32Array([0,0,0])});
  helper.Scaling!.Keys.push({Frame,Vector:new Float32Array([1,1,1])});
}
const original = new Map<string,mdx.AnimVector>();tracks(source,(t,p)=>original.set(p,t));
let cursor = Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
const bindings = new Map<string,{index:number,seconds:number,contact?:number}>();
for(const action of actions) {
  const start=cursor,end=start+Math.round(action.frames*1000/60),index=model.Sequences.length;cursor=end+100;
  model.Sequences.push({...stand,Name:`Sylvanas ${action.name}`,Interval:new Uint32Array([start,end]),NonLooping:!action.hold,MoveSpeed:0,Rarity:0,
    MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});
  tracks(model,(track,path)=>{
    const donor=original.get(path);if(!donor || onGlobalClock(donor))return;
    const first=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);if(!first)return;
    const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
    for(let f=0;f<=(action.hold?0:action.frames);f++) {
      const [pitch,yaw]=node?joint(node.Name,poseAt(action,f)):[0,0];
      const Vector=match?rotate(first.Vector,pitch,yaw):first.Vector.slice();
      track.Keys.push({...first,Frame:Math.round(start+f*(end-start)/action.frames),Vector,
        ...(first.InTan?{InTan:Vector.slice()}:{}),...(first.OutTan?{OutTan:Vector.slice()}: {})});
    }
  });
  const translations:mdx.AnimKeyframe[]=[];
  for(let f=0;f<=(action.hold?0:action.frames);f++) {
    const g=poseAt(action,f),Frame=Math.round(start+f*(end-start)/action.frames);
    helper.Rotation!.Keys.push({Frame,Vector:rotate(new Float32Array([0,0,0,1]),(g.roll??0)+(g.lean??0),g.yaw??0)});
    helper.Scaling!.Keys.push({Frame,Vector:new Float32Array([1,1,1-(g.tuck??0)])});
    const key={Frame,Vector:new Float32Array([0,0,g.height??0])};translations.push(key);helper.Translation!.Keys.push(key);
  }
  if(!action.air) {
    const drawn=new DrawnModel(generateMDX(model),1);
    for(let f=0;f<=(action.hold?0:action.frames);f++) {
      const vertices=drawn.triangles(index,f/60,1);let lowest=Infinity;
      for(let i=1;i<vertices.length;i+=2)lowest=Math.min(lowest,vertices[i]!);
      ensure(Number.isFinite(lowest),`${action.name}: missing body`);
      translations[f]!.Vector[2]-=lowest-(poseAt(action,f).height??0);
    }
  }
  bindings.set(action.name,{index,seconds:(end-start)/1000,...(action.contact?{contact:action.contact}:{})});
}
const painCells = painActions.map(a => bindings.get(a.name)!.index);
snapPain(painCells, helper.Translation!);
const beforeRetime = new DrawnModel(generateMDX(model), 1);
const victimPummel = bindings.get("victimPummel")!;
const victimSequence = model.Sequences[victimPummel.index]!;
const [victimFirst, victimLast] = victimSequence.Interval;
const victimContact = victimFirst! + 1000;
const retimedStart = cursor;

tracks(model, track => {
  if (onGlobalClock(track)) return;
  for (const key of track.Keys) if (key.Frame >= victimFirst! && key.Frame <= victimLast!) {
    key.Frame = retimedStart + (key.Frame <= victimContact
      ? Math.round((key.Frame - victimFirst!) / 2)
      : 500 + Math.round((key.Frame - victimContact) / (victimLast! - victimContact) * 500));
  }
  track.Keys.sort((a, b) => a.Frame - b.Frame);
});
victimSequence.Interval = new Uint32Array([retimedStart, retimedStart + 1000]);
bindings.set("victimPummel", { index: victimPummel.index, seconds: 1, contact: 0.5 });
const sampleSeconds = (action: Action, frame: number) => action.name === "victimPummel"
  ? frame <= 60 ? frame / 120 : 0.5 + (frame - 60) / 16 : frame / 60;
const bytes=encodeVerified(parseSource(generateMDX(model))),before=new DrawnModel(generateMDX(source),1),after=new DrawnModel(bytes,1);
let unchangedSequences = 0;
for (const [index, sequence] of model.Sequences.entries()) {
  if (index === victimPummel.index) continue;
  for (const facing of [-1, 1]) for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
    const time = (sequence.Interval[1] - sequence.Interval[0]) * fraction / 1000;
    const a = beforeRetime.triangles(index, time, facing), b = after.triangles(index, time, facing);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), `${sequence.Name}: retiming changed another pose`);
  }
  unchangedSequences++;
}
for (const facing of [-1, 1]) {
  const a = beforeRetime.triangles(victimPummel.index, 1, facing), b = after.triangles(victimPummel.index, 0.5, facing);
  ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), "Victim pummel contact pose changed");
}
for(const [index,s] of source.Sequences.entries())for(const t of [0,0.5,1]) {
  const a=before.triangles(index,(s.Interval[1]-s.Interval[0])*t/1000,1),b=after.triangles(index,(s.Interval[1]-s.Interval[0])*t/1000,1);
  ensure(a.length===b.length && a.every((v,i)=>Math.abs(v-b[i]!)<0.001),`Stock ${s.Name}: pose changed`);
}
const evidence=[];
for(const action of actions) {
  const binding=bindings.get(action.name)!;let travel=0,drift=0;
  const initial=after.triangles(binding.index,0,1);
  for(let f=1;f<=action.frames;f++) {
    const next=after.triangles(binding.index,sampleSeconds(action,f),1);ensure(next.length===initial.length && next.length>0,`${action.name}: body disappears`);
    for(let i=0;i<initial.length;i+=2) {const shift=Math.hypot(next[i]!-initial[i]!,next[i+1]!-initial[i+1]!);travel=Math.max(travel,shift);drift=Math.max(drift,shift);}
  }
  if(action.hold)ensure(drift<0.001,`${action.name}: held pose drifts ${drift}`);
  else if(!action.pain)ensure(travel>=5,`${action.name}: dead pose ${travel}`);
  const moments=action.phases.map(p=>Math.round(p.at));
  const capture=sheet(`Sylvanas ${action.name}`,new DrawnModel(bytes,1.0),[1,-1].flatMap(facing=>moments.map(frame=>({frame:Math.round(sampleSeconds(action,frame)*60),facing,clip:binding.index,seconds:sampleSeconds(action,frame),phase:AttackPhase.active,x:0,z:0,parts:[],strikes:[]}))),moments.length);
  await Bun.write(join(output,`${action.name}.png`),capture.png);
  evidence.push({name:action.name,...binding,travel});
}
const idle=before.triangles(9,0,1),pain=actions.filter(a=>a.pain).map(a=>after.triangles(bindings.get(a.name)!.index,0,1));
for(const [cell,p] of pain.entries())ensure(p.some((v,i)=>Math.abs(v-idle[i]!)>=8),`Pain ${cell}: insufficient recoil`);
for(let a=0;a<pain.length;a++)for(let b=a+1;b<pain.length;b++)ensure(pain[a]!.some((v,i)=>Math.abs(v-pain[b]![i]!)>2),`Pain ${a}/${b}: same pose`);
requirePainGate(bytes,painCells);
const modelPath=join(output,"hero-models/evilsylvanas.mdx");await Bun.write(modelPath,bytes);chmodSync(modelPath,0o644);
const literal=(b:{index:number,seconds:number,contact?:number})=>`{ index: ${b.index}, seconds: ${seconds(b.seconds)}, aligned: true${b.contact?`, contact: ${seconds(b.contact)}`:""} }`;
const aliases:Record<string,string>={doubleJump:"jump",wallJump:"jump",wallTech:"tech",fallSpecial:"fall",downDamage:"knockdown",damageTumble:"knockdown",damageGround:"pain11",damageAir:"pain11",damageShield:"stop",smashCharge:"shield",neutralSpecialAir:"neutralSpecial",sideSpecialAir:"sideSpecial",upSpecialAir:"upSpecial",downSpecialAir:"downSpecial"};
await Bun.write(join(project,"ts/src/game/fighters/sylvanas/clips.ts"),[
  "// Generated by tools/animations/sylvanas-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClipTable, HeroClip } from "../../sim/heroes/hero";',
  "export const SYLVANAS_FALLBACK_CLIP: HeroClip = { index: 9, seconds: f32(1.134) };", "export const SYLVANAS_CLIPS = {",
  "  idle: SYLVANAS_FALLBACK_CLIP,", "  walk: { index: 8, seconds: f32(0.834) },", "  dash: { index: 8, seconds: f32(0.834) },", "  run: { index: 8, seconds: f32(0.834) },",
  "  ko: { index: 10, seconds: 2.0 },", "  dizzy: { index: 3, seconds: f32(3.7) },",
  ...actions.filter(a=>!a.pain).map(a=>`  ${a.name}: ${literal(bindings.get(a.name)!)},`),
  ...Object.entries(aliases).map(([name,donor])=>`  ${name}: ${literal(bindings.get(donor)!)},`),
  "} as const satisfies HeroClipTable;", "export const SYLVANAS_PAIN_CLIPS: readonly HeroClip[] = [", ...actions.filter(a=>a.pain).map(a=>`  ${literal(bindings.get(a.name)!)},`), "];", "",
].join("\n"));
const strides = Object.entries(DRAWN_STRIDES).flatMap(([character, data]) => data ? (["walk", "run"] as const).map(motion => ({ character: Number(character) as Character, motion, ...data[motion] })) : []).filter(row => row.character !== Character.sylvanas);
for (const motion of ["walk", "run"] as const) strides.push(measureDrawnStride(bytes, after, Character.sylvanas, motion, "Units\\Undead\\EvilSylvanas\\EvilSylvanas.mdl"));
await Bun.write(join(project, "ts/src/game/presentation/drawnStrideInfo.ts"), drawnStrideSource(strides));
await Bun.write(join(output,"sylvanas-clips.json"),JSON.stringify({sourceBytes:(await Bun.file(input).arrayBuffer()).byteLength,stockSequences:11,victimPummel:{index:victimPummel.index,seconds:1,contact:0.5,unchangedSequences,contactPosePreserved:true},actions:evidence},null,2)+"\n");
console.log(`SYLVANAS_CLIPS_PASS: ${actions.length} authored clips; 11 stock sequences preserved; 9 distinct pain cells; ${bytes.byteLength} model bytes`);
