import { NO_GLOBAL_SEQ } from './animVector';
import { BunRuntime } from "../../ts/node_modules/@effect/platform-bun/dist/index.js";
import { Effect, Schema } from "effect";
import { mkdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackStyle, AttackPhase, Character, GrabAction } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/roster/kits";
import type { HeroDefinition, HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { DOWN_DAMAGE_FRAMES, DOWN_ROLL_FRAMES, TECH_ROLL_FRAMES } from "../../ts/src/game/sim/down";
import { LEDGE_ROLL_FRAMES } from "../../ts/src/game/sim/ledge";
import { GROUND_ROLL_FRAMES } from "../../ts/src/game/sim/conditions";
import { seconds } from "./asset-info";
import { highestGrip, ledgeGripOffset } from "./ledge-grip";
import { ensure, parseSource, tracks, onGlobalClock, encodeVerified } from "./original-clips";
class ClipFailure extends Schema.TaggedError<ClipFailure>()("ClipFailure", { cause: Schema.Unknown }) {}

type Point = readonly [number, number, number];
interface Gesture {
  tx?: number; tz?: number; body?: number; spin?: number; lean?: number; waist?: number; chest?: number; yaw?: number; head?: number; snakes?: number;
  uncoil?: number; tail?: number; tailYaw?: number; curl?: number; curlYaw?: number; whip?: number;
}
type Chain = "bow" | "draw" | "upperL" | "upperR";
interface Reach { frame: number; chain: Chain; target: Point; }
interface Donor { sequence: number; release: number; }
interface Action { pose: HeroPose; frames: number; contact: number; keys: readonly (readonly [number, Gesture])[]; reach?: readonly Reach[]; air?: boolean; loop?: boolean; donor?: Donor; }
interface Timing { startupFrames: number; activeFrames: number; totalFrames: number; }

const CHAINS: Record<Chain, readonly [string, string, string]> = {
  bow: ["Bone_ArmUpper2_Left", "Bone_ArmLower2_Left", "Bone_Hand2_Left"],
  draw: ["Bone_ArmUpper2_Right", "Bone_ArmLower2_Right", "Bone_Hand2_Right"],
  upperL: ["Bone_ArmUpper1_Left", "Bone_Armlower1_Left", "Bone_ArmHand1_Left"],
  upperR: ["Bone_ArmUpper1_Right", "Bone_ArmLower1_Right", "Bone_ArmHand1_Right"],
};
const TAIL = ["Bone_Tail_01", "Bone_Tail_02", "Bone_Tail_03", "Bone_Tail_04", "Bone_Tail_05"];
const SNAKES = ["Bone_HeadSnakeRF04", "Bone_HeadSnakeRF1", "Bone_HeadSnakeRR04", "Bone_HeadSnakeRR2"];
const NORMALS: Readonly<Partial<Record<HeroPose, readonly [AttackStyle, number, number, number]>>> = {
  jab: [AttackStyle.jab, 5, 2, 16], jab2: [AttackStyle.jab2, 6, 2, 18],
  forwardTilt: [AttackStyle.forwardTilt, 10, 4, 24], forwardTiltUp: [AttackStyle.forwardTiltUp, 10, 4, 24], forwardTiltDown: [AttackStyle.forwardTiltDown, 10, 4, 24],
  upTilt: [AttackStyle.upTilt, 8, 4, 22], downTilt: [AttackStyle.downTilt, 8, 3, 20], dashAttack: [AttackStyle.dashAttack, 12, 5, 28],
  forwardSmash: [AttackStyle.forwardSmash, 21, 3, 36], upSmash: [AttackStyle.upSmash, 19, 5, 34], downSmash: [AttackStyle.downSmash, 17, 5, 34],
  neutralAir: [AttackStyle.neutralAir, 9, 6, 24], forwardAir: [AttackStyle.forwardAir, 12, 3, 26], backAir: [AttackStyle.backAir, 11, 4, 26],
  upAir: [AttackStyle.upAir, 8, 4, 22], downAir: [AttackStyle.downAir, 16, 4, 30],
  grab: [AttackStyle.grab, 7, 2, 30], getUpAttack: [AttackStyle.getupAttack, 16, 4, 49], ledgeAttack: [AttackStyle.ledgeAttack, 20, 4, 40],
};
const THROWS: Readonly<Partial<Record<HeroPose, readonly [GrabAction, number, number]>>> = {
  pummel: [GrabAction.pummel, 8, 24], throwForward: [GrabAction.throwForward, 11, 30], throwBack: [GrabAction.throwBack, 13, 34],
  throwUp: [GrabAction.throwUp, 11, 30], throwDown: [GrabAction.throwDown, 15, 32],
};
const SPECIALS: Readonly<Record<"neutral" | "side" | "up" | "down", readonly [number, number]>> = { neutral: [18, 40], side: [16, 46], up: [12, 40], down: [6, 12] };


type Hero = HeroDefinition | undefined;
type Keys = (readonly [number, Gesture])[];
type Add = (pose: HeroPose, frames: number, contact: number, keys: Keys, extra?: Partial<Action>) => void;
interface Bake {
  readonly model: mdx.Model; readonly source: mdx.Model; readonly stand: mdx.Sequence; readonly originals: Map<string, mdx.AnimVector>; readonly rootNode: mdx.Node; readonly hangHands: number[];
  readonly bindings: string[]; readonly damageBindings: string[]; readonly records: { pose: string; index: number; frames: number; contact: number }[]; readonly authored: number; cursor: number;
}
const ms = (frame: number) => Math.round(frame * 1000 / 60);

function normalTiming(hero: Hero, pose: HeroPose): Timing {
  const row = NORMALS[pose]; ensure(row, `${pose}: no frame data`);
  const kit = hero?.moves.normals[row[0]];
  return kit ? { startupFrames: kit.startupFrames, activeFrames: kit.activeFrames, totalFrames: kit.totalFrames } : { startupFrames: row[1], activeFrames: row[2], totalFrames: row[3] };
}
function throwTiming(hero: Hero, pose: HeroPose): { contact: number; total: number } {
  const row = THROWS[pose]!, kit = hero?.moves.throws[row[0]];
  return kit ? { contact: kit.contactFrame, total: kit.totalFrames } : { contact: row[1], total: row[2] };
}
function specialTiming(hero: Hero, key: keyof typeof SPECIALS, air: boolean): { contact: number; total: number } {
  const move = hero?.specials?.[key];
  if (!move) return { contact: SPECIALS[key][0], total: SPECIALS[key][1] };
  const form = air ? move.air ?? move.ground : move.ground;
  const contact = Math.min(...[...(form.regions?.map(r => r.firstFrame) ?? []), ...(form.motion?.map(r => r.first) ?? []), ...(form.projectiles?.map(r => r.spawnFrame) ?? []), ...(form.placement ? [form.placement.frame] : []), ...(form.manaShield ? [form.manaShield.frame] : []), form.endFrame]);
  return { contact: Math.max(3, contact), total: form.endFrame };
}

const blend = (from: Gesture, to: Gesture, k: number): Gesture => Object.fromEntries([...new Set([...Object.keys(from), ...Object.keys(to)])].map(name => [name, ((from as Record<string, number>)[name] ?? 0) * (1 - k) + ((to as Record<string, number>)[name] ?? 0) * k]));
const recover = (start: number, end: number, from: Gesture, to: Gesture, via: Gesture = blend(from, to, 0.5), steps = 4): (readonly [number, Gesture])[] =>
  Array.from({ length: steps }, (_, i) => { const r = (i + 1) / (steps + 1), e = r; return [Math.round(start + (end - start) * r), e < 0.5 ? blend(from, via, e / 0.5) : blend(via, to, (e - 0.5) / 0.5)] as const; }).filter(([f]) => f > start && f < end);
const strike = (c: number, a: number, t: number, windup: Gesture, hit: Gesture, follow: Gesture = hit, settle: Gesture = {}, rest: Gesture = {}): (readonly [number, Gesture])[] => {
  const after = Math.min(t - 1, c + a);
  return [[0, rest], [Math.max(1, c - 3), windup], [c, hit], [after, follow], ...recover(after, t, follow, rest, settle), [t, rest]];
};
const dedupe = (keys: (readonly [number, Gesture])[]) => keys.filter(([frame], i) => keys.findIndex(([other]) => other === frame) === i).sort((a, b) => a[0] - b[0]);
const wave = (frames: number, steps: number, at: (p: number) => Gesture) => Array.from({ length: steps + 1 }, (_, i) => [Math.round(frames * i / steps), at(i / steps)] as const);
const hold = (frames: number, g: Gesture, sway = 12) => wave(frames, 4, p => ({ ...g, curlYaw: (g.curlYaw ?? 0) + sway * Math.sin(2 * Math.PI * p), tail: (g.tail ?? 0) + sway * 0.4 * Math.sin(4 * Math.PI * p) }));
const settleTail: Gesture = { uncoil: 0.4, tail: 6, curl: 6 };
const brace: Gesture = { lean: 18, chest: 12, head: -6, uncoil: 0.3, curl: 10 };
const ready = (g: Gesture): Gesture => ({ ...brace, ...g });
const airRest: Gesture = { lean: 6, chest: 4, head: -6, uncoil: 0.9, tail: -48, curl: 8 };
const lash = (pitch: number): Gesture => ({ lean: 22, chest: 18, yaw: -20, head: -10, uncoil: 1, tailYaw: 175, tail: pitch, curl: -4, whip: 10 });
const reachAll = (frames: readonly number[], chain: Chain, target: Point): Reach[] => frames.map(frame => ({ frame, chain, target }));

const thrust = (c: number, t: number, windup: Gesture, hit: Gesture, follow: Gesture, settle: Gesture): (readonly [number, Gesture])[] => [[0, {}], [Math.max(1, c - 3), windup], [c, hit], [c + 1, follow], ...recover(c + 1, t, follow, {}, settle), [t, {}]];

function authorNormals(hero: Hero, add: Add): void {
const normal = (pose: HeroPose, build: (c: number, a: number, t: number) => { keys: (readonly [number, Gesture])[]; reach?: Reach[] }, air = false) => {
  const { startupFrames: c, activeFrames: a, totalFrames: t } = normalTiming(hero, pose), built = build(c, a, t);
  add(pose, t, c, built.keys, { reach: built.reach, air });
};
normal("jab", (c, a, t) => ({ keys: thrust(c, t, { tx: -14, lean: -12, chest: -20, yaw: 28, uncoil: 0.3 }, { tx: 14, lean: 10, chest: 8, yaw: -18, uncoil: 0.3, tail: 4 }, { tx: 19, lean: 11, chest: 10, yaw: -20, uncoil: 0.3, tail: 4 }, { tx: 8, lean: 4, chest: 3, uncoil: 0.25 }), reach: [...reachAll([Math.max(1, c - 3)], "bow", [12, 26, 98]), ...reachAll([c, c + 1], "bow", [112, 18, 92])] }));
normal("jab2", (c, a, t) => ({ keys: thrust(c, t, { tx: -8, chest: -10, yaw: -20, uncoil: 0.3 }, { tx: 14, lean: 10, chest: 10, yaw: 20, uncoil: 0.3, tail: 6 }, { tx: 21, lean: 12, chest: 12, yaw: 22, uncoil: 0.3, tail: 6 }, { tx: 8, lean: 5, chest: 5, uncoil: 0.2 }), reach: [...reachAll([Math.max(1, c - 3)], "bow", [6, 22, 72]), ...reachAll([c, c + 1], "bow", [112, 12, 70])] }));
normal("forwardTilt", (c, a, t) => ({ keys: strike(c, a, t, { lean: -10, chest: -10, uncoil: 1, tail: 40, tailYaw: 20, curl: 12 }, lash(4), lash(-4), settleTail) }));
normal("forwardTiltUp", (c, a, t) => ({ keys: strike(c, a, t, { lean: -12, chest: -14, uncoil: 1, tail: 20, tailYaw: 20, curl: 12 }, { ...lash(38), chest: 4 }, { ...lash(44), chest: 4 }, settleTail) }));
normal("forwardTiltDown", (c, a, t) => ({ keys: strike(c, a, t, { lean: -8, chest: -8, uncoil: 1, tail: 50, tailYaw: 20, curl: 10 }, { ...lash(-10), chest: 26 }, { ...lash(-12), chest: 26 }, settleTail) }));
normal("upTilt", (c, a, t) => ({ keys: strike(c, a, t, { lean: 12, chest: 18, head: 25, snakes: 30, uncoil: 0.5, tail: 10 }, { lean: -14, chest: -24, head: -40, snakes: -95, uncoil: 0.8, tail: 25, curl: 6 }, { lean: -16, chest: -26, head: -45, snakes: -100, uncoil: 0.8, tail: 25 }), reach: reachAll([c, c + a], "upperR", [12, -14, 190]).concat(reachAll([c, c + a], "upperL", [12, 14, 190])) }));
normal("downTilt", (c, a, t) => ({ keys: strike(c, a, t, { lean: 30, chest: 20, uncoil: 1, tail: 14, tailYaw: -40, curl: 8 }, { lean: 42, chest: 26, head: -14, uncoil: 1, tailYaw: 150, tail: -2, curl: -2, curlYaw: 8 }, { lean: 42, chest: 26, uncoil: 1, tailYaw: 178, tail: -2, curlYaw: 10 }, { ...brace, uncoil: 0.6 }) }));
normal("dashAttack", (c, a, t) => ({ keys: [[0, { lean: 30, chest: 12, uncoil: 1, tail: 8 }], [Math.max(1, c - 4), { lean: 20, chest: 0, head: 10, uncoil: 1, tail: 20, curl: 8 }], [c, { tx: 18, body: 0, lean: 70, chest: 20, head: -25, uncoil: 1, tail: 14, curl: -2, whip: 6 }], [c + a, { tx: 26, lean: 72, chest: 22, head: -25, uncoil: 1, tail: 10 }], [Math.round(c + a + (t - c - a) * 0.6), { tx: 10, lean: 35, chest: 10, uncoil: 0.8, tail: 6 }], [t, {}]], reach: [...reachAll([c, c + a], "bow", [70, 25, 40]), ...reachAll([c, c + a], "upperR", [65, -20, 45])] }));
normal("forwardSmash", (c, a, t) => ({ keys: [[0, {}], [Math.round(c * 0.5), { lean: -18, chest: -20, yaw: 35, head: 8, uncoil: 0.8, tail: 20, curl: 10 }], [c - 2, { lean: -22, chest: -24, yaw: 40, head: 10, uncoil: 0.9, tail: 24, curl: 12 }], [c, { tx: 14, lean: 40, chest: 28, yaw: -20, head: -18, uncoil: 1, tail: 18, whip: 8 }], [c + a + 2, { tx: 16, lean: 42, chest: 30, yaw: -22, head: -18, uncoil: 1, tail: 18 }], [Math.round(c + a + (t - c - a) * 0.6), { tx: 6, lean: 15, chest: 10, uncoil: 0.6, tail: 8 }], [t, {}]],
  reach: [...reachAll([Math.round(c * 0.5), c - 2], "upperR", [-30, -25, 120]), ...reachAll([Math.round(c * 0.5), c - 2], "upperL", [-20, 25, 115]), ...reachAll([c, c + a + 2], "upperR", [95, -12, 110]), ...reachAll([c, c + a + 2], "upperL", [85, 12, 112])] }));
normal("upSmash", (c, a, t) => ({ keys: [[0, {}], [c - 3, { lean: 20, chest: 24, head: 20, snakes: 25, uncoil: 0.3, curl: 14 }], [c, { tz: 10, lean: -12, chest: -22, head: -35, snakes: -80, uncoil: 0.8, tail: 30, curl: 8 }], [c + a, { tz: 12, lean: -14, chest: -24, head: -38, snakes: -85, uncoil: 0.8, tail: 32 }], [Math.round(c + a + (t - c - a) * 0.6), { lean: 4, chest: 2, uncoil: 0.5, tail: 10 }], [t, {}]],
  reach: [...reachAll([c - 3], "upperR", [20, -20, 80]), ...reachAll([c - 3], "upperL", [20, 20, 80]), ...reachAll([c, c + a], "upperR", [35, -40, 205]), ...reachAll([c, c + a], "upperL", [-15, 40, 205])] }));
normal("downSmash", (c, a, t) => { const back = Math.min(t - 2, c + a + 2); return { keys: [[0, {}], [Math.max(1, c - 4), { lean: 10, chest: 14, uncoil: 0.5, tail: 25, curl: 30, curlYaw: 25 }], [c, { lean: 30, chest: 22, yaw: -15, uncoil: 1, tailYaw: 172, tail: -3, curl: -2, curlYaw: 6 }], [c + 2, { lean: 28, chest: 20, uncoil: 1, tailYaw: 120, tail: 4, curlYaw: -10 }], [back, { lean: -18, chest: -12, yaw: 20, uncoil: 1, tailYaw: -4, tail: -3, whip: 4 }], [Math.min(t - 1, back + 6), { lean: -10, chest: -6, uncoil: 0.8, tail: 4 }], [t, {}]] }; });
normal("neutralAir", (c, a, t) => { const end: Gesture = { spin: 355, lean: 10, chest: 10, uncoil: 1, tail: -6, curlYaw: 15 }; return { keys: [[0, airRest], [Math.max(1, c - 3), { chest: 20, lean: 20, uncoil: 0.6, tail: -20, curl: 30, curlYaw: 20 }], [c, { spin: 120, lean: 10, chest: 10, uncoil: 1, tail: 0, curlYaw: 15 }], [c + Math.round(a / 2), { spin: 240, lean: 10, chest: 10, uncoil: 1, tail: 0, curlYaw: 15 }], [c + a, end], ...recover(c + a, t, { ...end, spin: -5 }, airRest), [t, airRest]] }; }, true);
normal("forwardAir", (c, a, t) => ({ keys: strike(c, a, t, { lean: -14, chest: -16, yaw: 20, uncoil: 0.8, tail: -40, curl: 10 }, { lean: 10, chest: 14, yaw: -15, head: -8, uncoil: 0.9, tail: -30, curl: -4 }, { lean: 18, chest: 20, yaw: -20, head: -10, uncoil: 0.9, tail: -28 }, blend({ lean: 18, chest: 20, uncoil: 0.9, tail: -28 }, airRest, 0.5), airRest),
  reach: [...reachAll([Math.max(1, c - 3)], "bow", [-10, 30, 178]), ...reachAll([c], "bow", [108, 20, 96]), ...reachAll([c + a], "bow", [92, 20, 42])] }), true);
normal("backAir", (c, a, t) => { const out: Gesture = { tx: -6, lean: 22, chest: 18, uncoil: 1, tail: 8, curl: -2, whip: -4 }; return { keys: [[0, airRest], [Math.max(1, c - 3), { tx: 4, lean: 20, chest: 18, head: 10, uncoil: 1, tail: -70, curl: 18 }], [c, { tx: -34, lean: 26, chest: 22, head: -10, yaw: 20, uncoil: 1, tail: 14, curl: -6, whip: -10 }], [c + a, out], ...recover(c + a, t, out, airRest), [t, airRest]], reach: [...reachAll([Math.max(1, c - 3)], "bow", [10, 30, 100]), ...reachAll([c], "bow", [-95, 20, 100]), ...reachAll([c + a], "bow", [-100, 20, 92])] }; }, true);
normal("upAir", (c, a, t) => { const low = Math.max(1, c - 5), back = Math.max(low + 1, c - 2), out: Gesture = { tz: -2, body: 5, lean: 6, chest: 8, head: -18, snakes: -30, uncoil: 1, tail: -55, curl: 14, whip: 10 };
  return { keys: [[0, airRest], [low, { tz: -6, lean: 12, chest: 14, uncoil: 1, tail: -60, curl: 6 }], [back, { tz: 0, body: -15, lean: -14, chest: -26, head: -30, snakes: -30, uncoil: 1, tail: -40, curl: -20, whip: -12 }], [c, { tz: 12, body: 0, lean: 0, chest: -4, head: -28, snakes: -30, uncoil: 1, tail: -48, curl: -4 }], [c + a, out], ...recover(c + a, t, out, airRest), [t, airRest]],
  reach: [...reachAll([low], "upperR", [-45, -25, 115]), ...reachAll([low], "upperL", [-45, 25, 115]), ...reachAll([back], "upperR", [-25, -25, 170]), ...reachAll([back], "upperL", [-25, 25, 170]), ...reachAll([back], "bow", [-20, 25, 170]),
    ...reachAll([c], "upperR", [30, -25, 175]), ...reachAll([c], "upperL", [30, 25, 175]), ...reachAll([c], "bow", [32, 25, 172]),
    ...reachAll([c + a], "upperR", [25, -25, 145]), ...reachAll([c + a], "upperL", [25, 25, 145]), ...reachAll([c + a], "bow", [28, 25, 140])] }; }, true);
normal("downAir", (c, a, t) => { const out: Gesture = { lean: 8, chest: 18, head: -30, uncoil: 1, tail: -90, curl: 0 }; return { keys: [[0, airRest], [Math.max(1, c - 4), { lean: -20, chest: -20, head: 15, uncoil: 1, tail: 20, curl: 20, curlYaw: 10 }], [c, { lean: 8, chest: 18, head: -30, uncoil: 1, tail: -92, curl: 0, whip: -4 }], [c + a, out], ...recover(c + a, t, out, airRest), [t, airRest]] }; }, true);
normal("grab", (c, a, t) => ({ keys: [[0, {}], [Math.max(1, c - 3), { lean: 10, chest: 10, uncoil: 1, tailYaw: 90, tail: 10, curl: 4 }], [c, { lean: 26, chest: 20, head: -10, uncoil: 1, tailYaw: 178, tail: 12, curl: -3, whip: 22 }], [c + a + 3, { lean: 26, chest: 20, uncoil: 1, tailYaw: 178, tail: 14, curl: -2, whip: 40 }], [Math.round(t * 0.75), { lean: 14, uncoil: 0.8, tailYaw: 90, tail: 6 }], [t, {}]], reach: reachAll([c, c + a + 3], "upperR", [60, -20, 80]) }));
normal("getUpAttack", (c, a, t) => ({ keys: [[0, { body: 80, uncoil: 1, tail: 0 }], [c - 4, { body: 40, lean: 10, uncoil: 1, tail: 20, curl: 20 }], [c, { lean: 30, chest: 15, uncoil: 1, tailYaw: 175, tail: -2, curlYaw: 8 }], [c + 4, { lean: 20, chest: 10, uncoil: 1, tailYaw: 95, tail: 2 }], [c + 8, { lean: -15, chest: -10, uncoil: 1, tailYaw: -5, tail: -2, whip: 4 }], [Math.round(c + 8 + (t - c - 8) * 0.5), { ...brace }], [t, {}]] }));
normal("ledgeAttack", (c, a, t) => ({ keys: strike(c, a, t, { body: 30, lean: 30, uncoil: 1, tail: -50, curl: 20 }, lash(0), lash(-4), settleTail) }));
}

function authorStates(add: Add): void {
add("crouch", 30, 12, hold(30, { lean: 80, chest: 36, waist: 44, head: -32, snakes: 60, uncoil: 0, curl: 34, tail: 4 }, 8), { loop: true });
add("landing", 8, 2, [[0, { lean: 30, chest: 20, uncoil: 0.8, tail: -20 }], [2, { lean: 45, chest: 26, waist: 18, uncoil: 0.6, curl: 22, tail: 10 }], [8, { ...brace }]]);
add("shield", 30, 8, hold(30, { lean: 20, chest: 26, head: -14, uncoil: 0.1, curl: 30, curlYaw: 20, tail: 12 }, 6), { loop: true, reach: [0, 8, 15, 23, 30].flatMap(f => reachAll([f], "upperR", [30, -10, 105]).concat(reachAll([f], "upperL", [30, 10, 105]))) });
add("airDodge", 49, 4, [[0, airRest], [4, { lean: 30, chest: 30, head: 20, uncoil: 0.4, curl: 40, curlYaw: 30, tail: -10 }], [30, { lean: 30, chest: 30, head: 20, uncoil: 0.4, curl: 40, curlYaw: 30, tail: -10 }], [49, airRest]], { air: true });
add("smashCharge", 30, 8, hold(30, { lean: -18, chest: -20, yaw: 30, head: 8, uncoil: 0.9, tail: 24, curl: 14 }, 6), { loop: true, reach: [0, 8, 15, 23, 30].flatMap(f => reachAll([f], "upperR", [-30, -25, 120])) });
add("dizzy", 60, 25, wave(60, 6, p => ({ lean: -10 + 10 * Math.sin(2 * Math.PI * p), chest: -15, head: 30 * Math.sin(2 * Math.PI * p), yaw: 20 * Math.sin(2 * Math.PI * p), uncoil: 0.5, curlYaw: 20 * Math.cos(2 * Math.PI * p), tail: 6 })), { loop: true });
add("turn", 8, 4, [[0, {}], [4, { yaw: 140, chest: -10, uncoil: 0.6, tailYaw: -60, curl: 10 }], [8, {}]]);
add("stop", 8, 3, [[0, { lean: 20, uncoil: 1 }], [3, { lean: -22, chest: -12, uncoil: 1, tail: 25, curl: 12 }], [8, {}]]);
add("jumpSquat", 5, 4, [[0, {}], [4, { lean: 40, chest: 25, waist: 20, head: -12, uncoil: 0.1, curl: 28, tail: 4 }], [5, { lean: 42, chest: 26, waist: 20, uncoil: 0.1, curl: 30, tail: 4 }]]);
add("jump", 24, 7, [[0, { lean: 10, uncoil: 1, tail: -70, curl: -4 }], [7, { lean: -12, chest: -14, head: -10, uncoil: 1, tail: -55, curl: 6 }], [16, { lean: -6, chest: -8, uncoil: 1, tail: -45, curl: 10 }], [24, { uncoil: 0.9, tail: -40, curl: 10 }]], { air: true, reach: reachAll([7], "upperR", [10, -25, 170]) });
add("doubleJump", 24, 7, [[0, { body: 25, lean: 30, chest: 20, uncoil: 0.6, tail: -20, curl: 30 }], [7, { body: -30, lean: -18, chest: -20, head: -15, uncoil: 1, tail: -70, curl: -6, whip: -20 }], [16, { body: -12, lean: -8, uncoil: 1, tail: -55, curl: 4 }], [24, { uncoil: 0.9, tail: -40, curl: 10 }]], { air: true, reach: reachAll([7], "upperR", [15, -30, 180]).concat(reachAll([7], "upperL", [15, 30, 180])) });
add("wallJump", 24, 7, [[0, { lean: 20, uncoil: 0.8, tail: 10 }], [7, { lean: -25, chest: -20, uncoil: 1, tail: -60 }], [24, { uncoil: 0.9, tail: -40 }]], { air: true });
add("wallTech", 26, 6, [[0, {}], [6, { lean: -30, chest: -20, uncoil: 0.8, tail: 30, curl: 15 }], [26, { uncoil: 0.8, tail: -30 }]], { air: true });
add("fall", 30, 12, hold(30, { lean: 6, chest: 4, head: -6, uncoil: 0.9, tail: -48, curl: 8 }, 14), { air: true, loop: true });
add("fallSpecial", 30, 12, hold(30, { lean: 30, chest: 40, head: 20, uncoil: 1, tail: -70, curl: -4 }, 8), { air: true, loop: true });
add("ledgeHang", 30, 10, hold(30, { lean: -6, chest: -10, head: -14, uncoil: 1, tail: -88, curl: 0, body: 0 }, 10), { air: true, loop: true, reach: [0, 8, 15, 23, 30].flatMap(f => reachAll([f], "upperR", [14, -26, 185]).concat(reachAll([f], "upperL", [14, 26, 185]))) });
add("ledgeClimb", 25, 10, [[0, { uncoil: 1, tail: -88 }], [10, { lean: 45, chest: 30, uncoil: 1, tail: -40, curl: 20 }], [18, { lean: 25, chest: 15, uncoil: 0.8, tail: 0, curl: 10 }], [25, {}]], { air: true, reach: reachAll([0], "upperR", [14, -26, 185]).concat(reachAll([10], "upperR", [40, -20, 60])) });
add("knockdown", 30, 25, hold(30, { body: 82, chest: -10, head: 20, uncoil: 1, tail: -82, curl: 4 }, 4), { loop: true });
add("downDamage", DOWN_DAMAGE_FRAMES, 8, [[0, { body: 82, chest: -10, head: 20, uncoil: 1, tail: -82 }], [4, { body: 76, chest: -30, head: 40, uncoil: 1, tail: -70, curl: 20, whip: 20 }], [DOWN_DAMAGE_FRAMES, { body: 82, chest: -10, head: 20, uncoil: 1, tail: -82 }]]);
add("getUp", 30, 18, [[0, { body: 82, chest: -10, head: 20, uncoil: 1, tail: -82 }], [10, { body: 50, lean: 10, uncoil: 1, tail: -40, curl: 25 }], [18, { lean: 30, chest: 15, uncoil: 0.6, curl: 20 }], [30, {}]]);
add("spotDodge", 22, 4, [[0, {}], [4, { lean: 50, chest: 30, waist: 20, head: -20, uncoil: 0, curl: 36, curlYaw: 20, tail: 6 }], [16, { lean: 50, chest: 30, waist: 20, head: -20, uncoil: 0, curl: 36, curlYaw: 20, tail: 6 }], [22, {}]]);
add("tech", 26, 8, [[0, { body: 60, uncoil: 1, tail: -60 }], [8, { lean: 40, chest: 25, uncoil: 0.4, curl: 30 }], [26, {}]]);
add("damageGround", 24, 3, [[0, {}], [3, { lean: -25, chest: -30, head: -30, uncoil: 0.8, tail: 30, whip: 15 }], [24, {}]]);
add("damageAir", 24, 3, [[0, airRest], [3, { lean: -30, chest: -35, head: -30, uncoil: 1, tail: -10, curl: 15, whip: 20 }], [24, airRest]], { air: true });
add("damageTumble", 30, 9, wave(30, 6, p => ({ spin: 0, body: 360 * p, chest: -20, head: 25, uncoil: 1, tail: -30, curl: 25 * Math.sin(2 * Math.PI * p), curlYaw: 20 }))
  .map(([f, g]) => [f, { ...g, body: (g.body ?? 0) > 180 ? (g.body ?? 0) - 360 : g.body }] as const), { air: true });
add("damageShield", 24, 3, [[0, { ...brace, curl: 30, uncoil: 0.1 }], [3, { lean: -5, chest: 8, head: -4, uncoil: 0.2, curl: 34, curlYaw: 26, tail: 18 }], [24, { ...brace, curl: 30, uncoil: 0.1 }]]);
add("grabHold", 30, 1, hold(30, { lean: 22, chest: 18, uncoil: 1, tailYaw: 178, tail: 14, curl: -2, whip: 55 }, 3), { loop: true, reach: [0, 8, 15, 23, 30].flatMap(f => reachAll([f], "upperR", [55, -20, 85])) });
add("grabbed", 30, 1, hold(30, { lean: -20, chest: -35, waist: 20, head: 30, uncoil: 0.7, tail: 30, curl: 20 }, 6), { loop: true, reach: [0, 8, 15, 23, 30].flatMap(f => reachAll([f], "upperR", [20, -30, 160]).concat(reachAll([f], "upperL", [20, 30, 160]))) });
}

function authorThrows(hero: Hero, add: Add): void {
{ const { contact: c, total: t } = throwTiming(hero, "pummel"); add("pummel", t, c, [[0, { lean: 22, chest: 18, uncoil: 1, tailYaw: 178, tail: 14, whip: 55 }], [c - 3, { lean: 16, chest: 10, uncoil: 1, tailYaw: 178, tail: 18, whip: 45, curl: -6 }], [c, { lean: 32, chest: 30, head: -18, uncoil: 1, tailYaw: 178, tail: 10, curl: 4, whip: 80 }], [c + 4, { lean: 30, chest: 26, uncoil: 1, tailYaw: 178, tail: 12, whip: 70 }], [t, { lean: 22, chest: 18, uncoil: 1, tailYaw: 178, tail: 14, whip: 55 }]]); }
{ const { contact: c, total: t } = throwTiming(hero, "throwForward"); add("throwForward", t, c, [[0, { lean: 22, chest: 18, uncoil: 1, tailYaw: 178, tail: 14, whip: 55 }], [c - 3, { lean: 10, chest: 4, uncoil: 1, tailYaw: 150, tail: 6, whip: 60, curl: 10 }], [c, { lean: 40, chest: 30, head: -20, uncoil: 1, tailYaw: 178, tail: 25, curl: -6, whip: -10 }], [c + 5, { lean: 38, chest: 28, uncoil: 1, tailYaw: 178, tail: 30, whip: -14 }], [t, {}]], { reach: reachAll([c, c + 5], "upperR", [80, -20, 115]) }); }
{ const { contact: c, total: t } = throwTiming(hero, "throwBack"); add("throwBack", t, c, [[0, { lean: 22, chest: 18, uncoil: 1, tailYaw: 178, tail: 14, whip: 55 }], [Math.round(c / 2), { yaw: 80, lean: 10, uncoil: 1, tailYaw: 90, tail: 25, whip: 40 }], [c, { yaw: 150, lean: -15, chest: -10, uncoil: 1, tailYaw: 0, tail: 30, curl: -6, whip: -10 }], [c + 5, { yaw: 160, lean: -15, chest: -10, uncoil: 1, tailYaw: -6, tail: 34, whip: -14 }], [t, {}]]); }
{ const { contact: c, total: t } = throwTiming(hero, "throwUp"); add("throwUp", t, c, [[0, { lean: 22, chest: 18, uncoil: 1, tailYaw: 178, tail: 14, whip: 55 }], [c - 3, { lean: 30, chest: 26, uncoil: 1, tailYaw: 178, tail: 4, whip: 60 }], [c, { tz: 16, lean: -20, chest: -28, head: -35, snakes: -60, uncoil: 1, tailYaw: 178, tail: 80, curl: 8, whip: -6 }], [c + 5, { tz: 18, lean: -22, chest: -30, head: -38, snakes: -60, uncoil: 1, tailYaw: 178, tail: 85 }], [t, {}]], { reach: reachAll([c, c + 5], "upperR", [25, -30, 200]).concat(reachAll([c, c + 5], "upperL", [25, 30, 200])) }); }
{ const { contact: c, total: t } = throwTiming(hero, "throwDown"); add("throwDown", t, c, [[0, { lean: 22, chest: 18, uncoil: 1, tailYaw: 178, tail: 14, whip: 55 }], [c - 4, { lean: 0, chest: -10, uncoil: 1, tailYaw: 178, tail: 40, whip: 50 }], [c, { lean: 55, chest: 35, head: -25, uncoil: 1, tailYaw: 178, tail: -4, curl: -2, whip: 10 }], [c + 5, { lean: 52, chest: 32, uncoil: 1, tailYaw: 178, tail: -4, whip: 0 }], [t, {}]], { reach: reachAll([c, c + 5], "upperR", [55, -20, 30]) }); }
}

function authorMotions(add: Add): void {
add("victimPummel", 24, 3, [[0, { lean: -20, chest: -35, waist: 20, head: 30, uncoil: 0.7, tail: 30, curl: 20 }], [3, { lean: -36, chest: -55, waist: 30, head: -40, uncoil: 0.9, tail: 55, curl: 34, whip: 28 }], [10, { lean: -30, chest: -48, waist: 26, head: -20, uncoil: 0.8, tail: 45, curl: 28, whip: 18 }], [24, { lean: -20, chest: -35, waist: 20, head: 30, uncoil: 0.7, tail: 30, curl: 20 }]]);
add("victimThrowForward", 30, 8, [[0, { lean: -20, chest: -35, head: 30, uncoil: 0.7, tail: 30 }], [8, { body: -30, chest: -35, waist: 15, head: 30, uncoil: 1, tail: 50, whip: 20 }], [30, { body: -50, chest: -30, uncoil: 1, tail: 60 }]], { air: true });
add("victimThrowBack", 30, 8, [[0, { lean: -20, chest: -35, head: 30, uncoil: 0.7, tail: 30 }], [8, { body: 30, chest: 35, waist: -15, head: -20, uncoil: 1, tail: -40, whip: -20 }], [30, { body: 50, chest: 30, uncoil: 1, tail: -50 }]], { air: true });
add("victimThrowUp", 30, 8, [[0, { lean: -20, chest: -35, head: 30, uncoil: 0.7, tail: 30 }], [8, { lean: -30, chest: -30, head: -30, uncoil: 1, tail: -85, curl: 4 }], [30, { lean: -20, chest: -20, uncoil: 1, tail: -70 }]], { air: true });
add("victimThrowDown", 30, 8, [[0, { lean: -20, chest: -35, head: 30, uncoil: 0.7, tail: 30 }], [8, { body: 70, chest: -20, head: 30, uncoil: 1, tail: -70, whip: 20 }], [30, { body: 82, chest: -10, head: 20, uncoil: 1, tail: -82 }]]);
for (const pose of ["rollForward", "techForward", "getUpRollForward", "ledgeRoll", "rollBackward", "techBackward", "getUpRollBackward"] as const) {
  const frames = pose.startsWith("tech") ? TECH_ROLL_FRAMES : pose.startsWith("getUp") ? DOWN_ROLL_FRAMES : pose === "ledgeRoll" ? LEDGE_ROLL_FRAMES : GROUND_ROLL_FRAMES, dir = pose.endsWith("Backward") ? -1 : 1;
  add(pose, frames, 10, wave(frames, 6, p => { const tuck = Math.sin(Math.PI * p); return { spin: dir * 359 * p, lean: dir * 45 * tuck, chest: 30 * tuck, waist: 20 * tuck, head: -20 * tuck, uncoil: 1 - 0.8 * tuck, curl: 30 * tuck, curlYaw: -dir * 25 * tuck, tail: 6 * tuck }; }));
}
const loop = (frames: number, lean: number, amp: number, steps = 6) => wave(frames, steps, p => ({ lean, chest: lean * 0.4, head: -lean * 0.3, uncoil: 1, tail: 4 + amp * 0.35 * Math.sin(2 * Math.PI * p), curl: amp * 0.25 * Math.sin(2 * Math.PI * p + 1.6), curlYaw: amp * Math.sin(2 * Math.PI * p + 0.8), tailYaw: amp * 0.6 * Math.sin(2 * Math.PI * p) }));
add("run", 30, 0, loop(30, 30, 24), { loop: true });
}

const VICTORY = "victory" as HeroPose, regal: Gesture = { lean: -6, chest: -12, head: -14, snakes: -45, uncoil: 0.9, tail: 24, curl: 16, curlYaw: 18, whip: 12 };

function authorSpecials(hero: Hero, add: Add): void {
for (const [pose, key] of [["neutralSpecial", "neutral"], ["sideSpecial", "side"], ["upSpecial", "up"], ["downSpecial", "down"]] as const) for (const air of [false, true]) {
  const { contact: c, total: t } = specialTiming(hero, key, air), name = (air ? `${pose}Air` : pose) as HeroPose, rest: Gesture = air ? airRest : {};
  if (key === "neutral") add(name, t, c, [[0, rest], [c, { ...rest, uncoil: 1 }], [t, rest]], { air, donor: { sequence: 3, release: 0.68 } });
  if (key === "side") { const wind: Gesture = { ...rest, lean: -12, chest: -14, yaw: 35, head: 6, uncoil: 0.8, tail: 20, curl: 10 }, fling: Gesture = { ...rest, tx: 24, lean: 30, chest: 24, yaw: -25, head: -12, uncoil: 1, tail: 10, whip: 8 };
    add(name, t, c, [[0, rest], [Math.round(c / 2), wind], [c - 2, { ...wind, yaw: 40, chest: -18 }], [c, fling], [c + 6, { ...fling, tx: 28, lean: 32, chest: 26, yaw: -28 }], [Math.round(c + (t - c) * 0.6), { ...brace, ...rest }], [t, rest]],
      { air, reach: [...[Math.round(c / 2), c - 2].flatMap(f => reachAll([f], "upperR", [-50, -25, 100]).concat(reachAll([f], "upperL", [-50, 25, 100]))), ...reachAll([c], "upperR", [100, -15, 68]), ...reachAll([c], "upperL", [100, 15, 68]), ...reachAll([c + 6], "upperR", [105, -15, 55]), ...reachAll([c + 6], "upperL", [105, 15, 55])] }); }
  if (key === "up") add(name, t, c, [[0, { ...rest, lean: 30, chest: 20, uncoil: 0.2, curl: 30 }], [c - 3, { lean: 40, chest: 25, uncoil: 0.1, curl: 36, tail: 6 }], [c, { tz: 20, lean: -10, chest: -20, head: -30, snakes: -40, uncoil: 1, tail: -88, curl: 0 }], [Math.min(t - 2, c + 7), { tz: 24, lean: -12, chest: -22, head: -30, snakes: -40, uncoil: 1, tail: -86, curlYaw: 15 }], [t, { lean: 30, chest: 40, head: 20, uncoil: 1, tail: -70 }]],
    { air: true, reach: reachAll([c, Math.min(t - 2, c + 7)], "upperR", [15, -30, 200]).concat(reachAll([c, Math.min(t - 2, c + 7)], "upperL", [15, 30, 200])) });
  if (key === "down") { const cast: Gesture = { ...rest, lean: -6, chest: -14, head: -18, snakes: -40, uncoil: 0.5, curl: 26, curlYaw: 20 }, hold = Math.min(t - 1, c + 4), spread = (f: number) => [...reachAll([f], "upperR", [40, -35, 130]), ...reachAll([f], "upperL", [-45, 35, 135]), ...reachAll([f], "bow", [60, 25, 95]), ...reachAll([f], "draw", [-55, -25, 90])];
    add(name, t, c, [[0, rest], [Math.max(1, c - 3), { ...rest, lean: 14, chest: 18, head: -10, uncoil: 0.3, curl: 20, curlYaw: 10 }], [c, cast], [hold, cast], [t, rest]],
      { air, reach: [...reachAll([Math.max(1, c - 3)], "upperR", [30, -5, 105]), ...reachAll([Math.max(1, c - 3)], "upperL", [30, 5, 105]), ...spread(c), ...spread(hold)] }); }
}
add("ultimate", 70, 20, [[0, {}], [8, { lean: 10, chest: 15, head: 15, snakes: 20, uncoil: 0.6, curl: 20, curlYaw: 20 }], [20, { tz: 12, lean: -8, chest: -14, head: -10, snakes: -75, uncoil: 0.9, tail: 30, curl: 14, whip: 20 }], [60, { tz: 12, lean: -6, chest: -12, head: -12, snakes: -80, uncoil: 0.9, tail: 32, curl: 16, whip: 24 }], [70, {}]],
  { reach: [...reachAll([20, 60], "upperR", [40, -60, 165]), ...reachAll([20, 60], "upperL", [40, 60, 165]), ...reachAll([20, 60], "draw", [30, -45, 95])] });
add(VICTORY, 90, 24, [[0, {}], [12, { lean: 8, chest: 10, head: 10, snakes: 10, uncoil: 0.6, curl: 14, curlYaw: 8 }], [24, regal], [60, { ...regal, head: -10, curlYaw: 24, whip: 16 }], [90, regal]],
  { reach: [24, 60, 90].flatMap(f => [...reachAll([f], "upperL", [-10, 45, 95]), ...reachAll([f], "bow", [35, 30, 80])]) });
}

function authoredActions(hero: Hero): Action[] {
  const actions: Action[] = [];
  const add: Add = (pose, frames, contact, keys, extra = {}) => { actions.push({ pose, frames, contact, keys: dedupe(keys), ...extra }); };
  authorNormals(hero, add); authorStates(add); authorThrows(hero, add); authorMotions(add); authorSpecials(hero, add);
  return actions;
}

function damageActions(): Action[] {
  const damage: Action[] = [];
for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
  const k = [0.45, 0.8, 1.2][strength]!;
  const pain: Gesture = height === 0 ? { body: -14 * k, lean: -30 * k, chest: 20 * k, head: 15 * k, uncoil: 1, tail: 45 * k, curl: 15 * k, whip: 25 * k, curlYaw: 20 * k }
    : height === 1 ? { lean: 30 * k, waist: 25 * k, chest: 45 * k, yaw: -25 * k, head: 10 * k, uncoil: 0.4, curl: 35 * k, curlYaw: 25 * k, tail: 10 * k }
    : { lean: -35 * k, chest: -40 * k, head: -45 * k, snakes: -40 * k, uncoil: 0.8, tail: 25 * k, whip: -15 * k };
  const arms: Reach[] = height === 2 ? [{ frame: 3, chain: "upperR", target: [-20 - 25 * k, -45, 150 + 20 * k] }, { frame: 3, chain: "upperL", target: [-15 - 25 * k, 45, 145 + 20 * k] }]
    : height === 1 ? [{ frame: 3, chain: "upperR", target: [35, -15, 70] }, { frame: 3, chain: "upperL", target: [35, 15, 70] }] : [{ frame: 3, chain: "upperR", target: [-10, -55, 140] }];
  damage.push({ pose: "damageGround", frames: 24, contact: 3, keys: [[0, pain], [3, pain], [24, pain]], reach: arms });
}
  return damage;
}

