import { join } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { GOLD_SACK_ACTIVE, GOLD_SACK_CHARGE, goldSackArcAt } from "../../ts/src/game/fighters/peon/specials";
import { seconds } from "./asset-info";
import { ensure } from "./original-clips";
import { type Action, type Gesture, type Phase, phase } from "./peon-gesture";

const LUMBER_GEOSET = 3, POLE_THICKNESS = 0.2, SWING = { first: 4, ready: 8, folded: 26 }, SACK_GEOSET = 2, SACK_SCALES = [0.4, 0.5, 0.6, 0.72, 0.86], HANDFUL = GOLD_SACK_CHARGE.full / GOLD_SACK_CHARGE.stages;
const BONK_STRIKE = 12, BONK_FRAMES = BONK_STRIKE + 26, SACK_HANG = 12, STOW_FRAMES = 6;
const holding: Gesture = { axe: -48, elbow: -42, grip: -12, chest: 8, head: -6, knee: 10 };
const handful = (at: number): Phase[] => [phase(at + 6, { ...holding, grip: 18, elbow: -30, twist: -14 }), phase(at + 13, { ...holding, grip: -78, elbow: -58, chest: 12 }),
  phase(at + 17, { ...holding, grip: -66, elbow: -62, chest: 16, head: -14 }), phase(at + HANDFUL, holding)];
const sackCharge: Action = { name: "goldSackCharge", frames: GOLD_SACK_CHARGE.hold + GOLD_SACK_CHARGE.full, air: true,
  phases: [phase(0), phase(GOLD_SACK_CHARGE.hold, holding), ...Array.from({ length: GOLD_SACK_CHARGE.stages }, (_, j) => handful(GOLD_SACK_CHARGE.hold + j * HANDFUL)).flat()] };
const sackBonk = (stage: number): Action => ({ name: `goldSackBonk${stage}`, frames: BONK_FRAMES, phases: [phase(0, { ...holding, grip: -50, elbow: -50 }),
  phase(4, { axe: -150, grip: -150, elbow: -20, chest: -10, knee: 20 }), phase(7, { axe: -225, grip: -225, elbow: -10, chest: -24, lean: -10, head: 14, knee: 28 }),
  phase(9, { axe: -235, grip: -235, elbow: -6, chest: -28, lean: -12, head: 16, knee: 30 }), phase(BONK_STRIKE, { axe: -170, grip: -170, elbow: -4, chest: 4, lean: 2, ahead: 4, knee: 14 }),
  phase(BONK_STRIKE + GOLD_SACK_ACTIVE[stage]! - 1, { axe: -98, grip: -98, elbow: -4, chest: 24, lean: 8, ahead: 10, knee: 26 }),
  phase(20, { axe: -99, grip: -99, chest: 44, lean: 10, ahead: 10, knee: 40 }), phase(28, { axe: -70, grip: -70, chest: 30, lean: 6, ahead: 6, knee: 28 }), phase(BONK_FRAMES)] });
export const SACK_ACTIONS: readonly Action[] = [sackCharge, ...SACK_SCALES.map((_, stage) => sackBonk(stage))];
export const SACK_MOMENTS = (cell: number): readonly number[] => cell === 0 ? [0, 6, 12, 19, 26, 46, 66, 86] : [4, 8, 10, 12, 13, 14, 15, 16, 17, 26];
const sackScale = (cell: number, frame: number) => SACK_SCALES[cell === 0 ? Math.min(GOLD_SACK_CHARGE.stages, Math.floor(Math.max(0, frame - GOLD_SACK_CHARGE.hold) / HANDFUL)) : cell - 1]!;

export function appendSackSequences(model: mdx.Model): void {
  for (const action of SACK_ACTIONS) {
    if (model.Sequences.some(s => s.Name === `Peon ${action.name}`)) continue;
    const start = Math.max(...model.Sequences.map(s => s.Interval[1]!)) + 100;
    model.Sequences.push({ ...structuredClone(model.Sequences[38]!), Name: `Peon ${action.name}`, Interval: new Uint32Array([start, start + Math.round(action.frames * 1000 / 60)]), NonLooping: true });
  }
}

const everySequence = (model: mdx.Model, vector: (index: number) => readonly number[]) =>
  model.Sequences.flatMap((s, index) => Array.from(s.Interval, Frame => ({ Frame, Vector: new Float32Array(vector(index)) }))).sort((a, b) => a.Frame - b.Frame);

const stowed = (cell: number, f: number) => cell > 0 ? Math.max(0, Math.min(1, (BONK_FRAMES - f) / STOW_FRAMES)) : 1;
const axeKeys = (start: number, cell: number) => Array.from({ length: SACK_ACTIONS[cell]!.frames + 1 }, (_, f) => f).filter(f => f === 0 || f === SACK_ACTIONS[cell]!.frames || (cell > 0 && f >= BONK_FRAMES - STOW_FRAMES))
  .map(f => { const shown = Math.max(0.01, 1 - stowed(cell, f)); return { Frame: start + Math.round(f * 1000 / 60), Vector: new Float32Array([shown, shown, shown]) }; });

