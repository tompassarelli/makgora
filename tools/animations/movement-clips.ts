import type { HumanoidJoint } from "./canonical-rig";
import { NO_GLOBAL_SEQ, type KeyVector } from './animVector';
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { quat } from "gl-matrix";
import { model as mdx } from "war3-model";
import { FIGHTER_RIGS } from "./hd-rigs";
import { type DefinitiveLook, definitiveLook, retargetedSequences } from "./movement-definitive";
import { DEFINITIVE_FIGHTERS } from "../../ts/src/game/assets/definitiveFighters";
import { highestGrip, ledgeGripOffset } from "./ledge-grip";
import { DEMON_HUNTER_LEDGE_CATCH_INDEX } from "../../ts/src/game/presentation/demonHunterAssetInfo";
import { clipFor } from "../../ts/src/game/presentation/fighterClips";
import { MOVEMENT_CLIPS } from "../../ts/src/game/presentation/movementClipInfo";
import type { HeroClip, HeroClipTable } from "../../ts/src/game/sim/heroes/hero";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { generateModelMDX as generateMDX } from "../../ts/scripts/mdxCodec";
import { fighters } from "../../ts/scripts/heroModelSource";
import { type ScoreFrame, bodyHeight, scoreCrouch, scoreLedgeHang, CROUCH_THRESHOLDS, LEDGE_THRESHOLDS } from "../../ts/scripts/wisp/animScore";
import { gameplayPixelsPerUnit, ledgeHangParts } from "../../ts/scripts/wisp/animScoreSample";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, Character } from "../../ts/src/game/sim/codes";
import { createFighter } from "../../ts/src/game/sim/fighter";
import { HurtState } from "../../ts/src/game/sim/hurtboxes";
import { LEDGE_HANG_DEPTH, LEDGE_HANG_OUTSET } from "../../ts/src/game/sim/ledge";
import { createRoster } from "../../ts/src/game/sim/roster";
import { seconds } from "./asset-info";
import { type Choice, type Pose, type Space, type Variant, describe, SPACES } from "./movement-space";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";

const [inputArg, outputArg, ...options] = process.argv.slice(2);
const input = resolve(inputArg ?? ""), output = resolve(outputArg ?? "");
const project = resolve(import.meta.dir, "../..");
const character = Number(options[options.indexOf("--character") + 1]) as Character;
const poses = options.flatMap((option, index) => option === "--pose" ? [options[index + 1] as Pose] : []);
ensure(inputArg && outputArg && relative(project, output).startsWith("..") && options.includes("--character") && poses.length > 0 && poses.every((pose) => pose === "crouch" || pose === "ledgeHang"),
  "usage: bun tools/animations/movement-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT --character ID --pose crouch|ledgeHang [--pose ...]");
const fighter = fighters.get(character), rig = FIGHTER_RIGS.get(character);
ensure(fighter && rig, `no fighter or canonical rig for character ${character}`);

