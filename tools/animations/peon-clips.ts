import { chmodSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, type Character } from "../../ts/src/game/sim/codes";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";
import { HIGH_STRETCH, PAIN_GAIN, PainBody, painGate } from "./pain-gate";
import { LOG_GRIP, LOG_LENGTH, LOG_PATH } from "../../ts/src/game/fighters/peon/logPath";

const [input, output] = process.argv.slice(2, 4).map(p => resolve(p));
const painOnly = process.argv.includes("pain"), lumberOnly = process.argv.includes("lumber");
const reauthorNames = process.argv.includes("reauthor") ? process.argv.slice(process.argv.indexOf("reauthor") + 1) : [];
const shipped = painOnly || lumberOnly || reauthorNames.length > 0;
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/peon-clips.ts STOCK_PEON.mdx|SHIPPED_PEON.mdx PRIVATE_OUTPUT [pain|lumber|reauthor ACTION...]");
mkdirSync(join(output, "hero-models"), { recursive: true });
const source = parseSource(await Bun.file(input).arrayBuffer());
ensure(source.Sequences.length === (shipped ? 90 : 22), shipped ? "Use the shipped 90-sequence Peon model" : "Use the unmodified stock Peon model");
const model = structuredClone(source), stand = source.Sequences[9], PEON = 18 as Character;
ensure(stand?.Name === "Stand Ready", "Peon stock sequence order changed");

interface Gesture {
  readonly chest?: number; readonly head?: number; readonly axe?: number; readonly elbow?: number;
  readonly grip?: number; readonly knee?: number; readonly twist?: number; readonly lean?: number;
  readonly roll?: number; readonly yaw?: number; readonly tuck?: number; readonly height?: number; readonly ahead?: number; readonly kick?: number;
}
interface Phase { readonly at: number; readonly pose: Gesture }
interface Action { readonly name: string; readonly frames: number; readonly phases: readonly Phase[]; readonly air?: boolean; readonly hold?: boolean; readonly contact?: number; readonly pain?: boolean }
const actions: Action[] = [];
const add = (name: string, frames: number, phases: readonly Phase[], options: Partial<Action> = {}) => actions.push({ name, frames, phases, ...options });
const phase = (at: number, pose: Gesture = {}): Phase => ({ at, pose });
const strike = (name: string, frames: number, first: number, last: number, coil: Gesture, hit: Gesture, exit: Gesture = {}, air = false, through: Gesture = { ...hit, axe: (hit.axe ?? 0) + 12 }) =>
  add(name, frames, [phase(0), phase(Math.max(0, first - 3), coil), phase(first, hit), phase(last, through), phase(Math.min(frames - 1, last + 9), exit), phase(frames)], { air });



strike("jab", 17, 3, 4, { axe: -135, chest: -12, twist: -18 }, { axe: -35, elbow: -10, chest: 8, knee: 8 });
strike("jab2", 25, 5, 6, { axe: -100, chest: -12 }, { axe: 5, elbow: 30, chest: 24, knee: 16 });
strike("forwardTilt", 29, 7, 9, { axe: -135, chest: -12, twist: -18 }, { axe: -30, elbow: -20, chest: 18, twist: 20, knee: 12 });
strike("forwardTiltUp", 29, 7, 9, { axe: 15, chest: 18, knee: 14 }, { axe: -55, elbow: -18, chest: -5, knee: 12 }, {}, false, { axe: -85, elbow: -18, chest: -12, knee: 10 });
strike("forwardTiltDown", 29, 7, 9, { axe: -110, chest: -20 }, { axe: -25, elbow: 0, chest: 32, knee: 30 });
strike("upTilt", 30, 6, 9, { axe: 18, chest: 20, knee: 15 }, { axe: -105, elbow: -10, chest: -10, grip: -80, knee: 0 });
strike("downTilt", 27, 5, 7, { axe: -155, chest: -15, yaw: 60 }, { axe: -45, elbow: -15, chest: 35, knee: 42, tuck: 0.16 });
const prone = { ahead: 40, lean: 88, chest: -10, head: -42, axe: -122, grip: -118, elbow: 0, knee: 4 };
const flail = { ahead: -10, lean: -24, chest: -20, head: -34, axe: -215, grip: -205, elbow: -10, knee: 28, kick: 60 };
add("dashAttack", 38, [phase(0), phase(1, { ahead: 4, lean: 16, chest: 8, head: -10, axe: -40, grip: -40, knee: 12, kick: 50 }),
  phase(3, { ...flail, ahead: -6, lean: -14, chest: -12, head: -24, axe: -190, grip: -185, knee: 36, kick: 20, tuck: 0.03 }), phase(5, { ...flail, ahead: -9, lean: -22, chest: -18, head: -18, axe: -205, grip: -200, elbow: -22, knee: 50, kick: 0, tuck: 0.07 }),
  phase(6, { ahead: 26, lean: 70, chest: -16, head: -38, axe: -150, grip: -145, elbow: 0, knee: 10 }), phase(8, prone), phase(9, { ...prone, ahead: 44, chest: -24, head: -48, knee: 30 }),
  phase(11, { ...prone, ahead: 52, lean: 90, chest: -4, head: -18, axe: -140, knee: 110 }), phase(14, { ...prone, ahead: 57, lean: 88, chest: -40, head: -26, axe: -150, grip: -150, elbow: 60, knee: 12 }),
  phase(18, { ...prone, ahead: 56, lean: 90, chest: -6, head: -30, axe: -130, grip: -128, elbow: 76, knee: 6, height: -10 }), phase(20, { ...prone, ahead: 56, lean: 90, chest: -4, head: -30, axe: -131, grip: -129, elbow: 77, knee: 4, height: -11 }),
  phase(25, { ahead: 50, lean: 72, chest: -12, head: -16, axe: -118, grip: -116, elbow: 34, knee: 40, height: -5 }), phase(28, { ahead: 40, lean: 48, chest: 6, head: -8, axe: -96, grip: -94, elbow: 20, knee: 66, twist: 12, tuck: 0.06, height: -2 }),
  phase(31, { ahead: 26, lean: 28, chest: 12, head: -4, axe: -64, grip: -62, elbow: 10, knee: 56, twist: 12, tuck: 0.06 }), phase(35, { ahead: 10, lean: 8, chest: 3, axe: -28, grip: -26, elbow: 3, knee: 26, twist: 4, tuck: 0.03 }),
  phase(38)]);