export function carrySack(model: mdx.Model, indices: readonly number[]): void {
  const motion = model.Helpers.find(h => h.Name === "Peon Motion"), bag = model.Bones.find(b => b.Name === "GoldBag Root"), axe = model.Bones.find(b => b.Name === "axehandle");
  const anim = model.GeosetAnims.find(a => a.GeosetId === SACK_GEOSET), geoset = model.Geosets[SACK_GEOSET];
  ensure(motion !== undefined && bag !== undefined && axe !== undefined && anim !== undefined && geoset !== undefined, "Peon gold bag, axe or motion helper missing");
  const low = [0, 1, 2].map(k => Math.min(...geoset.Vertices.filter((_, i) => i % 3 === k))), high = [0, 1, 2].map(k => Math.max(...geoset.Vertices.filter((_, i) => i % 3 === k)));
  const neck = new Float32Array([(low[0]! + high[0]!) / 2, (low[1]! + high[1]!) / 2, high[2]!]);
  let sack = model.Bones.find(b => b.Name === "Peon Sack");
  if (sack === undefined) {
    const id = model.Nodes.length;
    sack = { ...structuredClone(bag), Name: "Peon Sack", ObjectId: id, Parent: motion.Parent, PivotPoint: neck, GeosetId: model.Geosets.length, GeosetAnimId: model.GeosetAnims.length,
      Rotation: { LineType: 1, GlobalSeqId: -1, Keys: [] }, Translation: { LineType: 1, GlobalSeqId: -1, Keys: [] }, Scaling: { LineType: 1, GlobalSeqId: -1, Keys: [] } };
    model.Bones.push(sack); model.Nodes.push(sack); model.PivotPoints.push(sack.PivotPoint);
    const copy = structuredClone(geoset);
    copy.Groups = [[id]]; copy.TotalGroupsCount = 1; copy.VertexGroup = new Uint8Array(copy.Vertices.length / 3);
    model.Geosets.push(copy); model.GeosetAnims.push({ ...structuredClone(anim), GeosetId: model.Geosets.length - 1 });
  }
  const shown = model.GeosetAnims.find(a => a.GeosetId === sack.GeosetId)?.Alpha;
  ensure(shown !== undefined && typeof shown !== "number", "Peon sack geoset lacks its alpha track");
  shown.Keys = everySequence(model, index => [indices.includes(index) ? 1 : 0]);
  axe.Scaling ??= { LineType: 0, GlobalSeqId: -1, Keys: everySequence(model, () => [1, 1, 1]) };
  const ranges = indices.map(index => model.Sequences[index]!.Interval);
  axe.Scaling.Keys = [...axe.Scaling.Keys.filter(k => ranges.every(([from, to]) => k.Frame < from! || k.Frame > to!)),
    ...indices.flatMap((index, cell) => axeKeys(model.Sequences[index]!.Interval[0]!, cell))].sort((a, b) => a.Frame - b.Frame);
  for (const track of [sack.Rotation!, sack.Translation!, sack.Scaling!]) track.Keys = [];
  const lumber = model.Bones.find(b => b.Name === "Lumber"), lumberAnim = model.GeosetAnims.find(a => a.GeosetId === LUMBER_GEOSET), wood = model.Geosets[LUMBER_GEOSET];
  ensure(lumber !== undefined && lumberAnim !== undefined && wood !== undefined, "Peon lumber geoset missing");
  const woodLow = [0, 1, 2].map(k => Math.min(...wood.Vertices.filter((_, i) => i % 3 === k))), woodHigh = [0, 1, 2].map(k => Math.max(...wood.Vertices.filter((_, i) => i % 3 === k)));
  const butt = new Float32Array([woodLow[0]!, (woodLow[1]! + woodHigh[1]!) / 2, (woodLow[2]! + woodHigh[2]!) / 2]), woodLength = woodHigh[0]! - woodLow[0]!;
  let pole = model.Bones.find(b => b.Name === "Peon Pole");
  if (pole === undefined) {
    const id = model.Nodes.length;
    pole = { ...structuredClone(lumber), Name: "Peon Pole", ObjectId: id, Parent: motion.Parent, PivotPoint: butt, GeosetId: model.Geosets.length, GeosetAnimId: model.GeosetAnims.length,
      Rotation: { LineType: 1, GlobalSeqId: -1, Keys: [] }, Translation: { LineType: 1, GlobalSeqId: -1, Keys: [] }, Scaling: { LineType: 1, GlobalSeqId: -1, Keys: [] } };
    model.Bones.push(pole); model.Nodes.push(pole); model.PivotPoints.push(pole.PivotPoint);
    const copy = structuredClone(wood);
    copy.Groups = [[id]]; copy.TotalGroupsCount = 1; copy.VertexGroup = new Uint8Array(copy.Vertices.length / 3);
    model.Geosets.push(copy); model.GeosetAnims.push({ ...structuredClone(lumberAnim), GeosetId: model.Geosets.length - 1 });
  }
  const poleShown = model.GeosetAnims.find(a => a.GeosetId === pole.GeosetId)?.Alpha;
  ensure(poleShown !== undefined && typeof poleShown !== "number", "Peon pole geoset lacks its alpha track");
  poleShown.Keys = everySequence(model, index => [indices.slice(1).includes(index) ? 1 : 0]);
  for (const track of [pole.Rotation!, pole.Translation!, pole.Scaling!]) track.Keys = [];
  const drawn = new DrawnModel(generateMDX(model), 1), nodes = drawn.nodes(), node = (name: string) => nodes.findIndex(n => n.name === name);
  const [handL, handR, shoulderL, shoulderR] = ["Bone_Hand_L", "Bone_Hand_R", "Bone_Arm1_L", "Bone_Arm1_R"].map(node);
  const degrees = (from: number, to: number, share: number) => from + (((to - from + 540) % 360) - 180) * share;
  for (const [cell, index] of indices.entries()) {
    const action = SACK_ACTIONS[cell]!, start = model.Sequences[index]!.Interval[0]!, count = cell === 0 ? 0 : GOLD_SACK_ACTIVE[cell - 1]!, last = BONK_STRIKE + count - 1;
    const posed = Array.from({ length: action.frames + 1 }, (_, f) => {
      const { nodes: at } = drawn.posed(index, f / 60, 1), x = (n: number) => at[n * 2]!, z = (n: number) => at[n * 2 + 1]!;
      const hand = { x: (x(handL!) + x(handR!)) / 2, z: (z(handL!) + z(handR!)) / 2 }, shoulder = { x: (x(shoulderL!) + x(shoulderR!)) / 2, z: (z(shoulderL!) + z(shoulderR!)) / 2 };
      return { hand, right: { x: x(handR!), z: z(handR!) }, arm: Math.atan2(hand.z - shoulder.z, hand.x - shoulder.x) * 180 / Math.PI };
    });
    const hung = (s: number) => (high[2]! - low[2]!) * 0.75 * s;
    const reach = (f: number) => {
      const capsule = goldSackArcAt(f - BONK_STRIKE, count), hand = posed[f]!.hand, along = { x: capsule.x2 - hand.x, z: capsule.z2 - hand.z }, gap = Math.hypot(along.x, along.z);
      return { angle: Math.atan2(along.z, along.x) * 180 / Math.PI, reach: gap - hung(SACK_SCALES[cell - 1]!) / 2 };
    };
    const first = cell > 0 ? reach(BONK_STRIKE) : undefined, end = cell > 0 ? reach(last) : undefined;
    for (let f = 0; f <= action.frames; f++) {
      const { hand, right, arm } = posed[f]!, Frame = start + Math.round(f * 1000 / 60), s = sackScale(cell, f) * Math.max(0.05, stowed(cell, f));
      const swung = cell > 0 && f >= SWING.first && f < BONK_FRAMES - STOW_FRAMES;
      let aim = 0, out = 0;
      if (swung && f >= BONK_STRIKE && f <= last) ({ angle: aim, reach: out } = reach(f));
      else if (swung && f < BONK_STRIKE) {
        aim = f <= SWING.ready ? arm : degrees(posed[SWING.ready]!.arm, first!.angle, (f - SWING.ready) / (BONK_STRIKE - SWING.ready));
        out = first!.reach * (f - SWING.first) / (BONK_STRIKE - SWING.first);
      } else if (swung) { aim = end!.angle; out = end!.reach * Math.max(0, 1 - (f - last) / (SWING.folded - last)); }
      const at = swung ? hand : right, rad = aim * Math.PI / 180, hang = swung ? aim + 90 : SACK_HANG, half = -hang * Math.PI / 360, poleHalf = -aim * Math.PI / 360;
      const neckX = at.x + Math.cos(rad) * out, neckZ = at.z + Math.sin(rad) * out;
      sack.Translation!.Keys.push({ Frame, Vector: new Float32Array([neckX - neck[0]!, -neck[1]!, neckZ - neck[2]!]) });
      sack.Rotation!.Keys.push({ Frame, Vector: new Float32Array([0, Math.sin(half), 0, Math.cos(half)]) });
      sack.Scaling!.Keys.push({ Frame, Vector: new Float32Array([s * 1.25, s * 1.25, s * 0.75]) });
      pole.Translation!.Keys.push({ Frame, Vector: new Float32Array([at.x - butt[0]!, -butt[1]!, at.z - butt[2]!]) });
      pole.Rotation!.Keys.push({ Frame, Vector: new Float32Array([0, Math.sin(poleHalf), 0, Math.cos(poleHalf)]) });
      pole.Scaling!.Keys.push({ Frame, Vector: new Float32Array([Math.max(0.01, out) / woodLength, POLE_THICKNESS, POLE_THICKNESS]) });
    }
  }
}

