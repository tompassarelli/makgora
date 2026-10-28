import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { batch, focus, loadClients } from "wisp/scripts/warcraft/desktop";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { stageTileLeft, stageTileTop } from "../../src/game/menu/stageSelection";
import { dismissFirstRunPanels, gateDriver, pickFighters, pressStartUntil } from "./gateResults";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });

const MATCH_SHOTS_MILLIS = [0, 1500, 4000, 7000] as const;
const STAGE_WAIT_SECONDS = 15;
const MATCH_WAIT_SECONDS = 15;

const tilePoint = (choice: number) => ({ x: stageTileLeft(choice) + 0.015, y: stageTileTop(choice) - 0.03 });

const stageSlug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-");

export const measureStagesGate = (clientsFile: string, directory: string, restart: Effect.Effect<void, AcceptFailure>) => Effect.gen(function*() {
  const stages: { readonly id: number; readonly name: string; readonly started: boolean; readonly frames: readonly { readonly file: string; readonly sha256: string }[] }[] = [];
  for (const [index, { id, name }] of STAGE_CATALOG.entries()) {
    if (index > 0) yield* restart;
    const clients = yield* loadClients(clientsFile).pipe(Effect.mapError(fail("stages gate clients")));
    const [host] = clients;
    if (host === undefined || clients.length !== 2) return yield* new AcceptFailure({ operation: "stages gate", problem: "requires the selected offline pair" });
    const folder = join(directory, `${String(index).padStart(2, "0")}-${stageSlug(name)}`);
    yield* Effect.try({ try: () => mkdirSync(folder, { recursive: true, mode: 0o700 }), catch: cause => new AcceptFailure({ operation: "stages gate evidence", problem: String(cause) }) });
    const d = yield* gateDriver(host, folder);
    const initial = yield* d.phase("CHARACTER", 0, 30);
    for (const client of clients) yield* dismissFirstRunPanels(d, client);
    yield* pickFighters(d, clients);
    const select = yield* pressStartUntil(d, host, "STAGE", initial.epoch, STAGE_WAIT_SECONDS);
    yield* focus(host).pipe(Effect.mapError(fail("stages gate focus")));
    const tile = tilePoint(id);
    const target = yield* d.at(host, tile.x, tile.y);
    yield* batch(host, [{ kind: "click", ...target, holdMillis: 200 }, { kind: "wait", millis: 600 }]).pipe(Effect.mapError(fail(`stages gate pick ${name}`)));
    const frames = [yield* d.save("stage-select.ppm", yield* d.shot(host))];
    const match = yield* pressStartUntil(d, host, "BLOCKED", select.epoch, MATCH_WAIT_SECONDS).pipe(Effect.option);
    if (match._tag === "Some") {
      const began = yield* Clock.currentTimeMillis;
      for (const at of MATCH_SHOTS_MILLIS) {
        const wait = began + at - (yield* Clock.currentTimeMillis);
        if (wait > 0) yield* Effect.sleep(`${wait} millis`);
        for (const client of clients) frames.push(yield* d.save(`match-${at}-${client.name}.ppm`, yield* d.shot(client)));
      }
    }
    stages.push({ id, name, started: match._tag === "Some", frames });
  }
  const started = stages.filter(stage => stage.started).length;
  const text = `SMASHCRAFT GATE stages stages=${stages.length} started=${started} pass=${started === STAGE_CATALOG.length ? 1 : 0}`;
  const modified = yield* Clock.currentTimeMillis;
  yield* Effect.try({
    try: () => writeFileSync(join(directory, "measurements.json"), `${JSON.stringify({ text, shotsMillis: MATCH_SHOTS_MILLIS, stages }, null, 2)}\n`, { mode: 0o600 }),
    catch: cause => new AcceptFailure({ operation: "stages gate evidence", problem: String(cause) }),
  });
  return { name: "stages-gate", text, modified } satisfies ReceiptFile;
}).pipe(Effect.scoped);
