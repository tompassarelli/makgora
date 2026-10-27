import { meanVertexDistance, bodyHeight, strikingVertex, scoreMove, THRESHOLDS } from "../scripts/wisp/animScore";
import { loadBody, sampleFighter } from "../scripts/wisp/animScoreSample";
import { assetsView, readManifest } from "../scripts/wisp/buildInputs";
import { Effect } from "effect";
const assets = process.argv[2] ?? assetsView(await Effect.runPromise(readManifest()));
const s = sampleFighter(await loadBody(assets, 5 as never), 5 as never).find(m => m.move === "neutral-air")!;
const sample = (s as any).sample ?? s;
const h = bodyHeight(sample.ready);
console.log("moveFrames", sample.moveFrames, "frames", sample.frames.length, "active", sample.firstActive, sample.lastActive, "strike", sample.strike);
const tip = strikingVertex(sample, sample.frames[sample.firstActive]);
for (let i = 0; i < sample.frames.length; i++) {
  const f = sample.frames[i], p = f.vertices;
  console.log(i, "step", i ? (meanVertexDistance(sample.frames[i-1], f)/h).toFixed(3) : "", "ready", (meanVertexDistance(f, sample.ready)/h).toFixed(3), "tip", p[tip*2].toFixed(1), p[tip*2+1].toFixed(1));
}
console.log(JSON.stringify(scoreMove(sample, THRESHOLDS.aerial), (k, v) => typeof v === "number" ? +v.toFixed(3) : v));
