import { join } from "node:path";
import { readFileSync } from "node:fs";
import type { MapEntry } from "wisp/src/headless/client";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { fixtureOf } from "../scripts/nativeCapture";

const platform = join(import.meta.dir, "../src/platform");
const { captureTick } = await import(join(platform, "../host/loop/captureRunner.ts"));
const entry: MapEntry = await import(join(platform, "../host/entries/nativeDriverMain.ts"));
const fixtures = process.argv.slice(2).map(path => fixtureOf(path, readFileSync(path, "utf8")));
const runtime = installHeadless(SMASHCRAFT_HEADLESS);
const clients = runtime.clients(entry, [0]);
const client = clients.client(0);
clients.start();
clients.frames(3);
let last = "";
for (let tick = 0; tick < 60000; tick++) {
  clients.everywhere(() => captureTick(fixtures));
  clients.frames(1);
  let r: { hidden: boolean; frame: number; script: number; stage: string; held: number } | undefined;
  client.run(() => { r = (globalThis as { __smashcraftCaptureRunner?: typeof r }).__smashcraftCaptureRunner; });
  if (r === undefined || r.held !== 90) continue;
  const poses = client.effectPoses({ visibleOnly: true });
  const line = `script ${r.script} ${r.stage} frame#${r.frame} ${r.hidden ? "hidden" : "shown "} ${poses.map(p => `${p.model.replace(/.*[\\/]/, "").slice(0, 22)}@${p.scale.toFixed(2)}`).join(" ")}`;
  if (line !== last) console.log(line);
  last = line;
  if (r.script >= fixtures.length) break;
}
const files = [...client.files.keys()];
console.log(files.filter(name => name.includes("screen")));
console.log((client.files.get(files.find(name => name.includes("capture-screen")) ?? "") ?? []).slice(0, 6).join("\n"));
runtime.restore();
