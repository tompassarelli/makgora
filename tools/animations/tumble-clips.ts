import { chmodSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { quat, vec3 } from "gl-matrix";
import { model as mdx } from "war3-model";
import { NO_GLOBAL_SEQ } from "./animVector";
import { FIGHTER_RIGS } from "./rigs";
import { generateModelMDX as generateMDX } from "../../ts/scripts/mdxCodec";
import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet } from "../../ts/scripts/wisp/hurtboxView";
import { fighters } from "../../ts/scripts/heroModelSource";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { AttackPhase, Character } from "../../ts/src/game/sim/codes";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";

const [inputArg, outputArg] = process.argv.slice(2);
const input = resolve(inputArg ?? ""), output = resolve(outputArg ?? "");
const project = resolve(import.meta.dir, "../..");
ensure(inputArg && outputArg && relative(project, output).startsWith(".."), "usage: bun tools/animations/tumble-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");

const TUMBLERS = [Character.blademaster, Character.mountainKing, Character.lich, Character.shadowHunter, Character.pitLord, Character.beastmaster] as const;
const FRAMES = 24;
const NAME = "Tumble Motion damageTumble";

function flail(joint: string, t: number): number {
  const wave = Math.sin(2 * Math.PI * t), left = joint.endsWith(".L");
  if (joint === "chest") return -25;
  if (joint === "head") return 25;
  if (joint === "pelvis") return -10;
  if (joint.startsWith("shoulder")) return left ? -145 + 30 * wave : -55 - 30 * wave;
  if (joint.startsWith("elbow")) return 35;
  if (joint.startsWith("hip")) return left ? -65 + 25 * wave : 25 - 25 * wave;
  if (joint.startsWith("knee")) return left ? 80 : 45;
  return 0;
}
function pitch(q: ArrayLike<number>, degrees: number): Float32Array<ArrayBuffer> {
  const s = Math.sin(degrees * Math.PI / 360), c = Math.cos(degrees * Math.PI / 360);
  const [x = 0, y = 0, z = 0, w = 1] = Array.from(q);
  return new Float32Array([c*x+s*z, c*y+s*w, c*z-s*x, c*w-s*y]);
}
const ms = (frame: number) => Math.round(frame * 1000 / 60);

