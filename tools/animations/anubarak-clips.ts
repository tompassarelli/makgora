import { floatVector } from './animVector';

import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { model as mdx, ModelRenderer } from "war3-model";
import { parseModelMDX as parseMDX, generateModelMDX as generateMDX } from "../../ts/scripts/mdxCodec";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sampleAttack, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackStyle, AttackPhase, GrabAction, Character } from "../../ts/src/game/sim/codes";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { ANUBARAK_MOVES } from "../../ts/src/game/sim/heroes/anubarakMoves";
import { ANUBARAK_SPECIALS } from "../../ts/src/game/sim/heroes/anubarakSpecials";
import { seconds } from "./asset-info";
import { blenderOptions, blenderSkeleton } from "./blender-keys";
import { FIGHTER_ULTIMATES } from "../../ts/src/game/sim/ultimates";

function ensure(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function tracks(value: unknown, visit: (track: mdx.AnimVector, path: string) => void, path = "") {
  if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return;
  if ("Keys" in value && Array.isArray(value.Keys)) { if (value.Keys.length && typeof value.Keys[0] === "object" && "Vector" in value.Keys[0]) visit(value as mdx.AnimVector, path); return; }
  for (const [key, child] of Object.entries(value)) if (key !== "Nodes") tracks(child, visit, `${path}.${key}`);
}
const globalClock = (track: mdx.AnimVector) => track.GlobalSeqId != null && track.GlobalSeqId !== -1 && track.GlobalSeqId !== 0xffffffff;
const [input, output] = process.argv.slice(2, 4).map(p => resolve(p));
const { rig: rigOutput, keys: bakedKeys } = blenderOptions(process.argv), blenderPose: HeroPose = "dashAttack";
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith("..") && !(rigOutput && bakedKeys), "usage: bun tools/animations/anubarak-clips.ts STOCK_ANUBARAK.mdx|SHIPPED_ANUBARAK.mdx PRIVATE_OUTPUT [--rig RIG.json | --keys KEYS.json]");
const originalBytes = await Bun.file(input).arrayBuffer();
const source = parseMDX(originalBytes);
if (source.Sequences.length > 17) {
  ensure(source.Sequences.slice(17).every(sequence => sequence.Name.startsWith("Anubarak ")), "Expected only previously authored Anubarak clips after the stock sequences");
  source.Sequences = source.Sequences.slice(0, 17);
  const stockEnd = Math.max(...source.Sequences.map(sequence => sequence.Interval[1]!));
  tracks(source, track => { if (!globalClock(track)) track.Keys = track.Keys.filter(key => key.Frame <= stockEnd); });
}
const model = structuredClone(source);
ensure(source.Sequences.length === 17 && source.Helpers.some(b => b.Name === "Bone_ArmClawR"), "Expected original classic Crypt Lord");
const stand = source.Sequences[0]!;
interface Gesture { chest?: number; pelvis?: number; arm?: number; elbow?: number; wrist?: number; hand?: number; leftArm?: number; leftElbow?: number; leftWrist?: number; head?: number; thigh?: number; knee?: number; leftThigh?: number; frontThigh?: number; leftFrontThigh?: number; shield?: number; leftShield?: number; shieldTwist?: number; leftShieldTwist?: number; yaw?: number; lean?: number; }
interface Action { pose: HeroPose; frames: number; contact: number; gesture: Gesture; hold?: boolean; air?: boolean; roll?: number; target?: readonly [number, number]; paired?: boolean; pain?: boolean; }
const forward: Gesture = { chest: 15, pelvis: -8, arm: -95, elbow: 15, leftArm: -35, leftElbow: -20, head: -8, thigh: 12, leftThigh: -8 };
const overhead: Gesture = { chest: -18, pelvis: 8, arm: -165, elbow: -10, leftArm: -140, head: -18, thigh: -12, leftThigh: 15 };
const low: Gesture = { chest: 45, pelvis: 18, arm: -45, elbow: 15, leftArm: -60, head: -20, thigh: 45, knee: -55, leftThigh: -25 };
const back: Gesture = { chest: -12, pelvis: -15, arm: 40, leftArm: -55, head: 20, yaw: 105 };
const cast: Gesture = { chest: -15, pelvis: 8, arm: -120, elbow: -30, leftArm: -115, leftElbow: -20, head: -12 };
const brace: Gesture = { chest: 28, pelvis: 12, arm: -50, elbow: -30, leftArm: -70, leftElbow: -25, head: -15, thigh: 38, knee: -65, leftThigh: -35 };
const upperAir: readonly Gesture[] = [
  { chest: 55, pelvis: 25, lean: 25, arm: -185, elbow: 20, leftArm: -185, head: -25, thigh: 65, knee: -80, leftThigh: -55 },
  { chest: -35, pelvis: -15, lean: -15, arm: 0, elbow: 20, leftArm: 0, thigh: -25, leftThigh: 25 },
  { chest: -30, pelvis: -20, lean: -20, arm: -200, elbow: 20, leftArm: -200, thigh: -35, leftThigh: 35 },
];
const burrowRake: readonly Gesture[] = [
  { chest: 75, pelvis: 35, lean: 25, arm: -185, elbow: 20, leftArm: -185, head: -25, thigh: 65, knee: -80, leftThigh: -55 },
  { chest: -45, pelvis: -15, lean: -15, arm: 0, elbow: 20, leftArm: 0, thigh: -10, leftThigh: 10 },
  { chest: -40, pelvis: -25, lean: -20, arm: -200, elbow: 20, leftArm: -200, thigh: -20, leftThigh: 20 },
];
interface Lunge { contact: number; x?: number; z?: number; back: number; over?: number; ramp?: number; decay?: number; }
const lunges: Partial<Record<HeroPose, Lunge>> = {
  jab: { contact: 5, x: 64, back: 32 },
  jab2: { contact: 7, x: 64, back: 32 },
  forwardSmash: { contact: 20, x: 48, back: 24 },
  upSmash: { contact: 17, z: 48, back: 24 },
  downSmash: { contact: 15, x: 10, back: 6 },
  neutralAir: { contact: 9, x: 12, back: 6 },
  forwardAir: { contact: 12, x: 20, back: 10, decay: 26 },
  backAir: { contact: 10, x: -70, back: 35 },
  dashAttack: { contact: 8, x: 56, back: 26, over: 0.4, ramp: 11, decay: 21 },
  downAir: { contact: 16, z: -12, back: 6 },
  neutralSpecial: { contact: 17, x: 32, back: 16, over: 0.4, ramp: 8 },
  upSpecial: { contact: 8, z: 34, back: 24 },
  downSpecial: { contact: 21, x: 26, back: 30, over: 0.4, ramp: 4 },
  ultimate: { contact: 16, x: 32, back: 16 },
};
interface Rake { contact: number; through: number; settle?: number; cock?: number; windup: Gesture; strike: Gesture; follow: Gesture; carry?: { frame: number; gesture: Gesture }; }
const scythe = (chest: number, lean: number): Omit<Rake, "contact" | "through"> => ({
  windup: { chest: -22, pelvis: -15, lean: -12, arm: -190, elbow: 20, leftArm: -150 },
  strike: { chest, pelvis: 22, lean, arm: -100, elbow: 20, leftArm: -100 },
  follow: { chest: chest + 18, pelvis: 32, lean: lean + 6, arm: 100, elbow: 20, leftArm: 60 },
});
const rakes: Partial<Record<HeroPose, Rake>> = {
  jab: { contact: 5, through: 7, windup: { chest: -20, pelvis: -12, lean: -10, arm: -210, elbow: 70, wrist: 40, leftArm: -65, head: -15 }, strike: { chest: 30, pelvis: 15, lean: 12, arm: -275, elbow: 100, wrist: 60, leftArm: -80, head: 15 }, follow: { chest: 45, pelvis: 28, lean: 16, arm: -90, elbow: 110, wrist: 55, leftArm: -95, head: 15 }, carry: { frame: 13, gesture: { chest: 45, pelvis: 28, lean: 12, arm: 0, elbow: 0, wrist: 30, leftArm: -95, head: 10 } } },
  jab2: { contact: 7, through: 9, windup: { chest: -20, pelvis: -12, lean: -10, leftArm: -210, leftElbow: 70, leftWrist: 40, arm: -65, head: -15 }, strike: { chest: 25, pelvis: 15, lean: 10, leftArm: -230, leftElbow: 120, leftWrist: 40, arm: -80, head: 15 }, follow: { chest: 45, pelvis: 28, lean: 16, leftArm: -90, leftElbow: 110, leftWrist: 55, arm: -95, head: 15 }, carry: { frame: 15, gesture: { chest: 45, pelvis: 28, lean: 12, leftArm: 0, leftElbow: 0, leftWrist: 30, arm: -95, head: 10 } } },
  forwardSmash: { contact: 19, through: 22, windup: { chest: -28, pelvis: -15, lean: -14, arm: -210, elbow: 70, wrist: 40, leftArm: -170, leftElbow: 50, head: -25 }, strike: { chest: 30, pelvis: 15, lean: 10, arm: -230, elbow: 120, wrist: 40, head: 15, leftArm: -150, leftElbow: 70 }, follow: { chest: 50, pelvis: 30, lean: 18, arm: -90, elbow: 110, wrist: 55, head: 15, leftArm: -120, leftElbow: 60 }, carry: { frame: 34, gesture: { chest: 50, pelvis: 30, lean: 12, arm: 0, elbow: 0, wrist: 30, head: 10, leftArm: -90, leftElbow: 50 } } },
  downSmash: { contact: 15, through: 20, windup: { chest: -25, pelvis: -15, lean: -12, arm: -220, elbow: 80, wrist: 40, leftArm: -220, leftElbow: 80, leftWrist: 40, head: -20 }, strike: { chest: 45, pelvis: 18, lean: 18, arm: -170, elbow: 70, wrist: 80, head: 15, leftArm: -200, leftElbow: 90, leftWrist: 40, thigh: 30, knee: -40 }, follow: { chest: 30, pelvis: 20, lean: 5, yaw: 150, arm: -150, elbow: 80, wrist: 80, leftArm: -150, leftElbow: 80, leftWrist: 60, thigh: 35, knee: -45 }, carry: { frame: 30, gesture: { chest: 30, pelvis: 20, yaw: 120, arm: -60, elbow: 60, wrist: 60, leftArm: -60, leftElbow: 60, leftWrist: 60, thigh: 30, knee: -40 } } },
  forwardTiltDown: { contact: 9, through: 12, windup: { chest: -20, pelvis: -12, lean: -10, arm: -230, elbow: 70, wrist: 40, leftArm: -60, head: -20 }, strike: { chest: 55, pelvis: 18, lean: 22, arm: -150, elbow: 40, wrist: 30, head: 15, leftArm: -60, thigh: 30, knee: -40 }, follow: { chest: 45, pelvis: 28, lean: 18, arm: -80, elbow: 100, wrist: 60, head: 15, leftArm: -60, thigh: 40, knee: -50, leftThigh: -20 }, carry: { frame: 20, gesture: { chest: 40, pelvis: 28, lean: 12, arm: 0, elbow: 0, wrist: 30, head: 10, leftArm: -60, thigh: 35, knee: -45 } } },
  downTilt: { contact: 7, through: 10, windup: { chest: -15, pelvis: -10, lean: -8, arm: -220, elbow: 80, wrist: 40, leftArm: -40, head: -15, thigh: 20, knee: -30 }, strike: { chest: 55, pelvis: 20, lean: 22, arm: -130, elbow: 40, wrist: 30, hand: 0, head: 20, thigh: 40, knee: -50, leftArm: -60 }, follow: { chest: 20, pelvis: 20, arm: -40, elbow: 60, wrist: 70, hand: 30, head: 15, thigh: 35, knee: -45, leftArm: -60 }, carry: { frame: 18, gesture: { chest: 15, pelvis: 15, lean: -5, arm: 20, wrist: 30, head: 10, thigh: 30, knee: -40, leftArm: -60 } } },
  dashAttack: { contact: 8, through: 19, windup: { chest: -16, pelvis: -10, lean: -28, arm: -230, elbow: 70, wrist: 40, leftArm: -200, leftElbow: 60, head: -18, thigh: 25, knee: -35, leftThigh: 15, frontThigh: 15, leftFrontThigh: 15 }, strike: { chest: 8, arm: -80, elbow: -20, leftArm: -70, leftElbow: -20, head: 15, shieldTwist: 80, leftShieldTwist: 80, thigh: 50, knee: -10, leftThigh: 50, frontThigh: -45, leftFrontThigh: -45 }, follow: { chest: 28, lean: 12, arm: -35, elbow: 10, wrist: 30, leftArm: -25, leftElbow: 10, leftWrist: 40, head: 25, shieldTwist: 80, leftShieldTwist: 80, thigh: 72, knee: -22, leftThigh: 72, frontThigh: -66, leftFrontThigh: -66 }, carry: { frame: 19, gesture: { chest: 28, lean: 12, arm: -35, elbow: 10, wrist: 30, leftArm: -25, leftElbow: 10, leftWrist: 40, head: 25, shieldTwist: 80, leftShieldTwist: 80, thigh: 72, knee: -22, leftThigh: 72, frontThigh: -66, leftFrontThigh: -66 } } },
  forwardAir: { contact: 12, through: 15, settle: 1, windup: { chest: -22, pelvis: -14, lean: -12, arm: -190, elbow: 20, leftArm: -80, thigh: 25, leftThigh: -25 }, strike: { chest: 30, pelvis: 24, lean: 14, arm: -100, elbow: 20, leftArm: -100, thigh: -20, leftThigh: 20 }, follow: { chest: 48, pelvis: 32, lean: 20, arm: 100, elbow: 20, leftArm: -120, thigh: -35, leftThigh: 35 } },
  backAir: { contact: 10, through: 13, windup: { chest: 22, pelvis: 15, lean: 12, arm: 190, elbow: 20, leftArm: 70 }, strike: { chest: -28, pelvis: -20, lean: -15, arm: 100, elbow: 20, leftArm: 100 }, follow: { chest: -45, pelvis: -30, lean: -20, arm: -100, elbow: 20, leftArm: -100 } },
  neutralSpecial: { contact: 18, through: 26, ...scythe(35, 15) },
  neutralSpecialAir: { contact: 18, through: 26, ...scythe(35, 15) },
  downSpecial: { contact: 21, through: 31, settle: 2, ...scythe(35, 15) },
  downSpecialAir: { contact: 21, through: 31, settle: 2, ...scythe(35, 15) },
  ultimate: { contact: 17, through: 25, settle: 2, cock: 9, ...scythe(33, 14) },
};
const swings: Partial<Record<HeroPose, readonly [windup: number, follow: number]>> = {
  upSpecial: [0.8, 1],
  upSpecialAir: [0.8, 1],
  downAir: [0.6, 1.3],
};
const lungeAt = (lunge: Lunge, frame: number, frames: number) => {
  const over = lunge.over ?? 0.25, drive = lunge.x ?? lunge.z ?? 0, reach = Math.abs(drive), sign = Math.sign(drive);
  const windup = Math.max(1, Math.round(lunge.contact * 0.6)), hold = Math.min(frames - 1, lunge.contact + Math.max(3, lunge.ramp ?? 0));
  return sign * (frame <= windup ? -lunge.back * Math.sin(frame / windup * Math.PI / 2)
    : frame <= lunge.contact ? -lunge.back + (lunge.back + reach) * Math.sqrt((frame - windup) / (lunge.contact - windup))
    : frame <= hold ? reach * (1 + over * Math.min(1, (frame - lunge.contact) / (lunge.ramp ?? 1))) : reach * (1 + over) * Math.max(0, 1 - (frame - hold) / (lunge.decay ?? Math.min(20, frames - hold))));
};
const actions: Action[] = [];
const normals: readonly [HeroPose, AttackStyle, Gesture, readonly [number, number]][] = [
  ["jab", AttackStyle.jab, { ...forward, chest: 25, arm: -110, elbow: 150, lean: 20 }, [31, 42]],
  ["jab2", AttackStyle.jab2, { ...forward, chest: 30, arm: -125, elbow: 140, lean: 22 }, [38, 45]],
  ["forwardTilt", AttackStyle.forwardTilt, { ...forward, chest: 50, arm: -145, elbow: -35, lean: 45 }, [51, 48]],
  ["forwardTiltUp", AttackStyle.forwardTiltUp, { ...overhead, chest: -45, arm: -150, lean: -35 }, [42, 70]],
  ["forwardTiltDown", AttackStyle.forwardTiltDown, { ...low, chest: 75, arm: -85, lean: 35 }, [45, 14]],
  ["upTilt", AttackStyle.upTilt, { ...overhead, chest: -35, lean: -20 }, [8, 99]],
  ["downTilt", AttackStyle.downTilt, { ...low, chest: 80, arm: -95, lean: 40 }, [48, 10]],
  ["dashAttack", AttackStyle.dashAttack, { ...forward, chest: 55, arm: -140, elbow: -35, lean: 50 }, [51, 42]],
  ["forwardSmash", AttackStyle.forwardSmash, { ...forward, chest: 30, arm: -160, elbow: 35, leftArm: -100 }, [54, 52]],
  ["upSmash", AttackStyle.upSmash, { ...overhead, chest: -25 }, [0, 106]],
  ["downSmash", AttackStyle.downSmash, { ...low, arm: -125, elbow: -125, leftArm: 65, yaw: 25 }, [45, 13]],
  ["neutralAir", AttackStyle.neutralAir, { ...cast, leftArm: 65, yaw: 65 }, [45, 51]],
  ["forwardAir", AttackStyle.forwardAir, { ...forward, arm: -155, elbow: 30, thigh: 25, leftThigh: -30 }, [52, 54]],
  ["backAir", AttackStyle.backAir, { ...back, arm: 110, elbow: 40, leftArm: -90, yaw: 140 }, [-48, 54]],
  ["upAir", AttackStyle.upAir, overhead, [0, 101]],
  ["downAir", AttackStyle.downAir, { ...low, chest: 28, arm: -155, elbow: 45, lean: -10, thigh: 40, leftThigh: -25 }, [16, 13]],
];
for (const [pose, style, gesture, target] of normals) {
  const move = ANUBARAK_MOVES.normals[style]; ensure(move, `${pose}: missing timing`);
  actions.push({ pose, frames: move.totalFrames, contact: move.startupFrames, gesture, target, air: pose.endsWith("Air") });
}
const extra: readonly [HeroPose, number, number, Gesture][] = [
  ["crouch", 30, 8, brace], ["landing", 8, 2, brace], ["shield", 30, 5, { ...brace, leftArm: -105 }],
  ["airDodge", 49, 4, { ...brace, lean: -25 }], ["smashCharge", 30, 8, { ...cast, arm: -80, leftArm: -80 }],
  ["dizzy", 60, 25, { chest: -15, head: 30, arm: 20, leftArm: 15 }], ["turn", 8, 4, { yaw: 140, chest: -12 }],
  ["stop", 8, 3, { ...brace, lean: -18 }], ["jumpSquat", 5, 4, { ...brace, thigh: 55, knee: -80 }],
  ["jump", 24, 7, { ...overhead, thigh: -40, leftThigh: 30, lean: -12 }],
  ["doubleJump", 24, 7, { ...cast, thigh: -55, leftThigh: 40, lean: -20 }],
  ["wallJump", 24, 7, { ...overhead, lean: -25, thigh: 50 }], ["wallTech", 26, 6, brace],
  ["fall", 30, 12, { ...brace, thigh: 35, leftThigh: -20 }], ["fallSpecial", 30, 12, { ...brace, chest: 45, head: 20 }],
  ["ledgeHang", 30, 1, { ...overhead, chest: 15, thigh: 20 }], ["ledgeClimb", 25, 10, { ...overhead, lean: 35 }],
  ["ledgeAttack", 40, 16, forward], ["knockdown", 30, 25, { ...brace, lean: 85 }],
  ["downDamage", 24, 1, { ...brace, lean: 75, head: 30 }], ["getUp", 30, 18, { ...brace, lean: 30 }],
  ["getUpAttack", 49, 16, { ...forward, yaw: 160, leftArm: 65 }], ["spotDodge", 22, 4, { ...brace, lean: -30 }],
  ["tech", 26, 8, { ...brace, lean: 45 }], ["damageGround", 24, 1, { ...brace, chest: -35, head: -30 }],
  ["damageAir", 24, 1, { ...brace, chest: -40, thigh: 60 }], ["damageTumble", 30, 9, { ...brace, lean: 70 }],
  ["damageShield", 24, 1, { ...brace, chest: -20 }],
];
for (const [pose, frames, contact, gesture] of extra) actions.push({ pose, frames, contact, gesture,
  hold: ["shield", "smashCharge", "crouch", "ledgeHang"].includes(pose),
  air: ["airDodge", "jump", "doubleJump", "wallJump", "fall", "fallSpecial", "damageAir", "damageTumble", "ledgeHang"].includes(pose) });
