import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { quat } from "gl-matrix";
import { model as mdx } from "war3-model";
import { FIGHTER_RIGS } from "./rigs";
import { NO_GLOBAL_SEQ, type KeyVector } from "./animVector";
import { MOVEMENT_CLIPS } from "../../ts/src/game/presentation/movementClipInfo";
import { createFighter } from "../../ts/src/game/sim/fighter";
import type { HeroClip, HeroClipTable } from "../../ts/src/game/sim/heroes/hero";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { generateModelMDX as generateMDX } from "../../ts/scripts/mdxCodec";
import { fighters } from "../../ts/scripts/heroModelSource";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { drawnStrideOf } from "../../ts/scripts/wisp/drawnMotion";
import { sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, type Character } from "../../ts/src/game/sim/codes";
import { GROUND_LOCOMOTION_RATE_CAP } from "../../ts/src/game/presentation/fighterLocomotion";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";

const [inputArg, outputArg, ...options] = process.argv.slice(2);
const input = resolve(inputArg ?? ""), output = resolve(outputArg ?? "");
const project = resolve(import.meta.dir, "../..");
const character = Number(options[options.indexOf("--character") + 1]) as Character;
ensure(inputArg && outputArg && relative(project, output).startsWith("..") && options.includes("--character"), "usage: bun tools/animations/run-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT --character ID [--walk]");
const fighter = fighters.get(character), rig = FIGHTER_RIGS.get(character);
ensure(fighter && rig, `no fighter or canonical rig for character ${character}`);

const DUTY = 0.46, RATE_TARGET = 4.4, REACH = 0.97, CROUCH = 0.1, BOB = 0.05, LIFT = 0.22, LEAN = 9, ELBOW = 62, ARM_SWING = 28;
const rad = (degrees: number) => degrees * Math.PI / 180;
const lateral = (degrees: number) => quat.setAxisAngle(quat.create(), [0, 1, 0], rad(degrees));
const ms = (frame: number) => Math.round(frame * 1000 / 60);
const smooth = (t: number) => t * t * (3 - 2 * t);

const source = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer());
const model = structuredClone(source);
const stand = source.Sequences.find((s) => /^stand ready$/i.test(s.Name.trim())) ?? source.Sequences.find((s) => /^stand(?:\s*-?\s*1)?$/i.test(s.Name.trim()));
ensure(stand, `${fighter.name}: missing stand`);
const standIndex = source.Sequences.indexOf(stand);
const before = new DrawnModel(generateMDX(source), 1);
const restNodes = before.posed(standIndex, 0, 1).nodes;
const id = (joint: keyof typeof rig.classic) => { const name = rig.classic[joint]; const found = source.Nodes.find((n) => n.Name === name)?.ObjectId; ensure(found !== undefined, `${fighter.name}: rig has no ${joint}`); return found; };
const at = (node: number): readonly [number, number] => [restNodes[node * 2] ?? 0, restNodes[node * 2 + 1] ?? 0];
const angle = ([x, z]: readonly [number, number]) => Math.atan2(x, -z) * 180 / Math.PI;
const minus = (a: readonly [number, number], b: readonly [number, number]): [number, number] => [a[0] - b[0], a[1] - b[1]];

interface Leg { readonly hip: number; readonly knee: number; readonly ankle: number; readonly shoulder: number; readonly elbow: number; readonly phase: number }
const legs: readonly Leg[] = (["L", "R"] as const).map((side, index) => ({
  hip: id(`hip.${side}`), knee: id(`knee.${side}`), ankle: id(`ankle.${side}`), shoulder: id(`shoulder.${side}`), elbow: id(`elbow.${side}`), phase: index * 0.5,
}));
const pelvis = id("pelvis"), chest = id("chest"), head = id("head");
const [leg] = legs; ensure(leg, "no legs");
const lengthsOf = (l: Leg) => [Math.hypot(...minus(at(l.knee), at(l.hip))), Math.hypot(...minus(at(l.ankle), at(l.knee)))] as const;
const reach = REACH * Math.min(...legs.map((l) => lengthsOf(l)[0] + lengthsOf(l)[1])), groundZ = Math.min(...legs.map((l) => at(l.ankle)[1]));
const standHeight = at(leg.hip)[1] - groundZ, crouch = CROUCH * standHeight, bob = BOB * standHeight, lift = LIFT * standHeight;
const contactHeight = standHeight - crouch;
const step = 2 * Math.sqrt(Math.max(0, reach * reach - contactHeight * contactHeight));
const scale = characterModelScale(character), runSpeed = createFighter(character, 0.0, 1).tuning.physics.runSpeed * 60;
ensure(runSpeed > 0 && step > 0, `${fighter.name}: no run speed or no stride`);
const speed = runSpeed / scale / RATE_TARGET;
const frames = Math.round(2 * step / speed * 60);
const cadence = runSpeed / scale / (2 * step);

