import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { decodePng } from "wisp/scripts/wisp/fidelity/image";

const path = resolve(process.argv[2]!);
const stride = Number(process.argv[3] ?? 6);
const margin = Number(process.argv[4] ?? 40);
const thresholds = (process.argv[5] ?? "24,48,72,96,128").split(",").map(Number);
const pack = JSON.parse(readFileSync(path, "utf8"));
const load = (file: string) => decodePng(new Uint8Array(readFileSync(resolve(dirname(path), file))))!;
const D = 24;
const over = (a: Uint8Array, b: Uint8Array, o: number, t: number) => Math.abs(a[o]! - b[o]!) > t || Math.abs(a[o + 1]! - b[o + 1]!) > t || Math.abs(a[o + 2]! - b[o + 2]!) > t;
const inBox = (b: any, x: number, y: number) => x >= b.x && y >= b.y && x < b.x + b.width && y < b.y + b.height;
for (const sample of pack.samples) {
  const row: string[] = [];
  sample.frames.forEach((frame: any, index: number) => {
    if (index % stride !== 0) return;
    const [a, b, c] = [frame.shown, frame.off, frame.repeatedOff].map(ref => load(ref.file)!) as [any, any, any];
    const w = a.width, h = a.height;
    const g = frame.region, box = { x: Math.max(0, g.x - margin), y: Math.max(0, g.y - margin), width: g.width + 2 * margin, height: g.height + 2 * margin };
    const inside = thresholds.map(() => 0), outside = thresholds.map(() => 0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (inBox(frame.body, x, y) || frame.excluded.some((e: any) => inBox(e, x, y))) continue;
      const o = (y * w + x) * 3;
      if (over(b.rgb, c.rgb, o, D)) continue;
      const target = inBox(box, x, y) ? inside : outside;
      thresholds.forEach((t, i) => { if (over(a.rgb, b.rgb, o, t) && over(a.rgb, c.rgb, o, t)) target[i]!++; });
    }
    row.push(`${frame.frame} in=${inside.join("/")} out=${outside.join("/")}`);
  });
  console.log(sample.move, sample.role, "\n  " + row.join("\n  "));
}
