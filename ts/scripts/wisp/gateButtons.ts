import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import { InputInjection } from "wisp/scripts/platform/services";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { type Client, click, focus, loadClients } from "wisp/scripts/warcraft/desktop";
import { pollUntil } from "../hostPoll";
import { type SweepMiss, parseButtonList, parseClickLog, sweepMisses, sweepPoints } from "./buttonSweep";
import { viewportPoint } from "./gateIntro";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });
const LIST_FILE = /^smashcraft-dev-buttons-p\d+\.txt$/;
const CLICK_FILE = /^smashcraft-dev-button-clicks-p\d+\.txt$/;

const newest = (folder: string, pattern: RegExp, since: number) => readdirSync(folder)
  .filter(file => pattern.test(file) && statSync(join(folder, file)).mtimeMs >= since)
  .map(file => ({ path: join(folder, file), modified: statSync(join(folder, file)).mtimeMs }))
  .sort((a, b) => b.modified - a.modified)[0];

const readLines = (path: string) => {
  const text = readFileSync(path, "utf8");
  return preloadLines(text) ?? text.split(/\r?\n/);
};

export const measureButtonsGate = (clientsFile: string, name: string, directory: string) => Effect.gen(function*() {
  const since = (yield* Clock.currentTimeMillis) - 600_000;
  const client: Client | undefined = (yield* loadClients(clientsFile).pipe(Effect.mapError(fail("buttons gate clients")))).find(selected => selected.name === name);
  if (client === undefined) return yield* new AcceptFailure({ operation: "buttons gate", problem: `no selected client ${name}` });
  const data = join(client.documents, "CustomMapData");
  const listing = yield* Effect.try({ try: () => newest(data, LIST_FILE, since), catch: cause => new AcceptFailure({ operation: "buttons gate list", problem: String(cause) }) });
  if (listing === undefined) return yield* new AcceptFailure({ operation: "buttons gate list", problem: "no -dev buttons listing from the map; send -dev buttons first" });
  const buttons = parseButtonList(readLines(listing.path)).filter(({ visible }) => visible);
  const boxless = buttons.filter(({ box }) => box === undefined).map(({ label }) => label);
  const clicks = () => Effect.try({ try: () => { const file = newest(data, CLICK_FILE, since); return file === undefined ? [] : parseClickLog(readLines(file.path)); }, catch: cause => new AcceptFailure({ operation: "buttons gate clicks", problem: String(cause) }) });
  yield* focus(client).pipe(Effect.mapError(fail("buttons gate focus")));
  const region = yield* (yield* InputInjection).windowRegion(client).pipe(Effect.mapError(fail("buttons gate viewport")));
  const size = `${region.width}x${region.height}`;
  const misses: SweepMiss[] = [];
  let points = 0;
  let clicked = 0;
  for (const button of buttons) {
    if (button.box === undefined) continue;
    const landed: (string | undefined)[] = [];
    for (const spot of sweepPoints(button.box)) {
      const before = (yield* clicks()).length;
      const at = viewportPoint(region, spot.x, spot.y);
      yield* click(client, at.x, at.y).pipe(Effect.mapError(fail(`buttons gate click ${button.label}`)));
      const after = yield* pollUntil(clicks().pipe(Effect.map(log => log.length > before ? log : undefined)), { every: "100 millis", within: "1500 millis", orElse: () => Effect.void });
      landed.push(Array.isArray(after) ? after[after.length - 1] : undefined);
    }
    points += landed.length;
    clicked += landed.filter(label => label === button.label).length;
    misses.push(...sweepMisses(button, landed));
  }
  const pass = boxless.length === 0 && misses.length === 0 && buttons.length > 0;
  const text = `SMASHCRAFT GATE buttons size=${size} buttons=${buttons.length} points=${points} clicked=${clicked} boxless=${boxless.length} pass=${pass ? 1 : 0}`;
  yield* Effect.try({
    try: () => { mkdirSync(directory, { recursive: true, mode: 0o700 }); writeFileSync(join(directory, "measurements.json"), `${JSON.stringify({ text, size, buttons, boxless, misses }, null, 2)}\n`, { mode: 0o600 }); },
    catch: cause => new AcceptFailure({ operation: "buttons gate evidence", problem: String(cause) }),
  });
  const problems = [...boxless.map(label => `${label} has no click box`), ...misses.map(({ problem }) => problem)];
  if (problems.length > 0) return yield* new AcceptFailure({ operation: "buttons gate", problem: `${problems.length} of ${buttons.length} buttons not clickable across their width at ${size}: ${problems.join("; ")}` });
  return { name: "buttons-gate", text, modified: yield* Clock.currentTimeMillis } satisfies ReceiptFile;
});
