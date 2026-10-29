import { BunRuntime } from "../../ts/node_modules/@effect/platform-bun/dist/index.js";
import { Effect, Schema } from "effect";
import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, AttackStyle, Character } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/roster/kits";
import type { HeroDefinition, HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { FIGHTER_ULTIMATES } from "../../ts/src/game/sim/ultimates";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, rotated, tracks } from "./original-clips";
class ClipFailure extends Schema.TaggedError<ClipFailure>()("ClipFailure", { cause: Schema.Unknown }) {}

type Point = readonly [number, number, number];
interface Gesture {
  tx?: number; tz?: number; body?: number; spin?: number; hips?: number; chest?: number; twist?: number; head?: number;
  legF?: number; legB?: number; kneeF?: number; kneeB?: number; wristR?: number; wristL?: number;
}
type Chain = "cleaver" | "hook";
interface Reach { frame: number; chain: Chain; target: Point; }
type Keys = (readonly [number, Gesture])[];
interface Action { pose: HeroPose; frames: number; contact: number; keys: Keys; reach: Reach[]; air?: boolean; loop?: boolean; }

const CHAINS: Record<Chain, readonly [string, string, string]> = {
  cleaver: ["Bone_Arm1_R", "Bone_Arm2_R", "Bone_Hand_R"],
  hook: ["Bone_Arm1_L", "Bone_Arm2_L", "Bone_Hand_L"],
};
const ms = (frame: number) => Math.round(frame * 1000 / 60);

const blend = (from: Gesture, to: Gesture, k: number): Gesture => Object.fromEntries([...new Set([...Object.keys(from), ...Object.keys(to)])]
  .map(name => [name, ((from as Record<string, number>)[name] ?? 0) * (1 - k) + ((to as Record<string, number>)[name] ?? 0) * k]));
const settle = (start: number, end: number, from: Gesture, steps = 3): Keys =>
  Array.from({ length: steps }, (_, i) => { const r = (i + 1) / (steps + 1); return [Math.round(start + (end - start) * r), blend(from, {}, r)] as const; }).filter(([f]) => f > start && f < end);
const dedupe = (keys: Keys) => keys.filter(([frame], i) => keys.findIndex(([other]) => other === frame) === i).sort((a, b) => a[0] - b[0]);
const at = (chain: Chain, target: Point, ...frames: number[]): Reach[] => frames.map(frame => ({ frame, chain, target }));
const both = (target: Point, ...frames: number[]): Reach[] => [...at("cleaver", [target[0], -Math.abs(target[1]), target[2]], ...frames), ...at("hook", [target[0], Math.abs(target[1]), target[2]], ...frames)];

const crouched: Gesture = { hips: 18, chest: 30, legF: -40, legB: 30, kneeF: 70, kneeB: 60, tz: -12 };
const reared: Gesture = { chest: -24, head: -16, legF: -18, legB: 12 };
const tucked: Gesture = { legF: -55, legB: -35, kneeF: 90, kneeB: 80 };
const HOOK_SPIN_FRAMES = 20;

function timing(hero: HeroDefinition, style: AttackStyle): { c: number; a: number; t: number } {
  const move = hero.moves.normals[style]; ensure(move, `butcher: no attack style ${style}`);
  return { c: move.startupFrames, a: move.activeFrames, t: move.totalFrames };
}
function specialTiming(hero: HeroDefinition, key: "neutral" | "side", air: boolean, followUp?: number): { c: number; t: number } {
  const move = hero.specials?.[key]; ensure(move, `butcher: no ${key} special`);
  const root = air ? move.air ?? move.ground : move.ground;
  const form = followUp === undefined ? root : root.followUps?.[followUp]?.special; ensure(form, `butcher: no ${key} follow-up ${followUp}`);
  const contact = Math.min(...[...(form.regions?.map(r => r.firstFrame) ?? []), ...(form.motion?.filter(m => m.velocityX > 0).map(m => m.first) ?? []), ...(form.projectiles?.map(p => p.spawnFrame) ?? []), form.endFrame]);
  return { c: contact, t: form.endFrame };
}

