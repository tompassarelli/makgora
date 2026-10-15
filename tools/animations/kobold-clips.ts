import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { generateMDX, parseMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackStyle, AttackPhase } from "../../ts/src/game/sim/codes";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { KOBOLD_MOVES } from "../../ts/src/game/sim/heroes/koboldMoves";
import { KOBOLD_SPECIALS } from "../../ts/src/game/sim/heroes/koboldSpecials";
import { KOBOLD_BARE_CLIPS, KOBOLD_CLIPS } from "../../ts/src/game/sim/heroes/koboldClips";

function ensure(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function tracks(value: unknown, visit: (track: mdx.AnimVector, path: string) => void, path = "") {
  if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return;
  if ("Keys" in value && Array.isArray(value.Keys)) { visit(value as mdx.AnimVector, path); return; }
  for (const [key, child] of Object.entries(value)) if (key !== "Nodes") tracks(child, visit, `${path}.${key}`);
}
const globalClock = (track: mdx.AnimVector) => track.GlobalSeqId != null && track.GlobalSeqId !== -1 && track.GlobalSeqId !== 0xffffffff;
const [input, output] = process.argv.slice(2, 4).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && (relative(project, output).startsWith("..") || relative(project, output).startsWith("build/")), "usage: bun tools/animations/kobold-clips.ts AUTHORED_KOBOLD.mdx PRIVATE_OUTPUT");
const source = parseMDX(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
ensure(source.Sequences[0]?.Name === "Stand -1" && source.Sequences.some(s => s.Name === "Kobold jab") && source.Nodes.some(n => n.Name === "Candle"), "Expected the authored classic Kobold (stock rig plus murloc-clips.ts --kobold clips)");
const stand = source.Sequences[0]!;

type KoboldPose = HeroPose | "bareIdle" | "bareRun";
interface Gesture { chest?: number; pelvis?: number; arm?: number; armTwist?: number; elbow?: number; leftArm?: number; leftElbow?: number; head?: number; headYaw?: number; tail?: number;
  thigh?: number; knee?: number; leftThigh?: number; leftKnee?: number; lean?: number; yaw?: number; spin?: number; step?: number; rise?: number; wrist?: number }
interface Beat { frame: number; gesture: Gesture; target?: readonly [number, number] }
interface Strike { pickHead?: "local" | "world"; prep: Gesture; hit: Gesture; follow: Gesture; prepAt?: number; followAt?: number; settle?: number; mid?: readonly Beat[]; follows?: readonly [number, number]; even?: boolean; over?: readonly [number, number]; late?: number; hitAt?: readonly [number, number]; rest?: Gesture; air?: boolean; free?: boolean; reach?: number }
interface Action { pickHead?: "local" | "world"; pose: KoboldPose; frames: number; contact: number; beats: Beat[]; hold?: boolean; air?: boolean; reach?: number; loop?: boolean; bare?: boolean }
const ready: Gesture = {};
const blend = (a: Gesture, b: Gesture, t: number): Gesture => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])]
  .map(k => [k, (a[k as keyof Gesture] ?? 0) * (1 - t) + (b[k as keyof Gesture] ?? 0) * t]));
const seq = (pose: KoboldPose) => { const clip = ({ ...KOBOLD_CLIPS, bareIdle: KOBOLD_BARE_CLIPS.idle, bareRun: KOBOLD_BARE_CLIPS.run } as Record<string, { index: number; seconds: number }>)[pose]; ensure(clip, `${pose}: no clip`); return clip; };