export function sackStrikes(cell: number, frame: number, facing: number) {
  const count = cell === 0 ? 0 : GOLD_SACK_ACTIVE[cell - 1]!, index = frame - BONK_STRIKE;
  if (index < 0 || index >= count) return [];
  const capsule = goldSackArcAt(index, count);
  return [{ x1: facing * capsule.x1, z1: capsule.z1, x2: facing * capsule.x2, z2: capsule.z2, radius: 14 + 2 * (cell - 1) }];
}

export async function writeSackClips(project: string, indices: readonly number[]): Promise<void> {
  const row = (cell: number) => `{ index: ${indices[cell]}, seconds: ${seconds(Math.round(SACK_ACTIONS[cell]!.frames * 1000 / 60) / 1000)}, aligned: true }`;
  await Bun.write(join(project, "ts/src/game/fighters/peon/goldSackClips.ts"), [
    "// Generated by tools/animations/peon-clips.ts sack; regenerate instead of editing.", 'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClip } from "../../sim/heroes/hero";',
    `export const GOLD_SACK_STRIKE_FRAME = ${BONK_STRIKE};`, `export const GOLD_SACK_BONK_FRAMES = ${BONK_FRAMES};`,
    `export const GOLD_SACK_CHARGE_CLIP: HeroClip = ${row(0)};`, "export const GOLD_SACK_BONK_CLIPS: readonly HeroClip[] = [", ...SACK_SCALES.map((_, stage) => `  ${row(stage + 1)},`), "];", ""].join("\n"));
}

