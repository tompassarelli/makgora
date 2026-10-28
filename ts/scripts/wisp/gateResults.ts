import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { InputInjection } from "wisp/scripts/platform/services";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { encodePpm, type Frame } from "wisp/scripts/wisp/frameProbe";
import { type Client, type Ink, batch, capture, click, focus, frameWords, loadClients } from "wisp/scripts/warcraft/desktop";
import { journalMenuFile } from "../../src/game/core/gameFiles";
import { Action } from "../../src/game/input/actions";
import { keyFor, presetBindings } from "../../src/game/input/keyBindings";
import { MATCH_TICKS_PER_SECOND, ResultPick } from "../../src/game/lobby/lobbyState";
import { RESULTS_DELAY_FRAMES } from "../../src/game/render/matchPresentation";
import { parkedChipCentre } from "../../src/game/menu/selectionDrag";
import { cellRect, rosterGrid } from "../../src/game/menu/selectionGrid";
import { PLAYABLE_BUILD } from "../../src/game/session/currentBuild";
import { PLAYABLE_CHARACTERS } from "../../src/game/roster/kits";
import { BUTTON_WIDTH, CHOICE_HEIGHT, CHOICE_TOP, choiceLeft } from "../../src/game/ui/resultsBanner";
import { RULE_BUTTONS } from "../../src/game/ui/ruleButtons";
import { pollUntil } from "../hostPoll";
import { runProcess } from "../hostProcess";
import { JournalMenu } from "./boundary";
import { reachFighterSelect } from "./gateIntro";
import { type StockCursor, loadStockCursor, stockCursorAt } from "./stockCursor";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });

const CURSOR_THRESHOLD = 24;
const STOCK_STEPS = 10;
const START_PRESSES = 8;
const STAGE_WAIT_SECONDS = 3;
const MATCH_WAIT_SECONDS = 15;
const HOLD_MILLIS = 3000;
const BANNER_SETTLE_MILLIS = Math.ceil(2 * RESULTS_DELAY_FRAMES * 1000 / MATCH_TICKS_PER_SECOND);
const WALK_HOLDS = 6;
const WALK_HOLD_SECONDS = 5;

const MOVE_LEFT_KEYS = [...new Set((["wasd", "standard"] as const).flatMap(preset => {
  const key = keyFor(presetBindings(preset), Action.moveLeft, 0);
  return key === undefined ? [] : [String.fromCharCode(key).toLowerCase()];
}))];

const shownStocks = (words: readonly string[]) => {
  const shown = /\b([1-9])\s+Stocks?\b/i.exec(words.join(" "))?.[1];
  return shown === undefined ? undefined : Number(shown);
};

const REMATCH = { x: choiceLeft(ResultPick.rematch) + BUTTON_WIDTH / 2, y: CHOICE_TOP - CHOICE_HEIGHT / 2 };
const AWAY = { x: 0.4, y: 0.3 };

