import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { decodePng } from "wisp/scripts/wisp/fidelity/image";
import { frameStamp } from "../scripts/nativeCaptureVerdict";
import { measureFootprint } from "../scripts/wisp/classicEffectScreen";

const path = resolve(process.argv[2]!);
const pack = JSON.parse(readFileSync(path, "utf8"));
const load = (file: string) => decodePng(new Uint8Array(readFileSync(resolve(dirname(path), file))))!;
for (const sample of pack.samples) {
  const row: string[] = [];
  for (const frame of sample.frames) {
    const [shown, off, repeated] = [frame.shown, frame.off, frame.repeatedOff].map(ref => load(ref.file));
    const stamp = 1;
    const m = measureFootprint(shown!, off!, repeated!, frame.region, [frame.body, ...frame.excluded]);
    row.push(`${frame.frame}:${m === undefined ? "INVALID" : `${m.pixels}/${m.contamination}/${m.unstable}`}`);
  }
  console.log(sample.move, sample.role, row.join(" "));
}