function authoredActions(hero: HeroDefinition): Action[] {
  const actions: Action[] = [];
  const add = (pose: HeroPose, frames: number, contact: number, keys: Keys, reach: Reach[], extra: Partial<Action> = {}) => actions.push({ pose, frames, contact, keys: dedupe(keys), reach, ...extra });

  { const { c, a, t } = timing(hero, AttackStyle.upTilt), wind = Math.max(1, c - 4), end = Math.min(t - 3, c + a + 6), tall: Gesture = { ...reared, chest: -34, head: -30, legF: -6, legB: 4, tz: 10, wristR: -60 };
    add("upTilt", t, c, [[0, {}], [wind, { ...crouched, chest: 30, wristR: 40 }], [c, tall], [c + a, { ...tall, chest: -38 }], [end, { ...tall, chest: -36, tz: 6 }], ...settle(end, t, tall), [t, {}]],
      [...at("cleaver", [90, -40, 30], 0, wind), ...at("cleaver", [45, -35, 245], c), ...at("cleaver", [10, -35, 265], c + a, end), ...at("hook", [40, 55, 70], 0, wind), ...at("hook", [30, 50, 150], c, c + a, end)]); }

  { const { c, a, t } = timing(hero, AttackStyle.upSmash), hit = c - 1, wind = Math.max(1, hit - 8), set = hit - 3, top = c + 2, end = Math.min(t - 3, c + a + 8), high: Gesture = { ...reared, chest: -40, head: -40, legF: 4, legB: -4, kneeF: 0, kneeB: 0, tz: 24 };
    add("upSmash", t, c, [[0, {}], [wind, { ...crouched, chest: 44, hips: 28, kneeF: 100, kneeB: 90, tz: -24 }], [set, { ...crouched, chest: 46, hips: 30, kneeF: 105, kneeB: 95, tz: -26 }], [hit, high], [top, { ...high, tz: 30 }], [c + a, { ...high, chest: -46, tz: 30 }], [end, { ...high, tz: 12 }], ...settle(end, t, high), [t, {}]],
      [...both([60, 35, 15], wind, set), ...both([40, 30, 280], hit), ...both([0, 25, 305], top), ...both([-40, 25, 285], c + a), ...both([-50, 25, 255], end)]); }

  { const { c, a, t } = timing(hero, AttackStyle.backAir), hit = c - 1, wind = Math.max(1, hit - 5), end = Math.min(t - 2, c + a + 5), coiled: Gesture = { ...tucked, twist: 40, chest: 24, head: -14 }, lashed: Gesture = { body: 45, chest: 10, twist: -45, head: -60, legF: 80, legB: 95, kneeF: 0, kneeB: 0 };
    add("backAir", t, c, [[0, tucked], [wind, coiled], [hit, lashed], [c + a, { ...lashed, legB: 75 }], [end, { ...lashed, legB: 60 }], ...settle(end, t, lashed), [t, tucked]],
      [...at("cleaver", [115, -45, 135], wind), ...at("cleaver", [-130, -45, 130], hit), ...at("cleaver", [-140, -40, 125], c + a), ...at("cleaver", [-110, -40, 110], end), ...at("hook", [95, 50, 115], wind), ...at("hook", [35, 50, 95], hit, c + a, end)], { air: true }); }

  { const { c, a, t } = timing(hero, AttackStyle.forwardSmash), raise = Math.max(1, c - 10), top = c - 3, end = Math.min(t - 3, c + a + 4);
    const windup: Gesture = { ...reared, chest: -30, legF: -30, legB: 22, kneeF: 20, wristR: 60 }, chop: Gesture = { chest: 48, hips: 14, head: 10, legF: -42, legB: 32, kneeF: 40, kneeB: 20, tz: -8, wristR: -30 };
    add("forwardSmash", t, c, [[0, {}], [raise, windup], [top, { ...windup, chest: -36 }], [c, chop], [c + a, { ...chop, chest: 54 }], [end, { ...chop, chest: 56 }], ...settle(end, t, chop), [t, {}]],
      [...at("cleaver", [-45, -35, 235], raise, top), ...at("cleaver", [125, -35, 95], c), ...at("cleaver", [125, -35, 35], c + a), ...at("cleaver", [100, -35, 15], end), ...at("hook", [80, 50, 120], raise, top), ...at("hook", [40, 55, 70], c, c + a, end)]);
    add("smashCharge", 30, 8, [[0, windup], [15, { ...windup, chest: -34 }], [30, windup]], [...at("cleaver", [-45, -35, 235], 0, 15, 30), ...at("hook", [80, 50, 120], 0, 15, 30)], { loop: true }); }

  { const { c, a, t } = timing(hero, AttackStyle.downSmash), back = c + 2, end = Math.min(t - 2, back + a + 2), low: Gesture = { ...crouched, chest: 42, hips: 24, kneeF: 85, kneeB: 75, tz: -20 };
    const hit = c - 1, gather = Math.max(1, hit - 5), spread: Gesture = { ...low, chest: 30, legF: -55, legB: 50, kneeF: 70, kneeB: 60 };
    add("downSmash", t, c, [[0, {}], [gather, { ...low, chest: 20 }], [hit, { ...spread, twist: 15 }], [back, { ...spread, twist: -20 }], [end, { ...spread, twist: -15 }], ...settle(end, t, spread), [t, {}]],
      [...at("cleaver", [30, -50, 170], gather), ...at("hook", [-20, 50, 170], gather), ...at("cleaver", [160, -35, 12], hit, back, end), ...at("hook", [-160, 35, 12], hit, back, end)]); }

  { const { c, a, t } = timing(hero, AttackStyle.neutralAir), wind = Math.max(1, c - 3), end = c + a;
    const spun = (spin: number): Gesture => ({ ...tucked, spin, chest: 6 });
    add("neutralAir", t, c, [[0, tucked], [wind, { ...tucked, chest: 20 }], [c, spun(0)], [Math.round(c + a / 3), spun(120)], [Math.round(c + 2 * a / 3), spun(240)], [end, spun(355)], ...settle(end, t, tucked), [t, tucked]],
      [...both([20, 40, 90], 0, wind), ...at("cleaver", [115, -35, 75], c, Math.round(c + a / 3), Math.round(c + 2 * a / 3), end), ...at("hook", [-115, 35, 75], c, Math.round(c + a / 3), Math.round(c + 2 * a / 3), end)], { air: true }); }

  { const { c, a, t } = timing(hero, AttackStyle.forwardAir), hit = c - 1, wind = Math.max(1, hit - 5), end = Math.min(t - 2, c + a + 3), chop: Gesture = { ...tucked, chest: 36, head: 8, wristR: -30 };
    add("forwardAir", t, c, [[0, tucked], [wind, { ...tucked, chest: -30, head: -16, wristR: 50 }], [hit, chop], [c + a, { ...chop, chest: 50 }], [end, { ...chop, chest: 52 }], ...settle(end, t, chop), [t, tucked]],
      [...at("cleaver", [-45, -35, 230], wind), ...at("cleaver", [115, -35, 145], hit), ...at("cleaver", [125, -35, 60], c + a), ...at("cleaver", [95, -35, 20], end), ...at("hook", [50, 50, 110], wind, hit, c + a, end)], { air: true }); }

  { const { c, a, t } = timing(hero, AttackStyle.upAir), wind = Math.max(1, c - 4), end = Math.min(t - 2, c + a + 2), up: Gesture = { ...tucked, chest: -24, head: -32, wristR: -50 };
    add("upAir", t, c, [[0, tucked], [wind, { ...tucked, chest: 20, wristR: 40 }], [c, up], [c + a, { ...up, chest: -32 }], [end, { ...up, chest: -34 }], ...settle(end, t, up), [t, tucked]],
      [...at("cleaver", [85, -40, 60], wind), ...at("cleaver", [70, -35, 185], c), ...at("cleaver", [-10, -35, 220], c + a), ...at("cleaver", [-70, -35, 175], end), ...at("hook", [10, 50, 100], wind, c, c + a, end)], { air: true }); }

  { const { c, a, t } = timing(hero, AttackStyle.downAir), lift = Math.max(1, c - 6), end = Math.min(t - 2, c + a + 4), seat: Gesture = { body: -12, chest: -14, hips: -10, head: 12, legF: -80, legB: -72, kneeF: 20, kneeB: 25 }, hit = c - 1;
    add("downAir", t, c, [[0, tucked], [lift, { ...tucked, chest: -22, head: -18 }], [hit, seat], [c + a, { ...seat, body: -16 }], [end, seat], ...settle(end, t, seat), [t, tucked]],
      [...both([10, 35, 235], lift), ...both([-5, 75, 185], hit, c + a, end)], { air: true }); }

  for (const air of [false, true]) {
    const lean: Gesture = { ...air ? tucked : { legF: -24, legB: 18, kneeF: 22, kneeB: 14 }, head: -8 }, spin = [[70, 70, 105], [10, 75, 165], [-55, 70, 110], [10, 65, 50]] as const;
    add(air ? "neutralSpecialAir" : "neutralSpecial", HOOK_SPIN_FRAMES, 0, [0, 1, 2, 3, 4].map(i => [i * HOOK_SPIN_FRAMES / 4, { ...lean, chest: i % 2 ? 14 : 8, twist: i % 2 ? 26 : 16 }] as const),
      [...spin.flatMap((target, i) => at("hook", target, i * HOOK_SPIN_FRAMES / 4)), ...at("hook", spin[0], HOOK_SPIN_FRAMES), ...at("cleaver", [20, -50, 95], 0, HOOK_SPIN_FRAMES / 2, HOOK_SPIN_FRAMES)], { air, loop: true });
  }

  for (const air of [false, true]) {
    const { c, t } = specialTiming(hero, "neutral", air, 1), hit = c - 1, flight = c + 18, pull = Math.min(t - 10, flight + 14), coil: Gesture = { twist: 50, chest: 4, legF: -26, legB: 20, kneeF: 25, kneeB: 15 }, fling: Gesture = { twist: -35, chest: 30, head: -14, legF: -44, legB: 34, kneeF: 40, wristL: -20 };
    add(air ? "neutralSpecialFollowUpAir" : "neutralSpecialFollowUp", t, c, [[0, air ? { ...coil, ...tucked } : coil], [hit, fling], [flight, { ...fling, chest: 26 }], [pull, { ...coil, twist: 20, chest: -16, head: -6 }], ...settle(pull, t, coil), [t, air ? tucked : {}]],
      [...at("hook", [-95, 55, 80], 0), ...at("hook", [175, 30, 105], hit, flight), ...at("hook", [20, 50, 95], pull), ...at("cleaver", [20, -50, 95], 0, hit, flight, pull)], { air });
  }

  for (const air of [false, true]) {
    const { c, t } = specialTiming(hero, "side", air), hit = c - 1, low = Math.max(1, hit - 4), steps = [hit, hit + 4, hit + 8, hit + 12], last = Math.min(t - 12, hit + 15), skid = last + 5;
    const rush = (k: number): Gesture => ({ body: 24, chest: 16, hips: -6, twist: -35, head: -22, tx: 26, legF: -10 - 45 * k, legB: 10 + 45 * k, kneeF: 37 - 22 * k, kneeB: 37 + 22 * k }), brace: Gesture = { chest: -6, hips: 6, head: -10, legF: -38, legB: 26, kneeF: 30, kneeB: 20, tx: 10 };
    add(air ? "sideSpecialAir" : "sideSpecial", t, c, [[0, {}], [low, { body: 14, chest: 18, twist: -30, head: -10, legF: -30, legB: 22, kneeF: 40, kneeB: 30 }], ...steps.map((f, i) => [f, rush(i % 2 ? -1 : 1)] as const), [last, rush(1)], [skid, brace], ...settle(skid, t, brace), [t, {}]],
      [...at("hook", [-35, 60, 90], low, ...steps, last), ...at("cleaver", [-35, -60, 90], low, ...steps, last), ...at("hook", [50, 55, 100], skid), ...at("cleaver", [-20, -55, 80], skid)], { air });
  }

  { const ultimate = FIGHTER_ULTIMATES[Character.butcher]; ensure(ultimate, "butcher: no ultimate");
    const t = ultimate.endFrame, c = 21, raise: Gesture = { ...reared, chest: -30, legF: -28, legB: 20, wristR: 60 }, lunge: Gesture = { chest: 42, hips: 12, tx: 10, legF: -44, legB: 34, kneeF: 40, wristR: -30 };
    const carve = [c + 10, c + 20, c + 30, c + 40, c + 50].filter(f => f < t - 4);
    add("ultimate", t, c, [[0, {}], [12, raise], [c - 2, raise], [c, lunge], [c + 6, lunge], ...carve.map((f, i) => [f, { ...lunge, chest: i % 2 ? 50 : 26 }] as const), [t, {}]],
      [...at("cleaver", [-30, -35, 235], 12, c - 2), ...at("cleaver", [130, -35, 80], c, c + 6), ...carve.map((f, i) => ({ frame: f, chain: "cleaver" as const, target: (i % 2 ? [125, -35, 55] : [70, -35, 200]) as Point })),
        ...at("hook", [70, 55, 120], 12, c - 2), ...at("hook", [150, 30, 110], c, c + 6, ...carve)]);
  }
  { const { c, a, t } = timing(hero, AttackStyle.dashAttack), hit = c - 1, leap = Math.max(1, hit - 5), end = Math.min(t - 14, c + a + 6), up = end + 8;
    const run: Gesture = { body: 18, chest: 22, head: -22, legF: -42, legB: 32, kneeF: 40, kneeB: 55 }, flop: Gesture = { body: 72, chest: 8, head: -42, legF: 15, legB: 25, kneeF: 10, kneeB: 10, tx: 30 };
    add("dashAttack", t, c, [[0, {}], [leap, run], [hit, flop], [c + a, flop], [end, { ...flop, body: 64 }], [up, crouched], ...settle(up, t, crouched), [t, {}]],
      [...at("cleaver", [40, -55, 60], 0, leap), ...at("hook", [60, 55, 80], 0, leap), ...at("cleaver", [140, -75, 40], hit, c + a, end), ...at("hook", [140, 75, 40], hit, c + a, end), ...at("cleaver", [60, -50, 40], up), ...at("hook", [60, 50, 40], up)]); }
  return actions;
}

