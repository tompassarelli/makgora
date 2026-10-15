import { chmodSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { quat, vec3 } from "gl-matrix";
import { DrawnModel, sampleAttack, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, AttackStyle, Character } from "../../ts/src/game/sim/codes";
import type { HeroClip, HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { SHADOW_HUNTER_MOVES } from "../../ts/src/game/sim/heroes/shadowHunterMoves";
import { SHADOW_HUNTER_SPECIALS } from "../../ts/src/game/sim/heroes/shadowHunterSpecials";
import { CHARGED_AIM_FRAMES } from "../../ts/src/game/sim/heroSpecials";
import { ROSTER_ATTACK_CLIPS } from "../../ts/src/game/presentation/rosterAttackClipInfo";
import { JUMP_CLIPS } from "../../ts/src/game/presentation/jumpClipInfo";
import { SHADOW_HUNTER_AUTHORED_CLIPS } from "../../ts/src/game/presentation/heroes/shadowHunterClipInfo";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";

interface Gesture {
  lean?: number; chest?: number; chestTurn?: number; head?: number; pelvis?: number; beard?: number;
  arm?: number; armYaw?: number; elbow?: number; wrist?: number; wristRoll?: number;
  free?: number; freeYaw?: number; freeElbow?: number;
  frontHip?: number; frontKnee?: number; frontFoot?: number; backHip?: number; backKnee?: number; backFoot?: number;
  cloth?: number; clothTip?: number;
  drop?: number; lunge?: number; spin?: number; step?: number;
}
type End = "handL" | "handR" | "footL" | "footR";
interface Phase { frame: number; gesture: Gesture; tip?: readonly [number, number] | readonly [number, number, number]; grip?: readonly [number, number]; reach?: readonly [End, number, number] }
interface Authored {
  pose: HeroPose; style?: AttackStyle; phases: readonly Phase[]; airborne?: boolean; frames?: number; looping?: boolean; forms?: readonly HeroPose[]; bind?: boolean;
  ground?: "cloth" | "sole"; support?: "L" | "R";
}
const REACH: Readonly<Record<End, readonly [string, keyof Gesture, keyof Gesture, string, string]>> = {
  handL: ["Hand Left Ref ", "free", "freeElbow", "Bone_Arm1_L", "Bone_Arm2_L"], handR: ["Hand Right Ref ", "arm", "elbow", "Bone_Arm1_R", "Bone_Arm2_R"],
  footL: ["Foot Left Ref ", "frontHip", "frontKnee", "Bone_Leg1_L", "Bone_Leg2_L"], footR: ["Foot Right Ref ", "backHip", "backKnee", "Bone_Leg1_R", "Bone_Leg2_R"],
};

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

const FALL: Gesture = { chest: 6, head: -4, arm: -205, elbow: 15, wrist: -60, free: -80, freeElbow: 30, frontHip: 66, frontKnee: -89, frontFoot: 15, backHip: 83, backKnee: -71, backFoot: 20, cloth: -10 };

function jump(): Authored {
  return { pose: "jump", frames: 24, airborne: true, phases: [
    { frame: 0, gesture: { chest: 14, head: -14, arm: -205, elbow: 15, wrist: -60, free: 20, freeElbow: 20, frontHip: 16, frontKnee: 26, frontFoot: 0, backHip: 8, backKnee: 44, backFoot: 0, cloth: -25 } },
    { frame: 3, gesture: { chest: 12, head: -14, arm: -205, elbow: 15, wrist: -60, free: -160, freeElbow: 10, frontHip: 106, frontKnee: -140, frontFoot: 45, backHip: 98, backKnee: -127, backFoot: 45, cloth: 10 } },
    { frame: 6, gesture: { chest: 10, head: -10, arm: -205, elbow: 15, wrist: -60, free: -150, freeElbow: 15, frontHip: 81, frontKnee: -94, frontFoot: 35, backHip: 73, backKnee: -76, backFoot: 35, cloth: 0 } },
    { frame: 10, gesture: { chest: 12, head: -6, arm: -205, elbow: 15, wrist: -60, free: -115, freeElbow: 25, frontHip: 61, frontKnee: -66, frontFoot: 25, backHip: 58, backKnee: -54, backFoot: 25, cloth: -15 } },
    { frame: 14, gesture: { chest: 18, head: -2, arm: -205, elbow: 15, wrist: -60, free: -60, freeElbow: 50, frontHip: 26, frontKnee: 2, frontFoot: 15, backHip: 23, backKnee: 15, backFoot: 15, cloth: -40, clothTip: -15 } },
    { frame: 19, gesture: { chest: 8, head: -6, arm: -205, elbow: 15, wrist: -60, free: -95, freeElbow: 25, frontHip: 56, frontKnee: -55, frontFoot: 15, backHip: 63, backKnee: -62, backFoot: 20, cloth: -20 } },
    { frame: 24, gesture: FALL },
  ] };
}

function doubleJump(): Authored {
  return { pose: "doubleJump", frames: 30, airborne: true, phases: [
    { frame: 0, gesture: FALL },
    { frame: 3, gesture: { chest: 10, head: -18, arm: -205, elbow: 15, wrist: -60, free: -40, freeElbow: 40, frontHip: 11, frontKnee: 26, frontFoot: 10, backHip: -7, backKnee: 44, backFoot: 10, cloth: -50, clothTip: -20 } },
    { frame: 8, gesture: { chest: 0, head: -12, arm: -205, elbow: 15, wrist: -60, free: -170, freeElbow: 5, frontHip: 111, frontKnee: -145, frontFoot: 45, backHip: 98, backKnee: -127, backFoot: 45, cloth: 15 } },
    { frame: 14, gesture: { chest: 6, head: -8, arm: -205, elbow: 15, wrist: -60, free: -135, freeElbow: 15, frontHip: 81, frontKnee: -94, frontFoot: 30, backHip: 73, backKnee: -76, backFoot: 30, cloth: 0 } },
    { frame: 20, gesture: { chest: 10, head: -5, arm: -205, elbow: 15, wrist: -60, free: -95, freeElbow: 25, frontHip: 61, frontKnee: -66, frontFoot: 20, backHip: 58, backKnee: -54, backFoot: 20, cloth: -20 } },
    { frame: 30, gesture: FALL },
  ] };
}

function forwardSmash(): Authored {
  const move = SHADOW_HUNTER_MOVES.normals[AttackStyle.forwardSmash]!;
  const contact = move.startupFrames, total = move.totalFrames;
  const coil: Gesture = { lean: -14, chest: -26, chestTurn: -40, head: 22, pelvis: -8, arm: -210, elbow: 40, wrist: -20, free: 25, freeElbow: 40, beard: 12,
    frontHip: -14, frontKnee: 12, backHip: 26, backKnee: 42, drop: -10, lunge: -22 };
  const strike = (arm: number, drop: number, lunge: number, lean: number): Gesture => ({ lean, chest: 12, chestTurn: 22, head: -12, pelvis: 8, arm, elbow: 0, wrist: 10,
    free: 30, freeElbow: 30, beard: -20, frontHip: -72, frontKnee: 72, backHip: 46, backKnee: 14, drop, lunge });
  return { pose: "forwardSmash", style: AttackStyle.forwardSmash, ground: "cloth", phases: [
    { frame: 0, gesture: READY },
    { frame: 5, gesture: { ...coil, lean: -5, chest: -8, chestTurn: -12, frontHip: -6, frontKnee: 6, backHip: 10, backKnee: 16, lunge: -8, drop: -4 }, tip: [-20, 175] },
    { frame: contact - 7, gesture: coil, tip: [-115, 175] },
    { frame: contact - 1, gesture: { ...coil, chest: -32, chestTurn: -46, lean: -16, lunge: -24 }, tip: [-125, 160] },
    { frame: contact, gesture: strike(-150, -24, 34, 20), tip: [150, 100] },
    { frame: contact + 1, gesture: strike(-110, -28, 38, 24), tip: [160, 50] },
    { frame: contact + 2, gesture: strike(-80, -30, 40, 26), tip: [155, 14] },
    { frame: contact + 6, gesture: strike(-75, -30, 40, 26), tip: [150, 12] },
    { frame: contact + 16, gesture: { ...strike(-72, -24, 34, 20) }, tip: [140, 22] },
    { frame: contact + 26, gesture: { ...strike(-60, -12, 18, 10), frontHip: -36, frontKnee: 34, backHip: 22, backKnee: 12, chestTurn: 10 }, tip: [110, 55] },
    { frame: total - 3, gesture: { chest: 4, arm: -40, elbow: 20, frontHip: -6, frontKnee: 6, backHip: 6, backKnee: 6, drop: -2, lunge: 3 } },
    { frame: total, gesture: READY },
  ] };
}
function downSmash(): Authored {
  const move = SHADOW_HUNTER_MOVES.normals[AttackStyle.downSmash]!;
  const contact = move.startupFrames, total = move.totalFrames;
  const squat: Gesture = { lean: 12, chest: 12, head: -16, beard: -12, pelvis: 0, arm: -60, elbow: 20, wrist: 0, free: 20, freeElbow: 30,
    frontHip: -48, frontKnee: 70, backHip: 34, backKnee: 70, drop: -30, lunge: 0 };
  return { pose: "downSmash", style: AttackStyle.downSmash, ground: "cloth", phases: [
    { frame: 0, gesture: READY },
    { frame: 6, gesture: { ...squat, chestTurn: -20, drop: -24 }, tip: [-90, 70] },
    { frame: contact - 2, gesture: { ...squat, chestTurn: -36, lean: 8, drop: -32 }, tip: [-115, 60] },
    { frame: contact, gesture: { ...squat, chestTurn: 26, lean: 18 }, tip: [110, 20] },
    { frame: contact + 1, gesture: { ...squat, chestTurn: 32, lean: 20 }, tip: [125, 12] },
    { frame: contact + 2, gesture: { ...squat, chestTurn: 10, lean: 14 }, tip: [125, 12] },
    { frame: contact + 3, gesture: { ...squat, chestTurn: -26, lean: 10 }, tip: [-110, 20] },
    { frame: contact + 4, gesture: { ...squat, chestTurn: -32, lean: 8 }, tip: [-125, 12] },
    { frame: contact + 10, gesture: { ...squat, chestTurn: -28, lean: 8, drop: -28 }, tip: [-115, 18] },
    { frame: contact + 17, gesture: { lean: -4, chest: -8, head: 4, arm: -150, elbow: 30, free: 15, freeElbow: 30, drop: -6, frontHip: -14, frontKnee: 16, backHip: 10, backKnee: 16 }, tip: [-10, 170] },
    { frame: total - 4, gesture: { drop: -3, frontHip: -6, frontKnee: 6, backHip: 4, backKnee: 6, arm: -40 } },
    { frame: total, gesture: READY },
  ] };
}

function neutralAir(): Authored {
  const move = SHADOW_HUNTER_MOVES.normals[AttackStyle.neutralAir]!;
  const c = move.startupFrames, total = move.totalFrames;
  const legs: Gesture = { frontHip: -40, frontKnee: 55, frontFoot: 10, backHip: -15, backKnee: 50, backFoot: 10, beard: 50 };
  const cut = (spin: number): Gesture => ({ ...legs, spin, lean: 0, chest: 4, head: -4, arm: -25, elbow: 0, wrist: 0, free: -60, freeElbow: 20 });
  return { pose: "neutralAir", style: AttackStyle.neutralAir, airborne: true, phases: [
    { frame: 0, gesture: READY },
    { frame: c - 2, gesture: { ...cut(70), chest: -4, lunge: -6 }, tip: [-20, 70] },
    { frame: c, gesture: { ...cut(0), lunge: 8 }, tip: [130, 60] },
    { frame: c + 1, gesture: { ...cut(-50), lunge: 6 } },
    { frame: c + 2, gesture: cut(-100) },
    { frame: c + 3, gesture: cut(-145) },
    { frame: c + 4, gesture: cut(-180) },
    { frame: c + 9, gesture: { ...cut(-260), elbow: 20 } },
    { frame: c + 18, gesture: { ...legs, spin: -340, arm: -40, elbow: 30, frontHip: -25, frontKnee: 40, backHip: -10, backKnee: 35 } },
    { frame: total, gesture: { spin: -360 } },
  ] };
}
function backAir(): Authored {
  const move = SHADOW_HUNTER_MOVES.normals[AttackStyle.backAir]!;
  const c = move.startupFrames, total = move.totalFrames;
  const legs: Gesture = { frontHip: -60, frontKnee: 85, frontFoot: 15, backHip: -35, backKnee: 80, backFoot: 15, beard: 80 };
  const coil: Gesture = { ...legs, lunge: 6, lean: -6, chest: -14, head: 8, arm: -80, elbow: 70, wrist: 0, free: -40, freeElbow: 50 };
  const thrust = (lean: number): Gesture => ({ ...legs, backHip: 45, backKnee: 20, backFoot: -20, cloth: -70, lean, chest: 8, head: -6, arm: -195, elbow: 0, wrist: 0, free: -70, freeElbow: 10 });
  return { pose: "backAir", style: AttackStyle.backAir, airborne: true, phases: [
    { frame: 0, gesture: READY },
    { frame: c - 3, gesture: coil, tip: [35, 140] },
    { frame: c - 1, gesture: { ...coil, arm: -100, elbow: 50 }, tip: [20, 145] },
    { frame: c, gesture: { ...thrust(30), lunge: -10 }, tip: [-125, 30] },
    { frame: c + 2, gesture: { ...thrust(34), lunge: -14 }, tip: [-150, 22] },
    { frame: c + 8, gesture: { ...thrust(26), elbow: 20 }, tip: [-110, 32] },
    { frame: c + 16, gesture: { ...legs, lean: 4, arm: -90, elbow: 40, free: -20, freeElbow: 40 } },
    { frame: total, gesture: READY },
  ] };
}
function downAir(): Authored {
  const move = SHADOW_HUNTER_MOVES.normals[AttackStyle.downAir]!;
  const c = move.startupFrames, total = move.totalFrames, fling = 20;
  const stab = (bob: number): Gesture => ({ lean: 12, chest: 18, head: -20, beard: 90, cloth: 10, arm: 60, elbow: 0, wrist: 0, free: -20, freeElbow: 30,
    frontHip: 10, frontKnee: 70, frontFoot: 10, backHip: 45, backKnee: 60, backFoot: -10, drop: 14 + bob });
  const holds: Phase[] = [{ frame: c, gesture: { ...stab(-4), chest: 24 }, tip: [6, -100] }];
  for (let frame = c + 2; frame <= fling; frame += 2) holds.push({ frame, gesture: stab(frame % 4 === 0 ? 4 : 2), tip: [6, frame % 4 === 0 ? -80 : -86] });
  return { pose: "downAir", style: AttackStyle.downAir, airborne: true, phases: [
    { frame: 0, gesture: READY },
    { frame: c - 4, gesture: { lean: -12, chest: -18, head: 12, beard: 40, arm: -100, elbow: 30, free: -60, freeElbow: 40, frontHip: -70, frontKnee: 100, backHip: -50, backKnee: 100, drop: 8 }, tip: [10, 175] },
    ...holds,
    { frame: fling + 4, gesture: { ...stab(6), lean: 10, chest: 10, arm: 30 } },
    { frame: fling + 10, gesture: { lean: 5, beard: 40, arm: -30, elbow: 40, frontHip: -40, frontKnee: 60, backHip: -10, backKnee: 60 } },
    { frame: total, gesture: READY },
  ] };
}

function timing(style: AttackStyle) { const move = SHADOW_HUNTER_MOVES.normals[style]!; return { contact: move.startupFrames, total: move.totalFrames }; }
function jab(): Authored {
  const { contact, total } = timing(AttackStyle.jab);
  const hold: Gesture = STILL;
  return { pose: "jab", style: AttackStyle.jab, support: "R", phases: [
    { frame: 0, gesture: READY },
    { frame: contact - 2, gesture: { ...hold, lean: -6, chest: -12, head: 6, step: -2 }, reach: ["handL", 16, 74] },
    { frame: contact, gesture: { ...hold, lean: 0, chest: 6, head: -14, step: 11 }, reach: ["handL", 82, 76] },
    { frame: contact + 2, gesture: { ...hold, lean: 2, chest: 10, head: -16, step: 16 }, reach: ["handL", 98, 76] },
    { frame: contact + 7, gesture: { ...hold, lean: 0, chest: 6, head: -10, step: 13 }, reach: ["handL", 74, 74] },
    { frame: total, gesture: READY },
  ] };
}
const GUARD: Gesture = { arm: -150, elbow: 30, free: 120, freeElbow: -40 };
const guard = (k: number): Gesture => Object.fromEntries(Object.entries(GUARD).map(([key, v]) => [key, v * k]));
function kick(pose: HeroPose, style: AttackStyle, target: readonly [number, number], lean: number, through: readonly [number, number], raise = 0, drop = 0): Authored {
  const { contact, total } = timing(style);
  const guard = (k: number): Gesture => ({ arm: (GUARD.arm! + raise) * k, elbow: GUARD.elbow! * k, free: GUARD.free! * k, freeElbow: GUARD.freeElbow! * k, drop: drop * k, frontKnee: -drop * 2 * k });
  return { pose, style, support: "L", phases: [
    { frame: 0, gesture: READY },
    { frame: contact - 4, gesture: { ...guard(0.7), lean: lean * 0.3, chest: -4, backKnee: 90, step: 0 }, reach: ["footR", 12, Math.max(34, target[1] * 0.55)] },
    { frame: contact - 2, gesture: { ...guard(1), lean: lean * 0.7, chest: lean * 0.3, backKnee: 120, step: 6 }, reach: ["footR", 30, Math.max(46, target[1] * 0.8)] },
    { frame: contact, gesture: { ...guard(1), lean, chest: lean * 0.5, head: -lean * 0.5, backKnee: 0, step: 10 }, reach: ["footR", target[0], target[1]] },
    { frame: contact + 2, gesture: { ...guard(1), lean: lean * 1.05, chest: lean * 0.55, head: -lean * 0.5, backKnee: 0, step: 10 }, reach: ["footR", through[0], through[1]] },
    { frame: contact + 7, gesture: { ...guard(0.8), lean: lean * 0.5, chest: lean * 0.2, backKnee: 100, step: 8 }, reach: ["footR", 30, Math.max(40, target[1] * 0.6)] },
    { frame: total, gesture: READY },
  ] };
}
const STILL: Gesture = { arm: 110, elbow: -60, free: 50, freeElbow: -30 };
const still = (k: number): Gesture => ({ arm: STILL.arm! * k, elbow: STILL.elbow! * k, free: STILL.free! * k, freeElbow: STILL.freeElbow! * k });
function sideKick(pose: HeroPose, style: AttackStyle, chamber: readonly [number, number], target: readonly [number, number], through: readonly [number, number], lean: number, back: readonly [number, number], fold: readonly [number, number] = chamber): Authored {
  const { contact, total } = timing(style);
  return { pose, style, support: "L", phases: [
    { frame: 0, gesture: READY },
    { frame: Math.max(1, contact - 6), gesture: { ...still(1), lean: lean * 0.2, backKnee: 70 }, reach: ["footR", -14, 22] },
    { frame: contact - 2, gesture: { ...still(1), lean: lean * 0.6, chest: lean * 0.2, backKnee: 125, step: 4 }, reach: ["footR", chamber[0], chamber[1]] },
    { frame: contact, gesture: { ...still(1), lean, chest: lean * 0.4, head: -lean * 0.4, backKnee: 0, step: 8 }, reach: ["footR", target[0], target[1]] },
    { frame: contact + 2, gesture: { ...still(1), lean: lean * 1.05, chest: lean * 0.45, head: -lean * 0.4, backKnee: 0, step: 9 }, reach: ["footR", through[0], through[1]] },
    { frame: contact + 3, gesture: { ...still(1), lean: lean * 0.95, chest: lean * 0.4, head: -lean * 0.35, backKnee: 30, step: 8 }, reach: ["footR", back[0], back[1]] },
    { frame: contact + 8, gesture: { ...still(1), lean: lean * 0.5, chest: lean * 0.2, backKnee: 120, step: 6 }, reach: ["footR", fold[0], fold[1]] },
    { frame: total, gesture: READY },
  ] };
}
function upTilt(): Authored {
  const { contact, total } = timing(AttackStyle.upTilt);
  return { pose: "upTilt", style: AttackStyle.upTilt, support: "L", phases: [
    { frame: 0, gesture: READY },
    { frame: contact - 4, gesture: { ...still(1), lean: 4, chest: 4, backKnee: 60, drop: -6, frontKnee: 16 }, reach: ["footR", -50, 2] },
    { frame: contact - 2, gesture: { ...still(1), lean: -10, backKnee: 120, step: 2 }, reach: ["footR", 26, 76] },
    { frame: contact, gesture: { ...still(1), lean: -28, chest: -14, head: 14, backKnee: 0, step: 2 }, reach: ["footR", 20, 150] },
    { frame: contact + 2, gesture: { ...still(1), lean: -32, chest: -16, head: 16, backKnee: 0, step: 2 }, reach: ["footR", -10, 160] },
    { frame: contact + 6, gesture: { ...still(1), lean: -14, chest: -6, backKnee: 40, step: 4 }, reach: ["footR", 50, 90] },
    { frame: contact + 12, gesture: { ...still(0.8), lean: -2, backKnee: 50, step: 6 }, reach: ["footR", 50, 20] },
    { frame: total, gesture: READY },
  ] };
}
function downTilt(): Authored {
  const { contact, total } = timing(AttackStyle.downTilt);
  const low = (k: number): Gesture => ({ ...guard(1), arm: -180, lean: -6 * k, chest: -4 * k, frontHip: -40 * k, frontKnee: 70 * k, drop: -14 * k, step: 4 * k });
  return { pose: "downTilt", style: AttackStyle.downTilt, support: "L", phases: [
    { frame: 0, gesture: READY },
    { frame: contact - 3, gesture: { ...low(0.6), backKnee: 100 }, reach: ["footR", 20, 20] },
    { frame: contact, gesture: { ...low(1), backKnee: 0 }, reach: ["footR", 100, 4] },
    { frame: contact + 2, gesture: { ...low(1), backKnee: 0 }, reach: ["footR", 106, 4] },
    { frame: contact + 8, gesture: { ...low(0.6), backKnee: 60 }, reach: ["footR", 50, 10] },
    { frame: total, gesture: READY },
  ] };
}
function dashAttack(): Authored {
  const { contact, total } = timing(AttackStyle.dashAttack);
  const fly = (k: number): Gesture => ({ ...still(1), lean: -18 * k, chest: -6 * k, head: 6 * k, frontHip: -10 * k, frontKnee: 80 * k, lunge: 10 * k, drop: 18 * k });
  return { pose: "dashAttack", style: AttackStyle.dashAttack, airborne: true, phases: [
    { frame: 0, gesture: READY },
    { frame: Math.max(1, contact - 5), gesture: { ...fly(0.3), backKnee: 90 }, reach: ["footR", -40, 20] },
    { frame: contact - 2, gesture: { ...fly(0.6), backKnee: 120 }, reach: ["footR", 26, 50] },
    { frame: contact, gesture: { ...fly(1), backKnee: 0 }, reach: ["footR", 96, 56] },
    { frame: contact + 2, gesture: { ...fly(1), lunge: 28, backKnee: 0 }, reach: ["footR", 108, 55] },
    { frame: contact + 8, gesture: { ...fly(1), backKnee: 0 }, reach: ["footR", 98, 50] },
    { frame: contact + 13, gesture: { ...fly(0.5), backKnee: 110 }, reach: ["footR", 30, 30] },
    { frame: total, gesture: READY },
  ] };
}

function upSmash(): Authored {
  const { contact, total } = timing(AttackStyle.upSmash);
  const coil: Gesture = { lean: 6, chest: 10, head: -8, free: 30, freeElbow: 50, beard: -10,
    frontHip: -62, frontKnee: 96, frontFoot: 10, backHip: 40, backKnee: 96, backFoot: 10, drop: -36, lunge: 4 };
  const rise = (lean: number, chest: number, drop: number): Gesture => ({ lean, chest, head: 18, pelvis: -6, free: -150, freeElbow: 20, beard: 30,
    frontHip: -12, frontKnee: 8, frontFoot: -20, backHip: 14, backKnee: 6, backFoot: -25, drop });
  const settle: Gesture = { lean: -3, chest: -5, head: 3, free: -30, freeElbow: 30, frontHip: -20, frontKnee: 30, backHip: 13, backKnee: 32, drop: -11 };
  return { pose: "upSmash", style: AttackStyle.upSmash, ground: "cloth", phases: [
    { frame: 0, gesture: READY },
    { frame: 5, gesture: { ...coil, lean: 3, chest: 5, head: -4, frontHip: -24, frontKnee: 36, backHip: 14, backKnee: 36, drop: -14 }, tip: [60, 30] },
    { frame: contact - 5, gesture: coil, tip: [55, 10] },
    { frame: contact - 1, gesture: { ...coil, lean: 8, chest: 12, drop: -38 }, tip: [50, 8] },
    { frame: contact, gesture: rise(-6, -10, 6), tip: [95, 170] },
    { frame: contact + 1, gesture: rise(-10, -14, 8), tip: [45, 250] },
    { frame: contact + 2, gesture: rise(-14, -18, 8), tip: [-20, 262] },
    { frame: contact + 3, gesture: rise(-18, -22, 6), tip: [-80, 230] },
    { frame: contact + 8, gesture: { ...rise(-20, -24, 0), free: -110, frontHip: -16, frontKnee: 16, backHip: 16, backKnee: 16 }, tip: [-135, 160] },
    { frame: contact + 14, gesture: { lean: -12, chest: -15, head: 10, free: -75, freeElbow: 25, frontHip: -18, frontKnee: 24, backHip: 15, backKnee: 25, drop: -6 }, tip: [-125, 120] },
    { frame: contact + 21, gesture: settle, tip: [-105, 90] },
    { frame: total - 3, gesture: { chest: -1, frontHip: -2, frontKnee: 3, backHip: 2, backKnee: 3, drop: -1 } },
    { frame: total, gesture: READY },
  ] };
}

function upSpecial(): Authored {
  const special = SHADOW_HUNTER_SPECIALS.up.ground!, total = special.endFrame, launch = CHARGED_AIM_FRAMES;
  const plant: Gesture = { lean: -6, chest: -4, head: -6, free: -40, freeElbow: 30, beard: -10,
    frontHip: -30, frontKnee: 20, frontFoot: 10, backHip: 40, backKnee: 50, backFoot: 10, drop: -6 };
  const sit: Gesture = { lean: 0, chest: -6, head: 6, free: 60, freeElbow: 10, frontHip: -95, frontKnee: 5, frontFoot: -20, backHip: -85, backKnee: 10, backFoot: -20, cloth: -40 };
  const stretch: Gesture = { lean: -6, chest: -12, head: 18, free: -170, freeElbow: 0, beard: 50, frontHip: 4, frontKnee: 4, frontFoot: -40, backHip: 14, backKnee: 8, backFoot: -40, cloth: 10 };
  return { pose: "upSpecial", style: AttackStyle.forwardSmash, frames: total, airborne: true, forms: ["upSpecialAir"], phases: [
    { frame: 0, gesture: READY },
    { frame: 4, gesture: { ...plant, lean: 6, chest: 4, frontHip: -26, frontKnee: 40, backHip: 14, backKnee: 40, drop: -12 }, tip: [100, 30], grip: [45, 100] },
    { frame: launch, gesture: plant, tip: [125, -2], grip: [55, 135] },
    { frame: launch + 2, gesture: { lean: -10, chest: -6, head: 0, free: -20, freeElbow: 20, frontHip: -50, frontKnee: 30, frontFoot: -10, backHip: -30, backKnee: 50, backFoot: -10 }, tip: [95, -22], grip: [40, 120] },
    { frame: launch + 5, gesture: sit, tip: [30, -95], grip: [22, 45] },
    { frame: launch + 9, gesture: stretch, tip: [20, 300], grip: [12, 200] },
    { frame: launch + 13, gesture: { ...stretch, lean: -14, chest: -16, head: 22, backKnee: 40 }, tip: [-90, 260], grip: [0, 200] },
    { frame: total, gesture: { ...stretch, lean: -25, chest: -15, head: 22, free: -130, freeElbow: 30, frontHip: -40, frontKnee: 45, backHip: 10, backKnee: 60 }, tip: [-135, 165], grip: [-10, 150] },
  ] };
}

const HELPLESS: Gesture = { lean: -42, chest: -18, head: 26, free: -140, freeYaw: 60, freeElbow: 15, beard: 70, cloth: -20,
  frontHip: -70, frontKnee: 50, frontFoot: 30, backHip: 35, backKnee: 80, backFoot: 30 };
function fallSpecial(): Authored {
  return { pose: "fallSpecial", frames: 40, airborne: true, looping: true, bind: true, phases: [
    { frame: 0, gesture: HELPLESS, tip: [-160, 95] },
    { frame: 10, gesture: { ...HELPLESS, lean: -52, head: 30, free: -175, freeYaw: 30, frontHip: -35, frontKnee: 40, backHip: 50, backKnee: 60 }, tip: [-150, 140] },
    { frame: 20, gesture: { ...HELPLESS, lean: -34, head: 20, free: -80, freeYaw: 80, freeElbow: 25, frontHip: -90, frontKnee: 80, backHip: 5, backKnee: 50 }, tip: [-165, 55] },
    { frame: 30, gesture: { ...HELPLESS, lean: -48, head: 28, free: -120, freeYaw: 90, frontHip: -50, frontKnee: 25, backHip: 55, backKnee: 100 }, tip: [-145, 120] },
    { frame: 40, gesture: HELPLESS, tip: [-160, 95] },
  ] };
}

const hang = (action: Authored, drape = false): Authored => ({ ...action, phases: action.phases.map(phase => {
  const g = phase.gesture, cloth = g.cloth ?? 0.8 * Math.min(g.frontHip ?? 0, g.backHip ?? 0);
  return { ...phase, gesture: { ...g, beard: g.beard ?? Math.min(90, 3.5 * Math.max(0, (g.lean ?? 0) + (g.chest ?? 0) + (g.head ?? 0))), ...drape ? { cloth, clothTip: g.clothTip ?? 0.3 * cloth } : {} } };
}) });
const draped = (make: () => Authored) => () => hang(make(), true);
const kicked = (make: () => Authored) => () => hang({ ...make(), ground: "sole" });

const POSES: Readonly<Record<string, () => Authored>> = {
  neutralSpecial, jump, doubleJump, forwardSmash, downSmash, upSmash, upSpecial, fallSpecial,
  backAir: draped(backAir), neutralAir: draped(neutralAir), downAir: draped(downAir),
  forwardTiltDown: kicked(() => kick("forwardTiltDown", AttackStyle.forwardTiltDown, [76, 26], -8, [80, 24], -30, -8)),
  downTilt: kicked(downTilt), jab: kicked(jab), upTilt: kicked(upTilt), dashAttack: kicked(dashAttack),
  forwardTilt: kicked(() => sideKick("forwardTilt", AttackStyle.forwardTilt, [34, 64], [88, 60], [100, 61], -8, [66, 41])),
  forwardTiltUp: kicked(() => sideKick("forwardTiltUp", AttackStyle.forwardTiltUp, [30, 80], [74, 108], [82, 120], -26, [34, 72], [30, 40])),
};

function rotation(base: ArrayLike<number>, pitch: number, yaw = 0, roll = 0): Float32Array {
  const q = quat.create(); quat.rotateY(q, q, pitch * Math.PI / 180); quat.rotateZ(q, q, yaw * Math.PI / 180); quat.rotateX(q, q, roll * Math.PI / 180);
  quat.multiply(q, q, Float32Array.from(base)); quat.normalize(q, q); return new Float32Array(q);
}
function depthTurn(base: ArrayLike<number>, parent: ArrayLike<number>, degrees: number, world = 1): Float32Array {
  const axis = [0, 1, 2].map(i => parent[i * 4 + world]! / Math.hypot(parent[i * 4]!, parent[i * 4 + 1]!, parent[i * 4 + 2]!)), n = Math.hypot(...axis);
  const q = quat.setAxisAngle(quat.create(), axis.map(v => v / n) as [number, number, number], degrees * Math.PI / 180);
  quat.multiply(q, q, Float32Array.from(base)); quat.normalize(q, q); return new Float32Array(q);
}
function joint(name: string, g: Gesture): [number, number, number] {
  switch (name) {
    case "Attack Gesture": return [g.lean ?? 0, g.spin ?? 0, 0];
    case "Bone_Chest": return [g.chest ?? 0, g.chestTurn ?? 0, 0];
    case "Bone_Head": return [g.head ?? 0, 0, 0];
    case "Beard1": return [g.beard ?? 0, 0, 0];
    case "Object02": return [g.cloth ?? 0, 0, 0];
    case "Object04": return [g.clothTip ?? 0, 0, 0];
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
const blade = tipNode.Parent!;
const bladePoints = model.Geosets.flatMap(geoset => Array.from({ length: geoset.Vertices.length / 3 }, (_, v) => v)
  .filter(v => (geoset.Groups[geoset.VertexGroup[v] ?? 0] ?? []).every(node => node === blade))
  .filter((_, i) => i % 4 === 0).map(v => vec3.fromValues(geoset.Vertices[v * 3]!, geoset.Vertices[v * 3 + 1]!, geoset.Vertices[v * 3 + 2]!)));
ensure(bladePoints.length > 0, "no glaive vertices");
const bladeFloor = () => { const m = data.nodes[blade]!.matrix as unknown as Float32Array, p = vec3.create(); let low = Infinity; for (const v of bladePoints) { vec3.transformMat4(p, v, m); low = Math.min(low, p[2]!); } return low; };
const footRest = Math.min(model.PivotPoints[model.Nodes.find(n => n?.Name === "Foot Left Ref ")!.ObjectId]![2]!, model.PivotPoints[model.Nodes.find(n => n?.Name === "Foot Right Ref ")!.ObjectId]![2]!);
const soleNodes = new Set(["Bone_Foot_L", "Bone_Foot_R"].map(name => named(name).ObjectId));
const soles = model.Geosets.flatMap(geoset => Array.from({ length: geoset.Vertices.length / 3 }, (_, v) => ({ geoset, v, bones: [...geoset.Groups[geoset.VertexGroup[v]!]!] })).filter(sole => sole.bones.some(bone => soleNodes.has(bone))));
const soleZ = () => { let low = Infinity; for (const { geoset, v, bones } of soles) { let z = 0; for (const bone of bones) { const m = data.nodes[bone]!.matrix; z += (m[2]! * geoset.Vertices[v * 3]! + m[6]! * geoset.Vertices[v * 3 + 1]! + m[10]! * geoset.Vertices[v * 3 + 2]! + m[14]!) / bones.length; } low = Math.min(low, z); } return low; };
renderer.setSequence(standIndex); data.frame = stand.Interval[0]; renderer.update(0);
const soleRest = soleZ();
const time = (start: number, frame: number) => start + Math.round(frame * 1000 / 60);
const worldOf = (node: mdx.Node) => { const pivot = model.PivotPoints[node.ObjectId]!, p = vec3.fromValues(pivot[0]!, pivot[1]!, pivot[2]!); vec3.transformMat4(p, p, data.nodes[node.ObjectId]!.matrix as unknown as Float32Array); return p; };
const baseOf = (node: mdx.Node) => originals.get(`.Bones.${source.Bones.findIndex(b => b.Name === node.Name)}.Rotation`)!.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1])!.Vector;
const rootKey = (Frame: number) => {
  let key = root.Translation!.Keys.find(k => k.Frame === Frame);
  if (!key) {
    const before = root.Translation!.Keys.filter(k => k.Frame <= Frame).at(-1)!, after = root.Translation!.Keys.find(k => k.Frame >= Frame)!;
    const t = after.Frame === before.Frame ? 0 : (Frame - before.Frame) / (after.Frame - before.Frame);
    key = { ...before, Frame, Vector: Float32Array.from(before.Vector, (v, i) => v + (after.Vector[i]! - v) * t), ...before.InTan ? { InTan: new Float32Array(3), OutTan: new Float32Array(3) } : {} };
    root.Translation!.Keys.push(key); root.Translation!.Keys.sort((a, b) => a.Frame - b.Frame);
  }
  return key;
};

function settleFeet(index: number, start: number, frames: number) {
  const feet = [named("Foot Left Ref "), named("Foot Right Ref ")];
  for (let frame = 0; frame <= frames; frame++) {
    const Frame = time(start, frame);
    renderer.setSequence(index); data.frame = Frame; renderer.update(0);
    const floor = Math.min(...feet.map(node => worldOf(node)[2]!)) - footRest;
    const key = rootKey(Frame);
    key.Vector = Float32Array.from(key.Vector, (v, i) => i === 2 ? v - floor : v);
  }
}

function liftCloth(pose: string, action: Authored, index: number, start: number) {
  const cloth = named("Object02"), clothIds = new Set([cloth.ObjectId, named("Object04").ObjectId, named("Object01").ObjectId]);
  ensure(cloth.Rotation, "Object02 has no rotation track");
  const clothPoints = model.Geosets.flatMap(geoset => Array.from({ length: geoset.Vertices.length / 3 }, (_, v) => v)
    .filter(v => { const g = geoset.Groups[geoset.VertexGroup[v] ?? 0] ?? []; return g.length > 0 && g.every(n => clothIds.has(n)); })
    .map(v => ({ node: geoset.Groups[geoset.VertexGroup[v] ?? 0]![0]!, p: vec3.fromValues(geoset.Vertices[v * 3]!, geoset.Vertices[v * 3 + 1]!, geoset.Vertices[v * 3 + 2]!) })));
  const clothFloor = () => { const q = vec3.create(); let low = Infinity; for (const { node, p } of clothPoints) { vec3.transformMat4(q, p, data.nodes[node]!.matrix as unknown as Float32Array); low = Math.min(low, q[2]!); } return low; };
  const clothBase = baseOf(cloth);
  const cloth2 = named("Object04");
  const cloth2Base = originals.get(`.Bones.${source.Bones.findIndex(b => b.Name === "Object04")}.Rotation`)?.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1])?.Vector ?? new Float32Array([0, 0, 0, 1]);
  const clothAngles = [0, ...Array.from({ length: 64 }, (_, i) => (i % 2 ? -1 : 1) * (Math.floor(i / 2) * 5 + 5))];
  renderer.setSequence(index);
  for (const phase of action.phases) {
    const at = time(start, phase.frame), key = cloth.Rotation!.Keys.find(k => k.Frame === at)!;
    const key2 = cloth2.Rotation?.Keys.find(k => k.Frame === at);
    const set = (angle: number) => {
      key.Vector = rotation(clothBase, Math.max(-90, Math.min(90, angle))); if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); }
      if (key2) { key2.Vector = rotation(cloth2Base, Math.abs(angle) > 90 ? angle - Math.sign(angle) * 90 : 0); if (key2.InTan) { key2.InTan = key2.Vector.slice(); key2.OutTan = key2.Vector.slice(); } }
      data.frame = at; renderer.update(0); };
    let chosen = 0, bestLow = -Infinity;
    for (const angle of clothAngles) {
      set(angle); const low = clothFloor();
      if (low >= 0) { chosen = angle; bestLow = low; break; }
      if (low > bestLow) { bestLow = low; chosen = angle; }
    }
    set(chosen);
    if (chosen !== 0) console.log(`${pose} f${phase.frame}: loincloth pitched ${chosen} (low ${bestLow.toFixed(1)})`);
  }
}

