import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { InputInjection } from "wisp/scripts/platform/services";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { type Client, capture, focus, loadClients } from "wisp/scripts/warcraft/desktop";
import { encodePpm } from "wisp/scripts/wisp/frameProbe";
import { CREDITS_PANEL, INFO_POPUP_SIZE, infoPopupLayout } from "../../src/game/ui/infoPopupLayout";
import { pollUntil } from "../hostPoll";
import { runProcess } from "../hostProcess";
import { reachFighterSelect, viewportPoint } from "./gateIntro";
import { movePointer } from "./gatePointer";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });

const LOG_FILE = /^makgora-dev-wheel-p\d+\.txt$/;
const WHEEL_AWAY = "4";
const WHEEL_TOWARD = "5";
const TURNS = [WHEEL_TOWARD, WHEEL_TOWARD, WHEEL_TOWARD, WHEEL_AWAY, WHEEL_AWAY] as const;
const CLOSE_TURNS = [WHEEL_TOWARD, WHEEL_AWAY] as const;
const EXPECTED_FIRST = [1, 2, 3, 2, 1];

export const parseWheelLog = (lines: readonly string[]): readonly { readonly delta: number; readonly first: number }[] =>
  lines.flatMap(line => {
    const match = /^WHEEL popup=credits delta=(-?\d+) first=(\d+) n=\d+$/.exec(line.trim());
    return match === null ? [] : [{ delta: Number(match[1]), first: Number(match[2]) }];
  });

const newest = (folder: string, since: number) => readdirSync(folder)
  .filter(file => LOG_FILE.test(file) && statSync(join(folder, file)).mtimeMs >= since)
  .map(file => ({ path: join(folder, file), modified: statSync(join(folder, file)).mtimeMs }))
  .sort((a, b) => b.modified - a.modified)[0];

export const measureWheelGate = (clientsFile: string, name: string, directory: string, send: (text: string) => Effect.Effect<void, AcceptFailure>) => Effect.gen(function*() {
  const since = (yield* Clock.currentTimeMillis) - 60_000;
  const client: Client | undefined = (yield* loadClients(clientsFile).pipe(Effect.mapError(fail("wheel gate clients")))).find(selected => selected.name === name);
  if (client === undefined) return yield* new AcceptFailure({ operation: "wheel gate", problem: `no selected client ${name}` });
  const data = join(client.documents, "CustomMapData");
  const turns = () => Effect.try({
    try: () => {
      const file = newest(data, since);
      if (file === undefined) return [];
      const text = readFileSync(file.path, "utf8");
      return parseWheelLog(preloadLines(text) ?? text.split(/\r?\n/));
    },
    catch: cause => new AcceptFailure({ operation: "wheel gate log", problem: String(cause) }),
  });
  yield* focus(client).pipe(Effect.mapError(fail("wheel gate focus")));
  const region = yield* (yield* InputInjection).windowRegion(client).pipe(Effect.mapError(fail("wheel gate viewport")));
  yield* reachFighterSelect(client, region);
  yield* send("-dev popup credits");
  yield* pollUntil(turns().pipe(Effect.map(() => true), Effect.orElseSucceed(() => undefined)), { every: "100 millis", within: "5 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "wheel gate", problem: "the map did not start its wheel log after -dev popup credits" })) });
  const centre = viewportPoint(region, CREDITS_PANEL.x + CREDITS_PANEL.width / 2, CREDITS_PANEL.y - CREDITS_PANEL.height / 2);
  yield* movePointer(client, centre, "wheel gate pointer");
  yield* Effect.sleep("500 millis");
  for (const [index, button] of TURNS.entries()) {
    yield* runProcess(ChildProcess.make(client.tools.xdotool, ["click", button], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.mapError(fail("wheel gate wheel")));
    yield* pollUntil(turns().pipe(Effect.map(log => log.length > index ? log : undefined)), { every: "100 millis", within: "2 seconds", orElse: () => Effect.void });
  }
  const atCentre = (yield* turns()).length;
  const close = infoPopupLayout(CREDITS_PANEL, [], INFO_POPUP_SIZE, false).close;
  yield* movePointer(client, viewportPoint(region, close.x + close.width / 2, close.y - close.height / 2), "wheel gate close pointer");
  yield* Effect.sleep("500 millis");
  for (const [index, button] of CLOSE_TURNS.entries()) {
    yield* runProcess(ChildProcess.make(client.tools.xdotool, ["click", button], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.mapError(fail("wheel gate close wheel")));
    yield* pollUntil(turns().pipe(Effect.map(log => log.length > atCentre + index ? log : undefined)), { every: "100 millis", within: "2 seconds", orElse: () => Effect.void });
  }
  const shot = yield* capture(client, region).pipe(Effect.mapError(fail("wheel gate capture")));
  yield* Effect.try({ try: () => { mkdirSync(directory, { recursive: true, mode: 0o700 }); writeFileSync(join(directory, "popup.ppm"), encodePpm(shot), { mode: 0o600 }); }, catch: cause => new AcceptFailure({ operation: "wheel gate evidence", problem: String(cause) }) });
  const atClose = (yield* turns()).length - atCentre;
  const log = (yield* turns()).slice(0, atCentre);
  const trace = log.map(({ first }) => first);
  const deltas = log.map(({ delta }) => delta);
  const pass = trace.length === EXPECTED_FIRST.length && trace.every((first, index) => first === EXPECTED_FIRST[index]) && deltas.join(",") === "1,1,1,-1,-1";
  const text = `MAKGORA GATE wheel popup=credits turns=${log.length} trace=${trace.join(",")} pass=${pass ? 1 : 0}`;
  const extra = `centre=${atCentre} close=${atClose}`;
  yield* Effect.try({
    try: () => { mkdirSync(directory, { recursive: true, mode: 0o700 }); writeFileSync(join(directory, "measurements.json"), `${JSON.stringify({ text, extra, centre, log }, null, 2)}\n`, { mode: 0o600 }); },
    catch: cause => new AcceptFailure({ operation: "wheel gate evidence", problem: String(cause) }),
  });
  if (!pass) return yield* new AcceptFailure({ operation: "wheel gate", problem: `${TURNS.length} wheel turns over the open Credits popup produced ${log.length} handled turns with first lines [${trace.join(",")}]; wanted [${EXPECTED_FIRST.join(",")}]` });
  return { name: "wheel-gate", text, modified: yield* Clock.currentTimeMillis } satisfies ReceiptFile;
});