const nodeAt = (model: mdx.Model, path: string) => { const m = /^\.(Bones|Helpers)\.(\d+)\.(Rotation|Translation|Scaling)$/.exec(path); return m ? { node: model[m[1] as "Bones" | "Helpers"][Number(m[2])]!, kind: m[3]! } : undefined; };
const node = (model: mdx.Model, name: string) => { const n = model.Nodes.find(n => n?.Name === name); ensure(n, `no ${name}`); return n; };

function jointRotation(name: string, base: ArrayLike<number>, g: Gesture): Float32Array | undefined {
  switch (name) {
    case "Bone_Root": return rotated(base, g.body ?? 0, g.spin ?? 0);
    case "Bone_Pelvis": return rotated(base, g.hips ?? 0);
    case "Bone_Chest": return rotated(base, g.chest ?? 0, g.twist ?? 0);
    case "Bone_Head": return rotated(base, g.head ?? 0);
    case "Bone_Leg1_L": return rotated(base, g.legF ?? 0);
    case "Bone_Leg1_R": return rotated(base, g.legB ?? 0);
    case "Bone_Leg2_L": return rotated(base, g.kneeF ?? 0);
    case "Bone_Leg2_R": return rotated(base, g.kneeB ?? 0);
    case "Bone_Hand_R": return rotated(base, g.wristR ?? 0);
    case "Bone_Hand_L": return rotated(base, g.wristL ?? 0);
    default: return undefined;
  }
}