const grab = ANUBARAK_MOVES.normals[AttackStyle.grab]!;
actions.push({ pose: "grab", frames: grab.totalFrames, contact: grab.startupFrames, gesture: { ...forward, arm: -105 }, target: [48, 48], paired: true });
actions.push({ pose: "grabHold", frames: 30, contact: 1, gesture: { ...forward, arm: -100 }, target: [42, 51], hold: true, paired: true });
actions.push({ pose: "grabbed", frames: 30, contact: 1, gesture: { chest: -35, pelvis: 20, head: 30, arm: 30, leftArm: 35 }, hold: true, paired: true });
for (const [pose, code, gesture, target] of [
  ["pummel", GrabAction.pummel, { ...forward, arm: -70, leftArm: -105 }, [32, 48]],
  ["throwForward", GrabAction.throwForward, forward, [58, 48]],
  ["throwBack", GrabAction.throwBack, back, [-45, 58]],
  ["throwUp", GrabAction.throwUp, overhead, [6, 102]],
  ["throwDown", GrabAction.throwDown, low, [35, 13]],
] as const) {
  const timing = ANUBARAK_MOVES.throws[code]!;
  const frames = pose === "pummel" ? 24 : timing.totalFrames, contact = pose === "pummel" ? 8 : timing.contactFrame;
  actions.push({ pose, frames, contact, gesture, target, paired: true });
  const victimPose = pose === "pummel" ? "victimPummel" : `victim${pose[0]!.toUpperCase()}${pose.slice(1)}` as HeroPose;
  actions.push({ pose: victimPose, frames, contact, gesture: pose === "throwUp" ? { ...brace, lean: -30, thigh: 55 } : pose === "throwDown" ? { ...brace, lean: 70 } : pose === "throwBack" ? { chest: 35, pelvis: -15, lean: 25 } : { chest: -40, pelvis: 15, head: -25, lean: -25 }, paired: true, air: pose === "throwUp" });
}
for (const pose of ["rollForward", "techForward", "getUpRollForward", "ledgeRoll", "rollBackward", "techBackward", "getUpRollBackward"] as const)
  actions.push({ pose, frames: pose.startsWith("tech") ? 40 : 31, contact: 10, gesture: brace, roll: pose.endsWith("Backward") ? -1 : 1 });