const LEG_BONES: Readonly<Partial<Record<number, readonly (readonly [string, string, string])[]>>> = {
  [Character.thrall]: [["Bone Front L Leg", "Bone Front L Shin", "Bone FrontL Toe"], ["Bone Front R Leg", "Bone_Mesh49", "Bone_Mesh48"], ["Bone Back L Leg", "Bone Back L Shin", "Bone Object67"], ["Bone Back R Leg", "Bone Back R Shin", "Bone Back R Toe"]],
  [Character.pitLord]: [["Bone Front L Leg01", "Bone Front L Shin01", "Bone FrontL Toe01"], ["Bone Front R Leg01", "Bone Front R Shin01", "Bone Front R Toe01"], ["Bone Back L Leg01", "Bone Back L Shin01", "Bone Toe L "], ["Bone Back R Leg01", "Bone Back R Shin01", "Bone Toe R"]],
  [Character.anubarak]: [["Bone_LFLeg04", "Bone_LFLeg03", "Bone_LegEnd03"], ["Bone_LFLeg07", "Bone_LFLeg06", "Bone_LegEnd01"], ["Bone_LFLeg13", "Bone_LFLeg14", "Bone_LegEnd04"], ["Bone_LFLeg09", "Bone_LFLeg10", "Bone_LegEnd02"]],
};
const PINNED: Readonly<Partial<Record<number, Readonly<Partial<Record<Pose, Choice>>>>>> = {
  [Character.pitLord]: { crouch: { frame: 0, hip: -80, knee: 110, chest: 80, shoulder: 10, elbow: -40, weapon: 0, pelvis: 20, squash: 0.15 } },
  [Character.chen]: { crouch: { frame: 1, hip: -80, knee: 110, chest: 80, shoulder: -30, elbow: -40, weapon: 0, head: 60 }, ledgeHang: { frame: 0, shoulder: -207.5, elbow: 22.5, chest: 38, hip: -85, knee: 77.5, lean: 7.5, pelvis: -15, weapon: -45, head: -120 } },
};
const FRAMES: Readonly<Record<Pose, number>> = { crouch: 24, ledgeHang: 60 };
const LEDGE_CATCH_CLIPS: Readonly<Partial<Record<number, number>>> = { [Character.demonHunter]: DEMON_HUNTER_LEDGE_CATCH_INDEX };
const CATCH_SETTLED = 0.6;
const OWN_CLIP = /crouch|ledge ?hang/i;

const OWN_FILE = `movement-poses/${fighter.name.toLowerCase()}`;
const OWN: { readonly MOVEMENT_POSES?: Partial<Record<Pose, Space>>; readonly GRIP_BONES?: readonly string[] } = existsSync(join(import.meta.dir, `${OWN_FILE}.ts`)) ? await import(`./${OWN_FILE}`) : {};
const neighbours = (values: readonly number[], at: number | undefined) => { const i = values.indexOf(at ?? NaN); return i < 0 ? values : [values[i - 1], values[i + 1]].filter((v): v is number => v !== undefined); };
const mulberry32 = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const smooth = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };
function amount(pose: Pose, t: number, joint: string): number {
  if (pose === "crouch") return smooth(t / 0.25);
  const sway = Math.sin(2 * Math.PI * t) * (joint.endsWith(".L") ? 1 : -1);
  return 1 + 0.06 * sway;
}

const source = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer());
const model = structuredClone(source);
const stand = source.Sequences.find((s) => /^stand ready$/i.test(s.Name.trim())) ?? source.Sequences.find((s) => /^stand(?:\s*-?\s*1)?$/i.test(s.Name.trim()));
ensure(stand, `${fighter.name}: missing stand`);
const scale = characterModelScale(character), ppu = gameplayPixelsPerUnit();
const before = new DrawnModel(generateMDX(source), 1);
const standIndex = source.Sequences.indexOf(stand);
const lowest = (drawn: DrawnModel, sequence: number, at: number) => Math.min(...Array.from(drawn.triangles(sequence, at, 1)).filter((_, i) => i % 2 === 1));
const ankles = (["ankle.L", "ankle.R"] as const).flatMap((joint) => { const id = source.Nodes.findIndex((n) => n.Name === rig.classic[joint]); return rig.classic[joint] !== undefined && id >= 0 ? [source.Nodes[id]!.ObjectId] : []; });
const floor = (drawn: DrawnModel, sequence: number, at: number) => {
  if (ankles.length === 0) return lowest(drawn, sequence, at);
  const nodes = drawn.posed(sequence, at, 1).nodes;
  return Math.min(...ankles.map((id) => nodes[id * 2 + 1] ?? Infinity));
};
const standFloor = floor(before, standIndex, 0), standLowest = lowest(before, standIndex, 0);
const { parts, standing } = ledgeHangParts(character);
ensure(standing.clip !== undefined, `${fighter.name}: the sampled fighter shows no standing clip`);
const standFrame: ScoreFrame = { frame: 0, ...new DrawnModel(generateMDX(source), scale).posed(standing.clip, standing.seconds, 1) };
const standHeight = Math.max(...Array.from(standFrame.vertices).filter((_, i) => i % 2 === 1)) - Math.min(...Array.from(standFrame.vertices).filter((_, i) => i % 2 === 1));
const headId = source.Nodes.find((n) => n.Name === rig.classic.head)?.ObjectId;
const referenceStand = ((ready: number) => ready >= 0 ? ready : source.Sequences.findIndex((s) => /^Stand(?:\s*-?\s*\d+)?$/.test(s.Name)))(source.Sequences.findIndex((s) => /^Stand Ready(?:\s+\d+)?$/.test(s.Name)));
const look = DEFINITIVE_FIGHTERS.has(character as Character) ? await definitiveLook(input, rig, fighter.name) : undefined;
const jointOf = new Map(Object.entries(rig.classic).map(([joint, name]) => [name, joint]));
const TAIL_BONES: Readonly<Partial<Record<number, readonly string[]>>> = { [Character.pitLord]: ["Bone Tail 03", "Bone Tail 04", "Bone Tail 05", "Bone Tail 06"] };
const tailJoint = new Set(TAIL_BONES[character] ?? []);
const searched = (options: Space["options"]) => Object.entries(options).filter(([key]) => (key !== "tail" || tailJoint.size > 0) && (key !== "fold" || (LEG_BONES[character] ?? []).length > 0));
const legJoint = new Map((LEG_BONES[character] ?? []).flatMap(([hip, knee, toe]) => [[hip, 1], [knee, -2], [toe, 1]] as const));