function aim(model: mdx.Model, index: number, start: number, frame: number, chain: Chain, target: Point): void {
  const renderer = new ModelRenderer(model), data = Reflect.get(renderer, "rendererData"); renderer.setSequence(index); data.frame = start + ms(frame);
  const [arm, elbow, hand] = CHAINS[chain].map(name => node(model, name)) as [mdx.Node, mdx.Node, mdx.Node];
  const key = (n: mdx.Node) => { const k = n.Rotation!.Keys.find(k => k.Frame === start + ms(frame)); ensure(k, `${n.Name}: no key at ${frame}`); return k; };
  const set = (n: mdx.Node, q: Float32Array) => { const k = key(n); k.Vector = q; if (k.InTan) { k.InTan = q.slice(); k.OutTan = q.slice(); } };
  const point = (n: mdx.Node): Point => { const p = model.PivotPoints[n.ObjectId]!, m = data.nodes[n.ObjectId].matrix; return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; };
  const armBase = key(arm).Vector.slice(), elbowBase = key(elbow).Vector.slice(), angles = [0, 0, 0, 0];
  const loss = () => { set(arm, rotated(armBase, angles[0]!, angles[1]!)); set(elbow, rotated(elbowBase, angles[2]!, angles[3]!)); renderer.update(0); return point(hand).reduce((sum, v, i) => sum + (v - target[i]!) ** 2, 0); };
  for (const step of [30, 10, 3, 1]) for (let pass = 0; pass < 2; pass++) for (let dim = 0; dim < 4; dim++) {
    const origin = angles[dim]!, range = step === 30 ? 180 : step * 3; let best = loss(), angle = origin;
    for (let delta = -range; delta <= range; delta += step) { angles[dim] = origin + delta; const l = loss(); if (l < best) { best = l; angle = angles[dim]!; } }
    angles[dim] = angle;
  }
  loss();
}