const SACK_FIT = { inside: 8, tip: 8, grip: 30 };

export function checkSackReach(drawn: DrawnModel, indices: readonly number[]): string {
  const sackVertices = (name: string) => Array.from(drawn.influencedBy(new Set([name]))).flatMap((inside, vertex) => inside === 1 ? [vertex] : []);
  const [sack, pole] = [sackVertices("Peon Sack"), sackVertices("Peon Pole")];
  const nodes = drawn.nodes(), hands = ["Bone_Hand_L", "Bone_Hand_R"].map(name => nodes.findIndex(n => n.name === name));
  const misses: string[] = [], rows: string[] = [];
  for (const [cell, index] of indices.entries()) for (let f = BONK_STRIKE; cell > 0 && f < BONK_STRIKE + GOLD_SACK_ACTIVE[cell - 1]!; f++) {
    const [capsule] = sackStrikes(cell, f, 1)!, posed = drawn.posed(index, f / 60, 1);
    const at = (vertex: number): [number, number] => [posed.vertices[vertex * 2]!, posed.vertices[vertex * 2 + 1]!];
    const outside = (vertex: number) => { const [px, pz] = at(vertex), ux = capsule!.x2 - capsule!.x1, uz = capsule!.z2 - capsule!.z1, t = Math.max(0, Math.min(1, ((px - capsule!.x1) * ux + (pz - capsule!.z1) * uz) / (ux * ux + uz * uz))); return Math.max(0, Math.hypot(px - capsule!.x1 - ux * t, pz - capsule!.z1 - uz * t) - capsule!.radius); };
    const worst = Math.max(...[...sack, ...pole].map(outside)), points = sack.map(at), centre = [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
    const tip = Math.hypot(centre[0]! - capsule!.x2, centre[1]! - capsule!.z2), hand = [0, 1].reduce((s, h) => s + posed.nodes[hands[h]! * 2]! / 2, 0), handZ = [0, 1].reduce((s, h) => s + posed.nodes[hands[h]! * 2 + 1]! / 2, 0), grip = Math.hypot(hand - capsule!.x1, handZ - capsule!.z1);
    rows.push(`stage ${cell - 1} f${f}: sack+pole outside ${worst.toFixed(1)}, sack centre ${tip.toFixed(1)} from far end, hands ${grip.toFixed(1)} from grip`);
    if (worst > SACK_FIT.inside || tip > SACK_FIT.tip || grip > SACK_FIT.grip) misses.push(rows[rows.length - 1]!);
  }
  ensure(misses.length === 0, `Gold Sack drawn reach misses the hit arc:\n${misses.join("\n")}`);
  return rows.join("\n");
}
