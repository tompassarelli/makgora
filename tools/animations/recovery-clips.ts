import { chmodSync, cpSync, lstatSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { Character } from "../../ts/src/game/sim/codes";
import { seconds } from "./asset-info";
import { ensure, parseSource, tracks, onGlobalClock, encodeVerified } from "./original-clips";
import { fighters } from "../../ts/scripts/heroModelSource";
import { type Action, actions, phaseAt, quaternion } from "./recovery-actions";

const args = process.argv.slice(2);
const valued = new Set(["--fighter", "--replace-pose"]);
const only = args.flatMap((arg, i) => args[i - 1] === "--fighter" ? [arg.toLowerCase()] : []);
const replacing = args.flatMap((arg, i) => args[i - 1] === "--replace-pose" ? [arg] : []);
const [assets, output] = args.filter((arg, i) => !arg.startsWith("--") && !valued.has(args[i - 1] ?? "")).map(p => resolve(p));
const metadataOnly = args.includes("--metadata-only");
ensure(assets && output, "usage: bun tools/animations/recovery-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--fighter NAME]... [--metadata-only | --replace-pose POSE...]");

const project = resolve(import.meta.dir, "../..");
ensure(relative(project, output).startsWith(".."), "Derived models must stay outside the checkout");

function keyMotion(model: mdx.Model, helper: mdx.Helper, action: Action, index: number, start: number, label: string): void {
  const translation: mdx.AnimKeyframe[] = [];
  for (let frame = 0; frame <= action.frames; frame++) {
    const p = phaseAt(action.phases, frame / action.frames), Frame = Math.round(start + frame * 1000 / 60);
    helper.Rotation?.Keys.push({ Frame, Vector: quaternion(p.roll + p.lean, p.yaw) });
    helper.Scaling?.Keys.push({ Frame, Vector: new Float32Array([1, 1, 1 - p.tuck]) });
    const key = { Frame, Vector: new Float32Array([0, 0, p.height]) };
    translation.push(key); helper.Translation?.Keys.push(key);
  }
  for (const track of [helper.Rotation, helper.Translation, helper.Scaling]) track?.Keys.sort((a, b) => a.Frame - b.Frame);
  if (action.airborne) return;
  const drawn = new DrawnModel(generateMDX(model), 1);
  for (let frame = 0; frame <= action.frames; frame++) {
    const triangle = drawn.triangles(index, frame / 60, 1);
    let lowest = Infinity;
    for (let i = 1; i < triangle.length; i += 2) lowest = Math.min(lowest, triangle[i] ?? Infinity);
    ensure(Number.isFinite(lowest), `${label}: invisible body`);
    const p = phaseAt(action.phases, frame / action.frames);
    translation[frame]!.Vector[2] -= lowest - p.height;
  }
}

function moves(drawn: DrawnModel, index: number, frames: number): number {
  const first = drawn.triangles(index, 0, 1);
  let motion = 0;
  for (let frame = 1; frame <= frames; frame++) {
    const after = drawn.triangles(index, frame / 60, 1);
    ensure(first.length === after.length, `sequence ${index}: body disappears`);
    for (let i = 0; i < first.length; i += 2) motion = Math.max(motion,
      Math.hypot((after[i] ?? 0) - (first[i] ?? 0), (after[i + 1] ?? 0) - (first[i + 1] ?? 0)));
  }
  return motion;
}

if (replacing.length > 0) {
  ensure(!metadataOnly, "--replace-pose re-keys shipped models; it takes no --metadata-only");
  for (const [character, fighter] of fighters.entries()) {
    if (only.length > 0 && !only.includes(fighter.name.toLowerCase())) continue;
    const shipped = parseSource(await Bun.file(join(assets, fighter.source)).arrayBuffer());
    if (!shipped.Helpers.some(n => n.Name === "Recovery Motion")) continue;
    const model = structuredClone(shipped);
    const moved = model.Helpers.find(n => n.Name === "Recovery Motion");
    ensure(moved, `${fighter.name}: no Recovery Motion helper`);
    const replaced = new Set<number>();
    for (const pose of replacing) {
      const action = actions(character).find(a => a.pose === pose);
      ensure(action, `${fighter.name}: no recovery action ${pose}`);
      const index = model.Sequences.findIndex(s => s.Name === `Recovery ${pose}`);
      const sequence = model.Sequences[index];
      ensure(sequence, `${fighter.name}: no Recovery ${pose} sequence`);
      const [start = 0, end = 0] = sequence.Interval;
      ensure(end === start + Math.round(action.frames * 1000 / 60), `${fighter.name}/${pose}: action length changed`);
      for (const track of [moved.Rotation, moved.Translation, moved.Scaling]) if (track) track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
      keyMotion(model, moved, action, index, start, `${fighter.name}/${pose}`);
      replaced.add(index);
    }
    const before = new DrawnModel(generateMDX(shipped), 1);
    const encoded = encodeVerified(parseSource(generateMDX(model)));
    const after = new DrawnModel(encoded, 1);
    for (const [index, sequence] of shipped.Sequences.entries()) {
      if (replaced.has(index)) continue;
      for (const progress of [0, 0.5, 1]) {
        const time = (sequence.Interval[1] - sequence.Interval[0]) * progress / 1000;
        const a = before.triangles(index, time, 1), b = after.triangles(index, time, 1);
        ensure(a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? Infinity)) < 0.001), `${fighter.name}/${sequence.Name}: an unrelated posed body changed`);
      }
    }
    for (const index of replaced) ensure(moves(after, index, Math.round((shipped.Sequences[index]!.Interval[1] - shipped.Sequences[index]!.Interval[0]) * 60 / 1000)) >= 5, `${fighter.name}/${shipped.Sequences[index]!.Name}: held stance instead of an action`);
    mkdirSync(join(output, fighter.source, ".."), { recursive: true });
    await Bun.write(join(output, fighter.source), encoded);
    console.log(`RECOVERY_CLIPS_REPLACED ${fighter.name}: ${replacing.join(", ")} re-keyed in place, every other sequence unchanged`);
  }
  process.exit(0);
}
mkdirSync(output, { recursive: true });
for (const family of metadataOnly ? [] : ["animation-assets", "hero-models"]) {
  ensure(lstatSync(join(output, family), { throwIfNoEntry: false })?.isSymbolicLink() !== true,
    `${family}: staging must contain real directories, never input-store links`);
  cpSync(join(assets, family), join(output, family), { recursive: true, dereference: true });
  chmodSync(join(output, family), 0o755);
}