const helper: mdx.Helper = { Name: "Movement Motion", ObjectId: model.Nodes.length, Parent: null, Flags: 0, PivotPoint: new Float32Array(3),
  Translation: { LineType: mdx.LineType.Linear, GlobalSeqId: NO_GLOBAL_SEQ, Keys: [] }, Rotation: { LineType: mdx.LineType.Linear, GlobalSeqId: NO_GLOBAL_SEQ, Keys: [] } };
for (const node of [...model.Bones, ...model.Helpers, ...model.Attachments]) if (node.Parent == null) node.Parent = helper.ObjectId;
model.Helpers.push(helper); model.Nodes.push(helper); model.PivotPoints.push(helper.PivotPoint);
for (const sequence of source.Sequences) for (const Frame of sequence.Interval) {
  helper.Translation!.Keys.push({ Frame, Vector: new Float32Array(3) });
  helper.Rotation!.Keys.push({ Frame, Vector: new Float32Array([0, 0, 0, 1]) });
}
const rotation = helper.Rotation!;
const translation = helper.Translation!;
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (track, path) => originals.set(path, track));
const gripNodes = (joints: readonly HumanoidJoint[]) => joints.flatMap((joint) => { const name = rig.classic[joint]; const id = model.Nodes.findIndex((n) => n.Name === name); return name !== undefined && id >= 0 ? [id] : []; });
const GRIP_BONES: Readonly<Partial<Record<number, readonly string[]>>> = { [Character.thrall]: ["Bone FrontL Toe", "Bone_Mesh48"] };
const ownGrips = (OWN.GRIP_BONES ?? GRIP_BONES[character] ?? []).map((name) => model.Nodes.findIndex((n) => n.Name === name)).filter((id) => id >= 0);
const grips = ownGrips.length > 0 ? ownGrips : gripNodes(["wrist.L", "wrist.R"]).length > 0 ? gripNodes(["wrist.L", "wrist.R"]) : gripNodes(["weapon", "weapon.L"]);
ensure(grips.length > 0, `${fighter.name}: no hand or weapon joint to grip with`);
const ms = (frame: number) => Math.round(frame * 1000 / 60);

const rotationPath = new Map<number, string>();
for (const kind of ["Bones", "Helpers"] as const) source[kind].forEach((node, index) => rotationPath.set(node.ObjectId, `.${kind}.${index}.Rotation`));
const standRotation = (id: number): quat => {
  const donor = originals.get(rotationPath.get(id) ?? "");
  const key = donor && !onGlobalClock(donor) ? donor.Keys.find((k) => k.Frame >= stand!.Interval[0] && k.Frame <= stand!.Interval[1]) : undefined;
  return key ? quat.normalize(quat.create(), Float32Array.from(key.Vector) as unknown as quat) : quat.create();
};
const depth = (id: number): number => { const parent = model.Nodes[id]?.Parent; return parent == null || parent === helper.ObjectId ? 0 : 1 + depth(parent); };
const order = source.Nodes.map((node) => node.ObjectId).sort((a, b) => depth(a) - depth(b));
const lateral = (degrees: number) => quat.setAxisAngle(quat.create(), [0, 1, 0], degrees * Math.PI / 180);