function strikeBeats(style: AttackStyle, s: Strike): Beat[] {
  const move = KOBOLD_MOVES.normals[style]; ensure(move, `missing timing ${style}`);
  const contact = move.startupFrames, end = move.totalFrames, strike = move.regions[0]!.hit.strike!;
  const hitAt: readonly [number, number] = s.hitAt ?? [strike.x2, strike.z2], last = s.mid?.at(-1);
  const followAt = s.followAt ?? Math.max(contact, last?.frame ?? contact) + (s.late ?? 2);
  const over = s.over ?? [6, 0], from = last?.target ?? hitAt;
  const follows: readonly [number, number] = s.follows ?? [from[0] + over[0], from[1] + over[1]];
  const span = end - followAt, at = (t: number) => followAt + Math.max(1, Math.round(span * t)), rest = s.rest ?? ready, start = s.rest ? { ...s.rest, spin: 0, lean: 0 } : ready;
  const beats: Beat[] = [{ frame: 0, gesture: start }, { frame: s.prepAt ?? Math.max(1, contact - Math.max(2, Math.round(contact * 0.4))), gesture: s.prep },
    { frame: contact, gesture: s.hit, ...(s.free ? {} : { target: hitAt }) }, ...(s.mid ?? []), { frame: followAt, gesture: s.follow, ...(s.free ? {} : { target: follows }) },
    ...(s.even ? [0.25, 0.5, 0.75].map(t => ({ frame: at(t), gesture: blend(s.follow, rest, t) }))
      : [{ frame: at(0.3), gesture: blend(s.follow, rest, 0.45) }, { frame: at(0.62), gesture: blend(s.follow, rest, 0.85) }, { frame: at(0.85), gesture: blend(s.follow, rest, 0.97) }]), { frame: end, gesture: rest }];
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
    follow: { chest: 10, yaw: -30, arm: -92, leftArm: 47, lean: 13, step: 10, head: -19, thigh: 36, knee: -36, leftThigh: -26 }, late: 1, over: [5, 2] }],
  ["forwardTilt", AttackStyle.forwardTilt, { ...tiltStrike(0, 0), over: [6, -1] }],
  ["forwardTiltUp", AttackStyle.forwardTiltUp, { ...tiltStrike(-18, 40), over: [5, 3] }],
  ["forwardTiltDown", AttackStyle.forwardTiltDown, { pickHead: "world",
    prep: { chest: -18, arm: -200, elbow: -30, leftArm: -150, lean: -8, step: -4, head: -22, thigh: -15, leftThigh: 20, knee: -20 }, prepAt: 3,
    hit: { chest: 48, arm: -65, leftArm: -50, lean: 18, step: 10, head: -30, thigh: 50, knee: -65, leftThigh: -25 },
    follow: { chest: 54, arm: -45, leftArm: -35, lean: 26, step: 20, head: -32, thigh: 55, knee: -70, leftThigh: -28 }, over: [14, -10], even: true }],
  ["upTilt", AttackStyle.upTilt, {
    prep: { chest: 28, arm: -20, elbow: -30, leftArm: -20, lean: 4, head: -5, thigh: 40, knee: -55, leftThigh: 40, leftKnee: -55 }, prepAt: 2,
    hit: { chest: -12, arm: -175, leftArm: -150, lean: -4, head: -30, thigh: 5, leftThigh: 0, rise: 3 },
    follow: { chest: -34, arm: -245, leftArm: -200, lean: -16, step: -4, head: -42, thigh: -10, leftThigh: 15, rise: 2 }, over: [-24, -6] }],
  ["downTilt", AttackStyle.downTilt, { pickHead: "local",
    prep: { chest: 55, yaw: 50, arm: -60, elbow: -20, leftArm: -40, lean: 8, step: -18, head: -40, thigh: 55, knee: -75, leftThigh: 45, leftKnee: -70 }, prepAt: 2,
    hit: { chest: 55, yaw: -15, arm: -60, leftArm: 20, lean: 22, step: 10, head: -40, thigh: 70, knee: -95, leftThigh: -25, leftKnee: -20 },
    follow: { chest: 58, yaw: -40, arm: -50, leftArm: 25, lean: 25, step: 13, head: -40, thigh: 72, knee: -95, leftThigh: -30, leftKnee: -20 }, over: [7, -1], even: true }],
  ["dashAttack", AttackStyle.dashAttack, { pickHead: "world", reach: 0.01,
    prep: { chest: 35, arm: 24, armTwist: -34, elbow: -13, leftArm: 11, leftElbow: 6, lean: 60, step: -4, head: 2, thigh: -4, leftThigh: 2 }, prepAt: 3,
    hit: { chest: 40, arm: -80, armTwist: 115, elbow: 45, leftArm: -35, leftElbow: -20, lean: 0, step: 10, head: -8, thigh: 12, leftThigh: -8 },
    follow: { chest: 45, arm: -75, armTwist: 115, elbow: 45, leftArm: -40, leftElbow: -20, lean: 5, step: 16, head: -10, thigh: 20, knee: -15, leftThigh: -15 }, over: [8, -2], even: true }],
  ["forwardSmash", AttackStyle.forwardSmash, {
    prep: { chest: -28, arm: -215, elbow: -30, leftArm: -200, leftElbow: -30, lean: -14, step: -6, head: -28, thigh: -18, leftThigh: 22, knee: -20 }, prepAt: 8,
    mid: [{ frame: 11, gesture: { chest: -32, arm: -225, elbow: -35, leftArm: -210, leftElbow: -35, lean: -16, step: -7, head: -30, thigh: -20, leftThigh: 24, knee: -22 } }],
    hit: { chest: 28, arm: -110, leftArm: -105, lean: 16, step: 13, head: -12, thigh: 45, knee: -45, leftThigh: -32 },
    follow: { chest: 40, arm: -75, leftArm: -75, lean: 20, step: 14, head: -16, thigh: 50, knee: -52, leftThigh: -35 }, over: [3, -10], even: true }],
  ["upSmash", AttackStyle.upSmash, { pickHead: "world",
    prep: { chest: -45, arm: -15, elbow: -30, leftArm: -10, lean: 15, head: 15, thigh: -65, knee: 100, leftThigh: -65, leftKnee: 100 }, prepAt: 6,
    mid: [{ frame: 8, target: [10, 10], gesture: { chest: -55, arm: 20, elbow: 0, leftArm: -5, lean: 18, head: 18, thigh: -75, knee: 115, leftThigh: -75, leftKnee: 115 } }],
    hit: { chest: -15, arm: -180, leftArm: -175, lean: -4, head: -32, thigh: -5, leftThigh: 5, rise: 25 },
    follow: { chest: -22, arm: -195, leftArm: -190, lean: -10, head: -38, thigh: -12, leftThigh: 18, knee: -20, rise: 28 }, over: [-2, 8] }],
  ["downSmash", AttackStyle.downSmash, { pickHead: "world", reach: 0.001,
    prep: { chest: 18, arm: -65, armTwist: 95, elbow: 30, leftArm: -60, lean: -4, head: -15, thigh: 45, knee: -60, leftThigh: 40, leftKnee: -55, spin: 30 }, prepAt: 7,
    hit: { chest: 50, arm: -70, leftArm: 30, lean: 12, step: 8, head: -30, thigh: 60, knee: -85, leftThigh: 50, leftKnee: -80, spin: -10 },
    mid: [{ frame: 8, target: [-20, 9], gesture: { chest: 35, arm: -65, armTwist: 95, elbow: 30, leftArm: -60, lean: -4, step: -6, head: -15, thigh: 45, knee: -60, leftThigh: 40, leftKnee: -55, spin: 30 } }, { frame: 14, gesture: { chest: 50, arm: -70, leftArm: 30, lean: 12, head: -30, thigh: 60, knee: -85, leftThigh: 50, leftKnee: -80, spin: 180 }, target: [-70, 9] }],
    follow: { chest: 52, arm: -60, leftArm: 35, lean: 14, head: -30, thigh: 60, knee: -85, leftThigh: 50, leftKnee: -80, spin: 215 }, over: [-6, -2], even: true }],
];
const fall: Gesture = {};
const flail: Gesture = { chest: -4, arm: -80, elbow: -20, leftArm: -50, leftElbow: -45, head: -6, thigh: -10, knee: -20, leftThigh: 15, leftKnee: -45 };
const tuck: Gesture = { chest: 30, arm: -40, elbow: -60, leftArm: -40, leftElbow: -60, head: 10, thigh: 85, knee: -115, leftThigh: 85, leftKnee: -115 };
const squash: Gesture = { chest: 32, lean: 6, arm: 25, elbow: -25, leftArm: 25, leftElbow: -25, head: 12, thigh: 70, knee: -100, leftThigh: 70, leftKnee: -100 };
const hold: Gesture = { chest: 12, lean: 6, step: 4, leftArm: -88, leftElbow: -10, arm: -150, elbow: -70, head: -6, thigh: 18, knee: -22, leftThigh: -16 };
const airStrikes: readonly [HeroPose, AttackStyle, Strike][] = [
  ["neutralAir", AttackStyle.neutralAir, { air: true, reach: 0.01, rest: { spin: 360 },
    prep: { chest: -12, arm: -130, elbow: -50, leftArm: -40, lean: -10, spin: -60, head: -15, thigh: 55, knee: -80, leftThigh: 30, leftKnee: -55 }, prepAt: 2,
    hit: { wrist: 0, chest: 18, arm: -90, leftArm: 45, lean: 12, spin: 0, step: 4, head: -15, thigh: 35, knee: -50, leftThigh: -25, leftKnee: -35 },
    mid: [{ frame: 7, gesture: { wrist: 0, chest: 18, arm: -90, leftArm: 45, lean: 12, spin: 180, head: -15, thigh: 35, knee: -50, leftThigh: -25, leftKnee: -35 }, target: [-28, 36] }],
    follow: { wrist: 0, chest: 12, arm: -70, elbow: -40, leftArm: 30, lean: 5, spin: 330, head: -10, thigh: 25, knee: -35, leftThigh: -15, leftKnee: -25 }, follows: [14, 36], followAt: 9, even: true }],
  ["forwardAir", AttackStyle.forwardAir, { air: true, reach: 0.01, rest: fall,
    prep: { chest: -22, arm: -215, elbow: -35, leftArm: -195, leftElbow: -35, lean: -10, head: -28, thigh: 55, knee: -85, leftThigh: 35, leftKnee: -65 }, prepAt: 3,
    hit: { wrist: 0, chest: 30, arm: -100, leftArm: -100, lean: 18, step: 10, head: -15, thigh: -25, knee: -20, leftThigh: 30, leftKnee: -45 },
    follow: { wrist: 0, chest: 42, arm: -60, leftArm: -65, lean: 24, step: 13, head: -12, thigh: -35, knee: -15, leftThigh: 35, leftKnee: -40 }, over: [6, -12], even: true }],
  ["backAir", AttackStyle.backAir, { air: true, reach: 0.01, rest: fall,
    prep: { chest: -15, yaw: 55, arm: -150, elbow: -40, leftArm: 30, lean: 8, step: 4, head: -10, thigh: 30, knee: -60, leftThigh: 40, leftKnee: -70 }, prepAt: 4,
    hit: { wrist: 0, chest: 42, yaw: -60, arm: 95, leftArm: -70, lean: -12, step: -8, head: -25, thigh: -45, knee: -40, leftThigh: -20, leftKnee: -60 },
    follow: { wrist: 0, chest: 45, yaw: -65, arm: 110, leftArm: -80, lean: -14, step: -10, head: -28, thigh: -50, knee: -40, leftThigh: -25, leftKnee: -60 }, over: [-6, 8] }],
  ["upAir", AttackStyle.upAir, { air: true, reach: 0.01, rest: fall, hitAt: [16, 98],
    prep: { chest: 30, arm: 20, elbow: 0, leftArm: 20, leftElbow: -20, lean: 10, head: 10, thigh: 80, knee: -110, leftThigh: 80, leftKnee: -110 }, prepAt: 3,
    hit: { wrist: 0, chest: -20, arm: -185, leftArm: -150, lean: -25, head: -35, thigh: 40, knee: -10, leftThigh: -10, leftKnee: -50 },
    mid: [{ frame: 8, gesture: { wrist: 0, chest: -28, arm: -215, leftArm: -165, lean: -35, head: -40, thigh: 70, knee: -5, leftThigh: 10, leftKnee: -40 }, target: [-18, 96] }],
    follow: { wrist: 0, chest: -30, arm: -240, leftArm: -175, lean: -42, head: -40, thigh: 85, knee: -5, leftThigh: 30, leftKnee: -30 }, over: [-10, -10] }],
  ["downAir", AttackStyle.downAir, { air: true, reach: 0.01, rest: fall, hitAt: [14, -40],
    prep: { chest: -20, arm: -200, elbow: -40, leftArm: -195, leftElbow: -40, lean: -6, head: -25, thigh: 75, knee: -100, leftThigh: 75, leftKnee: -100, rise: 6 }, prepAt: 7,
    mid: [{ frame: 10, gesture: { chest: -24, arm: -210, elbow: -45, leftArm: -205, leftElbow: -45, lean: -8, head: -28, thigh: 80, knee: -105, leftThigh: 80, leftKnee: -105, rise: 8 } }],
    hit: { wrist: 0, chest: 40, arm: -10, leftArm: -10, lean: 2, head: 30, thigh: -25, knee: -5, leftThigh: 25, leftKnee: -5, rise: -22 },
    follow: { wrist: 0, chest: 45, arm: -5, leftArm: -5, lean: 2, head: 32, thigh: -28, knee: -5, leftThigh: 28, leftKnee: -5, rise: -24 }, over: [0, -6] }],
  ["grab", AttackStyle.grab, { free: true,
    prep: { chest: -10, lean: -5, step: -2, leftArm: 25, leftElbow: -40, arm: 35, elbow: -60, head: -10, thigh: -10, leftThigh: 10 }, prepAt: 3,
    hit: { wrist: 0, chest: 22, lean: 14, step: 10, leftArm: -95, leftElbow: 0, arm: 45, elbow: -70, head: -12, thigh: 35, knee: -35, leftThigh: -22 },
    follow: { wrist: 0, chest: 24, lean: 15, step: 11, leftArm: -90, leftElbow: -15, arm: 45, elbow: -70, head: -10, thigh: 36, knee: -36, leftThigh: -24 } }],
];
const loop = (frames: number, a: Gesture, b: Gesture): Beat[] => [{ frame: 0, gesture: a }, { frame: Math.round(frames / 2), gesture: b }, { frame: frames, gesture: a }];
const posed: [HeroPose, number, Beat[], boolean?][] = [
  ["jumpSquat", 3, [{ frame: 0, gesture: blend(ready, squash, 0.4) }, { frame: 3, gesture: squash }, { frame: 5, gesture: { ...squash, chest: 36, thigh: 78, knee: -110, leftThigh: 78, leftKnee: -110 } }]],
  ["jump", 3, [{ frame: 0, gesture: squash }, { frame: 3, gesture: { chest: -18, arm: -165, elbow: -10, leftArm: -170, leftElbow: -10, lean: -6, head: -22, thigh: -10, knee: -5, leftThigh: -18, leftKnee: -10 } },
    { frame: 12, gesture: { chest: -14, arm: -150, elbow: -20, leftArm: -160, leftElbow: -15, lean: -4, head: -18, thigh: 0, knee: -15, leftThigh: -12, leftKnee: -15 } }, { frame: 24, gesture: fall }], true],
  ["doubleJump", 4, [{ frame: 0, gesture: fall }, { frame: 3, gesture: { ...tuck, lean: 70 } }, { frame: 6, gesture: { ...tuck, lean: 160 } }, { frame: 9, gesture: { ...tuck, lean: 250 } },
    { frame: 12, gesture: { ...tuck, lean: 330 } }, { frame: 16, gesture: { ...flail, arm: -150, leftArm: -30, lean: 360 } }, { frame: 24, gesture: { ...fall, lean: 360 } }], true],
  ["landing", 2, [{ frame: 0, gesture: fall }, { frame: 2, gesture: { ...squash, arm: 35, leftArm: 35, chest: 40 } }, { frame: 5, gesture: blend(squash, ready, 0.55) }, { frame: 8, gesture: ready }]],
  ["stop", 3, [{ frame: 0, gesture: { lean: 12, chest: 15, arm: 30, leftArm: -30, thigh: 30, knee: -35, leftThigh: -25 } }, { frame: 3, gesture: { lean: -16, chest: -12, step: 4, arm: -75, elbow: -20, leftArm: -85, leftElbow: -20, head: -12, thigh: 40, knee: -5, leftThigh: -15, leftKnee: -50 } },
    { frame: 8, gesture: blend({ lean: -16, chest: -12, step: 4, arm: -75, leftArm: -85, thigh: 40, leftThigh: -15, leftKnee: -50 }, ready, 0.7) }]],
  ["grabHold", 15, loop(30, hold, { ...hold, chest: 16, arm: -165, elbow: -80, head: -2 })],
  ["pummel", 8, [{ frame: 0, gesture: hold }, { frame: 5, gesture: { ...hold, chest: -14, lean: -8, head: -30, step: 0 } }, { frame: 8, gesture: { ...hold, chest: 40, lean: 16, head: 35, step: 8, arm: -120 } },
    { frame: 14, gesture: { ...hold, chest: 22, lean: 10, head: 10 } }, { frame: 24, gesture: hold }]],
  ["throwForward", 12, [{ frame: 0, gesture: hold }, { frame: 7, gesture: { ...hold, chest: -18, lean: -12, step: -4, leftArm: -50, leftElbow: -80, arm: -60, elbow: -80, head: -15, thigh: -15, leftThigh: 15 } },
    { frame: 12, gesture: { chest: 30, lean: 24, step: 16, leftArm: -95, leftElbow: 0, arm: -95, elbow: 0, head: -10, thigh: 45, knee: -45, leftThigh: -35 } },
    { frame: 17, gesture: { chest: 34, lean: 26, step: 18, leftArm: -90, arm: -90, head: -8, thigh: 46, knee: -46, leftThigh: -36 } }, { frame: 24, gesture: { chest: 14, lean: 10, step: 8, leftArm: -40, arm: -40, thigh: 20, knee: -20, leftThigh: -14 } }, { frame: 32, gesture: ready }]],
  ["throwBack", 14, [{ frame: 0, gesture: hold }, { frame: 6, gesture: { chest: -10, lean: -6, leftArm: -175, leftElbow: -10, arm: -175, elbow: -20, head: -30, thigh: 30, knee: -40, leftThigh: 20, leftKnee: -30 } },
    { frame: 14, gesture: { chest: -40, lean: -28, step: -6, leftArm: -260, leftElbow: -10, arm: -255, elbow: -20, head: -45, thigh: 35, knee: -50, leftThigh: 25, leftKnee: -45 } },
    { frame: 20, gesture: { chest: -42, lean: -30, step: -8, leftArm: -280, arm: -275, head: -45, thigh: 30, knee: -50, leftThigh: 20, leftKnee: -45 } }, { frame: 28, gesture: { chest: -12, lean: -8, step: -3, leftArm: -100, arm: -100, head: -10 } }, { frame: 36, gesture: ready }]],
  ["throwUp", 12, [{ frame: 0, gesture: hold }, { frame: 5, gesture: { ...squash, leftArm: -70, leftElbow: -40, arm: -70, elbow: -40, head: -10 } },
    { frame: 12, gesture: { chest: -14, lean: -4, leftArm: -180, leftElbow: 0, arm: -180, elbow: 0, head: -40, thigh: -5, knee: 0, leftThigh: 5, rise: 8 } },
    { frame: 17, gesture: { chest: -18, lean: -6, leftArm: -185, arm: -185, head: -42, thigh: -5, leftThigh: 5, rise: 5 } }, { frame: 26, gesture: ready }]],
  ["throwDown", 16, [{ frame: 0, gesture: hold }, { frame: 8, gesture: { chest: -16, lean: -8, leftArm: -165, leftElbow: -20, arm: -165, elbow: -30, head: -25, thigh: 10, leftThigh: -10, rise: 4 } },
    { frame: 16, gesture: { chest: 60, lean: 18, step: 6, leftArm: -30, leftElbow: 0, arm: -25, elbow: 0, head: 30, thigh: 65, knee: -90, leftThigh: 55, leftKnee: -85 } },
    { frame: 22, gesture: { chest: 62, lean: 20, step: 7, leftArm: -20, arm: -15, head: 32, thigh: 68, knee: -92, leftThigh: 58, leftKnee: -88 } }, { frame: 30, gesture: blend({ chest: 62, lean: 20, thigh: 68, knee: -92, leftThigh: 58, leftKnee: -88 }, ready, 0.7) }, { frame: 38, gesture: ready }]],
];
const only = process.argv.find(a => a.startsWith("--only="))?.slice(7).split(",");
const actions: Action[] = [...strikes, ...airStrikes].filter(([pose]) => !only || only.includes(pose)).map(([pose, style, strike]) => {
  const move = KOBOLD_MOVES.normals[style]!;
  return { pose, frames: Math.round(seq(pose).seconds * 60), contact: move.startupFrames, beats: strikeBeats(style, strike), air: strike.air, reach: strike.reach, pickHead: strike.pickHead };
});
for (const [pose, contact, beats, air] of posed) if (!only || only.includes(pose))
  actions.push({ pose, frames: Math.round(seq(pose).seconds * 60), contact, beats, air });