const infoPath = join(project, "ts/src/game/presentation/recoveryClipInfo.ts");
const generated = new Map<number, string[]>(only.length === 0 ? [] : [...(await Bun.file(infoPath).text()).matchAll(/^  (\d+): \{\n[\s\S]*?\n  \},$/gm)].map(block => [Number(block[1]), block[0].split("\n")] as const));
const records: unknown[] = [];
for (const [character, fighter] of fighters.entries()) {
  if (only.length > 0 && !only.includes(fighter.name.toLowerCase())) continue;
  if (character === Character.demonHunter || character === Character.lichKing || character === Character.uther) continue;
  if (metadataOnly) {
    const model = parseSource(await Bun.file(join(output, fighter.source)).arrayBuffer());
    const bindings = actions(character).map(action => {
      const index = model.Sequences.findIndex(s => s.Name === `Recovery ${action.pose}`);
      const sequence = model.Sequences[index];
      ensure(sequence && sequence.NonLooping, `${fighter.name}/${action.pose}: retained action is missing or looping`);
      return `    ${action.pose}: { index: ${index}, seconds: ${seconds((sequence.Interval[1] - sequence.Interval[0]) / 1000)} },`;
    });
    generated.set(character, [`  ${character}: {`, ...bindings, "  },"]);
    continue;
  }
  const source = parseSource(await Bun.file(join(assets, fighter.source)).arrayBuffer());
  const model = structuredClone(source);
  ensure(!source.Helpers.some(n => n.Name === "Recovery Motion"), `${fighter.name}: use an unmodified source when regenerating`);
  const stand = source.Sequences.find(s => /^stand ready$/i.test(s.Name)) ?? source.Sequences.find(s => /^stand(?:\s*-?\s*\d+)?$/i.test(s.Name));
  const attack = source.Sequences.find(s => /^attack(?:\s*-?\s*\d+)?$/i.test(s.Name));
  ensure(stand && attack, `${fighter.name}: no standing/attack donor`);
  const preview = new DrawnModel(generateMDX(source), 1);
  const standing = preview.triangles(source.Sequences.indexOf(stand), 0, 1);
  const heights = Array.from(standing).filter((_, i) => i % 2 === 1);
  const centre = (Math.min(...heights) + Math.max(...heights)) / 2;
  const id = model.Nodes.length;
  const helper: mdx.Helper = { Name: "Recovery Motion", ObjectId: id, Parent: null, Flags: 0,
    PivotPoint: new Float32Array([0, 0, centre]),
    Rotation: { LineType: 1, GlobalSeqId: -1, Keys: [] }, Translation: { LineType: 1, GlobalSeqId: -1, Keys: [] }, Scaling: { LineType: 1, GlobalSeqId: -1, Keys: [] } };
  for (const node of [...model.Bones, ...model.Helpers, ...model.Attachments]) if (node.Parent == null) node.Parent = id;
  model.Helpers.push(helper); model.Nodes.push(helper); model.PivotPoints.push(helper.PivotPoint);

  for (const s of source.Sequences) for (const Frame of s.Interval) {
    helper.Rotation?.Keys.push({ Frame, Vector: new Float32Array([0, 0, 0, 1]) });
    helper.Translation?.Keys.push({ Frame, Vector: new Float32Array([0, 0, 0]) });
    helper.Scaling?.Keys.push({ Frame, Vector: new Float32Array([1, 1, 1]) });
  }
  const originalTracks = new Map<string, mdx.AnimVector>();
  tracks(source, (track, path) => originalTracks.set(path, track));
  let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
  const bindings: string[] = [];
  for (const action of actions(character)) {
    const donor = action.attack ? attack : stand;
    const start = cursor, end = start + Math.round(action.frames * 1000 / 60);
    const index = model.Sequences.length;
    cursor = end + 100;
    model.Sequences.push({ ...donor, Name: `Recovery ${action.pose}`, Interval: new Uint32Array([start, end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
      MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
    tracks(model, (track, path) => {
      const original = originalTracks.get(path);
      if (!original || onGlobalClock(original)) return;


      const channelDonor = /^\.(Bones|Helpers|Attachments|CollisionShapes)\./.test(path) ? donor : stand;
      for (const key of original.Keys) if (key.Frame >= channelDonor.Interval[0] && key.Frame <= channelDonor.Interval[1]) {
        track.Keys.push({ ...key, Frame: Math.round(start + (key.Frame - channelDonor.Interval[0]) * (end - start) / (channelDonor.Interval[1] - channelDonor.Interval[0])) });
      }
    });
    keyMotion(model, helper, action, index, start, `${fighter.name}/${action.pose}`);
    bindings.push(`    ${action.pose}: { index: ${index}, seconds: ${seconds((end - start) / 1000)} },`);
  }


  const packaged = parseSource(generateMDX(model));
  const encoded = encodeVerified(packaged);
  const finalPreview = new DrawnModel(encoded, 1);
  for (const [index, sequence] of source.Sequences.entries()) for (const progress of [0, 0.5, 1]) {
    const time = (sequence.Interval[1] - sequence.Interval[0]) * progress / 1000;
    const before = preview.triangles(index, time, 1), after = finalPreview.triangles(index, time, 1);
    ensure(before.length === after.length && before.every((v, i) => Math.abs(v - (after[i] ?? Infinity)) < 0.001),
      `${fighter.name}/${sequence.Name}: an existing posed body changed`);
  }
  for (const [offset, action] of actions(character).entries()) {
    const index = source.Sequences.length + offset;
    const motion = moves(finalPreview, index, action.frames);
    ensure(motion >= 5, `${fighter.name}/${action.pose}: held stance instead of an action (${motion})`);
  }
  chmodSync(join(output, fighter.source), 0o644);
  await Bun.write(join(output, fighter.source), encoded);
  generated.set(character, [`  ${character}: {`, ...bindings, "  },"]);
  records.push({ fighter: fighter.name, source: fighter.source, originalSequences: source.Sequences.length, appended: actions(character).map(a => a.pose) });
  console.log(`RECOVERY_CLIPS_PASS ${fighter.name}: ${bindings.length} appended actions, existing ${source.Sequences.length} indices preserved`);
}
await Bun.write(infoPath, [
  "// Generated by tools/animations/recovery-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";',
  'import { type HeroClipTable } from "../sim/heroes/hero";', "",
  "export const RECOVERY_CLIPS = {", ...[...generated].toSorted(([a], [b]) => a - b).flatMap(([, lines]) => lines), "} as const satisfies Readonly<Record<number, HeroClipTable>>;", "",
].join("\n"));
if (!metadataOnly) await Bun.write(join(output, "recovery-clips.json"), JSON.stringify(records, null, 2) + "\n");