for (const [pose, key, gesture, contact, target] of [
  ["neutralSpecial", "neutral", { ...cast, chest: 30 }, 8, [48, 29]],
  ["sideSpecial", "side", { ...cast, arm: -105, leftArm: -65 }, 26, [52, 51]],
  ["upSpecial", "up", { ...overhead, thigh: -50, leftThigh: 40, lean: -15 }, 11, [3, 102]],
  ["downSpecial", "down", { ...brace, leftArm: 70, arm: -100, yaw: 30 }, 13, [45, 45]],
] as const) {
  const special = ANUBARAK_SPECIALS[key]!;
  for (const air of [false, true]) {
    const form = air ? special.air ?? special.ground : special.ground;
    const projectile = key === "neutral" ? form.projectiles?.[0] : undefined;
    const release = projectile === undefined ? contact : projectile.spawnFrame + (projectile.activeFrom ?? 1) - 1;
    actions.push({ pose: (air ? `${pose}Air` : pose) as HeroPose, frames: form.endFrame, contact: release, gesture: air ? { ...gesture, thigh: 30, leftThigh: -35 } : gesture, target, air });
  }
}
const damageActions: Action[] = [];
for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
  const gain = [0.5, 0.9, 1.3][strength]!;
  damageActions.push({ pose: "damageGround", frames: 24, contact: 1, hold: true, pain: true,
    gesture: height === 0 ? { thigh: 65 * gain, knee: -65 * gain, leftThigh: -50 * gain, pelvis: 28 * gain, chest: 25 * gain, head: -15 * gain }
    : height === 1 ? { chest: 55 * gain, pelvis: -25 * gain, arm: 30 * gain, leftArm: 35 * gain, head: 12 * gain }
    : { head: -45 * gain, chest: -35 * gain, arm: 45 * gain, leftArm: 55 * gain, pelvis: 10 * gain } });
}
function rotated(q: ArrayLike<number>, y: number, z = 0) {
  const a = y * Math.PI / 360, b = z * Math.PI / 360;
  const [i, j, k, l] = [-Math.sin(a) * Math.sin(b), Math.sin(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.cos(a) * Math.cos(b)];
  const [x = 0, v = 0, w = 0, t = 1] = Array.from(q);
  const out = [l! * x + i! * t + j! * w - k! * v, l! * v - i! * w + j! * t + k! * x, l! * w + i! * v - j! * x + k! * t, l! * t - i! * x - j! * v - k! * w];
  const length = Math.hypot(...out); return new Float32Array(out.map(n => n / length));
}
const jointPitch: Readonly<Record<string, readonly [keyof Gesture, number]>> = {
  Bone_Chest: ["chest", 1], Bone_Pelvis: ["pelvis", 1], Bone_Head: ["head", 1], Bone_Root: ["lean", 1],
  Bone_Arm1R: ["arm", 0.65], Bone_Arm2R: ["elbow", 1], Bone_Arm3R: ["wrist", 1], Bone_ArmClawR: ["hand", 1],
  Bone_Arm1L: ["leftArm", 0.65], Bone_Arm2L: ["leftElbow", 1], Bone_Arm3L: ["leftWrist", 1],
  Bone_LFLeg09: ["thigh", 1], Bone_LFLeg13: ["leftThigh", 1], Bone_LFLeg10: ["knee", 1], Bone_LFLeg14: ["knee", 1],
  Bone_LFLeg07: ["frontThigh", 1], Bone_LFLeg04: ["leftFrontThigh", 1], Bone_ArmShieldR: ["shield", 1], Bone_ArmShieldR01: ["leftShield", 1],
};
function joint(name: string, g: Gesture): [number, number] {
  const pitch = jointPitch[name];
  return [pitch ? (g[pitch[0]] ?? 0) * pitch[1] : 0, name === "Bone_Chest" ? g.yaw ?? 0 : name === "Bone_ArmShieldR" ? g.shieldTwist ?? 0 : name === "Bone_ArmShieldR01" ? g.leftShieldTwist ?? 0 : 0];
}
function blend(from: ArrayLike<number>, to: ArrayLike<number>, weight: number): Float32Array<ArrayBuffer> {
  let dot = 0; for (let i = 0; i < 4; i++) dot += from[i]! * to[i]!;
  const sign = dot < 0 ? -1 : 1;
  const vector = Array.from({ length: 4 }, (_, i) => from[i]! * (1 - weight) + sign * to[i]! * weight);
  const length = Math.hypot(...vector); return new Float32Array(vector.map(v => v / length));
}
const groundGestures = new Set(normals.slice(0, 8).map(([pose]) => pose));
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (t, p) => originals.set(p, t));
const blender = blenderSkeleton(source, originals, stand, globalClock), blenderAction = actions.find(a => a.pose === blenderPose)!;
if (rigOutput) { await blender.writeRig(rigOutput, { frames: blenderAction.frames, contact: blenderAction.contact, active: ANUBARAK_MOVES.normals[AttackStyle.dashAttack]!.activeFrames }); console.log(`ANUBARAK_RIG ${blenderPose} ${rigOutput}`); process.exit(0); }
const bakedVector = bakedKeys ? await blender.readKeys(bakedKeys, blenderAction.frames) : undefined;
let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
const cutoff = cursor, bindings: string[] = [], damageBindings: string[] = [];
const records: { pose: string; index: number; frames: number; contact: number }[] = [];
const ultimate = FIGHTER_ULTIMATES[Character.anubarak]!, swarm = ultimate.projectiles?.[0]?.spawnFrame;
ensure(swarm !== undefined, "Locust Swarm release missing");
const authoredActions: Action[] = [...actions, ...damageActions, { pose: "ultimate", frames: ultimate.endFrame, contact: swarm, gesture: { ...cast, chest: 30, arm: -150, elbow: -45, lean: 15 } }];
const victimSpan = actions.filter(a => /^victim(Pummel|Throw)/.test(a.pose)).length * 1100;
for (const [ordinal, action] of authoredActions.entries()) {
  const index = model.Sequences.length, start = cursor + (action.pose === "ultimate" ? victimSpan : 0), end = start + Math.round(action.frames * 1000 / 60);
  if (action.pose !== "ultimate") cursor = end + 100;
  const name = !action.pain ? `Anubarak ${action.pose}` : `Anubarak Damage ${Math.floor((ordinal - actions.length) / 3)} ${(ordinal - actions.length) % 3}`;
  model.Sequences.push({ ...stand, Name: name, Interval: new Uint32Array([start, end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
  const rake = rakes[action.pose], groundGesture = groundGestures.has(action.pose) && rake === undefined, lunge = lunges[action.pose], settled = action.frames - (rake?.settle ?? 0);
  const phaseFrames = [...new Set([...(action.pose === "sideSpecial" || action.pose === "upAir" || groundGesture || lunge || rake?.carry ? Array.from({length: action.frames + 1}, (_, i) => i) : []), 0, Math.max(1, action.contact - 3), action.contact, Math.min(action.frames - 1, action.contact + 4), action.frames,
    ...(action.roll ? Array.from({ length: Math.ceil(action.frames / 3) }, (_, i) => i * 3) : []),
    ...(action.pose === "victimPummel" ? [action.contact - 1] : [])])].sort((a, b) => a - b);
  const [windup, follow] = swings[action.pose] ?? [0.3, 1];
  const keyed = (frame: number) => action.hold || action.pain ? 1 : action.pose === "victimPummel" && frame < action.contact ? 0 : action.pose === "knockdown" && frame >= action.contact ? 1 : frame === 0 || frame >= settled ? 0 : frame < action.contact ? -windup : frame > action.contact ? follow : 1;
  const sparse = [0, Math.max(1, action.contact - 3), action.contact, Math.min(action.frames - 1, action.contact + 4), settled, ...(settled < action.frames ? [action.frames] : [])];
  const amount = (frame: number) => {
    if (!lunge || groundGesture || sparse.includes(frame)) return keyed(frame);
    const after = sparse.findIndex(f => f > frame), from = sparse[after - 1]!, to = sparse[after]!;
    return keyed(from) + (keyed(to) - keyed(from)) * (frame - from) / (to - from);
  };
  tracks(model, (track, path) => {
    const donor = originals.get(path); if (!donor || globalClock(donor)) return;
    const first = donor.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]) ?? donor.Keys[0];
    if (!first) return;
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
    for (const frame of phaseFrames) {
      let Vector = first.Vector.slice();
      if (action.pose === "sideSpecial") {
        const index = frame < 26 ? 8 : 10;
        const sequence = source.Sequences[index]!;
        const progress = frame < 10 ? frame / 9 : frame < 26 ? 1 : Math.min(1, (frame - 26) / 9);
        const time = sequence.Interval[0]! + (sequence.Interval[1]! - sequence.Interval[0]!) * progress;
        const keys = donor.Keys.filter(k => k.Frame >= sequence.Interval[0]! && k.Frame <= sequence.Interval[1]!);
        const selected = keys.findLast(k => k.Frame <= time) ?? keys[0];
        if (selected) Vector = selected.Vector.slice();
        if (frame >= 24 && path.endsWith(".Translation")) Vector = first.Vector.slice();
        if (node && (frame < 10 || frame >= 24)) {
          const poses = burrowRake.map(g => { const [y, z] = joint(node.Name, g); return rotated(first.Vector, y, z); });
          Vector = frame <= 22 ? blend(first.Vector, poses[0]!, frame / 22)
            : frame <= 24 ? blend(poses[0]!, poses[1]!, (frame - 22) / 2)
            : frame <= 28 ? blend(poses[1]!, poses[2]!, (frame - 24) / 4)
            : frame <= 30 ? poses[2]!.slice()
            : blend(poses[2]!, first.Vector, (frame - 30) / (action.frames - 30));
        }
        if (frame >= 23) {
          const alpha = /^\.GeosetAnims\.(\d+)\.Alpha$/.exec(path);
          if (alpha) Vector = new Float32Array([source.GeosetAnims[Number(alpha[1])]!.GeosetId < 3 ? 1 : 0]);
        }
      }
      if (node && rake) {
        const poses = [rake.windup, rake.strike, rake.follow, rake.carry?.gesture ?? rake.follow].map(g => { const [y, z] = joint(node.Name, g); return rotated(first.Vector, y, z); });
        const cocked = Math.max(1, rake.contact - (rake.cock ?? 3)), carried = rake.carry?.frame ?? rake.through, released = Math.min(action.frames - 1, rake.carry ? carried : rake.through + 2);
        Vector = frame <= cocked ? blend(first.Vector, poses[0]!, frame / cocked)
          : frame <= rake.contact ? blend(poses[0]!, poses[1]!, (frame - cocked) / (rake.contact - cocked))
          : frame <= rake.through ? blend(poses[1]!, poses[2]!, (frame - rake.contact) / (rake.through - rake.contact))
          : frame <= carried ? blend(poses[2]!, poses[3]!, (frame - rake.through) / (carried - rake.through))
          : frame <= released ? poses[3]!.slice()
          : blend(poses[3]!, first.Vector, Math.min(1, (frame - released) / (settled - released)));
      } else if (node && action.pose !== "sideSpecial") { let [y, z] = joint(node.Name, action.gesture); y = node.Name === "Bone_Root" && action.roll ? frame / action.frames * 360 * action.roll : y * amount(frame);
        if (node.Name === "Bone_Root" && (action.pose === "getUp" || action.pose === "getUpAttack" || action.pose.startsWith("getUpRoll"))) y += 85 * Math.max(0, 1 - frame / action.contact);
        z *= amount(frame); Vector = rotated(first.Vector, y, z); }
      if (node && action.pose === "upAir") {
        const poses = upperAir.map(g => { const [y, z] = joint(node.Name, g); return rotated(first.Vector, y, z); });
        Vector = frame <= 6 ? blend(first.Vector, poses[0]!, frame / 6)
          : frame <= 8 ? blend(poses[0]!, poses[1]!, (frame - 6) / 2)
          : frame <= 11 ? blend(poses[1]!, poses[2]!, (frame - 8) / 3)
          : frame <= 13 ? poses[2]!.slice()
          : blend(poses[2]!, first.Vector, (frame - 13) / (action.frames - 13));
      }
      if (action.pose === blenderPose) Vector = bakedVector?.(path, frame) ?? Vector;
      const tangent = () => match || track.LineType === mdx.LineType.Bezier ? Vector.slice() : new Float32Array(Vector.length);
      track.Keys.push({ ...first, Frame: start + Math.round(frame * 1000 / 60), Vector, ...(track.LineType > 1 ? { InTan: tangent(), OutTan: tangent() } : {}) });
    }
  });
  const root = model.Nodes.find(n => n.Name === "Bone_Root")!;
  ensure(root.Translation, "Anubarak root has no translation");
  if (groundGesture) {
    const at = (frame: number) => start + Math.round(frame * 1000 / 60);
    const rotations = [...model.Bones, ...model.Helpers].filter(node => node.Rotation && joint(node.Name, action.gesture).some(n => n !== 0));
    const base = rotations.map(node => node.Rotation!.Keys.find(k => k.Frame === at(0))!.Vector.slice());
    const keys = rotations.map(node => node.Rotation!.Keys.find(k => k.Frame === at(action.contact))!);
    const frames = sampleAttack(Character.anubarak, AttackStyle[action.pose as keyof typeof AttackStyle], 1, false);
    const first = frames.find(frame => frame.phase === AttackPhase.active && frame.strikes.length > 0)!;
    const strike = first.strikes[0]!;
    const ends = [[strike.x1 - first.x, strike.z1 - first.z - 50], [strike.x2 - first.x, strike.z2 - first.z - 50]];
    const far = ends.toSorted((a, b) => Math.hypot(...b) - Math.hypot(...a))[0]!, length = Math.hypot(...far);
    const reach = () => {
      const triangles = new DrawnModel(generateMDX(model), 1).triangles(index, action.contact / 60, 1);
      let floor = Infinity, maximum = -Infinity;
      for (let i = 1; i < triangles.length; i += 2) floor = Math.min(floor, triangles[i]!);
      for (let i = 0; i < triangles.length; i += 2) maximum = Math.max(maximum, (triangles[i]! * far[0]! + (triangles[i + 1]! - floor - 50) * far[1]!) / length);
      return maximum;
    };
    let contactAmount = 1, preparationAmount = -0.8, most = -Infinity, least = Infinity;
    for (let step = -20; step <= 30; step++) {
      const amount = step / 20;
      keys.forEach((key, i) => { const [y, z] = joint(rotations[i]!.Name, action.gesture); key.Vector = rotated(base[i]!, y * amount, z * amount); if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); } });
      const value = reach();
      if (value > most + 0.01) { most = value; contactAmount = amount; }
      if (value < least - 0.01) { least = value; preparationAmount = amount; }
    }
    const contact = rotations.map((node, i) => { const [y, z] = joint(node.Name, action.gesture); return rotated(base[i]!, y * contactAmount, z * contactAmount); });
    const preparation = rotations.map((node, i) => { const [y, z] = joint(node.Name, action.gesture); return rotated(base[i]!, y * preparationAmount, z * preparationAmount); });
    if (!["jab", "jab2"].includes(action.pose)) {

      const chain = ["Bone_Arm1R", "Bone_Arm2R", "Bone_Arm3R"].map(name => [...model.Bones, ...model.Helpers].find(n => n.Name === name)!);
      for (const node of chain) if (!rotations.includes(node)) {
        rotations.push(node); base.push(node.Rotation!.Keys.find(k => k.Frame === at(0))!.Vector.slice());
        const vector = floatVector(node.Rotation!.Keys.find(k => k.Frame === at(action.contact))!.Vector); contact.push(vector); preparation.push(floatVector(base.at(-1)!));
      }
      rotations.forEach((node, i) => { const key = node.Rotation!.Keys.find(k => k.Frame === at(action.contact))!; key.Vector = contact[i]!.slice(); if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); } });
      const renderer = new ModelRenderer(model); renderer.setSequence(index);
      const data = Reflect.get(renderer, "rendererData") as { frame: number; nodes: { matrix: Float32Array }[] };
      data.frame = at(action.contact); renderer.update(0);
      const position = (node: mdx.Node) => { const m = data.nodes[node.ObjectId]!.matrix, v = model.PivotPoints[node.ObjectId]!; return [0, 1, 2].map(a => m[a]! * v[0]! + m[a + 4]! * v[1]! + m[a + 8]! * v[2]! + m[a + 12]!); };
      const tip = model.Attachments.find(n => n.Name.startsWith("Hand Right Ref"))!;
      const direction = [far[0]! / length, far[1]! / length], shoulder = position(chain[0]!);
      const target = [shoulder[0]! + direction[0]! * 400, shoulder[1]!, shoulder[2]! + direction[1]! * 400];
      const turn = (node: mdx.Node, axis: number[], full: number) => {
        const parent = node.Parent == null ? undefined : data.nodes[node.Parent]?.matrix;
        const local = parent ? [0, 1, 2].map(i => (axis[0]! * parent[i * 4]! + axis[1]! * parent[i * 4 + 1]! + axis[2]! * parent[i * 4 + 2]!) / Math.hypot(parent[i * 4]!, parent[i * 4 + 1]!, parent[i * 4 + 2]!)) : axis;
        const key = node.Rotation!.Keys.find(k => k.Frame === at(action.contact))!;
        const s = Math.sin(full / 2), d = Math.cos(full / 2), [u, v, w, t] = key.Vector, p = local.map(n => n * s);
        const vector = new Float32Array([d * u! + p[0]! * t! + p[1]! * w! - p[2]! * v!, d * v! - p[0]! * w! + p[1]! * t! + p[2]! * u!, d * w! + p[0]! * v! - p[1]! * u! + p[2]! * t!, d * t! - p[0]! * u! - p[1]! * v! - p[2]! * w!]);
        const norm = Math.hypot(...vector); key.Vector = vector.map(n => n / norm); renderer.update(0);
      };
      const aim = (node: mdx.Node) => {
        const origin = position(node), a = position(tip).map((v, i) => v - origin[i]!), b = target.map((v, i) => v - origin[i]!);
        const an = Math.hypot(...a), bn = Math.hypot(...b); if (an < 0.001 || bn < 0.001) return;
        const av = a.map(v => v / an), bv = b.map(v => v / bn), cross = [av[1]! * bv[2]! - av[2]! * bv[1]!, av[2]! * bv[0]! - av[0]! * bv[2]!, av[0]! * bv[1]! - av[1]! * bv[0]!], size = Math.hypot(...cross); if (size < 0.00001) return;
        turn(node, cross.map(v => v / size), Math.acos(Math.max(-1, Math.min(1, av.reduce((sum, v, i) => sum + v * bv[i]!, 0)))));
      };
      for (let iteration = 0; iteration < 12; iteration++) for (const node of chain.toReversed()) aim(node);
      const solved = chain.map(node => node.Rotation!.Keys.find(k => k.Frame === at(action.contact))!);
      const before = chain.map((node, i) => contact[rotations.indexOf(node)]!), solution = solved.map(k => k.Vector.slice());
      let best = 1, most = -Infinity;
      for (let step = 20; step >= 0; step--) {
        solved.forEach((key, i) => { key.Vector = blend(before[i]!, solution[i]!, step / 20); });
        const value = reach(); if (value > most + 0.01) { most = value; best = step / 20; }
      }
      chain.forEach((node, i) => { contact[rotations.indexOf(node)] = blend(before[i]!, solution[i]!, best); });
    }
    const anticipation = Math.max(1, action.contact - 2);
    for (const frame of phaseFrames) rotations.forEach((node, i) => {
      const key = node.Rotation!.Keys.find(k => k.Frame === at(frame))!;

      key.Vector = frame < anticipation ? blend(base[i]!, preparation[i]!, frame / anticipation)
        : frame <= action.contact ? blend(preparation[i]!, contact[i]!, (frame - anticipation) / (action.contact - anticipation))
        : blend(base[i]!, contact[i]!, frame < action.contact + 3 ? 1 : Math.max(0, 1 - (frame - action.contact - 3) / (action.frames - action.contact - 3)));
      if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); }
    });
  }
  if (action.pose === "sideSpecial") for (const frame of phaseFrames) {
    const key = root.Translation.Keys.find(k => k.Frame === start + Math.round(frame * 1000 / 60))!;
    const drive = frame <= 22 ? -frame / 22 : frame <= 25 ? -1 + 2 * (frame - 22) / 3 : Math.max(0, (34 - frame) / 9);
    key.Vector[0] += 42 * drive;
    if (key.InTan) { key.InTan = root.Translation.LineType === mdx.LineType.Bezier ? key.Vector.slice() : new Float32Array(3); key.OutTan = key.InTan.slice(); }
  }
  if (action.pose === "upAir") for (const frame of phaseFrames) {
    const key = root.Translation.Keys.find(k => k.Frame === start + Math.round(frame * 1000 / 60))!;
    const drive = frame <= 6 ? -frame / 6 : frame <= 8 ? -1 + 2 * (frame - 6) / 2 : Math.max(0, (18 - frame) / 10);
    key.Vector[2] += 30 * drive;
    if (key.InTan) { key.InTan = root.Translation.LineType === mdx.LineType.Bezier ? key.Vector.slice() : new Float32Array(3); key.OutTan = key.InTan.slice(); }
  }
  const drawn = new DrawnModel(generateMDX(model), 1);
  for (const frame of phaseFrames) {
    const triangles = drawn.triangles(index, frame / 60, 1); let lowest = Infinity;
    for (let i = 1; i < triangles.length; i += 2) lowest = Math.min(lowest, triangles[i]!);
    const key = root.Translation.Keys.find(k => k.Frame === start + Math.round(frame * 1000 / 60))!;
    if (!action.air && (action.pose !== "sideSpecial" || frame >= 23)) { key.Vector[2] = key.Vector[2]! - lowest; if (key.InTan) { key.InTan = root.Translation.LineType === mdx.LineType.Bezier ? key.Vector.slice() : new Float32Array(3); key.OutTan = key.InTan.slice(); } }
  }
  if (lunge && !(bakedVector && action.pose === blenderPose)) for (const frame of phaseFrames) {
    const key = root.Translation.Keys.find(k => k.Frame === start + Math.round(frame * 1000 / 60))!;
    key.Vector[lunge.x === undefined ? 2 : 0] += lungeAt(lunge, frame, settled);
    if (key.InTan) { key.InTan = root.Translation.LineType === mdx.LineType.Bezier ? key.Vector.slice() : new Float32Array(3); key.OutTan = key.InTan.slice(); }
  }
  const victim = /^victim(Pummel|Throw)/.test(action.pose);
  const binding = `{ index: ${index}, seconds: ${seconds(victim ? 1 : (end - start) / 1000)}, aligned: true${action.paired ? `, contact: ${seconds(victim ? 0.5 : action.contact / 60)}` : ""} }`;
  if (!action.pain) bindings.push(`  ${action.pose}: ${binding},`); else damageBindings.push(`  ${binding},`);
  records.push({ pose: name, index, frames: action.frames, contact: action.contact });
}