interface Slot { readonly pose: Pose; readonly index: number; readonly start: number; readonly frames: number; readonly replaced: boolean }
function replaceKeys(track: mdx.AnimVector, slot: Pick<Slot, "start" | "frames">, value: (frame: number) => KeyVector, template?: mdx.AnimKeyframe): void {
  const end = slot.start + ms(slot.frames);
  track.Keys = track.Keys.filter((k) => k.Frame < slot.start || k.Frame > end);
  for (let frame = 0; frame <= slot.frames; frame++) {
    const Vector = value(frame);
    track.Keys.push({ ...template, Frame: slot.start + ms(frame), Vector, ...(template?.InTan ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {}) });
  }
  track.Keys.sort((a, b) => a.Frame - b.Frame);
}

function solveJoints(slot: Slot, variant: Variant): { readonly moved: readonly number[]; readonly locals: readonly ReadonlyMap<number, quat>[] } {
  const { pose, frames } = slot;
  const angle = (id: number, t: number) => {
    const name = model.Nodes[id]?.Name ?? "", joint = jointOf.get(name), fold = legJoint.get(name), own = variant.bones?.[name];
    if (own !== undefined) return own * amount(pose, t, "");
    if (tailJoint.has(name)) return (variant.angles.tail ?? 0) * amount(pose, t, "");
    return fold !== undefined ? fold * variant.fold * amount(pose, t, "") : joint === undefined ? 0 : (variant.angles[joint.split(".")[0] ?? ""] ?? 0) * amount(pose, t, joint);
  };
  const locals = Array.from({ length: frames + 1 }, (_, frame) => {
    const t = frame / frames, world = new Map<number, quat>(), local = new Map<number, quat>();
    const root = lateral(variant.lean * amount(pose, t, ""));
    for (const id of order) {
      const parent = model.Nodes[id]?.Parent, above = parent == null || parent === helper.ObjectId ? root : world.get(parent) ?? root;
      const theta = angle(id, t), rest = standRotation(id);
      const frame = variant.parentFrame ? quat.create() : above;
      const turned = theta === 0 ? rest : quat.multiply(quat.create(), quat.multiply(quat.create(), quat.invert(quat.create(), frame), quat.multiply(quat.create(), lateral(theta), frame)), rest);
      local.set(id, quat.normalize(turned, turned));
      world.set(id, quat.multiply(quat.create(), above, turned));
    }
    return local;
  });
  return { moved: order.filter((id) => angle(id, 0.5) !== 0 && rotationPath.has(id)), locals };
}

function keyJoints(slot: Slot, moved: readonly number[], locals: readonly ReadonlyMap<number, quat>[]): void {
  const turned = (id: number | undefined, frame: number) => id === undefined ? undefined : locals[frame]?.get(id);
  tracks(model, (track, path) => {
    if (track === translation || track === rotation) return;
    const donor = originals.get(path); if (!donor || onGlobalClock(donor)) return;
    const key = donor.Keys.find((k) => k.Frame >= stand!.Interval[0] && k.Frame <= stand!.Interval[1]); if (!key) return;
    const id = moved.find((candidate) => rotationPath.get(candidate) === path);
    replaceKeys(track, slot, (frame) => { const q = turned(id, frame); return q ? new Float32Array(q) : key.Vector.slice(); }, key);
  });
  for (const node of [...model.Bones, ...model.Helpers]) {
    const id = node.ObjectId, path = rotationPath.get(id);
    if (path === undefined || (!moved.includes(id) && node.Rotation === undefined) || (originals.get(path)?.Keys.length ?? 0) > 0) continue;
    node.Rotation ??= { LineType: mdx.LineType.Linear, GlobalSeqId: NO_GLOBAL_SEQ, Keys: source.Sequences.flatMap((s) => Array.from(s.Interval, (Frame) => ({ Frame, Vector: new Float32Array([0, 0, 0, 1]) }))) };
    replaceKeys(node.Rotation, slot, (frame) => new Float32Array(turned(id, frame) ?? [0, 0, 0, 1]));
  }
}

