import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { decodePng } from "wisp/scripts/wisp/fidelity/image";

const path = resolve(process.argv[2]!);
const stride = Number(process.argv[3] ?? 6);
const pack = JSON.parse(readFileSync(path, "utf8"));
const load = (file: string) => decodePng(new Uint8Array(readFileSync(resolve(dirname(path), file))))!;
const D = 24;
const differs = (a: Uint8Array, b: Uint8Array, o: number) => Math.abs(a[o]! - b[o]!) > D || Math.abs(a[o + 1]! - b[o + 1]!) > D || Math.abs(a[o + 2]! - b[o + 2]!) > D;
function dilate(mask: Uint8Array, w: number, h: number, r: number) {
  if (r === 0) return mask;
  const tmp = new Uint8Array(mask.length), out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = -r; k <= r && !v; k++) { const xx = x + k; if (xx >= 0 && xx < w && mask[y * w + xx]) v = 1; } tmp[y * w + x] = v; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = -r; k <= r && !v; k++) { const yy = y + k; if (yy >= 0 && yy < h && tmp[yy * w + x]) v = 1; } out[y * w + x] = v; }
  return out;
}
const inBox = (b: any, x: number, y: number) => x >= b.x && y >= b.y && x < b.x + b.width && y < b.y + b.height;
for (const sample of pack.samples) {
  const row: string[] = [];
  sample.frames.forEach((frame: any, index: number) => {
    if (index % stride !== 0) return;
    const [s, o, r] = [frame.shown, frame.off, frame.repeatedOff].map(ref => load(ref.file));
    const w = s!.width, h = s!.height;
    const noise0 = new Uint8Array(w * h), changed = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { const off = i * 3; noise0[i] = differs(o!.rgb, r!.rgb, off) ? 1 : 0; changed[i] = differs(s!.rgb, o!.rgb, off) && differs(s!.rgb, r!.rgb, off) ? 1 : 0; }
    const cells: string[] = [];
    const hit = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; hit[i] = inBox(frame.body, x, y) || frame.excluded.some((b: any) => inBox(b, x, y)) || noise0[i] || !changed[i] ? 0 : 1; }
    const kept = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (!hit[i]) continue; let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && hit[i + dy * w + dx]) n++; kept[i] = n >= 2 ? 1 : 0; }
    for (const margin of [0, 40, 100]) {
      const g = frame.region, box = { x: Math.max(0, g.x - margin), y: Math.max(0, g.y - margin), width: g.width + 2 * margin, height: g.height + 2 * margin };
      let pixels = 0, contam = 0, raw = 0;
      for (let i = 0; i < w * h; i++) { const x = i % w, y = (i - x) / w; if (hit[i] && inBox(box, x, y)) raw++; if (!kept[i]) continue; if (inBox(box, x, y)) pixels++; else contam++; }
      cells.push(`m${margin}=${pixels}(${raw})/${contam}`);
    }
    row.push(`${frame.frame}:${cells.join(",")}`);
  });
  console.log(sample.move, sample.role, row.join(" "));
}
