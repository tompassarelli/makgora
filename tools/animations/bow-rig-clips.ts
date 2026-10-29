import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, type Character } from "../../ts/src/game/sim/codes";
import { DRAWN_STRIDES } from "../../ts/src/game/presentation/drawnStrideInfo";
import { drawnStrideSource, measureDrawnStride } from "../../ts/scripts/wisp/drawnMotion";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";
import { HIGH_STRETCH, PAIN_GAIN, PainBody, painGate } from "./pain-gate";

export interface Gesture {
  readonly chest?: number; readonly head?: number; readonly bow?: number; readonly elbow?: number;
  readonly grip?: number; readonly knee?: number; readonly twist?: number; readonly lean?: number;
  readonly roll?: number; readonly yaw?: number; readonly tuck?: number; readonly height?: number;
  readonly wrist?: number; readonly hip?: number; readonly shin?: number; readonly kick?: number;
}
export interface Phase { readonly at: number; readonly pose: Gesture }
export interface Action { readonly name: string; readonly frames: number; readonly phases: readonly Phase[]; readonly air?: boolean; readonly hold?: boolean; readonly contact?: number; readonly pain?: boolean }

export interface BowRigFighter {
  readonly character: Character;
  readonly label: string;
  readonly script: string;
  readonly stockSequences: number;
  readonly standIndex: number;
  readonly modelPath: string;
  readonly shippedModel: string;
  readonly clipModule: string;
  readonly constant: string;
  readonly stockClips: readonly string[];
  readonly evidence: string;
}

export const phase = (at: number, pose: Gesture = {}): Phase => ({ at, pose });