const dig = KOBOLD_SPECIALS.side.ground, digRegion = dig.regions![0]!;
const digScurry = (frame: number): Gesture => {
  const phase = (frame - digRegion.firstFrame) * Math.PI / 3, stride = Math.cos(phase), paw = Math.sin(phase);
  return { chest: -60, lean: 35, head: 15, pelvis: -10, tail: -30, step: 8 + Math.min(6, Math.max(0, frame - digRegion.firstFrame) * 3),
    arm: -70, elbow: -45, leftArm: -75 + 28 * stride, leftElbow: -55 + 28 * paw,
    thigh: -75 + 24 * stride, leftThigh: -75 - 24 * stride,
    knee: 110 + 25 * Math.max(0, paw), leftKnee: 110 + 25 * Math.max(0, -paw) };
};
for (const pose of ["sideSpecial", "sideSpecialAir"] as const) if (!only || only.includes(pose)) {
  const prep = { ...digScurry(digRegion.firstFrame), step: -42 }, last = digScurry(digRegion.lastFrame);
  actions.push({ pose, frames: dig.endFrame, contact: digRegion.firstFrame,
    beats: [{ frame: 0, gesture: ready }, { frame: 4, gesture: prep },
      ...Array.from({ length: digRegion.lastFrame - digRegion.firstFrame + 1 }, (_, i) => {
        const frame = digRegion.firstFrame + i;
        return { frame, gesture: digScurry(frame) };
      }), ...Array.from({ length: dig.endFrame - digRegion.lastFrame }, (_, i) => {
        const frame = digRegion.lastFrame + i + 1;
        return { frame, gesture: blend(last, ready, (frame - digRegion.lastFrame) / (dig.endFrame - digRegion.lastFrame)) };
      })] });
}
const charge: Gesture = { chest: -30, arm: -220, elbow: -32, leftArm: -205, leftElbow: -32, lean: -15, step: -6, head: -30, thigh: -20, leftThigh: 24, knee: -22 };
const crouch: Gesture = { chest: -60, lean: 20, head: 15, arm: 20, elbow: -60, leftArm: -40, thigh: -80, knee: 120, leftThigh: -80, leftKnee: 120 };
if (!only || only.includes("smashCharge")) actions.push({ pose: "smashCharge", frames: 30, contact: 8, hold: true, beats: [{ frame: 0, gesture: charge }, { frame: 30, gesture: charge }] });
if (!only || only.includes("crouch")) actions.push({ pose: "crouch", frames: 30, contact: 8, hold: true, beats: [{ frame: 0, gesture: crouch }, { frame: 30, gesture: crouch }] });

