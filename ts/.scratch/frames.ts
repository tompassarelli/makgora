import { join } from "node:path";
import { readFileSync } from "node:fs";
import type { MapEntry } from "wisp/src/headless/client";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { fixtureOf } from "../scripts/nativeCapture";
import { fighterAt } from "../src/game/sim/roster";
import { emptyBounds, hurtBounds, screenBox, strikeBounds } from "../src/game/presentation/screenBoxes";

const platform = join(import.meta.dir, "../src/platform");
const { shellState } = await import(join(platform, "../host/loop/state.ts"));
const { nativeDriverCommand } = await import(join(platform, "nativeDriver.ts"));
const entry: MapEntry = await import(join(platform, "../host/entries/nativeDriverMain.ts"));
for (const path of process.argv.slice(2)) {
  const fixture = fixtureOf(path, readFileSync(path, "utf8"));
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  const clients = runtime.clients(entry, [0]);
  const client = clients.client(0);
  clients.start();
  clients.frames(3);
  clients.everywhere(() => nativeDriverCommand(fixture.script));
  clients.frames(3);
  const rows: string[] = [];
  const first = fixture.frames[0] ?? 0, last = fixture.frames.at(-1) ?? 0;
  clients.everywhere(() => nativeDriverCommand(`resume ${last + 2}`));
  for (let guard = 0; guard < 4 * (last + 40); guard++) {
    clients.frames(1);
    let done = false;
    client.run(() => {
      const s = shellState();
      const frame = s.runtime.simulationFrame;
      if (frame < first - 2 || frame > last + 1 || rows.some(row => row.startsWith(`${frame} `))) { done = frame > last + 1; return; }
      const f = fighterAt(s.world, 0);
      const strike = strikeBounds(f, emptyBounds());
      const region = screenBox(s.camera, 16 / 9, 1920, 1080, strikeBounds(f, hurtBounds(f, emptyBounds())), 96);
      rows.push(`${frame} sp=${f.special.action}/${f.special.frame} strike=${Number.isFinite(strike.left) ? `${strike.left.toFixed(0)}..${strike.right.toFixed(0)}x${strike.bottom.toFixed(0)}..${strike.top.toFixed(0)}` : "-"} region=${JSON.stringify(region)}`);
    });
    if (done) break;
  }
  runtime.restore();
  console.log(`${fixture.name} capture ${first}-${last}`);
  for (const row of rows) console.log(`  ${row}`);
}