export class ClipBook {
  readonly actions: Action[] = [];
  add(name: string, frames: number, phases: readonly Phase[], options: Partial<Action> = {}): void {
    this.actions.push({ name, frames, phases, ...options });
  }
  strike(name: string, frames: number, first: number, last: number, coil: Gesture, hit: Gesture, exit: Gesture = {}, air = false): void {
    this.add(name, frames, [phase(0), phase(Math.max(0, first - 3), coil), phase(first, hit), phase(last, { ...hit, bow: (hit.bow ?? 0) + 12 }), phase(Math.min(frames - 1, last + 9), exit), phase(frames)], { air });
  }
  movement(): void {
    const roll = (sign: number, down = false) => [phase(0, { roll: down ? sign * 90 : 0 }), phase(4, { roll: sign * 35, tuck: 0.2, knee: 60, bow: -70 }), phase(11, { roll: sign * 135, tuck: 0.3, knee: 80, bow: -100 }), phase(21, { roll: sign * 275, tuck: 0.3, knee: 75, bow: -90 }), phase(29, { roll: sign * 355, knee: 30 }), phase(35, { roll: sign * 360 })];
    this.add("turn", 8, [phase(0, { yaw: 180 }), phase(3, { yaw: 110, lean: -15, knee: 20 }), phase(8)]);
    this.add("stop", 8, [phase(0, { lean: -20, knee: 15 }), phase(3, { lean: -25, knee: 30 }), phase(8)]);
    this.add("jumpSquat", 3, [phase(0), phase(2, { knee: 65, chest: 30, tuck: 0.22 }), phase(3, { knee: 70, chest: 32, tuck: 0.24 })]);
    this.add("jump", 22, [phase(0, { knee: 65, chest: 30 }), phase(4, { knee: 0, chest: -20, bow: -100, grip: -95 }), phase(12, { knee: 50, bow: -120, chest: -10 }), phase(22, { knee: 40, bow: -60 })], { air: true });
    this.add("fall", 30, [phase(0, { knee: 40, bow: -70, grip: -55, chest: 15 }), phase(15, { knee: 50, bow: -55, grip: -70, chest: 20 }), phase(30, { knee: 40, bow: -70, grip: -55, chest: 15 })], { air: true });
    this.add("landing", 12, [phase(0, { knee: 55, chest: 35, tuck: 0.18 }), phase(4, { knee: 65, chest: 40, tuck: 0.23 }), phase(12)]);
    this.add("crouch", 30, [phase(0, { knee: 65, chest: 30, tuck: 0.22 }), phase(30, { knee: 65, chest: 30, tuck: 0.22 })], { hold: true });
    this.add("shield", 30, [phase(0, { bow: -75, grip: -85, chest: -15, knee: 25 }), phase(30, { bow: -75, grip: -85, chest: -15, knee: 25 })], { hold: true });
    this.add("airDodge", 49, [phase(0), phase(4, { lean: -32, knee: 75, bow: -100, grip: -70, tuck: 0.2 }), phase(27, { lean: -32, knee: 75, bow: -100, grip: -70, tuck: 0.2 }), phase(49, { lean: -10, knee: 35 })], { air: true });
    this.add("tech", 26, [phase(0, { roll: 85, knee: 55 }), phase(8, { roll: 50, tuck: 0.3, knee: 75 }), phase(17, { roll: -10, knee: 35 }), phase(26)]);
    for (const [name, sign, frames, down] of [["rollForward", -1, 31, false], ["rollBackward", 1, 31, false], ["techForward", -1, 40, true], ["techBackward", 1, 40, true], ["getUpRollForward", -1, 35, true], ["getUpRollBackward", 1, 35, true], ["ledgeRoll", -1, 36, true]] as const)
      this.add(name, frames, roll(sign, down).map(p => ({ ...p, at: p.at * frames / 35 })));
    this.add("spotDodge", 22, [phase(0), phase(2, { lean: -35, knee: 60, bow: -85, tuck: 0.18 }), phase(15, { lean: -35, knee: 60, bow: -85, tuck: 0.18 }), phase(22)]);
    this.add("knockdown", 60, [phase(0, { roll: 90, knee: 35, bow: -40 }), phase(60, { roll: 90, knee: 35, bow: -40 })], { hold: true });
    this.add("getUp", 30, [phase(0, { roll: 90, knee: 35 }), phase(9, { roll: 70, knee: 70 }), phase(23, { roll: 15, knee: 35 }), phase(30)]);
    this.add("getUpAttack", 49, [phase(0, { roll: 90, knee: 35 }), phase(10, { roll: 60, bow: -135, knee: 60 }), phase(16, { roll: 15, bow: -65, chest: 25 }), phase(19, { roll: 15, yaw: 180, bow: -65, chest: 25 }), phase(30, { yaw: 180, knee: 25 }), phase(49, { yaw: 360 })]);
    this.add("ledgeHang", 30, [phase(0, { bow: -145, grip: -170, chest: -12, knee: 30, height: -65 }), phase(30, { bow: -145, grip: -170, chest: -12, knee: 30, height: -65 })], { air: true, hold: true });
    this.add("ledgeClimb", 25, [phase(0, { lean: 65, height: -60, grip: -150 }), phase(11, { lean: 30, height: -15, knee: 50 }), phase(25)]);
    this.add("ledgeAttack", 40, [phase(0, { lean: 65, height: -60, grip: -150 }), phase(12, { lean: 20, height: -10, bow: -155 }), phase(20, { bow: -45, chest: 30, knee: 20 }), phase(40)]);
  }
  grabs(): void {
    const held: Gesture = { chest: 12, head: -8, grip: -72, elbow: -15, bow: -35, knee: 9, twist: -8 };
    const captive: Gesture = { chest: -24, head: -18, grip: -18, elbow: 46, bow: -32, knee: 16, twist: 12 };
    const reach: Gesture = { bow: -92, elbow: -20, lean: 22, chest: 8, knee: 28, head: 8 };
    this.add("grab", 31, [phase(0), phase(3, { lean: -6, chest: -10, bow: 25, knee: 20 }), phase(6, reach), phase(12, reach), phase(20, { lean: 14, chest: 18, knee: 34, bow: -30, elbow: 30, head: 10 }), phase(31)]);
    this.add("grabHold", 60, [phase(0, held), phase(60, held)], { hold: true, air: true });
    this.add("grabbed", 60, [phase(0, captive), phase(60, captive)], { hold: true, air: true });
    const paired = (name: string, first: Gesture, coil: Gesture, hit: Gesture, last: Gesture = {}) =>
      this.add(name, 60, [phase(0, first), phase(18, coil), phase(30, hit), phase(36, hit), phase(60, last)], { air: true, contact: 0.5 });
    this.add("pummel", 68, [phase(0, held), phase(54, held), phase(57, { ...held, chest: -14, bow: -85, twist: -22 }), phase(60, { ...held, chest: 30, bow: -105, elbow: 30, twist: 24 }), phase(62, { ...held, chest: 30, bow: -105, elbow: 30, twist: 24 }), phase(68, held)], { air: true, contact: 1.0 });
    this.add("victimPummel", 68, [phase(0, captive), phase(59, captive), phase(60, { ...captive, chest: 48, head: -40, grip: -45, knee: 28 }), phase(62, { ...captive, chest: 48, head: -40, grip: -45, knee: 28 }), phase(68, captive)], { air: true, contact: 1.0 });
    paired("throwForward", held, { ...held, chest: -18, grip: -38, twist: -28 }, { ...held, chest: 36, grip: -100, elbow: -8, bow: -72, twist: 30 });
    paired("victimThrowForward", captive, { ...captive, chest: 36 }, { ...captive, chest: -46, head: -34, grip: -95, bow: -65, knee: 40, twist: -16 });
    paired("throwBack", held, { ...held, chest: -14, grip: -118, bow: -70, twist: -32 }, { ...held, chest: -32, grip: -180, bow: -148, twist: 70, knee: 24 });
    paired("victimThrowBack", captive, { ...captive, chest: -28, grip: -110, knee: 48 }, { ...captive, chest: -68, grip: -156, bow: -130, knee: 68, twist: -50 });
    paired("throwUp", held, { ...held, chest: 30, grip: -46, knee: 32 }, { ...held, chest: -22, grip: -168, elbow: -5, bow: -140, head: -25, knee: 0 });
    paired("victimThrowUp", captive, { ...captive, chest: 35, knee: 55 }, { ...captive, chest: -45, grip: -160, bow: -130, head: -35, knee: 5 });
    paired("throwDown", held, { ...held, chest: -22, grip: -140, knee: 15 }, { ...held, chest: 58, grip: -45, bow: 25, knee: 48 });
    paired("victimThrowDown", captive, { ...captive, chest: -24, grip: -118, knee: 45 }, { ...captive, chest: 76, head: -8, grip: -40, bow: 36, knee: 70, twist: 25 });
  }
  pain(lowBow = -70, lowWrist = 50): void {
    for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
      const gain = PAIN_GAIN[strength]!, stretch = HIGH_STRETCH[strength]!;
      const g: Gesture = height === 0 ? { knee: 100 * gain, shin: 55 * gain, hip: 20 * gain, tuck: 0.16 * gain, chest: 12 * gain, head: -20 * gain, lean: 14 * gain, bow: lowBow * gain, wrist: lowWrist, grip: -70 * gain, elbow: 20 }
        : height === 1 ? { chest: 50 * gain, head: 28 * gain, twist: 28 * gain, bow: 35 * gain, wrist: 40, grip: 55 * gain, elbow: 55 * gain, knee: 24 * gain, lean: 6 * gain }
        : { hip: -22 * stretch, chest: -25 * stretch, head: -40 * stretch, lean: -6 * stretch, knee: -10 * stretch, bow: -70 * stretch, wrist: -45, grip: -110 * stretch, elbow: 15 * stretch };
      this.add(`pain${height}${strength}`, 24, [phase(0, g), phase(3, g), phase(12, Object.fromEntries(Object.entries(g).map(([k,v]) => [k,v * 0.85]))), phase(24, Object.fromEntries(Object.entries(g).map(([k,v]) => [k,v * 0.75])))], { air: true, pain: true });
    }
  }
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
const JOINTS: Readonly<Record<string, (g: Gesture) => [number, number]>> = {
  Bone_Chest: g => [g.chest ?? 0, g.twist ?? 0],
  Bone_Head: g => [g.head ?? 0, 0],
  Bone_Arm1_L: g => [g.bow ?? 0, 0],
  Bone_Arm1_R: g => [g.grip ?? 0, 0],
  Bone_Arm2_L: g => [g.elbow ?? 0, 0],
  Bone_Hand_L: g => [g.wrist ?? 0, 0],
  Bone_Pelvis: g => [g.hip ?? 0, 0],
  Bone_Arm2_R: g => [-(g.elbow ?? 0)*0.5, 0],
  Bone_Leg1_L: g => [-(g.knee ?? 0)*0.85 - (g.kick ?? 0), 0],
  Bone_Leg1_R: g => [-(g.knee ?? 0)*0.35, 0],
  Bone_Leg2_L: g => [(g.knee ?? 0) + (g.shin ?? 0), 0],
  Bone_Leg2_R: g => [g.knee ?? 0, 0],
};
const joint = (name: string, g: Gesture): [number, number] => JOINTS[name]?.(g) ?? [0, 0];

