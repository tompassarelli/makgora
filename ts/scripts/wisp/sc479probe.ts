import { Effect } from "effect";
import { assetsView, readManifest } from "./buildInputs";
import { loadBody, sampleFighter } from "./animScoreSample";
import { bodyHeight, strikingVertex } from "./animScore";
import { Character } from "../../src/game/sim/codes";
const assets = process.argv[2] ?? await Effect.runPromise(Effect.map(readManifest(), assetsView) as never);
const moves = sampleFighter(await loadBody(assets as string, Character.blademaster), Character.blademaster);
for (const name of process.argv.slice(3).length ? process.argv.slice(3) : ["up-tilt"]) {
  const m = moves.find(m => m.move === name)!; const s = m.sample;
  const h = bodyHeight(s.ready), c = s.frames[s.firstActive]!;
  const tip = strikingVertex(s, c);
  console.log(name, "strike", s.strike, "first", s.firstActive, "last", s.lastActive, "frames", s.moveFrames, "h", h.toFixed(1), "tip", tip);
  for (let i = 0; i < s.moveFrames; i++) { const f = s.frames[i]!; console.log(i, (f.vertices[tip*2]!).toFixed(1), (f.vertices[tip*2+1]!).toFixed(1)); }
}