mkdirSync(output, { recursive: true });
cpSync(join(input, "hero-models"), join(output, "hero-models"), { recursive: true, dereference: true });
chmodSync(join(output, "hero-models"), 0o755);
const bindings: string[] = [];
for (const character of TUMBLERS) {
  const fighter = fighters.get(character), rig = FIGHTER_RIGS.get(character);
  ensure(fighter && rig, `no fighter or canonical rig for character ${character}`);
  const source = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer()), model = structuredClone(source);
  const stand = source.Sequences.find((s) => /^stand ready$/i.test(s.Name.trim())) ?? source.Sequences.find((s) => /^stand(?:\s*-?\s*1)?$/i.test(s.Name.trim()));
  ensure(stand, `${fighter.name}: missing stand`);
  const before = new DrawnModel(generateMDX(source), 1);
  const heights = Array.from(before.triangles(source.Sequences.indexOf(stand), 0, 1)).filter((_, i) => i % 2 === 1);
  const centre = (Math.min(...heights) + Math.max(...heights)) / 2;
  const previous = source.Sequences.findIndex((s) => s.Name === NAME);
  const index = previous >= 0 ? previous : model.Sequences.length;
  const begin = previous >= 0 ? source.Sequences[previous]!.Interval[0] : Math.max(...source.Sequences.map((s) => s.Interval[1])) + 100, end = begin + ms(FRAMES);
  if (previous < 0) model.Sequences.push({ ...stand, Name: NAME, Interval: new Uint32Array([begin, end]), NonLooping: false, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
  const replace = (track: mdx.AnimVector, value: (frame: number) => Float32Array<ArrayBuffer>, template?: mdx.AnimKeyframe) => {
    track.Keys = track.Keys.filter((k) => k.Frame < begin || k.Frame > end);
    for (let frame = 0; frame <= FRAMES; frame++) {
      const Vector = value(frame);
      track.Keys.push({ ...template, Frame: begin + ms(frame), Vector, ...(template?.InTan ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {}) });
    }
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  };

  let top = model.Bones[0]?.ObjectId;
  while (top !== undefined && model.Nodes.find((node) => node.ObjectId === top)?.Parent != null) top = model.Nodes.find((node) => node.ObjectId === top)!.Parent!;
  const root = model.Helpers.find((node) => node.ObjectId === top);
  ensure(root?.Rotation, `${fighter.name}: no root motion helper to tumble`);
  root.Translation ??= { LineType: mdx.LineType.Linear, GlobalSeqId: NO_GLOBAL_SEQ, Keys: source.Sequences.flatMap((s) => Array.from(s.Interval, (Frame) => ({ Frame, Vector: new Float32Array(3) }))) };
  const originals = new Map<string, mdx.AnimVector>(); tracks(source, (track, path) => originals.set(path, track));
  const jointOf = new Map(Object.entries(rig.classic).map(([joint, name]) => [name, joint]));
  let articulated = 0;
  tracks(model, (track, path) => {
    if (track === root.Rotation || track === root.Translation) return;
    const donor = originals.get(path); if (!donor || onGlobalClock(donor)) return;
    const key = donor.Keys.find((k) => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]); if (!key) return;
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const joint = match ? jointOf.get(source[match[1] as "Bones" | "Helpers"][Number(match[2])]?.Name ?? "") : undefined;
    if (joint !== undefined && flail(joint, 0.5) !== 0) articulated++;
    replace(track, (frame) => joint === undefined ? Float32Array.from(key.Vector) : pitch(key.Vector, flail(joint, frame / FRAMES)), key);
  });
  ensure(articulated >= 3, `${fighter.name}: tumble moves fewer than three joints`);
  const arm = vec3.sub(vec3.create(), [0, 0, centre], root.PivotPoint as unknown as vec3);
  const turn = (frame: number) => pitch([0, 0, 0, 1], -360 * frame / FRAMES);
  replace(root.Rotation, turn);
  replace(root.Translation, (frame) => new Float32Array(vec3.sub(vec3.create(), arm, vec3.transformQuat(vec3.create(), arm, turn(frame) as unknown as quat))));

  const bytes = encodeVerified(parseSource(generateMDX(model))), after = new DrawnModel(bytes, 1);
  for (const [other, sequence] of source.Sequences.entries()) for (const fraction of [0, 0.5, 1]) {
    if (other === previous) continue;
    const time = (sequence.Interval[1] - sequence.Interval[0]) * fraction / 1000;
    const a = before.triangles(other, time, 1), b = after.triangles(other, time, 1);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? Infinity)) < 0.001), `${fighter.name}/${sequence.Name}: previous clip changed`);
  }
  mkdirSync(dirname(join(output, fighter.source)), { recursive: true });
  rmSync(join(output, fighter.source), { force: true });
  await Bun.write(join(output, fighter.source), bytes); chmodSync(join(output, fighter.source), 0o644);
  const moments = [0, 4, 8, 12, 16, 20];
  await Bun.write(join(output, `${fighter.name}-damageTumble.png`), sheet(`${fighter.name} damageTumble`, new DrawnModel(bytes, characterModelScale(character)),
    [1, -1].flatMap((facing) => moments.map((frame) => ({ frame, facing, clip: index, seconds: frame / 60, phase: AttackPhase.none, x: 0, z: 0, parts: [], strikes: [] }))), moments.length).png);
  bindings.push(`  ${character}: { damageTumble: { index: ${index}, seconds: ${seconds(Math.fround(FRAMES / 60))} } },`);
  console.log(`TUMBLE_CLIPS_PASS ${fighter.name}: clip ${index}, ${articulated} joints flail through a back flip, ${source.Sequences.length - (previous >= 0 ? 1 : 0)} unrelated clips preserved`);
}
await Bun.write(join(project, "ts/src/game/presentation/tumbleClipInfo.ts"), [
  "// Generated by tools/animations/tumble-clips.ts; regenerate instead of editing.",
  ...(bindings.some((line) => line.includes("f32(")) ? ['import { f32 } from "wisp/src/sim/f32";'] : []),
  "export const TUMBLE_CLIPS = {", ...bindings, "} as const;", ""].join("\n"));