function keyRoot(slot: Slot, variant: Variant): void {
  if (variant.squash) helper.Scaling ??= { LineType: mdx.LineType.Linear, GlobalSeqId: NO_GLOBAL_SEQ, Keys: source.Sequences.flatMap((s) => Array.from(s.Interval, (Frame) => ({ Frame, Vector: new Float32Array([1, 1, 1]) }))) };
  if (helper.Scaling) replaceKeys(helper.Scaling, slot, (frame) => new Float32Array([1, 1, 1 - (variant.squash ?? 0) * amount(slot.pose, frame / slot.frames, "")]));
  replaceKeys(rotation, slot, (frame) => new Float32Array(lateral(variant.lean * amount(slot.pose, frame / slot.frames, ""))));
  replaceKeys(translation, slot, () => new Float32Array(3));
  const posed = new DrawnModel(generateMDX(model), 1);
  const grip = highestGrip(posed, slot.index, 0, grips);
  replaceKeys(translation, slot, (frame) => {
    const [x, z] = slot.pose === "ledgeHang" ? ledgeGripOffset(posed, slot.index, frame / 60, grip, character) : [0, Math.max(standFloor - floor(posed, slot.index, frame / 60), standLowest - lowest(posed, slot.index, frame / 60))];
    return new Float32Array([x - (slot.pose === "ledgeHang" ? variant.back ?? 0 : 0), 0, z - (slot.pose === "ledgeHang" ? variant.drop ?? 0 : 0)]);
  });
}

function author(slot: Slot, variant: Variant): number {
  const { moved, locals } = solveJoints(slot, variant);
  keyJoints(slot, moved, locals);
  keyRoot(slot, variant);
  return moved.length;
}

interface Shortfall { readonly value: number; readonly pass: boolean; readonly report: string }
const SUNK_TOLERANCE = 0.005;
const WEAPON_JOINTS = new Set(["weapon", "weapon.L"]);
const bodyBottom = (frame: ScoreFrame, held: Uint8Array) => {
  let bottom = Infinity;
  for (let v = 0; v < frame.vertices.length / 2; v++) if (frame.drawn[v] !== 0 && held[v] !== 1) bottom = Math.min(bottom, frame.vertices[v * 2 + 1] ?? Infinity);
  return bottom;
};
function poseShortfall(pose: Pose, stand: ScoreFrame, at: (frame: number) => ScoreFrame, frames: number, headroom: (frame: ScoreFrame) => number, held: Uint8Array): Shortfall {
  if (pose === "crouch") {
    const crouch = at(frames), s = scoreCrouch(stand, crouch, ppu), sunk = Math.max(0, bodyBottom(stand, held) - bodyBottom(crouch, held)) / bodyHeight(stand);
    return { value: Math.max(0, s.heightRatio - (CROUCH_THRESHOLDS.height - 0.1)) + Math.max(0, CROUCH_THRESHOLDS.contrast - s.contrast) + 3 * Math.max(0, sunk - SUNK_TOLERANCE), pass: s.pass && sunk <= SUNK_TOLERANCE,
      report: `height ${s.heightRatio.toFixed(3)} contrast ${s.contrast.toFixed(3)}${sunk > 0 ? ` sunk ${sunk.toFixed(3)}` : ""}` };
  }
  const t = LEDGE_THRESHOLDS;
  const hang = Array.from({ length: 10 }, (_, i) => at(Math.round((i + 1) * frames / 10)));
  const s = scoreLedgeHang(stand, hang, parts, { x: LEDGE_HANG_OUTSET, z: LEDGE_HANG_DEPTH });
  return { value: 3 * Math.max(0, Math.max(...hang.map(headroom)) + 0.05) + Math.max(0, s.grip - t.grip) / t.grip + 3 * (Math.max(0, t.below + 0.06 - s.below) + Math.max(0, t.clear + 0.03 - s.clear) + Math.max(0, t.fit + 0.03 - s.fit)), pass: s.pass, report: `grip ${s.grip.toFixed(3)} below ${s.below.toFixed(3)} clear ${s.clear.toFixed(3)} fit ${s.fit.toFixed(3)}` };
}