export const gateDriver = (host: Client, directory: string) => Effect.gen(function*() {
  const input = yield* InputInjection;
  const view = (client: Client) => input.windowRegion(client).pipe(Effect.mapError(fail(`results gate viewport ${client.name}`)));
  const shot = (client: Client) => view(client).pipe(Effect.flatMap(region => capture(client, region)), Effect.mapError(fail(`results gate capture ${client.name}`)));
  const words = (client: Client, frame: Frame, ink: Ink = "light") => frameWords(client, frame, ink).pipe(Effect.mapError(fail(`results gate words ${client.name}`)));
  const at = (client: Client, x: number, y: number) => Effect.map(view(client), region => ({ x: region.x + Math.round((region.width - region.height * 4 / 3) / 2 + x * region.height / 0.6), y: region.y + Math.round(region.height - y * region.height / 0.6) }));
  const save = (file: string, frame: Frame) => Effect.try({
    try: () => { const bytes = encodePpm(frame); writeFileSync(join(directory, file), bytes, { mode: 0o600 }); return { file, sha256: createHash("sha256").update(bytes).digest("hex") }; },
    catch: cause => new AcceptFailure({ operation: "results gate evidence", problem: String(cause) }),
  });
  const menu = () => Effect.try({
    try: () => {
      const file = journalMenuFile(PLAYABLE_BUILD.id, 0);
      const path = join(host.documents, "CustomMapData", file);
      return { file, text: readFileSync(path, "latin1"), modified: statSync(path).mtimeMs };
    },
    catch: cause => new AcceptFailure({ operation: "results gate menu", problem: String(cause) }),
  }).pipe(Effect.flatMap(latest => JournalMenu.decode(latest.file, latest.text).pipe(Effect.mapError(fail("results gate menu")))));
  const phase = (wanted: string, after: number, seconds: number) => pollUntil(menu().pipe(Effect.map(value => value.phase === wanted && value.epoch >= after ? value : undefined)), {
    every: "100 millis", within: `${seconds} seconds`, orElse: () => Effect.fail(new AcceptFailure({ operation: "results gate menu", problem: `no ${wanted} journal phase at epoch ${after} or later within ${seconds} s` })),
  });
  const xdotool = (client: Client, args: readonly string[]) => runProcess(ChildProcess.make(client.tools.xdotool, args, { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.mapError(fail(`results gate input ${client.name}`)));
  const pointer = (client: Client) => xdotool(client, ["getmouselocation", "--shell"]).pipe(Effect.map(text => ({ x: Number(/^X=(\d+)$/m.exec(text)?.[1]), y: Number(/^Y=(\d+)$/m.exec(text)?.[1]) })));
  const hover = (client: Client, x: number, y: number) => Effect.gen(function*() {
    const target = yield* at(client, x, y);
    yield* pollUntil(Effect.gen(function*() {
      const from = yield* pointer(client);
      if (from.x === target.x && from.y === target.y) return true;
      yield* xdotool(client, ["mousemove_relative", "--", String(target.x - from.x), String(target.y - from.y)]);
      return undefined;
    }), { every: "100 millis", within: "3 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "results gate pointer", problem: `pointer never reached ${target.x},${target.y} on ${client.name}` })) });
  });
  return { view, shot, words, at, save, menu, phase, xdotool, hover };
});

export type Driver = Effect.Success<ReturnType<typeof gateDriver>>;
type Menu = Effect.Success<ReturnType<Driver["menu"]>>;

export const dismissFirstRunPanels = (d: Driver, client: Client) => Effect.gen(function*() {
  yield* focus(client).pipe(Effect.mapError(fail("results gate setup")));
  yield* reachFighterSelect(client, yield* d.view(client));
});

const oneStock = (d: Driver, host: Client) => Effect.gen(function*() {
  const { fewerStocks } = RULE_BUTTONS;
  const fewer = yield* d.at(host, fewerStocks.x + fewerStocks.width / 2, fewerStocks.y - fewerStocks.height / 2);
  let stocks: number | undefined;
  for (let step = 0; step < STOCK_STEPS; step++) {
    const frame = yield* d.shot(host);
    yield* d.save(`stocks-${step}.ppm`, frame);
    stocks = shownStocks((yield* d.words(host, frame, "gold")).map(word => word.text));
    if (stocks === 1) return stocks;
    yield* click(host, fewer.x, fewer.y).pipe(Effect.mapError(fail("results gate stocks")));
    yield* Effect.sleep("400 millis");
  }
  return yield* new AcceptFailure({ operation: "results gate stocks", problem: `the rules read ${stocks ?? "no"} stocks after ${STOCK_STEPS} steps` });
});

export const pickFighters = (d: Driver, clients: readonly Client[]) => Effect.gen(function*() {
  const grid = rosterGrid(PLAYABLE_CHARACTERS.length);
  for (const [slot, client] of clients.entries()) {
    const tile = cellRect(grid, slot);
    const pin = yield* d.at(client, parkedChipCentre(slot).x, parkedChipCentre(slot).y);
    const drop = yield* d.at(client, (tile.left + tile.right) / 2, (tile.top + tile.bottom) / 2);
    yield* batch(client, [{ kind: "click", ...pin, holdMillis: 200 }, { kind: "wait", millis: 150 }, { kind: "click", ...drop, holdMillis: 200 }, { kind: "wait", millis: 300 }]).pipe(Effect.mapError(fail("results gate fighters")));
    yield* d.save(`picked-${client.name}.ppm`, yield* d.shot(client));
  }
});

const startMatch = (d: Driver, clients: readonly Client[], host: Client, after: number) => Effect.gen(function*() {
  yield* pickFighters(d, clients);
  const stage = yield* pressStartUntil(d, host, "STAGE", after, STAGE_WAIT_SECONDS);
  return { stage, match: yield* pressStartUntil(d, host, "BLOCKED", stage.epoch + 1, MATCH_WAIT_SECONDS) };
});

export const pressStartUntil = (d: Driver, host: Client, wanted: Menu["phase"], after: number, seconds: number) => Effect.gen(function*() {
  for (let press = 0; press < START_PRESSES; press++) {
    yield* batch(host, [{ kind: "keys", keys: ["y"] }]).pipe(Effect.mapError(fail(`results gate ${wanted}`)));
    const seen = yield* d.phase(wanted, after, seconds).pipe(Effect.option);
    if (seen._tag === "Some") return seen.value;
  }
  return yield* new AcceptFailure({ operation: `results gate ${wanted}`, problem: `no ${wanted} journal phase at epoch ${after} or later after ${START_PRESSES} presses of Y` });
});

const walkOff = (d: Driver, host: Client, epoch: number) => Effect.gen(function*() {
  yield* focus(host).pipe(Effect.mapError(fail("results gate walk off")));
  for (let hold = 0; hold < WALK_HOLDS && (yield* d.menu()).phase !== "RESULT"; hold++) {
    yield* d.xdotool(host, ["keydown", ...MOVE_LEFT_KEYS, "sleep", String(WALK_HOLD_SECONDS), "keyup", ...MOVE_LEFT_KEYS]);
  }
  const result = yield* d.phase("RESULT", epoch, 30);
  yield* Effect.sleep(`${BANNER_SETTLE_MILLIS} millis`);
  return result;
});

const cursorOverRematch = (d: Driver, host: Client, stock: StockCursor) => Effect.gen(function*() {
  yield* focus(host).pipe(Effect.mapError(fail("results gate cursor")));
  yield* d.hover(host, REMATCH.x, REMATCH.y);
  const matched = yield* pollUntil(Effect.gen(function*() {
    const frame = yield* d.shot(host);
    const onRematch = stockCursorAt(stock, frame, REMATCH.x, REMATCH.y);
    const away = stockCursorAt(stock, frame, AWAY.x, AWAY.y);
    return onRematch !== undefined && onRematch.error <= CURSOR_THRESHOLD ? { frame, error: onRematch.error, awayError: away?.error } : undefined;
  }), { every: "100 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "results gate cursor", problem: "no drawn cursor over Rematch" })) }).pipe(Effect.option);
  const drawn = matched._tag === "Some" ? matched.value : undefined;
  const evidence = yield* d.save("results-cursor.ppm", drawn?.frame ?? (yield* d.shot(host)));
  return { cursor: drawn !== undefined && (drawn.awayError === undefined || drawn.awayError > CURSOR_THRESHOLD), error: drawn?.error, awayError: drawn?.awayError, evidence };
});

const rematchByBoth = (d: Driver, guest: Client, host: Client, epoch: number) => Effect.gen(function*() {
  const rematchAt = (client: Client) => Effect.gen(function*() {
    const target = yield* d.at(client, REMATCH.x, REMATCH.y);
    yield* batch(client, [{ kind: "click", ...target, holdMillis: 200 }]).pipe(Effect.mapError(fail(`results gate rematch ${client.name}`)));
    return { client: client.name, ...target };
  });
  const first = yield* rematchAt(guest);
  const heldUntil = (yield* Clock.currentTimeMillis) + HOLD_MILLIS;
  let held = true;
  while (held && (yield* Clock.currentTimeMillis) < heldUntil) {
    held = (yield* d.menu()).phase === "RESULT";
    yield* Effect.sleep("100 millis");
  }
  const clicks = [{ ...first, held }, yield* rematchAt(host)];
  const next = yield* d.phase("BLOCKED", epoch + 1, 15).pipe(Effect.option);
  return { held, clicks, next: next._tag === "Some" ? next.value : undefined, evidence: yield* d.save("after-rematch.ppm", yield* d.shot(host)) };
});

export const measureResultsGate = (clientsFile: string, directory: string) => Effect.gen(function*() {
  const clients = yield* loadClients(clientsFile).pipe(Effect.mapError(fail("results gate clients")));
  const [host, guest] = clients;
  if (host === undefined || guest === undefined || clients.length !== 2) return yield* new AcceptFailure({ operation: "results gate", problem: "requires the selected offline pair" });
  yield* Effect.try({ try: () => mkdirSync(directory, { recursive: true, mode: 0o700 }), catch: cause => new AcceptFailure({ operation: "results gate evidence", problem: String(cause) }) });
  const stock = yield* loadStockCursor(host.documents, directory, "results gate cursor assets");
  const d = yield* gateDriver(host, directory);
  const initial = yield* d.menu();
  if (initial.phase !== "CHARACTER") return yield* new AcceptFailure({ operation: "results gate setup", problem: `expected CHARACTER, got ${initial.phase}` });
  for (const client of clients) yield* dismissFirstRunPanels(d, client);
  const stocks = yield* oneStock(d, host);
  const { stage, match } = yield* startMatch(d, clients, host, initial.epoch);
  const result = yield* walkOff(d, host, match.epoch);
  const cursor = yield* cursorOverRematch(d, host, stock);
  const rematch = yield* rematchByBoth(d, guest, host, result.epoch);
  const started = rematch.next !== undefined;
  const text = `SMASHCRAFT GATE results stocks=${stocks} epoch=${result.epoch} result=1 cursor=${cursor.cursor ? 1 : 0} held=${rematch.held ? 1 : 0} rematch=${started ? 1 : 0} pass=${cursor.cursor && rematch.held && started ? 1 : 0}`;
  const modified = yield* Clock.currentTimeMillis;
  yield* Effect.try({
    try: () => writeFileSync(join(directory, "measurements.json"), `${JSON.stringify({ text, threshold: CURSOR_THRESHOLD, holdMillis: HOLD_MILLIS, rematchAt: REMATCH, away: AWAY, initial, stage, match, result, cursor, rematch }, null, 2)}\n`, { mode: 0o600 }),
    catch: cause => new AcceptFailure({ operation: "results gate evidence", problem: String(cause) }),
  });
  return { name: "results-gate", text, modified } satisfies ReceiptFile;
}).pipe(Effect.scoped);