interface Bake { model: mdx.Model; source: mdx.Model; stand: mdx.Sequence; originals: Map<string, mdx.AnimVector>; root: mdx.Node; bindings: string[]; records: { pose: string; index: number; frames: number; contact: number }[]; cursor: number; }

function bakeTracks({ model, originals, stand }: Bake, action: Action, start: number): void {
  tracks(model, (track, path) => {
    const original = originals.get(path); if (!original || onGlobalClock(original)) return;
    const at = nodeAt(model, path), rest = at ? new Float32Array(at.kind === "Rotation" ? [0, 0, 0, 1] : at.kind === "Scaling" ? [1, 1, 1] : [0, 0, 0]) : undefined;
    const first = original.Keys.find(k => k.Frame >= stand.Interval[0]! && k.Frame <= stand.Interval[1]!) ?? (rest ? { Frame: stand.Interval[0]!, Vector: rest, ...track.LineType > 1 ? { InTan: rest.slice(), OutTan: rest.slice() } : {} } : undefined);
    if (!first) return;
    for (const [frame, g] of action.keys) {
      const Vector = at?.kind === "Rotation" ? jointRotation(at.node.Name, first.Vector, g) ?? first.Vector.slice() : first.Vector.slice();
      const tangent = () => at?.kind === "Rotation" || track.LineType === mdx.LineType.Bezier ? Vector.slice() : new Float32Array(Vector.length);
      track.Keys.push({ ...first, Frame: start + ms(frame), Vector, ...first.InTan ? { InTan: tangent(), OutTan: tangent() } : {} });
    }
  });
  tracks(model, track => track.Keys.sort((a, b) => a.Frame - b.Frame));
}