function classicShortfall(slot: Slot): Shortfall {
  const drawn = new DrawnModel(generateMDX(model), scale);
  return poseShortfall(slot.pose, standFrame, (frame) => ({ frame, ...drawn.posed(slot.index, frame / 60, 1) }), slot.frames,
    (frame) => headId === undefined ? -1 : ((frame.nodes[headId * 2 + 1] ?? 0) - LEDGE_HANG_DEPTH) / standHeight,
    drawn.influencedBy(new Set(Object.entries(rig!.classic).flatMap(([joint, bone]) => WEAPON_JOINTS.has(joint) && bone !== undefined ? [bone] : []))));
}

function definitiveShortfall(slot: Slot, hd: DefinitiveLook): Shortfall {
  ensure(standing.clip !== undefined, `${fighter!.name}: the sampled fighter shows no standing clip`);
  const keep = [...new Set([referenceStand, standing.clip, slot.index])].sort((a, b) => a - b);
  const drawn = new DrawnModel(retargetedSequences(model, rig!, hd, keep), scale);
  const stand: ScoreFrame = { frame: 0, ...drawn.posed(keep.indexOf(standing.clip), standing.seconds, 1) };
  return poseShortfall(slot.pose, stand, (frame) => ({ frame, ...drawn.posed(keep.indexOf(slot.index), frame / 60, 1) }), slot.frames, () => -1,
    drawn.influencedBy(new Set(rig!.pairs.flatMap(([joint, bone]) => WEAPON_JOINTS.has(joint) ? [bone] : []))));
}

function shortfall(slot: Slot, classicBest: Shortfall | undefined): Shortfall {
  const classic = classicShortfall(slot);
  if (classicBest === undefined || look === undefined) return classic;
  if (classicBest.pass ? !classic.pass : classic.value > classicBest.value + 1e-6) return { ...classic, value: 10 + classic.value };
  const definitive = definitiveShortfall(slot, look);
  return { value: Math.max(classic.value, definitive.value), pass: classic.pass && definitive.pass, report: `${classic.report}; definitive ${definitive.report}` };
}

