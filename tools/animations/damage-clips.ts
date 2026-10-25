import { NO_GLOBAL_SEQ } from "./animVector";
import { chmodSync, cpSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { mat4, quat, vec3 } from "../../ts/node_modules/gl-matrix";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { contactDamageClips } from "../../ts/src/game/presentation/damagePose";
import type { Character } from "../../ts/src/game/sim/codes";
import { encodeVerified, ensure, onGlobalClock, parseSource } from "./original-clips";
import { fighters } from "../../ts/scripts/heroModelSource";
import { FIGHTER_RIGS } from "./rigs";
import type { PainHeight, PainLimb, PainRow, PainTurn } from "./canonical-rig";
import { HIGH_STRETCH, PAIN_GAIN, PainBody, painGate } from "./pain-gate";

const USAGE = "usage: bun tools/animations/damage-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT --fighter NAME...";
const args = process.argv.slice(2);
const [input, output] = args.slice(0, 2).map(p => resolve(p));
const named = args.slice(2).filter(arg => arg !== "--fighter").map(name => name.replaceAll(/[^A-Za-z]/g, "").toLowerCase());
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith("..") && args[2] === "--fighter" && named.length > 0, USAGE);
const chosen = [...fighters.entries()].filter(([, fighter]) => named.includes(fighter.name.toLowerCase()));
ensure(chosen.length === named.length, `${USAGE}; names are ${[...fighters.values()].map(f => f.name).join(", ")}`);
mkdirSync(output, { recursive: true });
for (const family of ["animation-assets", "illidan-animation", "hero-models", "imported-models"]) {
  cpSync(join(input, family), join(output, family), { recursive: true, dereference: true });
  chmodSync(join(output, family), 0o755);
}

const HEIGHTS: readonly PainHeight[] = ["low", "middle", "high"];
const CELL_NAMES = ["Low Small", "Low Medium", "Low Large", "Mid Small", "Mid Medium", "Mid Large", "High Small", "High Medium", "High Large"];
const RECOIL = [[0, 1], [3, 1], [12, 0.85], [24, 0.75]] as const;

const SHARED: Readonly<Record<PainHeight, Required<Pick<PainRow, "turn" | "aim">>>> = {
  low: {
    turn: { chest: 30, head: 40 },
    aim: { "thigh.front": 80, "shin.front": 170, "thigh.back": 178, "shin.back": 265, "arm.weapon": 140, "forearm.weapon": 120, "arm.free": 70, "forearm.free": 50 },
  },
  middle: {
    turn: { pelvis: 20, chest: 55, head: 65 },
    aim: { "thigh.front": 165, "shin.front": 180, "thigh.back": 195, "shin.back": 190, "arm.weapon": 155, "forearm.weapon": 250, "arm.free": 165, "forearm.free": 260 },
  },
  high: {
    turn: { pelvis: -8, chest: -20, head: -55 },
    aim: { "thigh.front": 175, "shin.front": 178, "thigh.back": 188, "shin.back": 185, "arm.weapon": 230, "forearm.weapon": 250, "arm.free": 330, "forearm.free": 340 },
  },
};

const wrap = (degrees: number) => ((degrees % 360) + 540) % 360 - 180;
const angle = (x: number, z: number) => Math.atan2(x, z) * 180 / Math.PI;

function geometryNodes(model: mdx.Model): Set<number> {
  const nodes = new Set<number>();
  for (const geoset of model.Geosets) {
    const material = model.Materials[geoset.MaterialID];
    if (material === undefined || !material.Layers.some(layer => Number(layer.FilterMode) <= 2)) continue;
    if (geoset.SkinWeights) for (let v = 0; v < geoset.SkinWeights.length; v += 8) for (let i = 0; i < 4; i++) { if (geoset.SkinWeights[v + 4 + i]! > 0) nodes.add(geoset.SkinWeights[v + i]!); }
    else for (const group of geoset.Groups) for (const node of group) nodes.add(node);
  }
  return nodes;
}

function worldMatrices(model: mdx.Model, sequence: number, frame: number): mat4[] {
  const renderer = new ModelRenderer(model), data = Reflect.get(renderer, "rendererData") as { frame: number; nodes: { matrix: Float32Array }[] };
  renderer.setSequence(sequence); data.frame = frame; renderer.update(0);
  return model.Nodes.map((_, id) => mat4.clone(data.nodes[id]!.matrix as unknown as mat4));
}

const rotationOf = (m: mat4) => { const out = quat.create(); mat4.getRotation(out, m); return quat.normalize(out, out); };

