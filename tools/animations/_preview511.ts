import { DrawnModel } from "../../ts/scripts/wisp/drawnModel";
import { sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase } from "../../ts/src/game/sim/codes";
import { parseMDX } from "war3-model";
const [file, outDir] = process.argv.slice(2);
const bytes = await Bun.file(file!).arrayBuffer(), seqs = parseMDX(bytes).Sequences, drawn = new DrawnModel(bytes, 1);
const show = { neutralAir: { region: [0, 40], frames: [0, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 35] }, forwardAir: { region: [46, 46], frames: [0, 5, 10, 12, 14, 15, 16, 17, 18, 20, 23, 27, 32, 38, 43, 48] } } as const;
for (const [pose, { region, frames }] of Object.entries(show)) {
  const clip = seqs.findIndex(s => s.Name === `Attack Gesture ${pose}`), s = seqs[clip]!, end = (s.Interval[1]! - s.Interval[0]!) / 1000;
  const [x, z] = region, tz = z! - 50, len = Math.hypot(x!, tz) || 1; let best = -Infinity, moment = 0; const reaches: string[] = [];
  for (let t = 0, f = 0; t <= end + 1e-9; t += 1 / 60, f++) { const tri = drawn.triangles(clip, t, 1); let r = -Infinity; for (let i = 0; i < tri.length; i += 2) r = Math.max(r, (tri[i]! * x! + (tri[i + 1]! - 50) * tz) / len); reaches.push(`${f}:${r.toFixed(1)}`); if (r > best + 0.5) { best = r; moment = t; } }
  console.log(pose, "moment", moment.toFixed(3), "=frame", Math.round(moment * 60), reaches.join(" "));
  const posed = frames.flatMap(frame => [1, -1].map(facing => ({ frame, facing, clip, seconds: frame / 60, phase: AttackPhase.active, x: 0, z: 0, parts: [], strikes: [] })));
  await Bun.write(`${outDir}/${pose}.png`, sheet(pose, new DrawnModel(bytes, 1), posed.filter(p => p.facing === 1), 8).png);
}
const timing = { neutralAir: [7, 6, 35], forwardAir: [15, 3, 48] } as const;
const ready = drawn.triangles(seqs.findIndex(s => s.Name === "Stand Ready"), 0, 1);
let lo = Infinity, hi = -Infinity; for (let i = 1; i < ready.length; i += 2) { lo = Math.min(lo, ready[i]!); hi = Math.max(hi, ready[i]!); }
const height = hi - lo, mean = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i += 2) s += Math.hypot(a[i]! - b[i]!, a[i + 1]! - b[i + 1]!); return s / (a.length / 2); };
for (const [pose, [c, a, total]] of Object.entries(timing)) {
  const clip = seqs.findIndex(s => s.Name === `Attack Gesture ${pose}`), end = (seqs[clip]!.Interval[1]! - seqs[clip]!.Interval[0]!) / 1000, r = total - c - a;
  const strike = 0.4 / ((a + r) / 60), atRec = c / 60 + strike * a / 60, rec = (end - atRec) / (r / 60);
  const t = (f: number) => f <= c ? f / 60 : f <= c + a ? c / 60 + (f - c) * strike / 60 : atRec + (f - c - a) * rec / 60;
  const posed = Array.from({ length: total }, (_, f) => drawn.triangles(clip, t(f), 1)); posed.push(ready);
  const steps = posed.slice(c + a).map((p, i) => mean(posed[c + a + i - 1]!, p) / height);
  console.log(pose, "height", height.toFixed(1), "jump", Math.max(...steps).toFixed(3), "end", (mean(posed[total - 1]!, ready) / height).toFixed(3), "steps", steps.map(s => s.toFixed(3)).join(" "));
}
