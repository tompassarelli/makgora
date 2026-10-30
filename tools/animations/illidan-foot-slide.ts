import { join, resolve } from "node:path";
import { ModelRenderer, type model as mdx } from "war3-model";
import { parseModelMDX } from "../../ts/scripts/mdxCodec";
import { ensure } from "./original-clips";

const [modelDir, sequenceName = "Locomotion Run", groundArg = "0", plantedArg = "0.25", strideArg] = process.argv.slice(2);
ensure(modelDir, "usage: bun tools/animations/illidan-foot-slide.ts ILLIDAN_ANIMATION_DIR [SEQUENCE] [GROUND_UNITS_PER_SECOND] [PLANTED_FRACTION_OF_FOOT_LIFT] [STRIDE]");
const model = parseModelMDX(await Bun.file(join(resolve(modelDir), "DemonHunterFighter.mdx")).arrayBuffer()) as mdx.Model;
const index = model.Sequences.findIndex(s => s.Name === sequenceName);
ensure(index >= 0, `${sequenceName}: not in the model`);
const [start = 0, end = 0] = model.Sequences[index]!.Interval;
const renderer = new ModelRenderer(model);
const data = Reflect.get(renderer, "rendererData") as { frame: number; nodes: { matrix: Float32Array }[] };
renderer.setSequence(index);
const id = (name: string) => model.Nodes.find(n => n?.Name === name)!.ObjectId;
const feet = ["Bone_Foot_L", "Bone_Foot_R"].map(id);
const pelvis = id("Bone_Pelvis");
const seconds = (end - start) / 1000;
const count = Math.round(seconds * 60);
const position = (node: number, at: number) => {
  data.frame = start + (end - start) * at / count;
  renderer.update(0);
  const m = data.nodes[node]!.matrix;
  return [m[12]!, m[13]!, m[14]!] as const;
};
const samples = Array.from({ length: count + 1 }, (_, i) => ({ feet: feet.map(f => position(f, i)), pelvis: position(pelvis, i) }));
const spans = [0, 1, 2].map(axis => { const values = samples.flatMap(s => s.feet.map(f => f[axis]!)); return Math.max(...values) - Math.min(...values); });
const travel = spans[0]! > spans[1]! ? 0 : 1;
const plantedFraction = Number(plantedArg);
const ground = Number(groundArg);
const footRange = Math.max(...samples.map(s => s.feet[0]![travel]!)) - Math.min(...samples.map(s => s.feet[0]![travel]!));
const stride = strideArg === undefined ? 2 * footRange / seconds : Number(strideArg);
const slides: number[] = [];
const heights: number[] = [];
let stanceFrames = 0;
for (const k of [0, 1]) {
  const z = samples.map(sample => sample.feet[k]![2]!);
  const low = Math.min(...z), span = Math.max(...z) - low;
  for (let i = 0; i < count; i++) {
    const velocity = (samples[i + 1]!.feet[k]![travel]! - samples[i]!.feet[k]![travel]!) * 60;
    if (z[i]! - low > plantedFraction * span || velocity > 0) continue;
    stanceFrames++;
    slides.push(Math.abs(1 - Math.abs(velocity) / stride));
    heights.push(z[i]!);
  }
}
const mean = slides.reduce((s, v) => s + v, 0) / Math.max(1, slides.length);
const meanHeight = heights.reduce((s, v) => s + v, 0) / Math.max(1, heights.length);
console.log(JSON.stringify({ sequence: sequenceName, seconds, travelAxis: "xyz"[travel], stride: +stride.toFixed(1), stanceFramesPerCycle: stanceFrames, meanSlidePct: +(100 * mean).toFixed(1), worstSlidePct: +(100 * Math.max(...slides)).toFixed(1), stanceAnkleHeight: +meanHeight.toFixed(1), stanceAnkleHeightSpread: +(Math.max(...heights) - Math.min(...heights)).toFixed(1), meanSlideUnitsPerSecond: ground > 0 ? +(ground * mean).toFixed(1) : undefined, worstSlideUnitsPerSecond: ground > 0 ? +(ground * Math.max(...slides)).toFixed(1) : undefined }));