const generated: string[] = [], failed: string[] = [];
const evidence = [];
for (const [character, fighter] of chosen) {
  const rig = FIGHTER_RIGS.get(character as Character);
  ensure(rig, `${fighter.name}: no canonical rig`);
  const sourceBytes = await Bun.file(join(input, fighter.source)).arrayBuffer();
  const source = parseSource(sourceBytes);
  const model = structuredClone(source);
  const stand = source.Sequences.find(s => /^stand ready$/i.test(s.Name)) ?? source.Sequences.find(s => /^stand(?:\s*-?\s*\d+)?$/i.test(s.Name));
  ensure(stand, `${fighter.name}: no standing donor`);
  const standIndex = source.Sequences.indexOf(stand);
  const cells = (contactDamageClips(character) ?? []).map(clip => clip.index);
  ensure(cells.length === 9 && cells.every((index, cell) => source.Sequences[index]?.Name === `Damage Grid ${CELL_NAMES[cell]}`), `${fighter.name}: damage table does not name the shipped Damage Grid sequences`);
  const id = (name: string | undefined) => name === undefined ? -1 : model.Nodes.findIndex(node => node?.Name === name);
  const parent = (node: number) => model.Nodes[node]?.Parent ?? -1;
  const under = (node: number, root: number): boolean => node >= 0 && (node === root || under(parent(node), root));
  const weapons = [rig.classic.weapon, rig.classic["weapon.L"]].map(id).filter(node => node >= 0);
  const carried = (node: number) => weapons.some(weapon => under(node, weapon));
  const standKey = (track: mdx.AnimVector) => track.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]);
  const rekey = (track: mdx.AnimVector, start: number, end: number, vector: (frame: number, base: mdx.AnimKeyframe) => Float32Array) => {
    const found = standKey(track) ?? track.Keys.find(k => k.Frame >= start && k.Frame <= end);
    const blank = track.Keys[0];
    ensure(found ?? blank, "track has no keys");
    const base = found ?? { ...blank!, Vector: new Float32Array(blank!.Vector.length), ...(blank!.InTan ? { InTan: new Float32Array(blank!.Vector.length), OutTan: new Float32Array(blank!.Vector.length) } : {}) };
    track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
    for (const [frame] of RECOIL) {
      const v = vector(frame, base);
      track.Keys.push({ ...base, Frame: start + Math.round(frame * 1000 / 60), Vector: v, ...(base.InTan ? { InTan: v.slice(), OutTan: v.slice() } : {}) });
    }
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  };
  for (const bone of model.Bones) {
    const node = id(bone.Name);
    if (!bone.Rotation || onGlobalClock(bone.Rotation) || carried(node) || !standKey(bone.Rotation)) continue;
    for (const index of cells) { const [start, end] = model.Sequences[index]!.Interval; rekey(bone.Rotation, start!, end!, (_, base) => Float32Array.from(base.Vector)); }
  }

  const neutralBytes = generateMDX(model);
  const drawnNeutral = new DrawnModel(neutralBytes, 1);
  const pivots = drawnNeutral.posed(cells[0]!, 0, 1).nodes;
  const at = (node: number) => [pivots[node * 2]!, pivots[node * 2 + 1]!] as const;
  const joint = (name: keyof typeof rig.classic) => id(rig.classic[name]);
  const side = (s: "L" | "R") => weapons.some(weapon => under(weapon, joint(`wrist.${s}`))) ? 1 : 0;
  const weaponSide: "L" | "R" = side("L") > side("R") ? "L" : "R", freeSide = weaponSide === "L" ? "R" : "L";
  const frontSide: "L" | "R" = joint("ankle.L") >= 0 && joint("ankle.R") >= 0 && at(joint("ankle.L"))[0] > at(joint("ankle.R"))[0] ? "L" : "R", backSide = frontSide === "L" ? "R" : "L";
  const segments: { node: number; child: number; limb: PainLimb }[] = [];
  const add = (from: keyof typeof rig.classic, to: keyof typeof rig.classic, limb: PainLimb) => { if (joint(from) >= 0 && joint(to) >= 0) segments.push({ node: joint(from), child: joint(to), limb }); };
  add(`hip.${frontSide}`, `knee.${frontSide}`, "thigh.front"); add(`knee.${frontSide}`, `ankle.${frontSide}`, "shin.front");
  add(`hip.${backSide}`, `knee.${backSide}`, "thigh.back"); add(`knee.${backSide}`, `ankle.${backSide}`, "shin.back");
  add(`shoulder.${weaponSide}`, `elbow.${weaponSide}`, "arm.weapon"); add(`elbow.${weaponSide}`, `wrist.${weaponSide}`, "forearm.weapon");
  add(`shoulder.${freeSide}`, `elbow.${freeSide}`, "arm.free"); add(`elbow.${freeSide}`, `wrist.${freeSide}`, "forearm.free");
  for (const extra of rig.pain?.segments ?? []) { ensure(id(extra.node) >= 0 && id(extra.child) >= 0, `${fighter.name}: no ${extra.node}/${extra.child}`); segments.push({ node: id(extra.node), child: id(extra.child), limb: extra.limb }); }
  const turns: [number, PainTurn][] = [[joint("pelvis"), "pelvis"], [joint("chest"), "chest"], [joint("neck"), "neck"], [joint("head"), "head"], [joint(`wrist.${weaponSide}`), "wrist.weapon"], [joint(`wrist.${freeSide}`), "wrist.free"]];

  const geometry = geometryNodes(model);
  const chain = (node: number): number[] => node < 0 ? [] : [...chain(parent(node)), node];
  const chains = [...geometry].map(chain);
  let common = -1;
  for (let depth = 0; chains.every(c => c[depth] !== undefined && c[depth] === chains[0]![depth]); depth++) common = chains[0]![depth]!;
  const anchors = [...new Set(chains.map(c => c[common < 0 ? 0 : c.indexOf(common) + 1] ?? common))];
  const wrists = [joint("wrist.L"), joint("wrist.R")].filter(node => node >= 0);
  const loose = weapons.filter(weapon => !wrists.some(wrist => under(weapon, wrist))).map(weapon => {
    const [wx, wz] = at(weapon), reach = (wrist: number) => Math.hypot(at(wrist)[0] - wx, at(wrist)[1] - wz);
    return { weapon, hand: wrists.toSorted((a, b) => reach(a) - reach(b))[0]! };
  });
  for (const node of [...anchors, ...loose.map(item => item.weapon)].map(at => model.Nodes[at]!)) {
    node.Translation ??= { LineType: mdx.LineType.Linear, GlobalSeqId: NO_GLOBAL_SEQ, Keys: model.Sequences.flatMap(s => [s.Interval[0]!, s.Interval[1]!].map(Frame => ({ Frame, Vector: new Float32Array(3) }))) };
    ensure(!onGlobalClock(node.Translation), `${fighter.name}: ${node.Name} moves on a global clock`);
    for (const index of cells) { const [start, end] = model.Sequences[index]!.Interval; rekey(node.Translation, start!, end!, (_, base) => Float32Array.from(base.Vector)); }
  }

  const standFloor = new PainBody(sourceBytes, character as Character).floor(standIndex, 0);
  const deltas = new Map<number, number[][]>();
  for (const [cell, index] of cells.entries()) {
    const height = HEIGHTS[Math.floor(cell / 3)]!, strength = cell % 3;
    const weight = height === "high" ? HIGH_STRETCH[strength]! / HIGH_STRETCH[2] : PAIN_GAIN[strength]! / PAIN_GAIN[2];
    const shared = SHARED[height], own = rig.pain?.rows?.[height];
    const turn = { ...shared.turn, ...own?.turn }, aim = { ...shared.aim, ...own?.aim };
    const [start, end] = model.Sequences[index]!.Interval;
    const neutral = RECOIL.map(([frame]) => worldMatrices(model, index, start! + Math.round(frame * 1000 / 60)));
    const world = neutral[0]!.map(rotationOf);
    for (const [frame, recoil] of RECOIL) {
      const target = new Map<number, number>();
      for (const [node, name] of turns) if (node >= 0 && turn[name] !== undefined) target.set(node, turn[name]! * weight * recoil);
      for (const segment of segments) {
        const goal = aim[segment.limb];
        if (goal === undefined) continue;
        const [px, pz] = at(segment.node), [cx, cz] = at(segment.child);
        target.set(segment.node, wrap(goal - angle(cx - px, cz - pz)) * weight * recoil);
      }
      const total = (node: number): number => node < 0 ? 0 : target.get(node) ?? total(parent(node));
      for (let node = 0; node < model.Nodes.length; node++) {
        const turnBy = total(node) - total(parent(node));
        if (Math.abs(turnBy) < 1e-6) continue;
        const rows = deltas.get(node) ?? cells.map(() => RECOIL.map(() => 0));
        rows[cell]![RECOIL.findIndex(([f]) => f === frame)] = turnBy;
        deltas.set(node, rows);
      }
    }
    for (const [node, rows] of deltas) {
      const track = model.Nodes[node]!.Rotation;
      ensure(track && !onGlobalClock(track), `${fighter.name}: ${model.Nodes[node]!.Name} must turn but has no rotation track`);
      const before = parent(node) >= 0 ? world[parent(node)]! : quat.create();
      const inverse = quat.invert(quat.create(), before);
      rekey(track, start!, end!, (frame, base) => {
        const degrees = rows[cell]![RECOIL.findIndex(([f]) => f === frame)]!;
        const turnQ = quat.setAxisAngle(quat.create(), [0, 1, 0], degrees * Math.PI / 180);
        const out = quat.multiply(quat.create(), inverse, quat.multiply(quat.create(), turnQ, quat.multiply(quat.create(), before, base.Vector as unknown as quat)));
        return Float32Array.from(quat.normalize(out, out));
      });
    }
    deltas.clear();
    for (const { weapon, hand } of loose) {
      const node = model.Nodes[weapon]!, pivot = node.PivotPoint as unknown as vec3;
      const local = RECOIL.map(([frame], k) => {
        const moved = worldMatrices(model, index, start! + Math.round(frame * 1000 / 60));
        const follow = mat4.multiply(mat4.create(), moved[hand]!, mat4.invert(mat4.create(), neutral[k]![hand]!));
        const goal = mat4.multiply(mat4.create(), follow, neutral[k]![weapon]!);
        return mat4.multiply(mat4.create(), mat4.invert(mat4.create(), parent(weapon) >= 0 ? moved[parent(weapon)]! : mat4.create()), goal);
      });
      const frameAt = (frame: number) => RECOIL.findIndex(([f]) => f === frame);
      ensure(node.Rotation && !onGlobalClock(node.Rotation), `${fighter.name}: loose weapon ${node.Name} has no rotation track`);
      rekey(node.Rotation, start!, end!, frame => Float32Array.from(rotationOf(local[frameAt(frame)]!)));
      rekey(node.Translation!, start!, end!, frame => { const p = vec3.transformMat4(vec3.create(), pivot, local[frameAt(frame)]!); return Float32Array.from(vec3.subtract(p, p, pivot)); });
    }
  }

  const posedBytes = generateMDX(model);
  const posed = new PainBody(posedBytes, character as Character);
  for (const [cell, index] of cells.entries()) {
    const [start, end] = model.Sequences[index]!.Interval;
    const height = HEIGHTS[Math.floor(cell / 3)]!, strength = cell % 3;
    const weight = height === "high" ? HIGH_STRETCH[strength]! / HIGH_STRETCH[2] : PAIN_GAIN[strength]! / PAIN_GAIN[2];
    const drop = (rig.pain?.rows?.[height]?.drop ?? 0) * weight;
    const lift = RECOIL.map(([frame, recoil]) => standFloor + drop * recoil - posed.floor(index, frame / 60));
    for (const anchor of anchors) for (const [k, [frame]] of RECOIL.entries()) {
      const key = model.Nodes[anchor]!.Translation!.Keys.find(item => item.Frame === start! + Math.round(frame * 1000 / 60));
      ensure(key, `${fighter.name}: anchor key missing`);
      key.Vector = Float32Array.from(key.Vector);
      key.Vector[2] = key.Vector[2]! + lift[k]!;
      for (const tangent of ["InTan", "OutTan"] as const) if (key[tangent]) key[tangent] = key.Vector.slice();
    }
  }

  const encoded = encodeVerified(parseSource(generateMDX(model)));
  const before = new DrawnModel(sourceBytes, 1), after = new DrawnModel(encoded, 1);
  for (const [index, sequence] of source.Sequences.entries()) if (!cells.includes(index)) for (const t of [0, 0.5, 1]) {
    const time = (sequence.Interval[1] - sequence.Interval[0]) * t / 1000;
    const a = before.triangles(index, time, 1), b = after.triangles(index, time, 1);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), `${fighter.name}/${sequence.Name}: existing pose changed`);
  }
  for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) {
    const first = after.triangles(cells[a]!, 0, 1), second = after.triangles(cells[b]!, 0, 1);
    ensure(first.some((v, i) => Math.abs(v - second[i]!) > 2), `${fighter.name}: damage cells ${a}/${b} share a pose`);
  }
  const gate = painGate(encoded, character as Character, standIndex, cells);
  console.log(`### ${fighter.name}\n${gate.report}`);
  if (!gate.pass) failed.push(fighter.name);
  chmodSync(join(output, fighter.source), 0o644);
  await Bun.write(join(output, fighter.source), encoded);
  generated.push(fighter.name);
  evidence.push({ fighter: fighter.name, cells, anchors: anchors.map(a => model.Nodes[a]!.Name), weaponSide, frontSide, gate: gate.report });
  console.log(`DAMAGE_GRID_PASS ${fighter.name}: nine pain cells re-keyed in place, ${source.Sequences.length - 9} other sequences unchanged`);
}
await Bun.write(join(output, "damage-grid.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log(`DAMAGE_GRID_DONE ${generated.join(", ")} -> ${output}`);
ensure(failed.length === 0, `pain gate failed: ${failed.join(", ")}`);
