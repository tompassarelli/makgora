import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { decodePng } from "wisp/scripts/wisp/fidelity/image";

const path = resolve(process.argv[2]!);
const stride = Number(process.argv[3] ?? 6);
const margins = (process.argv[4] ?? "40,100").split(",").map(Number);
const pack = JSON.parse(readFileSync(path, "utf8"));
const load = (file: string) => decodePng(new Uint8Array(readFileSync(resolve(dirname(path), file))))!;
const D = 24;
const differs = (a: Uint8Array, b: Uint8Array, o: number) => Math.abs(a[o]! - b[o]!) > D || Math.abs(a[o + 1]! - b[o + 1]!) > D || Math.abs(a[o + 2]! - b[o + 2]!) > D;
const inBox = (b: any, x: number, y: number) => x >= b.x && y >= b.y && x < b.x + b.width && y < b.y + b.height;
for (const sample of pack.samples) {
  const row: string[] = [];
  sample.frames.forEach((frame: any, index: number) => {
    if (index % stride !== 0) return;
    const imgs = [frame.shown, frame.off, frame.repeatedOff].map(ref => load(ref.file)!);
    const [a, b, c] = imgs as [typeof imgs[0], typeof imgs[0], typeof imgs[0]];
    const w = a.width, h = a.height;
    const cells: string[] = [];
    for (const margin of margins) {
      const g = frame.region, box = { x: Math.max(0, g.x - margin), y: Math.max(0, g.y - margin), width: g.width + 2 * margin, height: g.height + 2 * margin };
      const inside = [0, 0, 0], outside = [0, 0, 0];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (inBox(frame.body, x, y) || frame.excluded.some((e: any) => inBox(e, x, y))) continue;
        const o = (y * w + x) * 3;
        const ab = differs(a.rgb, b.rgb, o), ac = differs(a.rgb, c.rgb, o), bc = differs(b.rgb, c.rgb, o);
        const target = inBox(box, x, y) ? inside : outside;
        if (ab && ac && !bc) target[0]!++;
        if (ab && bc && !ac) target[1]!++;
        if (ac && bc && !ab) target[2]!++;
      }
      cells.push(`m${margin}:in=${inside.join("/")} out=${outside.join("/")}`);
    }
    row.push(`${frame.frame} ${cells.join(" ")}`);
  });
  console.log(sample.move, sample.role, "\n  " + row.join("\n  "));
}