function aimTip(action: Authored, start: number) {
  const arm = named("Bone_Arm1_R"), elbow = named("Bone_Arm2_R");
  const gripAt = () => worldOf(hand);
  for (const phase of action.phases) if (phase.tip) {
    const at = time(start, phase.frame), tip = phase.tip;
    const keys = [arm, elbow, hand].map(n => n.Rotation!.Keys.find(k => k.Frame === at)!);
    const angles = [phase.gesture.arm ?? 0, phase.gesture.armYaw ?? 0, 0, phase.gesture.elbow ?? 0, phase.gesture.wrist ?? 0, phase.gesture.wristRoll ?? 0];
    const apply = () => {
      keys[0]!.Vector = rotation(baseOf(arm), angles[0]!, angles[1]!, angles[2]!);
      keys[1]!.Vector = rotation(baseOf(elbow), angles[3]!, 0, 0);
      keys[2]!.Vector = rotation(baseOf(hand), angles[4]!, 0, angles[5]!);
      for (const key of keys) if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); }
      data.frame = at; renderer.update(0);
    };
    const loss = () => { apply(); const p = tipAt(), g = phase.grip ? gripAt() : undefined;
      return (p[0]! - tip[0]) ** 2 + (p[2]! - tip[1]) ** 2 + (tip[2] === undefined ? 0.3 * p[1]! ** 2 : (p[1]! - tip[2]) ** 2)
        + (g ? (g[0]! - phase.grip![0]) ** 2 + (g[2]! - phase.grip![1]) ** 2 : 0) + (action.ground === "cloth" ? 40 * Math.max(0, 3 - bladeFloor()) ** 2 : 0); };
    for (let pass = 0; pass < 4; pass++) for (const axis of [0, 3, 4, 1, 2, 5]) {
      let best = Infinity, bestAngle = angles[axis]!;
      const centre = angles[axis]!, span = pass < 2 ? 180 : 30, step = pass < 2 ? 10 : 2;
      for (let angle = centre - span; angle <= centre + span; angle += step) { angles[axis] = angle; const value = loss(); if (value < best) { best = value; bestAngle = angle; } }
      angles[axis] = bestAngle;
    }
    loss();
  }
}

