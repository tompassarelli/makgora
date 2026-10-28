import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase } from "../../ts/src/game/sim/codes";
import { parseMDX } from "war3-model";
const [file, outDir] = process.argv.slice(2);
const bytes = await Bun.file(file!).arrayBuffer(), seqs = parseMDX(bytes).Sequences;
const clip = seqs.findIndex(s => s.Name === "Attack Gesture upAir");
const frames = [0, 3, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22];
for (const facing of [1, -1]) {
  const posed = frames.map(frame => ({ frame, facing, clip, seconds: frame / 60, phase: AttackPhase.active, x: 0, z: 0, parts: [], strikes: [] }));
  await Bun.write(`${outDir}/upAir-${facing > 0 ? "r" : "l"}.png`, sheet("upAir", new DrawnModel(bytes, 1), posed, 7).png);
}
const crest: string[] = [];
for (let f = 0; f <= 32; f++) { const tri = new DrawnModel(bytes, 1).triangles(clip, f / 60, 1); let top = -Infinity; for (let i = 1; i < tri.length; i += 2) top = Math.max(top, tri[i]!); crest.push(`${f}:${top.toFixed(1)}`); }
console.log("CREST", crest.join(" "));