function ankleTarget(phase: number, p: number): readonly [number, number] {
  const u = (((p + phase) % 1) + 1) % 1;
  if (u < DUTY) return [step / 2 - step * u / DUTY, 0];
  const w = (u - DUTY) / (1 - DUTY);
  return [-step / 2 + step * smooth(w), lift * Math.sin(Math.PI * w)];
}
const hipDrop = (p: number) => crouch + bob * (1 + Math.cos(4 * Math.PI * (p - DUTY / 2))) / 2;

function solveLeg(l: Leg, p: number): ReadonlyMap<number, number> {
  const hip0 = at(l.hip), knee0 = at(l.knee), ankle0 = at(l.ankle), [upper, lower] = lengthsOf(l);
  const hip: [number, number] = [hip0[0], hip0[1] - hipDrop(p)];
  const [tx, tz] = ankleTarget(l.phase, p);
  const target: [number, number] = [hip0[0] + tx, groundZ + tz];
  const d = minus(target, hip), dist = Math.min(Math.hypot(...d), upper + lower - 1e-3);
  const alpha = Math.acos(Math.max(-1, Math.min(1, (upper * upper + dist * dist - lower * lower) / (2 * upper * dist))));
  const thigh = angle(d) + alpha * 180 / Math.PI;
  const knee: [number, number] = [hip[0] + upper * Math.sin(rad(thigh)), hip[1] - upper * Math.cos(rad(thigh))];
  const shin = angle(minus(target, knee));
  const thigh0 = angle(minus(knee0, hip0)), shin0 = angle(minus(ankle0, knee0));
  const hipTurn = -(thigh - thigh0), shinTurn = -(shin - shin0);
  return new Map([[l.hip, hipTurn], [l.knee, shinTurn - hipTurn], [l.ankle, -shinTurn]]);
}

function turns(frame: number): ReadonlyMap<number, number> {
  const p = (frame % frames) / frames, out = new Map<number, number>();
  for (const l of legs) {
    for (const [node, turn] of solveLeg(l, p)) out.set(node, turn);
    const swing = ARM_SWING * Math.sin(2 * Math.PI * (p + l.phase + 0.5));
    out.set(l.shoulder, -swing - 10);
    out.set(l.elbow, -ELBOW + swing * 0.3);
  }
  out.set(chest, -LEAN); out.set(head, LEAN);
  return out;
}

const rootHelper = model.Helpers.find((node) => /Motion$/.test(node.Name) && node.Parent == null && node.Translation !== undefined && node.Rotation !== undefined);
const helper: mdx.Helper = rootHelper ?? { Name: "Movement Motion", ObjectId: model.Nodes.length, Parent: null, Flags: 0, PivotPoint: new Float32Array(3),
  Translation: { LineType: mdx.LineType.Linear, GlobalSeqId: NO_GLOBAL_SEQ, Keys: [] }, Rotation: { LineType: mdx.LineType.Linear, GlobalSeqId: NO_GLOBAL_SEQ, Keys: [] } };