const scurry = (frame: number, bare: boolean): Gesture => {
  const phase = frame * Math.PI / 12, stride = Math.cos(phase), lift = Math.sin(phase);
  return { chest: -30, lean: 20, head: 10, tail: -30, pelvis: -6,
    thigh: -35 + 22 * stride, leftThigh: -35 - 22 * stride,
    knee: 50 + 24 * Math.max(0, lift), leftKnee: 50 + 24 * Math.max(0, -lift),
    arm: bare ? -170 + 24 * stride : -70 + 5 * stride, elbow: bare ? -20 - 15 * lift : -45,
    leftArm: bare ? -170 - 24 * stride : -50 - 8 * stride, leftElbow: bare ? -20 + 15 * lift : -60,
    rise: 1.5 * (1 - Math.cos(phase * 2)) };
};
for (const pose of ["run", "dash", "bareRun"] as const) if (!only || only.includes(pose)) {
  const frames = pose === "dash" ? 12 : 24, bare = pose === "bareRun";
  actions.push({ pose, frames, contact: 6, loop: pose !== "dash", bare, pickHead: "local", reach: 0.01,
    beats: Array.from({ length: frames + 1 }, (_, frame) => ({ frame, gesture: scurry(frame, bare), ...(bare ? {} : { target: [32, 30] as const }) })) });
}
if (!only || only.includes("bareIdle")) actions.push({ pose: "bareIdle", frames: 120, contact: 30, loop: true, bare: true,
  beats: Array.from({ length: 121 }, (_, frame) => {
    const phase = frame * Math.PI / 60;
    return { frame, gesture: { chest: 8 + 2 * Math.sin(phase * 2), lean: 3, head: -12, headYaw: 40 * Math.sin(phase),
      arm: -75 + 4 * Math.sin(phase * 4), elbow: -100 + 3 * Math.sin(phase * 4),
      leftArm: -80 - 4 * Math.sin(phase * 4), leftElbow: -100 - 3 * Math.sin(phase * 4),
      thigh: 12, leftThigh: 12, knee: -22, leftKnee: -22, tail: -12 } };
  }) });