function groundRoot({ model, root }: Bake, action: Action, index: number, start: number): void {
  const drawn = new DrawnModel(generateMDX(model), 1), translation = root.Translation!;
  for (const [frame, g] of action.keys) {
    const key = translation.Keys.find(k => k.Frame === start + ms(frame)); ensure(key, `${action.pose}: no root key at ${frame}`);
    let lowest = Infinity; const triangles = drawn.triangles(index, frame / 60, 1); for (let i = 1; i < triangles.length; i += 2) lowest = Math.min(lowest, triangles[i]!);
    key.Vector = new Float32Array([key.Vector[0]! + (g.tx ?? 0), key.Vector[1]!, key.Vector[2]! + (action.air ? g.tz ?? 0 : (g.tz ?? 0) - lowest)]);
  }
}

function bakeAction(b: Bake, action: Action): void {
  const { model, stand } = b, name = `Butcher ${action.pose}`;
  const index = model.Sequences.length, start = b.cursor, end = start + ms(action.frames); b.cursor = end + 100;
  model.Sequences.push({ ...stand, Name: name, Interval: new Uint32Array([start, end]), NonLooping: !action.loop, MoveSpeed: 0, Rarity: 0, MinimumExtent: new Float32Array([-320, -320, -220]), MaximumExtent: new Float32Array([320, 320, 360]), BoundsRadius: 400 });
  bakeTracks(b, action, start);
  for (const reach of action.reach) aim(model, index, start, reach.frame, reach.chain, reach.target);
  groundRoot(b, action, index, start);
  const clipSeconds = seconds(action.loop ? action.frames / 60 : (end - start) / 1000);
  b.bindings.push(`  ${action.pose}: { index: ${index}, seconds: ${clipSeconds}, aligned: true },`);
  b.records.push({ pose: name, index, frames: action.frames, contact: action.contact });
}