const rotate = (q: ArrayLike<number>, y: number, z = 0) => { const a = y * Math.PI / 360, b = z * Math.PI / 360, u = [-Math.sin(a) * Math.sin(b), Math.sin(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.cos(a) * Math.cos(b)], [x = 0, v = 0, w = 0, t = 1] = Array.from(q), [i = 0, j = 0, k = 0, l = 1] = u; return new Float32Array([l * x + i * t + j * w - k * v, l * v - i * w + j * t + k * x, l * w + i * v - j * x + k * t, l * t - i * x - j * v - k * w]); };
function power(q: ArrayLike<number>, amount: number) {
  const a = Array.from(q), sign = (a[3] ?? 1) < 0 ? -1 : 1, w = Math.min(1, Math.max(-1, (a[3] ?? 1) * sign)), angle = Math.acos(w), gain = Math.abs(Math.sin(angle)) < 0.00001 ? amount : Math.sin(angle * amount) / Math.sin(angle);
  return new Float32Array([(a[0] ?? 0) * sign * gain, (a[1] ?? 0) * sign * gain, (a[2] ?? 0) * sign * gain, Math.cos(angle * amount)]);
}
function jointRotation(name: string, base: ArrayLike<number>, g: Gesture): Float32Array | undefined {
  const tail = TAIL.indexOf(name);
  if (tail >= 0) { const relaxed = power(base, 1 - (g.uncoil ?? 0)); return tail === 0 ? rotate(relaxed, g.tail ?? 0, g.tailYaw ?? 0) : rotate(relaxed, (g.curl ?? 0) + (tail >= 3 ? g.whip ?? 0 : 0), g.curlYaw ?? 0); }
  if (SNAKES.includes(name)) return rotate(base, g.snakes ?? 0);
  if (name === "Bone_Root") return rotate(base, g.body ?? 0, g.spin ?? 0);
  if (name === "Bone_Torso_01") return rotate(base, g.lean ?? 0);
  if (name === "Bone_Torso_03") return rotate(base, g.waist ?? 0);
  if (name === "Bone_Chest") return rotate(base, g.chest ?? 0, g.yaw ?? 0);
  if (name === "Bone_Head") return rotate(base, g.head ?? 0);
  return undefined;
}

const nodeAt = (model: mdx.Model, path: string) => { const m = /^\.(Bones|Helpers)\.(\d+)\.(Rotation|Translation|Scaling)$/.exec(path); return m ? { node: model[m[1] as "Bones" | "Helpers"][Number(m[2])]!, kind: m[3]! } : undefined; };
const node = (model: mdx.Model, name: string) => { const n = model.Nodes.find(n => n?.Name === name); ensure(n, `no ${name}`); return n; };

function aim(model: mdx.Model, index: number, start: number, frame: number, chain: Chain, target: Point) {
  const renderer = new ModelRenderer(model), data = Reflect.get(renderer, "rendererData"); renderer.setSequence(index); data.frame = start + ms(frame);
  const [arm, elbow, hand] = CHAINS[chain].map(name => node(model, name)) as [mdx.Node, mdx.Node, mdx.Node];
  const key = (n: mdx.Node) => { const k = n.Rotation!.Keys.find(k => k.Frame === start + ms(frame)); ensure(k, `${n.Name}: no key at ${frame}`); return k; };
  const set = (n: mdx.Node, q: Float32Array) => { const k = key(n); k.Vector = q; if (k.InTan) { k.InTan = q.slice(); k.OutTan = q.slice(); } };
  const point = (n: mdx.Node): Point => { const p = model.PivotPoints[n.ObjectId]!, m = data.nodes[n.ObjectId].matrix; return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; };
  const armBase = key(arm).Vector.slice(), elbowBase = key(elbow).Vector.slice(), angles = [0, 0, 0, 0];
  const loss = () => { set(arm, rotate(armBase, angles[0]!, angles[1]!)); set(elbow, rotate(elbowBase, angles[2]!, angles[3]!)); renderer.update(0); const p = point(hand); return p.reduce((sum, v, i) => sum + (v - target[i]!) ** 2, 0); };
  for (const step of [30, 10, 3, 1]) for (let pass = 0; pass < 2; pass++) for (let dim = 0; dim < 4; dim++) { const origin = angles[dim]!, range = step === 30 ? 180 : step * 3; let best = loss(), angle = origin; for (let delta = -range; delta <= range; delta += step) { angles[dim] = origin + delta; const score = loss(); if (score < best) { best = score; angle = angles[dim]!; } } angles[dim] = angle; }
  loss();
}

function bakeTracks({ model, originals, stand }: Bake, action: Action, start: number, end: number, donor: mdx.Sequence | undefined): void {
  tracks(model, (track, path) => {
    const original = originals.get(path); if (!original || onGlobalClock(original)) return;
    if (donor && action.donor) {
      const [d0, d1] = [donor.Interval[0]!, donor.Interval[1]!], release = d0 + (d1 - d0) * action.donor.release, c = ms(action.contact), t = end - start;
      const map = (f: number) => start + Math.round(f <= release ? (f - d0) / (release - d0) * c : c + (f - release) / (d1 - release) * (t - c));
      const keys = original.Keys.filter(k => k.Frame >= d0 && k.Frame <= d1);
      if (keys.length > 0) { for (const k of keys) track.Keys.push({ ...structuredClone(k), Frame: map(k.Frame) }); return; }
    }
    const at = nodeAt(model, path), rest = at ? new Float32Array(at.kind === "Rotation" ? [0, 0, 0, 1] : at.kind === "Scaling" ? [1, 1, 1] : [0, 0, 0]) : undefined;
    const first = original.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]) ?? (rest ? { Frame: stand.Interval[0]!, Vector: rest, ...track.LineType > 1 ? { InTan: rest.slice(), OutTan: rest.slice() } : {} } : undefined); if (!first) return;
    for (const [frame, g] of action.keys) {
      const Vector = at?.kind === "Rotation" ? jointRotation(at.node.Name, first.Vector, g) ?? first.Vector.slice() : first.Vector.slice();
      const tangent = () => at?.kind === "Rotation" || track.LineType === mdx.LineType.Bezier ? Vector.slice() : new Float32Array(Vector.length);
      track.Keys.push({ ...first, Frame: start + ms(frame), Vector, ...first.InTan ? { InTan: tangent(), OutTan: tangent() } : {} });
    }
  });
  tracks(model, track => track.Keys.sort((a, b) => a.Frame - b.Frame));
}