strike("forwardSmash", 59, 21, 23, { axe: -175, grip: -120, chest: -24, knee: 26 }, { axe: -75, grip: -60, elbow: 10, chest: 30, knee: 28 }, { axe: 40, chest: 28, knee: 20 }, false, { axe: -40, grip: -40, elbow: 10, chest: 38, knee: 30 });
strike("upSmash", 51, 16, 19, { axe: 10, chest: 30, knee: 35 }, { axe: -115, grip: -110, elbow: -10, chest: -12, knee: 0, height: 12 }, { axe: -150, grip: -140, elbow: -20, chest: 20, knee: 32, tuck: 0.12 }, false, { axe: -175, grip: -155, elbow: -22, chest: -26, knee: 0, height: 8 });
add("downSmash", 54, [phase(0), phase(14, { axe: -160, knee: 25, chest: -15 }), phase(17, { axe: 5, chest: 40, knee: 35 }), phase(19, { axe: 15, chest: 40, knee: 35, yaw: 20 }), phase(20, { axe: 5, yaw: 180, chest: 40, knee: 35 }), phase(21, { axe: 15, yaw: 195, chest: 40, knee: 35 }), phase(26, { axe: 55, yaw: 195, knee: 20 }), phase(40, { yaw: 300 }), phase(54, { yaw: 360 })]);
add("neutralAir", 31, [phase(0), phase(3, { axe: -80, grip: -80, twist: -35, knee: 40, chest: -25, lean: -15 }), phase(5, { axe: -85, grip: -100, yaw: 0, chest: 20, knee: 32, lean: 15 }), phase(9, { axe: -100, yaw: 180, chest: 25, knee: 38 }), phase(16, { yaw: 300, knee: 26 }), phase(31, { yaw: 360 })], { air: true });
strike("forwardAir", 38, 10, 12, { axe: -175, grip: -80, chest: -20, knee: 25 }, { axe: -70, elbow: 10, chest: 30, knee: 42 }, { chest: 20, axe: 45 }, true, { axe: -35, elbow: 15, chest: 35, knee: 42 });
add("backAir", 35, [phase(0), phase(5, { axe: -35, grip: -105, chest: 22, yaw: 60, knee: 30 }), phase(8, { axe: -70, grip: -90, chest: 25, yaw: 170, knee: 38 }), phase(10, { axe: -40, grip: -80, chest: 30, yaw: 185, knee: 38 }), phase(19, { axe: -20, yaw: 250, knee: 30 }), phase(35, { yaw: 360 })], { air: true });
strike("upAir", 33, 7, 9, { axe: -20, chest: 20, knee: 42 }, { axe: -110, grip: -100, elbow: -10, chest: 0, knee: 20 }, {}, true, { axe: -175, grip: -135, elbow: -22, chest: -24, knee: 10 });
strike("downAir", 45, 13, 16, { axe: -160, chest: -20, knee: 60 }, { axe: 25, elbow: 0, chest: 15, knee: 65 }, { axe: 25, chest: 15, knee: 50 }, true, { axe: 45, elbow: 0, chest: 15, knee: 65 });
strike("neutralSpecial", 42, 18, 20, { grip: -145, chest: -20, twist: -25, knee: 20 }, { grip: -80, axe: -35, chest: 32, twist: 30, knee: 12 });
const coiled = { chest: 56, knee: 88, tuck: 0.32, lean: 30, ahead: 8, axe: -25, grip: -45, elbow: 0, head: -28 };
const heaved = { chest: -16, lean: -8, knee: 12, tuck: 0, axe: -158, grip: -150, elbow: -55, head: 18 };
add("sideSpecial", 30, [phase(0), phase(3, { chest: 34, knee: 44, tuck: 0.14, lean: 12, axe: -10, grip: -25, head: -10 }), phase(6, coiled), phase(12, { ...coiled, chest: 58, knee: 90, lean: 32 }),
  phase(13, { chest: 40, knee: 64, tuck: 0.2, lean: 20, axe: -45, grip: -60, elbow: 0, head: -18 }), phase(14, { chest: 24, knee: 36, tuck: 0.08, lean: 10, axe: -55, grip: -66, elbow: 0, head: -6 }),
  phase(15, { chest: 4, knee: 12, lean: -4, axe: -80, grip: -90, elbow: -8, head: 6 }), phase(16, { chest: -16, knee: 0, lean: -10, axe: -128, grip: -124, elbow: -16, head: 18 }),
  phase(17, { chest: -28, knee: 0, lean: -14, axe: -160, grip: -150, elbow: -26, head: 26 }), phase(19, heaved), phase(23, { ...heaved, knee: 18, lean: -6 }), phase(25, heaved),
  phase(27, { chest: -12, knee: 14, twist: -20, axe: -178, grip: -172, elbow: -10, head: 4 }), phase(30)]);