function reachAndStand(action: Authored, index: number, start: number, frames: number) {
  const supportFoot = action.support === undefined ? undefined : named(REACH[action.support === "L" ? "footL" : "footR"][0]);
  data.frame = start; renderer.setSequence(index); renderer.update(0);
  const supportRest = supportFoot === undefined ? 0 : worldOf(supportFoot)[0]!;
  const settled = (p: vec3, phase: Phase) => {
    const floor = Math.min(action.airborne ? 0 : Infinity, soleZ() - soleRest);
    const shift = supportFoot === undefined ? 0 : supportRest + (phase.gesture.step ?? 0) - worldOf(supportFoot)[0]!;
    return [p[0]! + shift, p[2]! - floor];
  };
  for (const phase of action.phases) if (phase.reach) {
    const [end, x, z] = phase.reach, [ref, upperField, lowerField, upperName, lowerName] = REACH[end], effector = named(ref), at = time(start, phase.frame);
    const keys = [named(upperName), named(lowerName)].map(n => n.Rotation!.Keys.find(k => k.Frame === at)!), bases = [named(upperName), named(lowerName)].map(baseOf);
    const preferred = phase.gesture[lowerField] ?? 0;
    let best = [phase.gesture[upperField] ?? 0, preferred], score = Infinity;
    let tuck = 0, bestTuck = 0;
    const trial = (a: number, b: number) => {
      data.frame = at;
      [a, b].forEach((angle, i) => {
        const node = [named(upperName), named(lowerName)][i]!, key = keys[i]!; key.Vector = bases[i]!.slice(); renderer.update(0);
        const parent = data.nodes[node.Parent!]!.matrix;
        key.Vector = depthTurn(i === 0 ? depthTurn(bases[i]!, parent, tuck, 0) : bases[i]!, parent, angle);
        if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); }
        renderer.update(0);
      });
      const [px, pz] = settled(worldOf(effector), phase), value = (px! - x) ** 2 + (pz! - z) ** 2 + 0.002 * (b - preferred) ** 2;
      if (value < score) { score = value; best = [a, b]; bestTuck = tuck; }
    };
    for (const t of end.startsWith("foot") ? [0, -20, 20, -40, 40, -60, 60] : [0]) { if (score < 16) break; tuck = t; for (let a = -180; a < 180; a += 10) for (let b = -170; b <= 170; b += 10) trial(a, b); }
    tuck = bestTuck;
    for (const step of [4, 2, 1]) { const [a0, b0] = best; for (let a = a0! - 3 * step; a <= a0! + 3 * step; a += step) for (let b = b0! - 3 * step; b <= b0! + 3 * step; b += step) trial(a, b); }
    trial(best[0]!, best[1]!);
    phase.gesture[upperField] = best[0]; phase.gesture[lowerField] = best[1];
  }
  for (let frame = 0; frame <= frames; frame++) {
    const Frame = time(start, frame);
    renderer.setSequence(index); data.frame = Frame; renderer.update(0);
    const key = rootKey(Frame);
    const next = action.phases.findIndex(p => p.frame >= frame), b = action.phases[next]!, a = action.phases[Math.max(0, next - 1)]!;
    const step = (a.gesture.step ?? 0) + ((b.gesture.step ?? 0) - (a.gesture.step ?? 0)) * (b.frame === a.frame ? 1 : (frame - a.frame) / (b.frame - a.frame));
    for (let pass = 0; pass < 3; pass++) {
      data.frame = Frame; renderer.update(0);
      const floor = Math.min(action.airborne ? 0 : Infinity, soleZ() - soleRest), shift = supportFoot === undefined ? 0 : supportRest + step - worldOf(supportFoot)[0]!;
      key.Vector = Float32Array.from(key.Vector, (v, i) => i === 2 ? v - floor : i === 0 ? v + shift : v);
    }
  }
}