if (rootHelper === undefined) {
  for (const node of [...model.Bones, ...model.Helpers, ...model.Attachments]) if (node.Parent == null) node.Parent = helper.ObjectId;
  model.Helpers.push(helper); model.Nodes.push(helper); model.PivotPoints.push(helper.PivotPoint);
  for (const sequence of source.Sequences) for (const Frame of sequence.Interval) {
    helper.Translation!.Keys.push({ Frame, Vector: new Float32Array(3) });
    helper.Rotation!.Keys.push({ Frame, Vector: new Float32Array([0, 0, 0, 1]) });
  }
}
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (track, path) => originals.set(path, track));
const rotationPath = new Map<number, string>();
for (const kind of ["Bones", "Helpers"] as const) source[kind].forEach((node, index) => rotationPath.set(node.ObjectId, `.${kind}.${index}.Rotation`));
const standRotation = (node: number): quat => {
  const donor = originals.get(rotationPath.get(node) ?? "");
  const key = donor && !onGlobalClock(donor) ? donor.Keys.find((k) => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]) : undefined;
  return key ? quat.normalize(quat.create(), Float32Array.from(key.Vector) as unknown as quat) : quat.create();
};
const depth = (node: number): number => { const parent = model.Nodes[node]?.Parent; return parent == null || parent === helper.ObjectId ? 0 : 1 + depth(parent); };
const order = source.Nodes.map((node) => node.ObjectId).sort((a, b) => depth(a) - depth(b));

const start = Math.max(...source.Sequences.map((s) => s.Interval[1])) + 100, end = start + ms(frames), index = model.Sequences.length;
model.Sequences.push({ ...stand, Name: "Movement run", Interval: new Uint32Array([start, end]), NonLooping: false, MoveSpeed: 0, Rarity: 0,
  MinimumExtent: new Float32Array([-300, -300, -250]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });

const locals = Array.from({ length: frames + 1 }, (_, frame) => {
  const turned = turns(frame), world = new Map<number, quat>(), local = new Map<number, quat>();
  for (const node of order) {
    const parent = model.Nodes[node]?.Parent, above = parent == null || parent === helper.ObjectId ? quat.create() : world.get(parent) ?? quat.create();
    const theta = turned.get(node) ?? 0, rest = standRotation(node);
    const value = theta === 0 ? rest : quat.multiply(quat.create(), quat.multiply(quat.create(), quat.invert(quat.create(), above), quat.multiply(quat.create(), lateral(theta), above)), rest);
    local.set(node, quat.normalize(value, value));
    world.set(node, quat.multiply(quat.create(), above, value));
  }
  return local;
});

function keys(track: mdx.AnimVector, value: (frame: number) => KeyVector, template?: mdx.AnimKeyframe): void {
  track.Keys = track.Keys.filter((k) => k.Frame < start || k.Frame > end);
  for (let frame = 0; frame <= frames; frame++) {
    const Vector = value(frame);
    track.Keys.push({ ...template, Frame: start + ms(frame), Vector, ...(template?.InTan ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {}) });
  }
  track.Keys.sort((a, b) => a.Frame - b.Frame);
}
const moved = [...new Set(legs.flatMap((l) => [l.hip, l.knee, l.ankle, l.shoulder, l.elbow]).concat(chest, head))];
tracks(model, (track, path) => {
  if (track === helper.Translation || track === helper.Rotation || track === helper.Scaling) return;
  const donor = originals.get(path); if (!donor || onGlobalClock(donor)) return;
  const key = donor.Keys.find((k) => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]); if (!key) return;
  const node = moved.find((candidate) => rotationPath.get(candidate) === path);
  keys(track, (frame) => { const q = node === undefined ? undefined : locals[frame]?.get(node); return q ? new Float32Array(q) : key.Vector.slice(); }, key);
});
keys(helper.Rotation!, () => new Float32Array([0, 0, 0, 1]));
if (helper.Scaling) keys(helper.Scaling, () => new Float32Array([1, 1, 1]));
keys(helper.Translation!, (frame) => new Float32Array([0, 0, -hipDrop((frame % frames) / frames)]));

const bytes = encodeVerified(parseSource(generateMDX(model))), after = new DrawnModel(bytes, 1);
for (const [i, sequence] of source.Sequences.entries()) for (const fraction of [0, 0.5, 1]) {
  const time = (sequence.Interval[1] - sequence.Interval[0]) * fraction / 1000;
  const a = before.triangles(i, time, 1), b = after.triangles(i, time, 1);
  ensure(a.length === b.length && a.every((v, k) => Math.abs(v - (b[k] ?? Infinity)) < 0.001), `${fighter.name}/${sequence.Name}: previous clip changed`);
}