const LOG_THICKNESS = 1.8, LOG_GRIP_REACH = 6;
add("upSpecial", 28, [phase(0), phase(6, { chest: 35, knee: 65, axe: 40, tuck: 0.2 }), phase(8, { chest: -15, axe: -155, grip: -110, knee: 10 }), phase(18, { chest: -25, axe: -170, grip: -150, knee: 45 }), phase(28, { chest: 15, knee: 50, axe: -75 })], { air: true });
add("downSpecial", 38, [phase(0), phase(3, { chest: 35, knee: 55, axe: -85, grip: -65, tuck: 0.16 }), phase(7, { chest: 38, knee: 55, axe: -95, grip: -70, tuck: 0.16 }), phase(18, { chest: 20, knee: 25, axe: 20, grip: -25 }), phase(38)]);

const roll = (sign: number, down = false) => [phase(0, { roll: down ? sign * 90 : 0 }), phase(4, { roll: sign * 35, tuck: 0.2, knee: 60, axe: -70 }), phase(11, { roll: sign * 135, tuck: 0.3, knee: 80, axe: -100 }), phase(21, { roll: sign * 275, tuck: 0.3, knee: 75, axe: -90 }), phase(29, { roll: sign * 355, knee: 30 }), phase(35, { roll: sign * 360 })];
add("turn", 8, [phase(0, { yaw: 180 }), phase(3, { yaw: 110, lean: -15, knee: 20 }), phase(8)]);
add("stop", 8, [phase(0, { lean: -20, knee: 15 }), phase(3, { lean: -25, knee: 30 }), phase(8)]);
add("jumpSquat", 3, [phase(0), phase(2, { knee: 65, chest: 30, tuck: 0.22 }), phase(3, { knee: 70, chest: 32, tuck: 0.24 })]);
add("jump", 22, [phase(0, { knee: 65, chest: 30 }), phase(4, { knee: 0, chest: -20, axe: -100, grip: -95 }), phase(12, { knee: 50, axe: -120, chest: -10 }), phase(22, { knee: 40, axe: -60 })], { air: true });
add("fall", 30, [phase(0, { knee: 40, axe: -70, grip: -55, chest: 15 }), phase(15, { knee: 50, axe: -55, grip: -70, chest: 20 }), phase(30, { knee: 40, axe: -70, grip: -55, chest: 15 })], { air: true });
add("landing", 12, [phase(0, { knee: 55, chest: 35, tuck: 0.18 }), phase(4, { knee: 65, chest: 40, tuck: 0.23 }), phase(12)]);
add("crouch", 30, [phase(0, { knee: 65, chest: 30, tuck: 0.22 }), phase(30, { knee: 65, chest: 30, tuck: 0.22 })], { hold: true });
add("shield", 30, [phase(0, { axe: -75, grip: -85, chest: -15, knee: 25 }), phase(30, { axe: -75, grip: -85, chest: -15, knee: 25 })], { hold: true });
add("airDodge", 49, [phase(0), phase(4, { lean: -32, knee: 75, axe: -100, grip: -70, tuck: 0.2 }), phase(27, { lean: -32, knee: 75, axe: -100, grip: -70, tuck: 0.2 }), phase(49, { lean: -10, knee: 35 })], { air: true });
add("tech", 26, [phase(0, { roll: 85, knee: 55 }), phase(8, { roll: 50, tuck: 0.3, knee: 75 }), phase(17, { roll: -10, knee: 35 }), phase(26)]);
for (const [name, sign, frames, down] of [["rollForward", -1, 31, false], ["rollBackward", 1, 31, false], ["techForward", -1, 40, true], ["techBackward", 1, 40, true], ["getUpRollForward", -1, 35, true], ["getUpRollBackward", 1, 35, true], ["ledgeRoll", -1, 36, true]] as const)
  add(name, frames, roll(sign, down).map(p => ({ ...p, at: p.at * frames / 35 })));
add("spotDodge", 22, [phase(0), phase(2, { lean: -35, knee: 60, axe: -85, tuck: 0.18 }), phase(15, { lean: -35, knee: 60, axe: -85, tuck: 0.18 }), phase(22)]);
add("knockdown", 60, [phase(0, { roll: 90, knee: 35, axe: -40 }), phase(60, { roll: 90, knee: 35, axe: -40 })], { hold: true });
add("getUp", 30, [phase(0, { roll: 90, knee: 35 }), phase(9, { roll: 70, knee: 70 }), phase(23, { roll: 15, knee: 35 }), phase(30)]);
add("getUpAttack", 49, [phase(0, { roll: 90, knee: 35 }), phase(10, { roll: 60, axe: -135, knee: 60 }), phase(16, { roll: 15, axe: -65, chest: 25 }), phase(19, { roll: 15, yaw: 180, axe: -65, chest: 25 }), phase(30, { yaw: 180, knee: 25 }), phase(49, { yaw: 360 })]);
add("ledgeHang", 30, [phase(0, { axe: -145, grip: -170, chest: -12, knee: 30, height: -65 }), phase(30, { axe: -145, grip: -170, chest: -12, knee: 30, height: -65 })], { air: true, hold: true });
add("ledgeClimb", 25, [phase(0, { lean: 65, height: -60, grip: -150 }), phase(11, { lean: 30, height: -15, knee: 50 }), phase(25)]);
add("ledgeAttack", 40, [phase(0, { lean: 65, height: -60, grip: -150 }), phase(12, { lean: 20, height: -10, axe: -155 }), phase(20, { axe: -45, chest: 30, knee: 20 }), phase(40)]);