type Placed = readonly (readonly [Action, number])[];
type Binding = { index: number; seconds: number; contact?: number };
interface Session {
  readonly fighter: BowRigFighter;
  readonly actions: readonly Action[];
  readonly output: string;
  readonly input: string;
  readonly project: string;
  readonly originalBytes: ArrayBuffer;
  readonly source: mdx.Model;
  readonly model: mdx.Model;
  readonly stand: mdx.Sequence;
}

const keyAt = (track: mdx.AnimVector, Frame: number) => { const key = track.Keys.find(k => k.Frame === Frame); ensure(key, `missing key at ${Frame}`); return key!; };
const sameTriangles = (a: Float32Array | readonly number[], b: Float32Array | readonly number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001);

function snapPain(s: Session, placed: Placed, motion: mdx.AnimVector) {
  const body = new PainBody(generateMDX(s.model), s.fighter.character), rest = body.floor(s.fighter.standIndex, 0);
  for (const [action, index] of placed) {
    const [start, end] = s.model.Sequences[index]!.Interval as unknown as [number, number];
    for (let f = 0; f <= action.frames; f++) keyAt(motion, Math.round(start + f * (end - start) / action.frames)).Vector[2]! -= body.floor(index, f / 60) - rest;
  }
}
function requirePainGate(s: Session, bytes: ArrayBuffer, cells: readonly number[]) {
  const { pass, report } = painGate(bytes, s.fighter.character, s.fighter.standIndex, cells);
  console.log(report);
  ensure(pass, `${s.fighter.label} pain gate failed`);
}
function snapGround(s: Session, placed: Placed, motion: mdx.AnimVector) {
  const drawn = new DrawnModel(generateMDX(s.model), 1);
  for (const [action, index] of placed) {
    const [start, end] = s.model.Sequences[index]!.Interval as unknown as [number, number];
    const floors = Array.from({ length: action.frames + 1 }, (_, f) => {
      const vertices = drawn.triangles(index, f / 60, 1); let lowest = Infinity;
      for (let i = 1; i < vertices.length; i += 2) lowest = Math.min(lowest, vertices[i]!);
      ensure(Number.isFinite(lowest), `${action.name}: missing body`);
      return lowest - (poseAt(action, f).height ?? 0);
    });
    for (const [f, lowest] of floors.entries()) keyAt(motion, Math.round(start + f * (end - start) / action.frames)).Vector[2]! -= lowest;
  }
}
async function clipSheets(s: Session, bytes: ArrayBuffer, placed: Placed) {
  const drawn = new DrawnModel(bytes, 1);
  for (const [action, index] of placed) {
    const moments = action.phases.map(p => Math.round(p.at));
    const capture = sheet(`${s.fighter.label} ${action.name}`, drawn, [1, -1].flatMap(facing => moments.map(frame => ({ frame, facing, clip: index, seconds: frame / 60, phase: AttackPhase.active, x: 0, z: 0, parts: [], strikes: [] }))), moments.length);
    await Bun.write(join(s.output, `${action.name}.png`), capture.png);
  }
}