async function writeClips(project: string, bindings: readonly string[]): Promise<void> {
  const usesF32 = bindings.some(line => line.includes("f32("));
  await Bun.write(join(project, "ts/src/game/fighters/butcher/clips.ts"), [
    "// Generated by tools/animations/butcher-clips.ts from the stock classic Abomination.",
    ...usesF32 ? ['import { f32 } from "wisp/src/sim/f32";'] : [],
    'import type { HeroClipTable } from "../../sim/heroes/hero";',
    "export const BUTCHER_AUTHORED_CLIPS = {", ...bindings, "} as const satisfies HeroClipTable;", "",
  ].join("\n"));
}

async function writeSheets(output: string, drawn: DrawnModel, actions: readonly Action[], records: Bake["records"]): Promise<string[]> {
  const sheets = join(output, "sheets"); mkdirSync(sheets, { recursive: true });
  const written: string[] = [];
  for (const [i, action] of actions.entries()) for (const facing of [1, -1]) {
    const frames = [...new Set([0, ...action.keys.map(([f]) => f).filter(f => f > 0 && f < action.frames), action.frames])].sort((a, b) => a - b).slice(0, 8);
    const panels: PoseFrame[] = frames.map(frame => ({ frame, phase: frame < action.contact ? AttackPhase.startup : frame <= action.contact + 4 ? AttackPhase.active : AttackPhase.recovery, x: 0, z: 0, facing, parts: [], strikes: [], clip: records[i]!.index, seconds: frame / 60 }));
    const file = join(sheets, `${action.pose}-${facing > 0 ? "right" : "left"}.png`); await Bun.write(file, sheet(`Butcher ${action.pose}`, drawn, panels, 8).png); written.push(file);
  }
  return written;
}

async function generate(): Promise<void> {
  const [input, output] = process.argv.slice(2, 4).map(p => resolve(p));
  const project = resolve(import.meta.dir, "../..");
  ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/butcher-clips.ts STOCK_ABOMINATION.mdx PRIVATE_OUTPUT");
  const source = parseSource(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
  ensure(source.Sequences.length === 10 && source.Sequences[0]?.Name === "Stand - 1" && source.Nodes.some(n => n?.Name === "Bone_Hand_R"), "Expected the original classic Abomination");
  const hero = heroDefinition(Character.butcher); ensure(hero, "Register the Butcher before authoring his clips");
  const root = node(model, "Bone_Root"); ensure(root.Translation && root.Rotation, "Abomination root has no translation or rotation track");
  const originals = new Map<string, mdx.AnimVector>(); tracks(model, (t, p) => originals.set(p, structuredClone(t)));
  const b: Bake = { model, source, stand: source.Sequences[0]!, originals, root, bindings: [], records: [], cursor: Math.max(...source.Sequences.map(s => s.Interval[1]!)) + 100 };
  const actions = authoredActions(hero);
  for (const action of actions) bakeAction(b, action);
  const bytes = encodeVerified(parseSource(generateMDX(model))); mkdirSync(output, { recursive: true }); await Bun.write(join(output, "abomination.mdx"), bytes);
  await writeClips(project, b.bindings);
  const written = await writeSheets(output, new DrawnModel(bytes, 1), actions, b.records);
  await Bun.write(join(output, "butcher-clips.json"), JSON.stringify({ stockSequences: source.Sequences.length, appended: b.records.length, records: b.records, sheets: written }, null, 2) + "\n");
  console.log(`BUTCHER_CLIPS_PASS ${b.records.length} authored clips; ${source.Sequences.length} stock sequences retained; private output ${output}`);
}

BunRuntime.runMain(Effect.tryPromise({ try: generate, catch: cause => new ClipFailure({ cause }) }));