const held: Gesture = { chest: 12, head: -8, grip: -72, elbow: -15, axe: -35, knee: 9, twist: -8 };
const captive: Gesture = { chest: -24, head: -18, grip: -18, elbow: 46, axe: -32, knee: 16, twist: 12 };
add("grab", 34, [phase(0), phase(5, { ...held, chest: -12, grip: -30 }), phase(7, held), phase(9, held), phase(34)]);
add("grabHold", 60, [phase(0, held), phase(60, held)], { hold: true, air: true });
add("grabbed", 60, [phase(0, captive), phase(60, captive)], { hold: true, air: true });
const paired = (name: string, first: Gesture, coil: Gesture, hit: Gesture, last: Gesture = {}) =>
  add(name, 60, [phase(0, first), phase(18, coil), phase(30, hit), phase(36, hit), phase(60, last)], { air: true, contact: 0.5 });
add("pummel", 68, [phase(0, held), phase(54, held), phase(57, { ...held, chest: -14, axe: -85, twist: -22 }), phase(60, { ...held, chest: 30, axe: -105, elbow: 30, twist: 24 }), phase(62, { ...held, chest: 30, axe: -105, elbow: 30, twist: 24 }), phase(68, held)], { air: true, contact: 1.0 });
add("victimPummel", 68, [phase(0, captive), phase(59, captive), phase(60, { ...captive, chest: 48, head: -40, grip: -45, knee: 28 }), phase(62, { ...captive, chest: 48, head: -40, grip: -45, knee: 28 }), phase(68, captive)], { air: true, contact: 1.0 });
paired("throwForward", held, { ...held, chest: -18, grip: -38, twist: -28 }, { ...held, chest: 36, grip: -100, elbow: -8, axe: -72, twist: 30 });
paired("victimThrowForward", captive, { ...captive, chest: 36 }, { ...captive, chest: -46, head: -34, grip: -95, axe: -65, knee: 40, twist: -16 });
paired("throwBack", held, { ...held, chest: -14, grip: -118, axe: -70, twist: -32 }, { ...held, chest: -32, grip: -180, axe: -148, twist: 70, knee: 24 });
paired("victimThrowBack", captive, { ...captive, chest: -28, grip: -110, knee: 48 }, { ...captive, chest: -68, grip: -156, axe: -130, knee: 68, twist: -50 });
paired("throwUp", held, { ...held, chest: 30, grip: -46, knee: 32 }, { ...held, chest: -22, grip: -168, elbow: -5, axe: -140, head: -25, knee: 0 });
paired("victimThrowUp", captive, { ...captive, chest: 35, knee: 55 }, { ...captive, chest: -45, grip: -160, axe: -130, head: -35, knee: 5 });
paired("throwDown", held, { ...held, chest: -22, grip: -140, knee: 15 }, { ...held, chest: 58, grip: -45, axe: 25, knee: 48 });
paired("victimThrowDown", captive, { ...captive, chest: -24, grip: -118, knee: 45 }, { ...captive, chest: 76, head: -8, grip: -40, axe: 36, knee: 70, twist: 25 });
for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
  const gain = PAIN_GAIN[strength]!, stretch = HIGH_STRETCH[strength]!;
  const g: Gesture = height === 0 ? { lean: -40 * gain, knee: 75 * gain, chest: 10 * gain, head: 25 * gain, axe: -90 * gain, elbow: 20, grip: -40 * gain }
    : height === 1 ? { chest: 50 * gain, head: 20 * gain, twist: -22 * gain, axe: 25 * gain, elbow: 60 * gain, grip: 35 * gain, knee: 20 * gain, lean: 8 * gain }
    : { chest: -35 * stretch, head: -45 * stretch, axe: -165, grip: 25 * stretch, elbow: -20, knee: -30 * stretch, lean: -8 * stretch };
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
  if(name === "Bone_Arm1_R") return [g.axe ?? 0, 0];
  if(name === "Bone_Arm1_L") return [g.grip ?? 0, 0];
  if(name === "Bone_Arm2_R") return [g.elbow ?? 0, 0];
  if(name === "Bone_Arm2_L") return [-(g.elbow ?? 0)*0.5, 0];
  if(name === "Bone_Leg1_L") return [-(g.knee ?? 0)*0.85,0];
  if(name === "Bone_Leg1_R") return [-(g.knee ?? 0)*0.35 + (g.kick ?? 0),0];
  if(name === "Bone_Leg2_R") return [(g.knee ?? 0) + (g.kick ?? 0)*0.8,0];
  if(name === "Bone_Leg2_L") return [g.knee ?? 0,0];
  return [0,0];
}
const snapPain = (bytes: ArrayBuffer, index: number, frames: number, translations: readonly mdx.AnimKeyframe[]) => {
  const body = new PainBody(bytes, PEON, ["Peon Log"]), floor = body.floor(9, 0);
  for (let f = 0; f <= frames; f++) translations[f]!.Vector[2]! -= body.floor(index, f / 60) - floor;
};
const CARGO = [16, 19], LUMBER_GEOSET = 3;
const hideLumber = (m: mdx.Model) => {
  ensure(m.Sequences[16]?.Name === "Walk Lumber" && m.Sequences[19]?.Name === "Stand Lumber", "Peon lumber sequence order changed");
  const alpha = m.GeosetAnims.find(a => a.GeosetId === LUMBER_GEOSET)?.Alpha;
  ensure(alpha !== undefined && typeof alpha !== "number" && alpha.LineType === 0, "Peon lumber geoset lacks its stepped alpha track");
  for (const index of CARGO) {
    const [start, end] = m.Sequences[index]!.Interval as unknown as [number, number];
    alpha.Keys = alpha.Keys.filter(k => k.Frame < start || k.Frame > end);
    alpha.Keys.push({ Frame: start, Vector: new Float32Array([0]) }, { Frame: end, Vector: new Float32Array([0]) });
  }
  alpha.Keys.sort((a, b) => a.Frame - b.Frame);
};
const checkCargo = (before: DrawnModel, after: DrawnModel, from: mdx.Model) => {
  for (const [index, s] of from.Sequences.entries()) for (const t of [0, 0.5, 1]) {
    const a = before.triangles(index, (s.Interval[1]! - s.Interval[0]!) * t / 1000, 1), b = after.triangles(index, (s.Interval[1]! - s.Interval[0]!) * t / 1000, 1);
    if (CARGO.includes(index)) ensure(b.length > 0 && b.length < a.length, `${s.Name}: lumber bundle still drawn`);
    else ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), `${s.Name}: pose changed`);
  }
};
if (lumberOnly) {
  hideLumber(model);
  const bytes = encodeVerified(parseSource(generateMDX(model)));
  checkCargo(new DrawnModel(generateMDX(source), 1), new DrawnModel(bytes, 1), source);
  const modelPath = join(output, "hero-models/peon.mdx"); await Bun.write(modelPath, bytes); chmodSync(modelPath, 0o644);
  console.log(`PEON_LUMBER_PASS: lumber geoset ${LUMBER_GEOSET} hidden in sequences ${CARGO.join(" and ")}; ${source.Sequences.length - CARGO.length} sequences unchanged; ${bytes.byteLength} model bytes`);
  process.exit(0);
}
const literal = (b: { index: number, seconds: number, contact?: number }) => `{ index: ${b.index}, seconds: ${seconds(b.seconds)}, aligned: true${b.contact ? `, contact: ${seconds(b.contact)}` : ""} }`;
const aliases: Record<string, string> = { doubleJump: "jump", wallJump: "jump", wallTech: "tech", fallSpecial: "fall", downDamage: "knockdown", damageTumble: "knockdown", damageGround: "pain11", damageAir: "pain11", damageShield: "stop", smashCharge: "shield", neutralSpecialAir: "neutralSpecial", sideSpecialAir: "sideSpecial", upSpecialAir: "upSpecial", downSpecialAir: "downSpecial" };
const plantLog = (targets: readonly Action[], indices: readonly number[]) => {
  const cell = targets.findIndex(a => a.name === "sideSpecial");
  if (cell < 0) return;
  const index = indices[cell]!;
  const motion = model.Helpers.find(h => h.Name === "Peon Motion"), lumber = model.Bones.find(b => b.Name === "Lumber");
  const anim = model.GeosetAnims.find(a => a.GeosetId === LUMBER_GEOSET), geoset = model.Geosets[LUMBER_GEOSET];
  ensure(motion !== undefined && lumber !== undefined && anim !== undefined && typeof anim.Alpha !== "number" && geoset !== undefined, "Peon lumber geoset or motion helper missing");
  const low = [0, 1, 2].map(k => Math.min(...geoset.Vertices.filter((_, i) => i % 3 === k))), high = [0, 1, 2].map(k => Math.max(...geoset.Vertices.filter((_, i) => i % 3 === k)));
  const butt = new Float32Array([low[0]!, (low[1]! + high[1]!) / 2, (low[2]! + high[2]!) / 2]), stretch = new Float32Array([LOG_LENGTH / (high[0]! - low[0]!), LOG_THICKNESS, LOG_THICKNESS]);
  let log = model.Bones.find(b => b.Name === "Peon Log");
  if (log === undefined) {
    const id = model.Nodes.length;
    log = { ...structuredClone(lumber), Name: "Peon Log", ObjectId: id, Parent: motion.Parent, PivotPoint: butt, GeosetId: model.Geosets.length, GeosetAnimId: model.GeosetAnims.length,
      Rotation: { LineType: 1, GlobalSeqId: -1, Keys: [] }, Translation: { LineType: 1, GlobalSeqId: -1, Keys: [] }, Scaling: { LineType: 1, GlobalSeqId: -1, Keys: [] } };
    model.Bones.push(log); model.Nodes.push(log); model.PivotPoints.push(log.PivotPoint);
    const copy = structuredClone(geoset);
    copy.Groups = [[id]]; copy.TotalGroupsCount = 1; copy.VertexGroup = new Uint8Array(copy.Vertices.length / 3);
    const shown = { ...structuredClone(anim), GeosetId: model.Geosets.length };
    if (typeof shown.Alpha !== "number") shown.Alpha.Keys = model.Sequences.flatMap(s => Array.from(s.Interval, Frame => ({ Frame, Vector: new Float32Array([0]) })));
    model.Geosets.push(copy); model.GeosetAnims.push(shown);
  }
  const alpha = model.GeosetAnims.find(a => a.GeosetId === model.Geosets.length - 1)?.Alpha;
  ensure(alpha !== undefined && typeof alpha !== "number", "Peon log geoset lacks its alpha track");
  const [start, end] = model.Sequences[index]!.Interval as unknown as [number, number];
  const pivot = log.PivotPoint;
  pivot.set(butt);
  anim.Alpha.Keys = [...anim.Alpha.Keys.filter(k => k.Frame < start || k.Frame > end), { Frame: start, Vector: new Float32Array([0]) }, { Frame: end, Vector: new Float32Array([0]) }].sort((a, b) => a.Frame - b.Frame);
  alpha.Keys = [...alpha.Keys.filter(k => k.Frame < start || k.Frame > end), { Frame: start, Vector: new Float32Array([1]) }, { Frame: end, Vector: new Float32Array([1]) }].sort((a, b) => a.Frame - b.Frame);
  for (const track of [log.Rotation!, log.Translation!, log.Scaling!]) track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
  for (const { frame, x, z, angle } of LOG_PATH) {
    const Frame = start + Math.round(frame * 1000 / 60), half = -angle * Math.PI / 360;
    log.Translation!.Keys.push({ Frame, Vector: new Float32Array([x - butt[0]!, -butt[1]!, z - butt[2]!]) });
    log.Rotation!.Keys.push({ Frame, Vector: new Float32Array([0, Math.sin(half), 0, Math.cos(half)]) });
    log.Scaling!.Keys.push({ Frame, Vector: stretch.slice() });
  }
  for (const track of [log.Rotation!, log.Translation!, log.Scaling!]) track.Keys.sort((a, b) => a.Frame - b.Frame);
};
const checkGrip = (drawn: DrawnModel, targets: readonly Action[], indices: readonly number[]) => {
  const cell = targets.findIndex(a => a.name === "sideSpecial");
  if (cell < 0) return;
  const nodes = drawn.nodes(), node = (name: string) => nodes.findIndex(n => n.name === name);
  const hands = [node("Bone_Hand_L"), node("Bone_Hand_R")], log = node("Peon Log");
  const misses: string[] = [];
  for (let frame = LOG_GRIP.first; frame <= LOG_GRIP.last; frame++) {
    const { nodes: at } = drawn.posed(indices[cell]!, frame / 60, 1);
    const gap = Math.hypot((at[hands[0]! * 2]! + at[hands[1]! * 2]!) / 2 - at[log * 2]!, (at[hands[0]! * 2 + 1]! + at[hands[1]! * 2 + 1]!) / 2 - at[log * 2 + 1]!);
    if (gap > LOG_GRIP_REACH) misses.push(`f${frame} ${gap.toFixed(1)} (hands ${hands.map(h => `${at[h * 2]!.toFixed(0)},${at[h * 2 + 1]!.toFixed(0)}`).join(" ")} log ${at[log * 2]!.toFixed(0)},${at[log * 2 + 1]!.toFixed(0)})`);
  }
  ensure(misses.length === 0, `Log Heave hands miss the log's near end: ${misses.join("; ")}`);
};
const reauthorInPlace = (targets: readonly Action[], resize: boolean) => {
  const motion = model.Helpers.find(h => h.Name === "Peon Motion");
  ensure(motion !== undefined, "Shipped Peon lacks its motion helper");
  const donors = new Map<string, mdx.AnimVector>(); tracks(source, (t, p) => donors.set(p, t));
  const motionIndex = model.Helpers.indexOf(motion), added = (path: string) => { const helper = /^\.Helpers\.(\d+)\./.exec(path); return helper !== null && Number(helper[1]) >= motionIndex; };
  const indices: number[] = [], moves: mdx.AnimKeyframe[][] = [];
  for (const action of targets) {
    const index = model.Sequences.findIndex(s => s.Name === `Peon ${action.name}`);
    ensure(index >= 0, `Peon ${action.name}: shipped sequence missing`);
    const [start, end] = model.Sequences[index]!.Interval as unknown as [number, number];
    const length = Math.round(action.frames * 1000 / 60);
    ensure(resize ? end - start >= length : end - start === length, `Peon ${action.name}: timing changed`);
    const at = (f: number) => Math.round(start + f * length / action.frames);
    tracks(model, (track, path) => {
      if (onGlobalClock(track)) return;
      if (added(path)) { if (path.startsWith(`.Helpers.${motionIndex}.`)) track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end); return; }
      track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
      const donor = donors.get(path); if (!donor) return;
      const first = donor.Keys.find(k => k.Frame >= stand.Interval[0]! && k.Frame <= stand.Interval[1]!); if (!first) return;
      const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
      const node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
      for (let f = 0; f <= action.frames; f++) {
        const [pitch, yaw] = node ? joint(node.Name, poseAt(action, f)) : [0, 0];
        const Vector = match ? rotate(first.Vector, pitch, yaw) : first.Vector.slice();
        track.Keys.push({ ...first, Frame: at(f), Vector, ...(first.InTan ? { InTan: Vector.slice() } : {}), ...(first.OutTan ? { OutTan: Vector.slice() } : {}) });
      }
      track.Keys.sort((a, b) => a.Frame - b.Frame);
    });
    const translations: mdx.AnimKeyframe[] = [];
    for (let f = 0; f <= action.frames; f++) {
      const g = poseAt(action, f), Frame = at(f);
      motion.Rotation!.Keys.push({ Frame, Vector: rotate(new Float32Array([0, 0, 0, 1]), (g.roll ?? 0) + (g.lean ?? 0), g.yaw ?? 0) });
      motion.Scaling!.Keys.push({ Frame, Vector: new Float32Array([1, 1, 1 - (g.tuck ?? 0)]) });
      const key = { Frame, Vector: new Float32Array([g.ahead ?? 0, 0, g.height ?? 0]) }; translations.push(key); motion.Translation!.Keys.push(key);
    }
    for (const track of [motion.Rotation!, motion.Scaling!, motion.Translation!]) track.Keys.sort((a, b) => a.Frame - b.Frame);
    model.Sequences[index]!.Interval = new Uint32Array([start, start + length]);
    indices.push(index); moves.push(translations);
  }
  plantLog(targets, indices);
  const unsnapped = generateMDX(model);
  for (const [cell, action] of targets.entries()) snapPain(unsnapped, indices[cell]!, action.frames, moves[cell]!);
  const bytes = encodeVerified(parseSource(generateMDX(model))), before = new DrawnModel(generateMDX(source), 1), after = new DrawnModel(bytes, 1);
  checkGrip(after, targets, indices);
  for (const [index, s] of source.Sequences.entries()) if (!indices.includes(index)) for (const t of [0, 0.5, 1]) {
    const a = before.triangles(index, (s.Interval[1]! - s.Interval[0]!) * t / 1000, 1), b = after.triangles(index, (s.Interval[1]! - s.Interval[0]!) * t / 1000, 1);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), `${s.Name}: shipped pose changed`);
  }
  return { bytes, after, indices };
};
const sheets = async (targets: readonly Action[], after: DrawnModel, indices: readonly number[]) => {
  for (const [cell, action] of targets.entries()) {
    const moments = action.phases.map(p => Math.round(p.at));
    const capture = sheet(`Peon ${action.name}`, after, [1, -1].flatMap(facing => moments.map(frame => ({ frame, facing, clip: indices[cell]!, seconds: frame / 60, phase: AttackPhase.active, x: 0, z: 0, parts: [], strikes: [] }))), moments.length);
    await Bun.write(join(output, `${action.name}.png`), capture.png);
  }
};
if (painOnly) {
  const pains = actions.filter(a => a.pain);
  const { bytes, after, indices } = reauthorInPlace(pains, false);
  const gate = painGate(bytes, PEON, 9, indices);
  console.log(gate.report);
  ensure(gate.pass, "Peon pain poses fail the pain gate");
  await sheets(pains, after, indices);
  const modelPath = join(output, "hero-models/peon.mdx"); await Bun.write(modelPath, bytes); chmodSync(modelPath, 0o644);
  console.log(`PEON_PAIN_PASS: 9 pain cells re-authored in place; ${source.Sequences.length - 9} shipped sequences preserved; ${bytes.byteLength} model bytes`);
  process.exit(0);
}
if (reauthorNames.length > 0) {
  const targets = reauthorNames.map(name => { const action = actions.find(a => a.name === name && !a.pain); ensure(action !== undefined, `${name}: no such Peon action`); return action; });
  const { bytes, after, indices } = reauthorInPlace(targets, true);
  await sheets(targets, after, indices);
  const modelPath = join(output, "hero-models/peon.mdx"); await Bun.write(modelPath, bytes); chmodSync(modelPath, 0o644);
  const clipsPath = join(project, "ts/src/game/fighters/peon/clips.ts");
  let clips = await Bun.file(clipsPath).text();
  for (const [cell, action] of targets.entries()) for (const name of [action.name, ...Object.keys(aliases).filter(alias => aliases[alias] === action.name)]) {
    const row = new RegExp(`^  ${name}: \\{ index: ${indices[cell]}, [^\\n]*\\},$`, "m");
    ensure(row.test(clips), `${name}: clip row missing`);
    clips = clips.replace(row, `  ${name}: ${literal({ index: indices[cell]!, seconds: action.frames / 60, ...(action.contact ? { contact: action.contact } : {}) })},`);
  }
  await Bun.write(clipsPath, clips);
  console.log(`PEON_REAUTHOR_PASS: ${reauthorNames.join(", ")} re-authored in place; ${source.Sequences.length - targets.length} shipped sequences preserved; ${bytes.byteLength} model bytes`);
  process.exit(0);
}
const id = model.Nodes.length;
const helper: mdx.Helper = { Name: "Peon Motion", ObjectId:id, Parent:null, Flags:0, PivotPoint:new Float32Array([0,0,55]),
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
  model.Sequences.push({...stand,Name:`Peon ${action.name}`,Interval:new Uint32Array([start,end]),NonLooping:!action.hold,MoveSpeed:0,Rarity:0,
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
    const key={Frame,Vector:new Float32Array([g.ahead??0,0,g.height??0])};translations.push(key);helper.Translation!.Keys.push(key);
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
const victimPummel = bindings.get("victimPummel");
ensure(victimPummel?.index === 70, "Peon victim-pummel index changed");
const victimSequence = model.Sequences[victimPummel.index]!;
const [victimFirst, victimLast] = victimSequence.Interval;
const victimContact = victimFirst! + 1000;

tracks(model, track => {
  if (onGlobalClock(track)) return;
  for (const key of track.Keys) if (key.Frame >= victimFirst! && key.Frame <= victimLast!) {
    key.Frame = cursor + (key.Frame <= victimContact
      ? Math.round((key.Frame - victimFirst!) / (victimContact - victimFirst!) * 500)
      : 500 + Math.round((key.Frame - victimContact) / (victimLast! - victimContact) * 500));
  }
  track.Keys.sort((a, b) => a.Frame - b.Frame);
});
victimSequence.Interval = new Uint32Array([cursor, cursor + 1000]);
bindings.set("victimPummel", { index: victimPummel.index, seconds: 1, contact: 0.5 });
cursor += 1100;
const victimAction = actions.findIndex(action => action.name === "victimPummel");
const originalVictimAction = actions[victimAction]!;
actions[victimAction] = { ...originalVictimAction, frames: 60, contact: 0.5,
  phases: originalVictimAction.phases.map(p => ({ ...p, at: p.at <= 60 ? p.at / 2 : 30 + (p.at - 60) * 30 / 8 })) };
const lumberToss = bindings.get("neutralSpecial");
ensure(lumberToss?.index === 38, "Peon Lumber Toss index changed");
const lumberSequence = model.Sequences[lumberToss.index]!;
const [lumberFirst, lumberLast] = lumberSequence.Interval;

tracks(model, track => {
  if (onGlobalClock(track)) return;
  const keys = track.Keys.filter(key => key.Frame >= lumberFirst! && key.Frame <= lumberLast!);
  for (const key of keys) key.Frame = cursor + key.Frame - lumberFirst!;
  track.Keys.sort((a, b) => a.Frame - b.Frame);
});
lumberSequence.Interval = new Uint32Array([cursor, cursor + 800]);
bindings.set("neutralSpecial", { index: lumberToss.index, seconds: 0.8 });
const lumberAction = actions.findIndex(action => action.name === "neutralSpecial");
actions[lumberAction] = { ...actions[lumberAction]!, frames: 48, phases: [...actions[lumberAction]!.phases, phase(48)] };
hideLumber(model);
const bytes=encodeVerified(parseSource(generateMDX(model))),before=new DrawnModel(generateMDX(source),1),after=new DrawnModel(bytes,1);
checkCargo(before,after,source);
const evidence=[];
for(const action of actions) {
  const binding=bindings.get(action.name)!;let travel=0,drift=0;
  const initial=after.triangles(binding.index,0,1);
  for(let f=1;f<=action.frames;f++) {
    const next=after.triangles(binding.index,f/60,1);ensure(next.length===initial.length && next.length>0,`${action.name}: body disappears`);
    for(let i=0;i<initial.length;i+=2) {const shift=Math.hypot(next[i]!-initial[i]!,next[i+1]!-initial[i+1]!);travel=Math.max(travel,shift);drift=Math.max(drift,shift);}
  }
  if(action.hold)ensure(drift<0.001,`${action.name}: held pose drifts ${drift}`);
  else if(!action.pain)ensure(travel>=5,`${action.name}: dead pose ${travel}`);
  const moments=action.phases.map(p=>Math.round(p.at));
  const capture=sheet(`Peon ${action.name}`,new DrawnModel(bytes,1.0),[1,-1].flatMap(facing=>moments.map(frame=>({frame,facing,clip:binding.index,seconds:frame/60,phase:AttackPhase.active,x:0,z:0,parts:[],strikes:[]}))),moments.length);
  await Bun.write(join(output,`${action.name}.png`),capture.png);
  evidence.push({name:action.name,...binding,travel});
}
const idle=before.triangles(9,0,1),pain=actions.filter(a=>a.pain).map(a=>after.triangles(bindings.get(a.name)!.index,0,1));
for(const [cell,p] of pain.entries())ensure(p.some((v,i)=>Math.abs(v-idle[i]!)>=8),`Pain ${cell}: insufficient recoil`);
for(let a=0;a<pain.length;a++)for(let b=a+1;b<pain.length;b++)ensure(pain[a]!.some((v,i)=>Math.abs(v-pain[b]![i]!)>2),`Pain ${a}/${b}: same pose`);
const modelPath=join(output,"hero-models/peon.mdx");await Bun.write(modelPath,bytes);chmodSync(modelPath,0o644);
await Bun.write(join(project,"ts/src/game/fighters/peon/clips.ts"),[
  "// Generated by tools/animations/peon-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClipTable, HeroClip } from "../../sim/heroes/hero";',
  "export const PEON_FALLBACK_CLIP: HeroClip = { index: 9, seconds: 1.0 };", "export const PEON_CLIPS = {",
  "  idle: PEON_FALLBACK_CLIP,", "  walk: { index: 1, seconds: f32(0.6) },", "  dash: { index: 1, seconds: f32(0.6) },", "  run: { index: 1, seconds: f32(0.6) },",
  "  ko: { index: 15, seconds: f32(4.733) },", "  dizzy: { index: 12, seconds: f32(1.667) },",
  ...actions.filter(a=>!a.pain).map(a=>`  ${a.name}: ${literal(bindings.get(a.name)!)},`),
  ...Object.entries(aliases).map(([name,donor])=>`  ${name}: ${literal(bindings.get(donor)!)},`),
  "} as const satisfies HeroClipTable;", "export const PEON_PAIN_CLIPS: readonly HeroClip[] = [", ...actions.filter(a=>a.pain).map(a=>`  ${literal(bindings.get(a.name)!)},`), "];", "",
].join("\n"));
await Bun.write(join(output,"peon-clips.json"),JSON.stringify({sourceBytes:(await Bun.file(input).arrayBuffer()).byteLength,stockSequences:22,actions:evidence},null,2)+"\n");
console.log(`PEON_CLIPS_PASS: ${actions.length} authored clips; 22 stock sequences preserved; 9 distinct pain cells; ${bytes.byteLength} model bytes`);