const prior: Record<string, HeroClip> = { ...ROSTER_ATTACK_CLIPS[Character.shadowHunter], ...JUMP_CLIPS[Character.shadowHunter], ...SHADOW_HUNTER_AUTHORED_CLIPS };
let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
const bindings = new Map<string, HeroClip>(Object.entries(SHADOW_HUNTER_AUTHORED_CLIPS));
const authored: { action: Authored; index: number; frames: number }[] = [];

for (const pose of selected) {
  const action = POSES[pose]!();
  const frames = action.frames ?? SHADOW_HUNTER_MOVES.normals[action.style!]!.totalFrames;
  const name = `Attack Gesture ${pose}`;
  const previous = prior[pose];
  let index = model.Sequences.findIndex(s => s.Name === name);
  if (index < 0 && previous !== undefined && /^(Attack Gesture|Jump Motion) /.test(model.Sequences[previous.index]?.Name ?? "")) index = previous.index;
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
  if (action.ground === "cloth" && !action.airborne) { settleFeet(index, start, frames); liftCloth(pose, action, index, start); }
  renderer.setSequence(index);
  aimTip(action, start);
  if (action.ground === "sole") reachAndStand(action, index, start, frames);
  else if (action.ground === undefined && !action.airborne) settleFeet(index, start, frames);
  if (action.style !== undefined || action.bind) for (const form of [pose, ...action.forms ?? []]) bindings.set(form, { index, seconds: (time(start, frames) - start) / 1000, aligned: true });
  authored.push({ action, index, frames });
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
for (const { action, index, frames } of authored) {
  let lowest = Infinity; for (let frame = 0; frame <= frames && !action.airborne; frame++) { const t = after.triangles(index, frame / 60, 1); for (let i = 1; i < t.length; i += 2) lowest = Math.min(lowest, t[i]!); }
  if (lowest <= -8) console.warn(`${action.pose}: drawn body sinks ${lowest.toFixed(1)} below the floor`);
  const style = action.style === undefined ? undefined : action.frames === undefined && SHADOW_HUNTER_MOVES.normals[action.style] ? action.style : AttackStyle.forwardSmash;
  const panels: PoseFrame[] = [1, -1].flatMap(facing => { const sampled = style === undefined ? [] : sampleAttack(Character.shadowHunter, style, facing);
    return action.phases.map(p => ({ ...sampled[Math.min(p.frame, sampled.length - 1)] ?? { phase: AttackPhase.none, x: 0, z: 0, facing, parts: [], strikes: [] }, frame: p.frame, clip: index, seconds: p.frame / 60 })); });
  await Bun.write(join(output, `${action.pose}.png`), sheet(`Shadow Hunter ${action.pose}`, after, panels, action.phases.length).png);
}
const lines = [...bindings].sort(([a], [b]) => a.localeCompare(b)).map(([pose, clip]) => `  ${pose}: { index: ${clip.index}, seconds: ${seconds(Number(clip.seconds.toFixed(3)))}${clip.aligned ? ", aligned: true" : ""} },`);
await Bun.write(join(project, "ts/src/game/presentation/heroes/shadowHunterClipInfo.ts"), [
  "// Generated by tools/animations/shadow-hunter-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";',
  'import type { HeroClipTable } from "../../sim/heroes/hero";',
  "export const SHADOW_HUNTER_AUTHORED_CLIPS: HeroClipTable = {", ...lines, "};", "",
].join("\n"));
console.log(`SHADOW_HUNTER_CLIPS_PASS ${authored.map(a => `${a.action.pose}@${a.index}`).join(" ")}; ${preserved} earlier pose samples retained; ${target}`);