function rekeyInPlace(s: Session, motion: mdx.Helper, action: Action): readonly [Action, number] {
  const index = s.model.Sequences.findIndex(seq => seq.Name === `${s.fighter.label} ${action.name}`);
  ensure(index >= 0, `${action.name}: shipped sequence missing`);
  const [start, end] = s.model.Sequences[index]!.Interval as unknown as [number, number];
  ensure(end - start === Math.round(action.frames * 1000 / 60), `${action.name}: timing changed`);
  const frameAt = (f: number) => Math.round(start + f * (end - start) / action.frames);
  tracks(s.model, (track, path) => {
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    if (!match || onGlobalClock(track)) return;
    const node = s.model[match[1] as "Bones" | "Helpers"][Number(match[2])]!;
    if (node.Name.endsWith(" Motion")) return;
    const first = track.Keys.find(k => k.Frame >= s.stand.Interval[0]! && k.Frame <= s.stand.Interval[1]!); if (!first) return;
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
  return [action, index] as const;
}

async function authorInPlace(s: Session, names: readonly string[]): Promise<void> {
  const { label } = s.fighter;
  const painActions = s.actions.filter(a => a.pain);
  const motion = s.model.Helpers.find(h => h.Name === `${label} Motion`);
  ensure(motion?.Rotation && motion.Translation && motion.Scaling, `Shipped ${label} has no motion helper`);
  const chosen = names.flatMap(name => {
    if (name === "pain") return painActions;
    const action = s.actions.find(a => a.name === name);
    ensure(action && !action.hold, `${name}: no timed clip of that name`);
    return [action!];
  });
  const placed: Placed = chosen.map(action => rekeyInPlace(s, motion!, action));
  const pain = placed.filter(([a]) => a.pain);
  ensure(pain.length === 0 || pain.length === painActions.length, "Re-author all nine pain clips together");
  snapPain(s, pain, motion!.Translation!);
  snapGround(s, placed.filter(([a]) => !a.pain && !a.air), motion!.Translation!);
  const cells = placed.map(([, index]) => index);
  const bytes = encodeVerified(parseSource(generateMDX(s.model))), before = new DrawnModel(s.originalBytes, 1), after = new DrawnModel(bytes, 1), authored = new Set(cells);
  for (const [index, sequence] of s.source.Sequences.entries()) if (!authored.has(index)) for (const part of [0, 0.5, 1]) {
    const time = (sequence.Interval[1]! - sequence.Interval[0]!) * part / 1000;
    ensure(sameTriangles(before.triangles(index, time, 1), after.triangles(index, time, 1)), `${sequence.Name}: shipped pose changed`);
  }
  await clipSheets(s, bytes, placed);
  const modelPath = join(s.output, s.fighter.shippedModel.split("/").at(-1)!); await Bun.write(modelPath, bytes); chmodSync(modelPath, 0o644);
  if (pain.length) requirePainGate(s, bytes, pain.map(([, index]) => index));
  console.log(`${label.toUpperCase()}_IN_PLACE_PASS: ${cells.length} clips re-authored in place; ${s.source.Sequences.length - cells.length} other sequences unchanged; ${bytes.byteLength} model bytes`);
}

function motionHelper(s: Session): mdx.Helper {
  const id = s.model.Nodes.length;
  const helper: mdx.Helper = { Name: `${s.fighter.label} Motion`, ObjectId:id, Parent:null, Flags:0, PivotPoint:new Float32Array([0,0,55]),
    Rotation:{LineType:1,GlobalSeqId:-1,Keys:[]}, Translation:{LineType:1,GlobalSeqId:-1,Keys:[]}, Scaling:{LineType:1,GlobalSeqId:-1,Keys:[]} };
  for(const node of [...s.model.Bones,...s.model.Helpers,...s.model.Attachments]) if(node.Parent == null) node.Parent=id;
  s.model.Helpers.push(helper);s.model.Nodes.push(helper);s.model.PivotPoints.push(helper.PivotPoint);
  for(const seq of s.source.Sequences) for(const Frame of seq.Interval) {
    helper.Rotation!.Keys.push({Frame,Vector:new Float32Array([0,0,0,1])});
    helper.Translation!.Keys.push({Frame,Vector:new Float32Array([0,0,0])});
    helper.Scaling!.Keys.push({Frame,Vector:new Float32Array([1,1,1])});
  }
  return helper;
}

function appendAction(s: Session, helper: mdx.Helper, original: ReadonlyMap<string, mdx.AnimVector>, action: Action, start: number): Binding {
  const end=start+Math.round(action.frames*1000/60),index=s.model.Sequences.length;
  s.model.Sequences.push({...s.stand,Name:`${s.fighter.label} ${action.name}`,Interval:new Uint32Array([start,end]),NonLooping:!action.hold,MoveSpeed:0,Rarity:0,
    MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});
  const last = action.hold ? 0 : action.frames;
  tracks(s.model,(track,path)=>{
    const donor=original.get(path);if(!donor || onGlobalClock(donor))return;
    const first=donor.Keys.find(k=>k.Frame>=s.stand.Interval[0]&&k.Frame<=s.stand.Interval[1]);if(!first)return;
    const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const node=match?s.source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
    for(let f=0;f<=last;f++) {
      const [pitch,yaw]=node?joint(node.Name,poseAt(action,f)):[0,0];
      const Vector=match?rotate(first.Vector,pitch,yaw):first.Vector.slice();
      track.Keys.push({...first,Frame:Math.round(start+f*(end-start)/action.frames),Vector,
        ...(first.InTan?{InTan:Vector.slice()}:{}),...(first.OutTan?{OutTan:Vector.slice()}: {})});
    }
  });
  const translations:mdx.AnimKeyframe[]=[];
  for(let f=0;f<=last;f++) {
    const g=poseAt(action,f),Frame=Math.round(start+f*(end-start)/action.frames);
    helper.Rotation!.Keys.push({Frame,Vector:rotate(new Float32Array([0,0,0,1]),(g.roll??0)+(g.lean??0),g.yaw??0)});
    helper.Scaling!.Keys.push({Frame,Vector:new Float32Array([1,1,1-(g.tuck??0)])});
    const key={Frame,Vector:new Float32Array([0,0,g.height??0])};translations.push(key);helper.Translation!.Keys.push(key);
  }
  if(!action.air) {
    const drawn=new DrawnModel(generateMDX(s.model),1);
    for(let f=0;f<=last;f++) {
      const vertices=drawn.triangles(index,f/60,1);let lowest=Infinity;
      for(let i=1;i<vertices.length;i+=2)lowest=Math.min(lowest,vertices[i]!);
      ensure(Number.isFinite(lowest),`${action.name}: missing body`);
      translations[f]!.Vector[2]-=lowest-(poseAt(action,f).height??0);
    }
  }
  return {index,seconds:(end-start)/1000,...(action.contact?{contact:action.contact}:{})};
}

function retimeVictimPummel(s: Session, bindings: Map<string, Binding>, retimedStart: number): Binding {
  const victimPummel = bindings.get("victimPummel")!;
  const victimSequence = s.model.Sequences[victimPummel.index]!;
  const [victimFirst, victimLast] = victimSequence.Interval;
  const victimContact = victimFirst! + 1000;
  tracks(s.model, track => {
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
  return victimPummel;
}

const sampleSeconds = (action: Action, frame: number) => action.name === "victimPummel"
  ? frame <= 60 ? frame / 120 : 0.5 + (frame - 60) / 16 : frame / 60;

function verifyPreserved(s: Session, beforeRetime: DrawnModel, before: DrawnModel, after: DrawnModel, victimIndex: number): number {
  let unchangedSequences = 0;
  for (const [index, sequence] of s.model.Sequences.entries()) {
    if (index === victimIndex) continue;
    for (const facing of [-1, 1]) for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const time = (sequence.Interval[1] - sequence.Interval[0]) * fraction / 1000;
      ensure(sameTriangles(beforeRetime.triangles(index, time, facing), after.triangles(index, time, facing)), `${sequence.Name}: retiming changed another pose`);
    }
    unchangedSequences++;
  }
  for (const facing of [-1, 1]) ensure(sameTriangles(beforeRetime.triangles(victimIndex, 1, facing), after.triangles(victimIndex, 0.5, facing)), "Victim pummel contact pose changed");
  for(const [index,seq] of s.source.Sequences.entries())for(const t of [0,0.5,1]) {
    const time = (seq.Interval[1]-seq.Interval[0])*t/1000;
    ensure(sameTriangles(before.triangles(index,time,1), after.triangles(index,time,1)),`Stock ${seq.Name}: pose changed`);
  }
  return unchangedSequences;
}

async function sheetAndMeasure(s: Session, bytes: ArrayBuffer, after: DrawnModel, bindings: ReadonlyMap<string, Binding>) {
  const evidence=[];
  for(const action of s.actions) {
    const binding=bindings.get(action.name)!;let travel=0,drift=0;
    const initial=after.triangles(binding.index,0,1);
    for(let f=1;f<=action.frames;f++) {
      const next=after.triangles(binding.index,sampleSeconds(action,f),1);ensure(next.length===initial.length && next.length>0,`${action.name}: body disappears`);
      for(let i=0;i<initial.length;i+=2) {const shift=Math.hypot(next[i]!-initial[i]!,next[i+1]!-initial[i+1]!);travel=Math.max(travel,shift);drift=Math.max(drift,shift);}
    }
    if(action.hold)ensure(drift<0.001,`${action.name}: held pose drifts ${drift}`);
    else if(!action.pain)ensure(travel>=5,`${action.name}: dead pose ${travel}`);
    const moments=action.phases.map(p=>Math.round(p.at));
    const capture=sheet(`${s.fighter.label} ${action.name}`,new DrawnModel(bytes,1.0),[1,-1].flatMap(facing=>moments.map(frame=>({frame:Math.round(sampleSeconds(action,frame)*60),facing,clip:binding.index,seconds:sampleSeconds(action,frame),phase:AttackPhase.active,x:0,z:0,parts:[],strikes:[]}))),moments.length);
    await Bun.write(join(s.output,`${action.name}.png`),capture.png);
    evidence.push({name:action.name,...binding,travel});
  }
  return evidence;
}

function requireDistinctPain(s: Session, before: DrawnModel, after: DrawnModel, bindings: ReadonlyMap<string, Binding>) {
  const idle=before.triangles(s.fighter.standIndex,0,1),pain=s.actions.filter(a=>a.pain).map(a=>after.triangles(bindings.get(a.name)!.index,0,1));
  for(const [cell,p] of pain.entries())ensure(p.some((v,i)=>Math.abs(v-idle[i]!)>=8),`Pain ${cell}: insufficient recoil`);
  for(let a=0;a<pain.length;a++)for(let b=a+1;b<pain.length;b++)ensure(pain[a]!.some((v,i)=>Math.abs(v-pain[b]![i]!)>2),`Pain ${a}/${b}: same pose`);
}

async function writeClipModule(s: Session, bindings: ReadonlyMap<string, Binding>, aliases: Readonly<Record<string, string>>) {
  const literal=(b:Binding)=>`{ index: ${b.index}, seconds: ${seconds(b.seconds)}, aligned: true${b.contact?`, contact: ${seconds(b.contact)}`:""} }`;
  await Bun.write(join(s.project,s.fighter.clipModule),[
    `// Generated by tools/animations/${s.fighter.script}; regenerate instead of editing.`,
    'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClipTable, HeroClip } from "../../sim/heroes/hero";',
    ...s.fighter.stockClips,
    ...s.actions.filter(a=>!a.pain).map(a=>`  ${a.name}: ${literal(bindings.get(a.name)!)},`),
    ...Object.entries(aliases).map(([name,donor])=>`  ${name}: ${literal(bindings.get(donor)!)},`),
    "} as const satisfies HeroClipTable;", `export const ${s.fighter.constant}_PAIN_CLIPS: readonly HeroClip[] = [`, ...s.actions.filter(a=>a.pain).map(a=>`  ${literal(bindings.get(a.name)!)},`), "];", "",
  ].join("\n"));
}

async function writeStrides(s: Session, bytes: ArrayBuffer, after: DrawnModel) {
  const strides = Object.entries(DRAWN_STRIDES).flatMap(([character, data]) => data ? (["walk", "run"] as const).map(motion => ({ character: Number(character) as Character, motion, ...data[motion] })) : []).filter(row => row.character !== s.fighter.character);
  for (const motion of ["walk", "run"] as const) strides.push(measureDrawnStride(bytes, after, s.fighter.character, motion, s.fighter.modelPath));
  await Bun.write(join(s.project, "ts/src/game/presentation/drawnStrideInfo.ts"), drawnStrideSource(strides));
}

async function authorFromStock(s: Session, aliases: Readonly<Record<string, string>>): Promise<void> {
  const helper = motionHelper(s);
  const original = new Map<string,mdx.AnimVector>();tracks(s.source,(t,p)=>original.set(p,t));
  let cursor = Math.max(...s.source.Sequences.map(seq=>seq.Interval[1]))+100;
  const bindings = new Map<string,Binding>();
  for(const action of s.actions) {
    const binding = appendAction(s, helper, original, action, cursor);
    cursor += Math.round(action.frames*1000/60)+100;
    bindings.set(action.name, binding);
  }
  const painActions = s.actions.filter(a => a.pain);
  snapPain(s, painActions.map(a => [a, bindings.get(a.name)!.index] as const), helper.Translation!);
  const beforeRetime = new DrawnModel(generateMDX(s.model), 1);
  const victimPummel = retimeVictimPummel(s, bindings, cursor);
  const bytes=encodeVerified(parseSource(generateMDX(s.model))),before=new DrawnModel(generateMDX(s.source),1),after=new DrawnModel(bytes,1);
  const unchangedSequences = verifyPreserved(s, beforeRetime, before, after, victimPummel.index);
  const evidence = await sheetAndMeasure(s, bytes, after, bindings);
  requireDistinctPain(s, before, after, bindings);
  requirePainGate(s, bytes, painActions.map(a => bindings.get(a.name)!.index));
  const modelPath=join(s.output,s.fighter.shippedModel);await Bun.write(modelPath,bytes);chmodSync(modelPath,0o644);
  await writeClipModule(s, bindings, aliases);
  await writeStrides(s, bytes, after);
  await Bun.write(join(s.output,s.fighter.evidence),JSON.stringify({sourceBytes:(await Bun.file(s.input).arrayBuffer()).byteLength,stockSequences:s.fighter.stockSequences,victimPummel:{index:victimPummel.index,seconds:1,contact:0.5,unchangedSequences,contactPosePreserved:true},actions:evidence},null,2)+"\n");
  console.log(`${s.fighter.label.toUpperCase()}_CLIPS_PASS: ${s.actions.length} authored clips; ${s.fighter.stockSequences} stock sequences preserved; 9 distinct pain cells; ${bytes.byteLength} model bytes`);
}

export async function authorBowRigClips(fighter: BowRigFighter, actions: readonly Action[], aliases: Readonly<Record<string, string>>): Promise<void> {
  const [input, output] = process.argv.slice(2, 4).map(p => resolve(p));
  const inPlaceNames = process.argv.slice(4);
  const project = resolve(import.meta.dir, "../..");
  const { label } = fighter;
  ensure(input && output && relative(project, output).startsWith(".."), `usage: bun tools/animations/${fighter.script} STOCK_${label.toUpperCase()}.mdx|SHIPPED_${label.toUpperCase()}.mdx PRIVATE_OUTPUT [pain]`);
  mkdirSync(join(output!, dirname(fighter.shippedModel)), { recursive: true });
  const originalBytes = await Bun.file(input!).arrayBuffer();
  const source = parseSource(originalBytes);
  const inPlace = inPlaceNames.length > 0;
  ensure(inPlace ? source.Sequences.some(seq => seq.Name === `${label} pain00`) : source.Sequences.length === fighter.stockSequences, inPlace ? `Use the shipped ${label} model` : `Use the unmodified stock ${label} model`);
  const model = structuredClone(source), stand = source.Sequences[fighter.standIndex];
  ensure(stand?.Name === "Stand Ready", `${label} stock sequence order changed`);
  const session: Session = { fighter, actions, output: output!, input: input!, project, originalBytes, source, model, stand: stand! };
  if (inPlace) await authorInPlace(session, inPlaceNames);
  else await authorFromStock(session, aliases);
}