let cursor = Math.max(...source.Sequences.map((s) => s.Interval[1])) + 100;
const slots: Slot[] = [];
for (const pose of poses) {
  const bound = clipFor(character, pose).index, boundSequence = source.Sequences[bound];
  const replaced = boundSequence !== undefined && OWN_CLIP.test(boundSequence.Name) && bound !== standIndex;
  const frames = replaced ? Math.round((boundSequence.Interval[1] - boundSequence.Interval[0]) * 60 / 1000) : FRAMES[pose];
  const slot: Slot = { pose, index: replaced ? bound : model.Sequences.length, start: replaced ? boundSequence.Interval[0] : cursor, frames, replaced };
  if (!replaced) {
    cursor = slot.start + ms(frames) + 100;
    model.Sequences.push({ ...stand, Name: `Movement ${pose}`, Interval: new Uint32Array([slot.start, slot.start + ms(frames)]), NonLooping: pose === "crouch", MoveSpeed: 0, Rarity: 0,
      MinimumExtent: new Float32Array([-300, -300, -250]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
  }
  const space = OWN.MOVEMENT_POSES?.[pose] ?? SPACES[pose], pinned = PINNED[character]?.[pose];
  const evaluate = (choice: Choice, floor: Shortfall | undefined) => { ensure(author(slot, space.variant(choice)) >= 3, `${fighter.name}: ${pose} moves fewer than three joints`); return { choice, ...shortfall(slot, floor) }; };
  const descend = (start: Choice, floor: Shortfall | undefined, coarse: number) => {
    let found = evaluate(start, floor);
    for (let pass = 0; pass < coarse + (space.local ? 1 : 0); pass++) for (const [key, values] of searched(space.options)) for (const value of space.local ? neighbours(values, found.choice[key]) : values) {
      const tried = evaluate({ ...found.choice, [key]: value }, floor);
      if (tried.value < found.value - 1e-6) found = tried;
    }
    for (let pass = 0; pass < 2; pass++) for (const [key, values] of searched(space.options)) {
      const step = Math.min(...values.slice(1).map((value, index) => value - (values[index] ?? value))) / (2 * (pass + 1));
      if (!Number.isFinite(step) || key === "frame") continue;
      for (const value of [(found.choice[key] ?? 0) - step, (found.choice[key] ?? 0) + step]) {
        const tried = evaluate({ ...found.choice, [key]: value }, floor);
        if (tried.value < found.value - 1e-6) found = tried;
      }
    }
    return found;
  };
  const random = mulberry32(character * 7919 + (pose === "crouch" ? 1 : 2));
  const scattered = Array.from({ length: space.randomStarts ?? 0 }, () => Object.fromEntries(Object.entries(space.options).map(([key, values]) => [key, values[Math.floor(random() * values.length)] ?? 0])));
  const classicBest = pinned ? evaluate(pinned, undefined) : [...space.starts, ...scattered].map((start) => descend(start, undefined, 3)).reduce((a, b) => b.value < a.value - 1e-6 ? b : a);
  const refined = look === undefined || pinned ? undefined : descend(classicBest.choice, classicBest, 1);
  const floor = refined?.pass === true ? classicBest : undefined;
  const best = floor === undefined ? classicBest : refined!;
  author(slot, space.variant(best.choice));
  const written = shortfall(slot, floor);
  ensure(Math.abs(written.value - best.value) < 1e-6, `${fighter.name}: ${pose} re-authored as ${written.report}, not the chosen ${best.report}`);
  slots.push(slot);
  console.log(`MOVEMENT_CLIPS ${fighter.name} ${pose}: ${describe(best.choice)}; ${written.report}${look !== undefined && floor === undefined ? `; definitive ${definitiveShortfall(slot, look).report}${pinned ? "" : " (fails, so Classic-only)"}` : ""}; ${replaced ? `re-authored clip ${slot.index} in place` : `bind ${pose}: { index: ${slot.index}, seconds: ${seconds(frames / 60)} }`}`);
}

function sampled(track: mdx.AnimVector, start: number, end: number, frame: number): Float32Array | undefined {
  const inside = track.Keys.filter((k) => k.Frame >= start && k.Frame <= end);
  const next = inside.findIndex((k) => k.Frame >= frame), b = inside[next < 0 ? inside.length - 1 : next], a = next > 0 ? inside[next - 1] : b;
  if (a === undefined || b === undefined) return undefined;
  return blend(a.Vector, b.Vector, b.Frame === a.Frame ? 0 : (frame - a.Frame) / (b.Frame - a.Frame));
}
function blend(from: ArrayLike<number>, to: ArrayLike<number>, weight: number): Float32Array<ArrayBuffer> {
  if (from.length === 4) return new Float32Array(quat.slerp(quat.create(), Float32Array.from(from) as unknown as quat, Float32Array.from(to) as unknown as quat, weight));
  return from.length === 3 ? Float32Array.from(from, (v, i) => v + ((to[i] ?? v) - v) * weight) : Float32Array.from(weight < 1 ? from : to);
}
function easeIntoHang(catchIndex: number, hang: Slot): void {
  const sequence = model.Sequences[catchIndex]; ensure(sequence, `${fighter?.name}: no ledge catch clip ${catchIndex}`);
  const [start = 0, end = 0] = sequence.Interval, span = { start, frames: Math.round((end - start) * 60 / 1000) };
  tracks(model, (track) => {
    const target = onGlobalClock(track) ? undefined : track.Keys.find((k) => k.Frame === hang.start); if (!target) return;
    const values = Array.from({ length: span.frames + 1 }, (_, frame) => blend(sampled(track, start, end, start + ms(frame)) ?? target.Vector, target.Vector, smooth(frame / (span.frames * CATCH_SETTLED))));
    replaceKeys(track, span, (frame) => values[frame]!, target);
  });
}
const hangSlot = slots.find((s) => s.pose === "ledgeHang" && s.replaced), catchIndex = LEDGE_CATCH_CLIPS[character];
const eased: { readonly index: number; readonly hang: Slot }[] = [];
if (hangSlot !== undefined && catchIndex !== undefined) { easeIntoHang(catchIndex, hangSlot); eased.push({ index: catchIndex, hang: hangSlot }); console.log(`MOVEMENT_CLIPS ${fighter.name} eased ledge catch clip ${catchIndex} into the hang`); }

const bytes = encodeVerified(parseSource(generateMDX(model))), after = new DrawnModel(bytes, 1);
const replacedIndices = new Set([...slots.filter((s) => s.replaced).map((s) => s.index), ...eased.map((e) => e.index)]);
for (const [index, sequence] of source.Sequences.entries()) for (const fraction of [0, 0.5, 1]) {
  if (replacedIndices.has(index)) continue;
  const time = (sequence.Interval[1] - sequence.Interval[0]) * fraction / 1000;
  const a = before.triangles(index, time, 1), b = after.triangles(index, time, 1);
  ensure(a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? Infinity)) < 0.001), `${fighter.name}/${sequence.Name}: previous clip changed`);
}
for (const { index, hang: hangClip } of eased) {
  const [start = 0, end = 0] = model.Sequences[index]?.Interval ?? [], settled = after.triangles(index, (end - start) / 1000, 1), hang = after.triangles(hangClip.index, 0, 1);
  ensure(settled.length === hang.length && settled.every((v, i) => Math.abs(v - (hang[i] ?? Infinity)) < 0.001), `${fighter.name}: ledge catch clip ${index} doesn't settle into the hang`);
}
mkdirSync(dirname(join(output, fighter.source)), { recursive: true });
await Bun.write(join(output, fighter.source), bytes); chmodSync(join(output, fighter.source), 0o644);
const drawn = new DrawnModel(bytes, scale);
for (const { pose, index, frames } of slots) {
  const moments = [0, Math.round(frames / 4), Math.round(frames / 2), frames];
  await Bun.write(join(output, `${fighter.name}-${pose}.png`), sheet(`${fighter.name} ${pose}`, drawn,
    [1, -1].flatMap((facing) => moments.map((frame) => ({ frame, facing, clip: index, seconds: frame / 60, phase: AttackPhase.none, x: 0, z: 0,
      parts: pose === "ledgeHang" ? parts.map((part) => ({ ...part, state: HurtState.normal })) : [], strikes: [] }))), moments.length).png);
}
const tables: Record<number, Partial<Record<Pose, HeroClip>>> = { ...(MOVEMENT_CLIPS as Readonly<Record<number, HeroClipTable>>) };
tables[character] = { ...tables[character], ...Object.fromEntries(slots.filter((s) => !s.replaced).map((s) => [s.pose, { index: s.index, seconds: Math.fround(s.frames / 60) }])) };
const entries = Object.entries(tables).sort(([a], [b]) => Number(a) - Number(b)).flatMap(([id, table]) => Object.keys(table).length === 0 ? [] : [`  ${id}: {`,
  ...Object.entries(table).map(([pose, clip]) => `    ${pose}: { index: ${clip.index}, seconds: ${seconds(Math.fround(clip.seconds))} },`), "  },"]);
await Bun.write(join(project, "ts/src/game/presentation/movementClipInfo.ts"), [
  "// Generated by tools/animations/movement-clips.ts; regenerate instead of editing.",
  ...(entries.some((line) => line.includes("f32(")) ? ['import { f32 } from "wisp/src/sim/f32";'] : []),
  'import type { HeroClipTable } from "../sim/heroes/hero";',
  "export const MOVEMENT_CLIPS = {", ...entries, "} as const satisfies Readonly<Record<number, HeroClipTable>>;", ""].join("\n"));