for (const [ordinal, action] of actions.entries()) if (/^victim(Pummel|Throw)/.test(action.pose)) {
  const sequence = model.Sequences[source.Sequences.length + ordinal]!;
  const [first, last] = sequence.Interval, contact = first! + Math.round(action.contact * 1000 / 60), start = cursor;
  cursor = start + 1100;
  tracks(model, track => {
    if (globalClock(track)) return;
    for (const key of track.Keys) if (key.Frame >= first! && key.Frame <= last!)
      key.Frame = start + (key.Frame <= contact ? Math.round((key.Frame - first!) / (contact - first!) * 500)
        : 500 + Math.round((key.Frame - contact) / (last! - contact) * 500));
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  });
  sequence.Interval = new Uint32Array([start, start + 1000]);
  action.frames = 60; action.contact = 30;
  records[ordinal]!.frames = 60; records[ordinal]!.contact = 30;
}

await Bun.write(join(project, "ts/src/game/sim/heroes/anubarakClips.ts"), [
  "",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClip, HeroClipTable } from "./hero";',
  'export const ANUBARAK_MODEL_FILE = "units\\\\undead\\\\HeroCryptLord\\\\HeroCryptLord.mdl";',
  'export const ANUBARAK_FALLBACK: HeroClip = { index: 0, seconds: 1.0 };',
  'export const ANUBARAK_CLIPS = { idle: ANUBARAK_FALLBACK, walk: { index: 2, seconds: 1.0 }, dash: { index: 2, seconds: 1.0 }, run: { index: 2, seconds: 1.0 }, ko: { index: 3, seconds: f32(3.033) },',
  ...bindings, '} as const satisfies HeroClipTable;', 'export const ANUBARAK_DAMAGE_CLIPS: readonly HeroClip[] = [', ...damageBindings, '];', "",
].join("\n"));
const renderer = new ModelRenderer(model), posed = Reflect.get(renderer, "rendererData");
for (let index = source.Sequences.length; index < model.Sequences.length; index++) {
  const sequence = model.Sequences[index]!, low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  renderer.setSequence(index);
  for (let frame = 0; frame <= Math.ceil((sequence.Interval[1]! - sequence.Interval[0]!) * 60 / 1000); frame++) {
    posed.frame = Math.min(sequence.Interval[1]!, sequence.Interval[0]! + frame * 1000 / 60); renderer.update(0);
    for (const geoset of model.Geosets) for (let vertex = 0; vertex < geoset.Vertices.length / 3; vertex++) {
      const group = geoset.Groups[geoset.VertexGroup[vertex]!] ?? [];
      const coordinates = [0, 0, 0];
      for (const node of group) {
        const matrix = posed.nodes[node]?.matrix; if (!matrix) continue;
        for (let axis = 0; axis < 3; axis++) coordinates[axis]! += matrix[axis]! * geoset.Vertices[vertex * 3]! + matrix[axis + 4]! * geoset.Vertices[vertex * 3 + 1]! + matrix[axis + 8]! * geoset.Vertices[vertex * 3 + 2]! + matrix[axis + 12]!;
      }
      for (let axis = 0; axis < 3; axis++) { const value = coordinates[axis]! / Math.max(1, group.length); low[axis] = Math.min(low[axis]!, value); high[axis] = Math.max(high[axis]!, value); }
    }
  }
  ensure([...low, ...high].every(Number.isFinite), `${sequence.Name}: invalid posed bounds`);
  sequence.MinimumExtent = new Float32Array(low); sequence.MaximumExtent = new Float32Array(high);
  sequence.BoundsRadius = Math.hypot(...low.map((v, i) => Math.max(Math.abs(v), Math.abs(high[i]!))));
}
const stripped = structuredClone(model); stripped.Sequences = stripped.Sequences.slice(0, source.Sequences.length);
tracks(stripped, track => { if (!globalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
ensure(isDeepStrictEqual(stripped, source), "Authored suffix changed original body or animation");
const bytes = generateMDX(model), decoded = parseMDX(bytes);
ensure(isDeepStrictEqual(parseMDX(generateMDX(decoded)), decoded), "MDX round trip changed model");
mkdirSync(output, { recursive: true }); await Bun.write(join(output, "herocryptlord.mdx"), bytes);

const finalDrawn = new DrawnModel(bytes, 0.55);
const distance = (a: Float32Array, b: Float32Array) => { ensure(a.length === b.length && a.length > 0, "Missing drawn body"); let maximum = 0; for (let i = 0; i < a.length; i += 2) maximum = Math.max(maximum, Math.hypot(a[i]! - b[i]!, a[i + 1]! - b[i + 1]!)); return maximum; };
const claws = (["R", "L"] as const).map(side => ({ side, shoulder: model.Nodes.find(node => node.Name === `Bone_Arm1${side}`)!, tip: model.Attachments.find(node => node.Name.startsWith(`Hand ${side === "R" ? "Right" : "Left"} Ref`))! }));
const position = (node: mdx.Node) => { const matrix = posed.nodes[node.ObjectId]!.matrix, pivot = model.PivotPoints[node.ObjectId]!; return [0, 1, 2].map(axis => matrix[axis]! * pivot[0]! + matrix[axis + 4]! * pivot[1]! + matrix[axis + 8]! * pivot[2]! + matrix[axis + 12]!); };
const attackPoses = new Set(["jab", "jab2", "forwardTilt", "forwardTiltUp", "forwardTiltDown", "upTilt", "downTilt", "dashAttack", "forwardSmash", "upSmash", "downSmash", "neutralAir", "forwardAir", "backAir", "upAir", "downAir", "neutralSpecial", "neutralSpecialAir", "sideSpecial", "sideSpecialAir", "upSpecial", "upSpecialAir", "downSpecial", "downSpecialAir", "ultimate"]);
const tipArcs = authoredActions.flatMap((action, ordinal) => {
  if (!attackPoses.has(action.pose)) return [];
  const index = source.Sequences.length + ordinal, sequence = model.Sequences[index]!;
  renderer.setSequence(index);
  const swept = claws.map(({ side, shoulder, tip }) => {
    let previous: number | undefined, turned = 0, least = 0, most = 0;
    for (let frame = 0; frame <= Math.min(action.frames, action.contact + 6); frame++) {
      posed.frame = sequence.Interval[0]! + Math.round(frame * 1000 / 60); renderer.update(0);
      const origin = position(shoulder), endpoint = position(tip), angle = Math.atan2(endpoint[2]! - origin[2]!, endpoint[0]! - origin[0]!);
      if (previous !== undefined) turned += Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous)) * 180 / Math.PI;
      previous = angle; least = Math.min(least, turned); most = Math.max(most, turned);
    }
    return { claw: side, degrees: Number((most - least).toFixed(1)) };
  });
  return [{ move: action.pose, ...swept.toSorted((a, b) => b.degrees - a.degrees)[0]! }];
});
ensure(tipArcs.every(row => row.degrees >= 90), `Anubarak claw arc below 90 degrees: ${tipArcs.filter(row => row.degrees < 90).map(row => `${row.move} ${row.degrees}`).join(", ")}`);
let measured = 0;
for (const [i, action] of authoredActions.entries()) {
  const index = source.Sequences.length + i;
  const first = finalDrawn.triangles(index, 0, 1), contact = finalDrawn.triangles(index, action.contact / 60, 1);
  ensure(action.pose === "sideSpecial" ? contact.length > 0 : action.hold ? distance(contact, finalDrawn.triangles(index, action.frames / 60, 1)) < 0.01 : distance(first, contact) > 3, `${action.pose}: dead or drifting gesture`);
  if (action.pose === "sideSpecial") for (let frame = 12; frame <= 20; frame++) {
    renderer.setSequence(index);
    posed.frame = model.Sequences[index]!.Interval[0]! + frame * 1000 / 60;
    renderer.update(0);
    ensure([0, 1, 2].every(geoset => posed.geosetAlpha[geoset] === 0) && [3, 4].every(geoset => posed.geosetAlpha[geoset] === 1), `Burrow Hunt frame ${frame}: expected hidden shell and visible mound`);
  }
  const panels: PoseFrame[] = [1, -1].flatMap(facing => (action.pose === "sideSpecial" ? [0, 5, 12, 20, 25, 26, 30, 40, action.frames] : [0, Math.max(1, action.contact - 3), action.contact, Math.min(action.frames, action.contact + 4), action.frames]).map(frame => ({ frame, phase: frame < action.contact ? AttackPhase.startup : frame <= action.contact + 4 ? AttackPhase.active : AttackPhase.recovery, x: 0, z: 0, facing, parts: [], strikes: [], clip: index, seconds: frame / 60 })));
  await Bun.write(join(output, `${records[i]!.pose.replaceAll(" ", "-")}.png`), sheet(records[i]!.pose, finalDrawn, panels, 5).png); measured++;
}
await Bun.write(join(output, "anubarak-clips.json"), JSON.stringify({ stockSequences: source.Sequences.length, appended: records.length, measuredBothFacings: measured, tipArcs, records }, null, 2) + "\n");

console.log(`ANUBARAK_CLIPS_PASS ${records.length} authored clips; ${source.Sequences.length} stock sequences retained; ${measured} both-facing sheets; private output ${output}`);
console.log(`HEADLESS_TIP_ARCS_DEGREES ${tipArcs.map(row => `${row.move}=${row.degrees}${row.claw}`).join(" ")}`);