function groundRoot({ model, rootNode, hangHands }: Bake, action: Action, name: string, index: number, start: number): void {
    const drawn = new DrawnModel(generateMDX(model), 1), translation = rootNode.Translation!;
    for (const [frame, g] of action.keys) {
      const key = translation.Keys.find(k => k.Frame === start + ms(frame)); ensure(key, `${name}: no root key at ${frame}`);
      if (action.pose === "ledgeHang") { const [x, z] = ledgeGripOffset(drawn, index, frame / 60, highestGrip(drawn, index, frame / 60, hangHands), Character.ladyVashj); key.Vector = new Float32Array([key.Vector[0]! + x - 8, key.Vector[1]!, key.Vector[2]! + z]); continue; }
      let lowest = Infinity; const triangles = drawn.triangles(index, frame / 60, 1); for (let i = 1; i < triangles.length; i += 2) lowest = Math.min(lowest, triangles[i]!);
      key.Vector = new Float32Array([key.Vector[0]! + (g.tx ?? 0), key.Vector[1]!, key.Vector[2]! + (action.air ? g.tz ?? 0 : (g.tz ?? 0) - lowest)]);
    }
}

function bakeAction(b: Bake, action: Action, ordinal: number): void {
  const { model, source, stand } = b;
  const isDamage = ordinal >= b.authored, name = isDamage ? `Lady Vashj Damage ${Math.floor((ordinal - b.authored) / 3)} ${(ordinal - b.authored) % 3}` : `Lady Vashj ${action.pose}`;
  const index = model.Sequences.length, start = b.cursor, end = start + ms(action.frames); b.cursor = end + 100;
  model.Sequences.push({ ...stand, Name: name, Interval: new Uint32Array([start, end]), NonLooping: !action.loop, MoveSpeed: 0, Rarity: 0, MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
  const donor = action.donor ? source.Sequences[action.donor.sequence]! : undefined;
  bakeTracks(b, action, start, end, donor);
  if (!donor) for (const reach of action.reach ?? []) aim(model, index, start, reach.frame, reach.chain, reach.target);
  if (!donor) groundRoot(b, action, name, index, start);
  const victim = /^victim(Pummel|Throw)/.test(action.pose), paired = /^(pummel|throw|victimPummel|victimThrow)/.test(action.pose) ? `, contact: ${seconds(victim ? 0.5 : action.contact / 60)}` : "";
  const clipSeconds = action.loop ? seconds(action.frames / 60) : seconds(victim ? 1 : (end - start) / 1000);
  const binding = `{ index: ${index}, seconds: ${clipSeconds}, aligned: true${paired} }`;
  if (isDamage) b.damageBindings.push(`  ${binding},`); else if (action.pose !== VICTORY) b.bindings.push(`  ${action.pose}: ${binding},`);
  b.records.push({ pose: name, index, frames: victim ? 60 : action.frames, contact: victim ? 30 : action.contact });
}

function retimeVictims(b: Bake, actions: readonly Action[]): void {
  const { model, source } = b;
for (const [ordinal, action] of actions.entries()) if (/^victim(Pummel|Throw)/.test(action.pose)) {
  const sequence = model.Sequences[source.Sequences.length + ordinal]!, [first, last] = sequence.Interval, contact = first! + ms(action.contact), start = b.cursor; b.cursor = start + 1100;
  tracks(model, track => { if (onGlobalClock(track)) return; for (const key of track.Keys) if (key.Frame >= first! && key.Frame <= last!) key.Frame = start + (key.Frame <= contact ? Math.round((key.Frame - first!) / (contact - first!) * 500) : 500 + Math.round((key.Frame - contact) / (last! - contact) * 500)); track.Keys.sort((a, b) => a.Frame - b.Frame); });
  sequence.Interval = new Uint32Array([start, start + 1000]);
}
}

async function writeClips(project: string, bindings: readonly string[], damageBindings: readonly string[]): Promise<void> {
const runBinding = bindings.find(b => b.startsWith("  run:"))!.replace(/^  run: /, "").replace(/,$/, "");
await Bun.write(join(project, "ts/src/game/fighters/lady-vashj/clips.ts"), [
  "// Generated by tools/animations/lady-vashj-clips.ts from the stock classic Lady Vashj rig.", 'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClip, HeroClipTable } from "../../sim/heroes/hero";',
  'export const LADY_VASHJ_MODEL_FILE = ' + JSON.stringify("units\\naga\\LadyVashj\\LadyVashj.mdl") + ';',
  'export const LADY_VASHJ_FALLBACK: HeroClip = { index: 0, seconds: f32(2.667) };',
  `export const LADY_VASHJ_CLIPS = { idle: LADY_VASHJ_FALLBACK, walk: { index: 1, seconds: 2.0 }, dash: ${runBinding}, ko: { index: 4, seconds: 1.5 },`, ...bindings, '} as const satisfies HeroClipTable;',
  'export const LADY_VASHJ_DAMAGE_CLIPS: readonly HeroClip[] = [', ...damageBindings, '];', "",
].join("\n"));
}

const groups: Record<string, string[]> = {
  ground: ["jab", "jab2", "forwardTilt", "forwardTiltUp", "forwardTiltDown", "upTilt", "downTilt", "dashAttack"], smash: ["forwardSmash", "upSmash", "downSmash", "smashCharge", "getUpAttack", "ledgeAttack"],
  air: ["neutralAir", "forwardAir", "backAir", "upAir", "downAir"], grab: ["grab", "grabHold", "pummel", "throwForward", "throwBack", "throwUp", "throwDown", "grabbed"],
  victim: ["victimPummel", "victimThrowForward", "victimThrowBack", "victimThrowUp", "victimThrowDown"], special: ["neutralSpecial", "sideSpecial", "upSpecial", "downSpecial", "ultimate", "neutralSpecialAir", "sideSpecialAir", "upSpecialAir", "downSpecialAir"],
  movement: ["run", "crouch", "landing", "jumpSquat", "jump", "doubleJump", "wallJump", "wallTech", "fall", "fallSpecial", "turn", "stop"],
  defence: ["shield", "damageShield", "spotDodge", "airDodge", "rollForward", "rollBackward", "techForward", "techBackward", "tech", "dizzy"],
  recovery: ["ledgeHang", "ledgeClimb", "ledgeRoll", "knockdown", "downDamage", "getUp", "getUpRollForward", "getUpRollBackward", "damageGround", "damageAir", "damageTumble"],
  victory: ["victory"],
};

async function writeSheets(output: string, finalDrawn: DrawnModel, actions: readonly Action[], damage: readonly Action[], records: Bake["records"]): Promise<string[]> {
const sheets = join(output, "sheets"); mkdirSync(sheets, { recursive: true });
const panelsOf = (i: number, facing: number): PoseFrame[] => { const action = i < actions.length ? actions[i]! : damage[i - actions.length]!, frames = [...new Set([0, ...(action.donor ? [0.3, 0.6, 0.8].map(p => Math.round(action.frames * p)) : []), ...action.keys.map(([f]) => f).filter(f => f > 0 && f < action.frames), action.frames])].sort((a, b) => a - b).slice(0, 6); while (frames.length < 6) frames.push(action.frames);
  return frames.map(frame => ({ frame, phase: frame < action.contact ? AttackPhase.startup : frame <= action.contact + 4 ? AttackPhase.active : AttackPhase.recovery, x: 0, z: 0, facing, parts: [], strikes: [], clip: records[i]!.index, seconds: (records[i]!.frames === 60 ? frame / action.frames : frame / 60) })); };
const written: string[] = [];
for (const [group, poses] of Object.entries(groups)) for (const facing of [1, -1]) {
  const panels = poses.flatMap(pose => { const i = actions.findIndex(a => a.pose === pose); ensure(i >= 0, `${pose}: not authored`); return panelsOf(i, facing); });
  const file = join(sheets, `${group}-${facing > 0 ? "right" : "left"}.png`); await Bun.write(file, sheet(`Lady Vashj ${group}`, finalDrawn, panels, 6).png); written.push(file);
}
for (const facing of [1, -1]) { const file = join(sheets, `pain-${facing > 0 ? "right" : "left"}.png`); await Bun.write(file, sheet("Lady Vashj pain", finalDrawn, damage.flatMap((_, d) => panelsOf(actions.length + d, facing).slice(0, 2)), 6).png); written.push(file); }
  return written;
}

async function generate(): Promise<void> {
const args = process.argv.slice(2), [input, output] = args.slice(0, 2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/lady-vashj-clips.ts STOCK_LADY_VASHJ.mdx PRIVATE_OUTPUT");
const source = parseSource(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
ensure(source.Sequences.length === 14 && source.Bones.some(b => b.Name === "Bone_Tail_05") && source.Bones.some(b => b.Name === "Bow"), "Expected the original classic Lady Vashj");
const stand = source.Sequences[0]!;
const hero = heroDefinition(Character.ladyVashj);
const actions = authoredActions(hero), damage = damageActions();
const rootNode = model.Nodes.find(n => n?.Name === "Bone_Root"); ensure(rootNode, "No Lady Vashj root");
const stockKeys = (zero: number[]) => source.Sequences.flatMap(s => Array.from(s.Interval).map(Frame => ({ Frame, Vector: new Float32Array(zero) })));
if (!rootNode.Rotation) rootNode.Rotation = { LineType: 1, GlobalSeqId: NO_GLOBAL_SEQ, Keys: stockKeys([0, 0, 0, 1]) };
const originals = new Map<string, mdx.AnimVector>(); tracks(model, (t, p) => originals.set(p, structuredClone(t)));
const b: Bake = { model, source, stand, originals, rootNode, hangHands: ["Bone_ArmHand1_Left", "Bone_ArmHand1_Right"].map(name => model.Nodes.findIndex(n => n?.Name === name)),
  bindings: [], damageBindings: [], records: [], authored: actions.length, cursor: Math.max(...source.Sequences.map(s => s.Interval[1])) + 100 };
for (const [ordinal, action] of [...actions, ...damage].entries()) bakeAction(b, action, ordinal);
retimeVictims(b, actions);
const bytes = encodeVerified(parseSource(generateMDX(model))); mkdirSync(output, { recursive: true }); await Bun.write(join(output, "ladyvashj.mdx"), bytes);
await writeClips(project, b.bindings, b.damageBindings);
const finalDrawn = new DrawnModel(bytes, 1), beforeDrawn = new DrawnModel(generateMDX(source), 1);
for (const [index, sequence] of source.Sequences.entries()) for (const phase of [0, 0.5, 1]) { const time = (sequence.Interval[1] - sequence.Interval[0]) * phase / 1000, before = beforeDrawn.triangles(index, time, 1), after = finalDrawn.triangles(index, time, 1); ensure(before.length === after.length && before.every((v, i) => Math.abs(v - after[i]!) < 0.001), `stock clip ${index} changed`); }
const written = await writeSheets(output, finalDrawn, actions, damage, b.records);
await Bun.write(join(output, "lady-vashj-clips.json"), JSON.stringify({ stockSequences: source.Sequences.length, appended: b.records.length, kitTiming: hero !== undefined, records: b.records, sheets: written }, null, 2) + "\n");
console.log(`LADY_VASHJ_CLIPS_PASS ${b.records.length} authored clips; ${source.Sequences.length} stock sequences retained; kit timing ${hero ? "from the registered kit" : "from roster-next.md"}; private output ${output}`);
}

BunRuntime.runMain(Effect.tryPromise({ try: generate, catch: cause => new ClipFailure({ cause }) }));