const duration = frames / 60, drawn = new DrawnModel(bytes, scale);
const stride = drawnStrideOf(drawn, index, duration), drawnRate = runSpeed / stride;
const ankleZ = (frame: number, l: Leg) => drawn.posed(index, frame / 60, 1).nodes[l.ankle * 2 + 1] ?? 0;
const bodyOverFeet = Math.max(1, drawnRate / GROUND_LOCOMOTION_RATE_CAP);
console.log(`RUN_CLIP ${fighter.name}: ${frames} frames, ${cadence.toFixed(2)} cycles/s at ${runSpeed.toFixed(0)} u/s, step ${step.toFixed(1)}, drawn stride ${stride.toFixed(1)} u/s, run rate ${drawnRate.toFixed(2)}x (cap ${GROUND_LOCOMOTION_RATE_CAP}), body/feet ${bodyOverFeet.toFixed(2)}, ankle z ${ankleZ(0, leg).toFixed(1)}`);
if (!process.env.RUN_DEBUG) ensure(drawnRate <= GROUND_LOCOMOTION_RATE_CAP, `${fighter.name}: run rate ${drawnRate.toFixed(2)} past the cap`);

mkdirSync(dirname(join(output, fighter.source)), { recursive: true });
await Bun.write(join(output, fighter.source), bytes); chmodSync(join(output, fighter.source), 0o644);
const moments = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((t) => Math.round(frames * t));
await Bun.write(join(output, `${fighter.name}-run.png`), sheet(`${fighter.name} run`, drawn,
  [1, -1].flatMap((facing) => moments.map((frame) => ({ frame, facing, clip: index, seconds: frame / 60, phase: AttackPhase.none, x: 0, z: 0, parts: [], strikes: [] }))), moments.length).png);

const tables: Record<number, Partial<Record<string, HeroClip>>> = { ...(MOVEMENT_CLIPS as Readonly<Record<number, HeroClipTable>>) };
const bound = { index, seconds: Math.fround(duration) };
const { walk: _walk, run: _run, dash: _dash, ...kept } = tables[character] ?? {};
tables[character] = { ...kept, ...(options.includes("--walk") ? { walk: bound } : { run: bound, dash: bound }) };
const entries = Object.entries(tables).sort(([a], [b]) => Number(a) - Number(b)).flatMap(([key, table]) => Object.keys(table).length === 0 ? [] : [`  ${key}: {`,
  ...Object.entries(table).map(([pose, clip]) => `    ${pose}: { index: ${clip!.index}, seconds: ${seconds(Math.fround(clip!.seconds))} },`), "  },"]);
await Bun.write(join(project, "ts/src/game/presentation/movementClipInfo.ts"), [
  "// Generated by tools/animations/movement-clips.ts; regenerate instead of editing.",
  ...(entries.some((line) => line.includes("f32(")) ? ['import { f32 } from "wisp/src/sim/f32";'] : []),
  'import type { HeroClipTable } from "../sim/heroes/hero";',
  "export const MOVEMENT_CLIPS = {", ...entries, "} as const satisfies Readonly<Record<number, HeroClipTable>>;", ""].join("\n"));
if (process.env.RUN_DEBUG) for (let f = 0; f <= frames; f += 4) console.log(f, legs.map((l) => `${(drawn.posed(index, f / 60, 1).nodes[l.ankle * 2] ?? 0).toFixed(1)},${ankleZ(f, l).toFixed(1)}`).join(" | "), "target", legs.map((l) => ankleTarget(l.phase, f / frames).map((v) => v.toFixed(1))).join(" | "));
if (process.env.RUN_DEBUG) {
  const f = 16, t = turns(f); const l = legs[0]!;
  console.log("turns", [l.hip, l.knee, l.ankle].map((n) => t.get(n)?.toFixed(1)).join(" "), "actual hip/knee/ankle", [l.hip, l.knee, l.ankle].map((n) => [drawn.posed(index, f / 60, 1).nodes[n * 2], drawn.posed(index, f / 60, 1).nodes[n * 2 + 1]].map((v) => v?.toFixed(1)).join(",")).join(" | "));
}
