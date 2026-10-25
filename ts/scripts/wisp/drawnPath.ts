import { join } from "node:path";
import { readFileSync } from "node:fs";
import { Effect } from "effect";
import { ModelRenderer } from "war3-model";
import { parseModelMDX } from "wisp/scripts/wisp/models";
import { originalClip } from "../../src/generated/clips/fighterOriginalClipInfo";
import { characterModelScale } from "../../src/game/presentation/modelScale";
import { assetsView, readManifest } from "./buildInputs";
import { createStandaloneSession } from "./standalone";

const [scriptPath, framesText] = process.argv.slice(2);
if (scriptPath === undefined || framesText === undefined) throw new Error("usage: bun scripts/wisp/drawnPath.ts PAD FRAMES");
const REVERSAL_UNITS = 2.0;

const imports = join(process.env.ASSETS ?? assetsView(await Effect.runPromise(readManifest())), "original-clips-static-lights/imports");
const renderers = new Map<string, { model: ReturnType<typeof parseModelMDX>; renderer: ModelRenderer }>();

function bodyCentre(character: number, index: number, seconds: number): readonly [number, number] {
  const clip = originalClip(character, index);
  if (clip === undefined) return [0, 0];
  const path = join(imports, clip.modelPath.replaceAll("\\", "/"));
  let entry = renderers.get(path);
  if (entry === undefined) {
    const model = parseModelMDX(readFileSync(path).buffer);
    entry = { model, renderer: new ModelRenderer(model) };
    renderers.set(path, entry);
  }
  const { model, renderer } = entry;
  const ms = (clip.timeline === true ? 0 : model.Sequences[0]?.Interval[0] ?? 0) + ((clip.timeline === true ? clip.startSeconds : 0) + seconds) * 1000;
  renderer.setSequence(Math.max(0, model.Sequences.findIndex(sequence => ms >= (sequence.Interval[0] ?? 0) && ms <= (sequence.Interval[1] ?? 0))));
  const data = Reflect.get(renderer, "rendererData") as { frame: number; nodes: { matrix: Float32Array }[] };
  data.frame = ms;
  renderer.update(0);
  let x = 0, z = 0, count = 0;
  model.Nodes.forEach((node, id) => {
    const m = data.nodes[id]?.matrix;
    if (m === undefined || node === undefined || !/^Bone_/.test(node.Name)) return;
    const [px = 0, py = 0, pz = 0] = node.PivotPoint ?? [];
    x += m[0]! * px + m[4]! * py + m[8]! * pz + m[12]!;
    z += m[2]! * px + m[6]! * py + m[10]! * pz + m[14]!;
    count++;
  });
  return count === 0 ? [0, 0] : [x / count, z / count];
}

const session = await createStandaloneSession({ script: readFileSync(scriptPath, "utf8"), presentation: "pool-predicted" });
const platform = join(import.meta.dir, "../../src/platform");
const { shell } = await import(join(platform, "../host/loop/state.ts"));
const { views } = await import(join(platform, "../host/loop/ui.ts"));
const { presentedMatch } = await import(join(platform, "../host/loop/presentedMatch.ts"));
console.log("frame\tslot\tclip\tseconds\tplacedX\tplacedZ\tdrawnX\tdrawnZ\thitlag\tflag");
const previous = new Map<number, { x: number; z: number; dx: number; dz: number; pdx: number; pdz: number; quiet: boolean; clip: number | undefined; seconds: number; hitlag: number; leftClip: number | undefined; leftAt: number }>();
let flagged = 0;
for (let step = 0; step < Number(framesText); step++) {
  session.step({ buttons: [], axisX: 0, axisY: 0 });
  session.client.run(() => {
    const s = shell();
    const presented = presentedMatch(s);
    for (const slot of [0, 1]) {
      const pool = views(s).fighters[slot]?.pool;
      const fighter = presented.world.fighters[slot];
      if (pool === undefined || fighter === undefined) continue;
      const clip: number | undefined = pool.visible;
      const seconds: number = pool.seconds ?? 0;
      const scale = characterModelScale(fighter.character);
      const [cx, cz] = clip === undefined ? [0, 0] : bodyCentre(fighter.character, clip, seconds);
      const x = pool.placement.x + fighter.facing * scale * cx;
      const z = pool.placement.z + scale * cz;
      const hitlag = fighter.launch.hitlag;
      const last = previous.get(slot);
      const flags: string[] = [];
      let dx = 0, dz = 0, quiet = false, leftClip = last?.leftClip, leftAt = last?.leftAt ?? -1;
      if (last !== undefined) {
        dx = x - last.x;
        dz = z - last.z;
        quiet = hitlag === 0 && last.hitlag === 0 && clip === last.clip;
        const zigzag = (d: number, p: number, pp: number) => quiet && last.quiet && d * p < 0 && p * pp < 0 && Math.min(Math.abs(d), Math.abs(p), Math.abs(pp)) > REVERSAL_UNITS;
        if (zigzag(dx, last.dx, last.pdx)) flags.push(`x-zigzag ${last.pdx.toFixed(1)} ${last.dx.toFixed(1)} ${dx.toFixed(1)}`);
        if (zigzag(dz, last.dz, last.pdz)) flags.push(`z-zigzag ${last.pdz.toFixed(1)} ${last.dz.toFixed(1)} ${dz.toFixed(1)}`);
        const info = clip === undefined ? undefined : originalClip(fighter.character, clip);
        if (clip !== last.clip) {
          if (clip === leftClip && step - leftAt <= 2 && hitlag === 0 && last.hitlag === 0) flags.push(`clip-flap ${last.clip} ${clip}`);
          leftClip = last.clip;
          leftAt = step;
        }
        if (info !== undefined && !info.looping && clip === last.clip && seconds <= last.seconds && seconds < info.endSeconds - info.startSeconds - 0.0001 && hitlag === 0 && last.hitlag === 0) flags.push("time-held");
      }
      flagged += flags.length;
      previous.set(slot, { x, z, dx, dz, pdx: last?.dx ?? 0, pdz: last?.dz ?? 0, quiet, clip, seconds, hitlag, leftClip, leftAt });
      console.log([step, slot, clip, seconds.toFixed(4), pool.placement.x.toFixed(2), pool.placement.z.toFixed(2), x.toFixed(2), z.toFixed(2), hitlag, flags.join("; ")].join("\t"));
    }
  });
}
session.close();
console.error(`${flagged} flagged frames`);
if (flagged > 0) process.exitCode = 1;