let cursor = Math.max(...source.Sequences.map(s => s.Interval[1]!)) + 100;
for (const pose of ["run", "dash", "bareIdle", "bareRun", "sideSpecial", "sideSpecialAir"] as const) {
  const action = actions.find(a => a.pose === pose); if (!action) continue;
  const index = seq(pose).index;
  if (model.Sequences[index]) continue;
  ensure(model.Sequences.length === index, `${pose}: cannot append sequence ${index}`);
  const end = cursor + Math.round(action.frames * 1000 / 60);
  model.Sequences.push({ ...source.Sequences[seq("jab").index]!, Name: `Kobold ${pose}`, Interval: new Uint32Array([cursor, end]), NonLooping: !action.loop, MoveSpeed: 0, Rarity: 0 });
  cursor = end + 100;
}
const candle = model.Nodes.find(n => n.Name === "Candle")!;
if (actions.some(a => a.bare) && !candle.Scaling) candle.Scaling = { LineType: mdx.LineType.DontInterp, GlobalSeqId: null,
  Keys: source.Sequences.flatMap(s => Array.from(s.Interval).map(Frame => ({ Frame, Vector: new Float32Array([1, 1, 1]) }))) };

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
  if (name === "Bone_Hand_R") return [g.wrist ?? 0, 0];
  if (name === "Bone_Arm1_L") return [g.leftArm ?? 0, 0];
  if (name === "Bone_Arm2_L") return [g.leftElbow ?? 0, 0];
  if (name === "Bone_Head") return [g.head ?? 0, g.headYaw ?? 0];
  if (name === "K_Tail") return [g.tail ?? 0, 0];
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
let pickTip: [number, number, number] = [0, 0, 0], tipDistance = -1;
for (const geoset of model.Geosets) {
  const groups = geoset.Groups;
  for (let v = 0; v < geoset.Vertices.length / 3; v++) {
    const group = groups[geoset.VertexGroup[v]!]!;
    if (group.length !== 1 || group[0] !== pickNode.ObjectId) continue;
    const p: [number, number, number] = [geoset.Vertices[v * 3]!, geoset.Vertices[v * 3 + 1]!, geoset.Vertices[v * 3 + 2]!];
    const d = Math.hypot(p[0] - handPivot[0]!, p[1] - handPivot[1]!, p[2] - handPivot[2]!);
    if (d > tipDistance) { tipDistance = d; pickTip = p; }
  }
}
ensure(tipDistance > 10, "Kobold pick head not found");
function pickHead(): [number, number, number] {
  const verts: number[][] = [];
  for (const geoset of model.Geosets) for (let v = 0; v < geoset.Vertices.length / 3; v++) {
    const group = geoset.Groups[geoset.VertexGroup[v]!]!;
    if (group.length === 1 && group[0] === pickNode.ObjectId && geoset.Vertices[v * 3]! > 8) verts.push([geoset.Vertices[v * 3]!, geoset.Vertices[v * 3 + 1]!, geoset.Vertices[v * 3 + 2]!]);
  }
  ensure(verts.length > 8, "Kobold pick head vertices not found");
  return [0, 1, 2].map(i => verts.reduce((sum, p) => sum + p[i]!, 0) / verts.length) as [number, number, number];
}
const head = pickHead();
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
  if (action.bare) {
    ensure(candle.Scaling, "Bare Kobold needs candle scaling");
    candle.Scaling.Keys = candle.Scaling.Keys.filter(k => k.Frame < start || k.Frame > end);
    for (const Frame of [start, end]) candle.Scaling.Keys.push({ Frame, Vector: new Float32Array(3) });
    candle.Scaling.Keys.sort((a, b) => a.Frame - b.Frame);
    const flame = model.ParticleEmitters2.find(n => n.Name === "BlizParticle01");
    ensure(flame?.Visibility, "Bare Kobold needs flame visibility");
    ensure(!globalClock(flame.Visibility), "Kobold flame visibility uses a global clock");
    flame.Visibility.Keys = flame.Visibility.Keys.filter(k => k.Frame < start || k.Frame > end);
    for (const Frame of [start, end]) flame.Visibility.Keys.push({ Frame, Vector: new Float32Array([0]),
      ...(flame.Visibility.LineType > mdx.LineType.Linear ? { InTan: new Float32Array([0]), OutTan: new Float32Array([0]) } : {}) });
    flame.Visibility.Keys.sort((a, b) => a.Frame - b.Frame);
  }
  const renderer = new ModelRenderer(model), data = Reflect.get(renderer, "rendererData"); renderer.setSequence(index);
  const arm = model.Nodes.find(n => n.Name === "Bone_Arm1_R")!, elbow = model.Nodes.find(n => n.Name === "Bone_Arm2_R")!, hand = handNode;
  const donor = (n: mdx.Node) => source.Nodes[n.ObjectId]!.Rotation!.Keys.find(k => k.Frame >= stand.Interval[0]! && k.Frame <= stand.Interval[1]!)!.Vector;
  const tipMiss: number[] = [];
  for (const beat of action.beats) if (beat.target) {
    data.frame = time(beat.frame);
    const armKey = arm.Rotation!.Keys.find(k => k.Frame === time(beat.frame))!, elbowKey = elbow.Rotation!.Keys.find(k => k.Frame === time(beat.frame))!;
    const authored = [beat.gesture.arm ?? 0, beat.gesture.armTwist ?? 0, beat.gesture.elbow ?? 0, 0, ...(beat.gesture.wrist == null ? [] : [beat.gesture.wrist])], angles = authored.slice();
    const handKey = beat.gesture.wrist == null ? undefined : hand.Rotation?.Keys.find(k => k.Frame === time(beat.frame));
    ensure(beat.gesture.wrist == null || handKey, `${action.pose}: right hand has no rotation key`);
    const [tx, tz] = action.air || action.pickHead === "world" ? [beat.target[0] - (beat.gesture.step ?? 0), beat.target[1] - (beat.gesture.rise ?? 0)] : beat.target;
    const loss = () => {
      if (handKey) { handKey.Vector = rotated(donor(hand), angles[4]!, 0); if (handKey.InTan) { handKey.InTan = handKey.Vector.slice(); handKey.OutTan = handKey.Vector.slice(); } }
      armKey.Vector = rotated(donor(arm), angles[0]!, angles[1]!); elbowKey.Vector = rotated(donor(elbow), angles[2]!, angles[3]!);
      if (armKey.InTan) { armKey.InTan = armKey.Vector.slice(); armKey.OutTan = armKey.Vector.slice(); }
      if (elbowKey.InTan) { elbowKey.InTan = elbowKey.Vector.slice(); elbowKey.OutTan = elbowKey.Vector.slice(); }
      renderer.update(0); const m = data.nodes[pickNode.ObjectId].matrix, tip = action.air || action.pickHead ? head : pickTip;
      const x = m[0] * tip[0] + m[4] * tip[1] + m[8] * tip[2] + m[12], z = m[2] * tip[0] + m[6] * tip[1] + m[10] * tip[2] + m[14];
      return (x - tx!) ** 2 + (z - tz!) ** 2 + (action.reach ?? 0.04) * angles.reduce((sum, a, i) => sum + (a - authored[i]!) ** 2, 0);
    };
    for (let pass = 0; pass < 3; pass++) for (let dim = 0; dim < authored.length; dim++) {
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
  const floors = action.air ? frames.map(() => 0) : frames.map(frame => { const t = drawn.triangles(index, frame / 60, 1); let lowest = Infinity; for (let i = 1; i < t.length; i += 2) lowest = Math.min(lowest, t[i]!); return lowest; });
  const restFloor = action.air ? 0 : (() => { const t = drawn.triangles(0, 0, 1); let lowest = Infinity; for (let i = 1; i < t.length; i += 2) lowest = Math.min(lowest, t[i]!); return lowest; })();
  for (const [i, frame] of frames.entries()) {
    const key = root.Translation.Keys.find(k => k.Frame === time(frame))!;
    key.Vector[0] = key.Vector[0]! + along(action.beats, frame, g => g.step ?? 0);
    key.Vector[2] = key.Vector[2]! - (floors[i]! - restFloor) + along(action.beats, frame, g => g.rise ?? 0);
    if (key.InTan) { key.InTan = root.Translation.LineType === mdx.LineType.Bezier ? key.Vector.slice() : new Float32Array(3); key.OutTan = key.InTan.slice(); }
  }
  records.push({ pose: action.pose, index, frames: action.frames, contact: action.contact, beats: action.beats.map(b => b.frame), tipMiss });
}

if (!source.Nodes[candle.ObjectId]!.Scaling && candle.Scaling) {
  const bareIntervals = actions.filter(a => a.bare).map(a => model.Sequences[seq(a.pose).index]!.Interval);
  for (const key of candle.Scaling.Keys) {
    const bare = bareIntervals.some(([start, end]) => key.Frame >= start! && key.Frame <= end!);
    ensure(key.Vector.every(v => v === (bare ? 0 : 1)), "Candle scaling changed outside bare clips");
  }
}
const outside = (m: mdx.Model) => { const copy = structuredClone(m);
  copy.Sequences = copy.Sequences.slice(0, source.Sequences.length);
  if (!source.Nodes[candle.ObjectId]!.Scaling) delete copy.Nodes[candle.ObjectId]!.Scaling;
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
  const panelFrames = action.loop ? Array.from({ length: 9 }, (_, i) => Math.round(action.frames * i / 8)) : action.pose === "dash" ? [0, 3, 6, 9, 12] : action.hold ? [0, action.frames] : action.beats.map(b => b.frame);
  const panels: PoseFrame[] = [1, -1].flatMap(facing => panelFrames.map(frame => ({ frame, phase: frame < action.contact ? AttackPhase.startup : frame <= action.contact + 4 ? AttackPhase.active : AttackPhase.recovery,
    x: 0, z: 0, facing, parts: [], strikes: [], clip: index, seconds: frame / 60 })));
  await Bun.write(join(output, `Kobold-${action.pose}.png`), sheet(`Kobold ${action.pose}`, finalDrawn, panels, panelFrames.length).png);
}
await Bun.write(join(output, "kobold-ground.json"), JSON.stringify({ tip: pickTip, head, records }, null, 2) + "\n");
console.log(`KOBOLD_CLIPS_PASS ${records.length} ground clips re-authored at their indices; other sequences unchanged; ${output}`);
