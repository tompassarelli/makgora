import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { InputInjection } from "wisp/scripts/platform/services";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { type Client, capture, click, focus, frameWords, loadClients } from "wisp/scripts/warcraft/desktop";
import { journalMenuFile } from "../../src/game/core/gameFiles";
import { PLAYABLE_BUILD } from "../../src/game/session/currentBuild";
import { RULE_BUTTONS } from "../../src/game/ui/ruleButtons";
import { pollUntil } from "../hostPoll";
import { runProcess } from "../hostProcess";
import { JournalMenu } from "./boundary";
import { screenWords, startPromptReady, viewportPoint } from "./gateIntro";
import { stopAutorepeat, xset } from "./gateMoves";
import { pickFighters } from "./gateStart";
import { type Fields, RATES_FILE, parseSessionRates } from "./sessionRates";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });
const SEGMENT_MILLIS = 10_000;
const EDGE_MILLIS = 1_000;
const POLL_MILLIS = 500;
const FLUSH_WAIT = "12 seconds";
const MATCH_SETTLE = "6 seconds";
const KEPT_SHARE = 0.9;
const TAP = ["keydown", "semicolon", "sleep", "0.1", "keyup", "semicolon", "sleep", "0.15", "keydown", "semicolon", "sleep", "0.1", "keyup", "semicolon", "sleep", "0.15"];

export interface ModxSegment {
  readonly name: string;
  readonly keys: readonly string[];
  readonly tapped?: boolean;
}

export const MODX_SEGMENTS: readonly ModxSegment[] = [
  { name: "idle", keys: [] },
  { name: "up-right", keys: ["w", "d"] },
  { name: "modx-up-right", keys: ["semicolon", "w", "d"] },
  { name: "modx-tapped", keys: [], tapped: true },
  { name: "modx-alone", keys: ["semicolon"] },
];

interface Window {
  readonly name: string;
  readonly from: number;
  readonly to: number;
}

interface Anchor {
  readonly wall: number;
  readonly t: number;
}

interface Load {
  readonly folder: string;
  readonly load: string;
}

const newestLoad = (folder: string, since: number): Load | undefined => {
  const named = readdirSync(folder).flatMap(name => {
    const match = RATES_FILE.exec(name);
    const mtime = match === null ? 0 : statSync(join(folder, name)).mtimeMs;
    return match === null || mtime < since ? [] : [{ load: match[1] ?? "", mtime }];
  });
  const load = named.sort((a, b) => b.mtime - a.mtime)[0]?.load;
  return load === undefined ? undefined : { folder, load };
};

export const loadSeconds = ({ folder, load }: Load): Fields[] => readdirSync(folder)
  .flatMap(name => {
    const match = RATES_FILE.exec(name);
    return match === null || match[1] !== load ? [] : [{ minute: Number(match[2]), name }];
  })
  .sort((a, b) => a.minute - b.minute)
  .flatMap(({ name }) => {
    const text = readFileSync(join(folder, name), "utf8");
    return parseSessionRates(preloadLines(text) ?? text.split(/\r?\n/)).seconds;
  });

const mean = (rows: readonly Fields[], key: string) => rows.reduce((total, row) => total + (row[key] ?? 0), 0) / Math.max(1, rows.length);
const most = (rows: readonly Fields[], key: string) => rows.reduce((top, row) => Math.max(top, row[key] ?? 0), 0);
const total = (rows: readonly Fields[], key: string) => rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);

export interface SegmentRates {
  readonly segment: string;
  readonly seconds: number;
  readonly cb: number;
  readonly sim: number;
  readonly conf: number;
  readonly luaMs: number;
  readonly tickMs: number;
  readonly tickMaxMs: number;
  readonly stall: number;
  readonly sendFailed: number;
  readonly phases: string;
}

export const segmentRates = (seconds: readonly Fields[], offset: number, windows: readonly Window[]): SegmentRates[] => windows.map(({ name, from, to }) => {
  const rows = seconds.filter(row => row.t !== undefined && offset + row.t >= from + EDGE_MILLIS && offset + row.t <= to - EDGE_MILLIS);
  return {
    segment: name, seconds: rows.length, cb: mean(rows, "cb"), sim: mean(rows, "sim"), conf: mean(rows, "conf"),
    luaMs: mean(rows, "lua") / 1000, tickMs: mean(rows, "tk") / 1000, tickMaxMs: most(rows, "tkmax") / 1000,
    stall: total(rows, "stall"), sendFailed: total(rows, "sf"), phases: [...new Set(rows.map(row => row.ph))].join(","),
  };
});

export const modxKept = (rates: readonly SegmentRates[]): boolean => {
  const plain = rates.find(row => row.segment === "up-right");
  if (plain === undefined || plain.seconds === 0) return false;
  return rates.filter(row => row.segment.startsWith("modx")).every(row => row.seconds > 0 && row.conf >= plain.conf * KEPT_SHARE && row.sendFailed === 0);
};

const rateTable = (client: string, rates: readonly SegmentRates[]) => [
  `client ${client}`,
  "segment        n  cb/s   sim/s  conf/s  lua ms/s  tick ms  tickmax ms  stall  sf  ph",
  ...rates.map(row => [row.segment.padEnd(14), String(row.seconds).padStart(2), row.cb.toFixed(1).padStart(5), row.sim.toFixed(1).padStart(7), row.conf.toFixed(1).padStart(7), row.luaMs.toFixed(1).padStart(9), row.tickMs.toFixed(3).padStart(8), row.tickMaxMs.toFixed(2).padStart(11), String(row.stall).padStart(6), String(row.sendFailed).padStart(3), ` ${row.phases}`].join(" ")),
];

const enterMatch = (clients: readonly Client[], host: Client) => Effect.gen(function*() {
  const input = yield* InputInjection;
  const data = join(host.documents, "CustomMapData");
  const xdotool = (args: readonly string[]) => runProcess(ChildProcess.make(host.tools.xdotool, args, { env: { ...Bun.env, ...host.x11 }, stdin: "ignore" })).pipe(Effect.mapError(fail("modx input")));
  const phase = (wanted: string, after: number) => pollUntil(Effect.try({
    try: () => {
      const file = journalMenuFile(PLAYABLE_BUILD.id, 0);
      return { file, text: readFileSync(join(data, file), "latin1"), modified: statSync(join(data, file)).mtimeMs };
    },
    catch: cause => new AcceptFailure({ operation: "modx menu", problem: String(cause) }),
  }).pipe(
    Effect.flatMap(latest => JournalMenu.decode(latest.file, latest.text).pipe(Effect.map(value => value.phase === wanted && latest.modified >= after ? value : undefined), Effect.mapError(fail("modx menu")))),
  ), { every: "100 millis", within: "30 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "modx menu", problem: `no ${wanted} journal phase within 30 s` })) });
  yield* pickFighters(clients);
  const view = yield* input.windowRegion(host).pipe(Effect.mapError(fail("modx viewport")));
  const { training } = RULE_BUTTONS;
  const toggle = viewportPoint(view, training.x + training.width / 2, training.y - training.height / 2);
  yield* focus(host).pipe(Effect.mapError(fail("modx training")));
  yield* click(host, toggle.x, toggle.y).pipe(Effect.mapError(fail("modx training")));
  yield* pollUntil(capture(host, view).pipe(
    Effect.flatMap(frame => screenWords(host, frame).pipe(Effect.map(words => startPromptReady(words, frame.height) ? true : undefined))),
    Effect.mapError(fail("modx selection ready")),
  ), { every: "250 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "modx selection ready", problem: "fighter choices did not reach the Start / Click prompt" })) });
  const picked = yield* Clock.currentTimeMillis;
  yield* xdotool(["keydown", "y", "sleep", "0.12", "keyup", "y"]);
  yield* phase("STAGE", picked);
  const staged = yield* Clock.currentTimeMillis;
  yield* xdotool(["keydown", "y", "sleep", "0.12", "keyup", "y"]);
  yield* phase("BLOCKED", staged);
  yield* pollUntil(capture(host, view).pipe(
    Effect.flatMap(frame => frameWords(host, frame, "light").pipe(Effect.map(words => words.filter(word => word.y < frame.height * 0.12).map(word => word.text.toUpperCase())))),
    Effect.map(title => title.includes("STAGE") && title.includes("SELECT") ? undefined : true),
    Effect.mapError(fail("modx match pixels")),
  ), { every: "200 millis", within: "30 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "modx match", problem: "STAGE SELECT stays drawn after the start" })) });
  yield* Effect.sleep(MATCH_SETTLE);
  return xdotool;
});

export const measureModxGate = (clientsFile: string, directory: string) => Effect.gen(function*() {
  const clients = yield* loadClients(clientsFile).pipe(Effect.mapError(fail("modx clients")));
  const [host] = clients;
  if (host === undefined || clients.length !== 2) return yield* new AcceptFailure({ operation: "modx gate", problem: "requires the selected offline pair" });
  yield* Effect.try({ try: () => mkdirSync(directory, { recursive: true, mode: 0o700 }), catch: cause => new AcceptFailure({ operation: "modx evidence", problem: String(cause) }) });
  const since = yield* Clock.currentTimeMillis;
  const xdotool = yield* enterMatch(clients, host);
  yield* stopAutorepeat(yield* xset.pipe(Effect.mapError(fail("modx autorepeat"))), host);
  const folders = clients.map(client => join(client.documents, "CustomMapData"));
  const anchors: Anchor[][] = clients.map(() => []);
  const observe = Effect.gen(function*() {
    const wall = yield* Clock.currentTimeMillis;
    yield* Effect.try({ try: () => folders.forEach((folder, slot) => {
      const load = newestLoad(folder, since);
      const t = load === undefined ? undefined : loadSeconds(load).at(-1)?.t;
      if (t !== undefined && anchors[slot]?.at(-1)?.t !== t) anchors[slot]?.push({ wall, t });
    }), catch: cause => new AcceptFailure({ operation: "modx rates", problem: String(cause) }) });
  });
  const windows: Window[] = [];
  for (const segment of MODX_SEGMENTS) {
    const from = yield* Clock.currentTimeMillis;
    if (segment.keys.length > 0) yield* xdotool(["keydown", ...segment.keys]);
    for (let at = 0; at < SEGMENT_MILLIS; at += POLL_MILLIS) {
      if (segment.tapped === true) yield* xdotool(TAP);
      else yield* Effect.sleep(`${POLL_MILLIS} millis`);
      yield* observe;
    }
    if (segment.keys.length > 0) yield* xdotool(["keyup", ...segment.keys]);
    windows.push({ name: segment.name, from, to: yield* Clock.currentTimeMillis });
  }
  yield* Effect.sleep(FLUSH_WAIT);
  yield* observe;
  return yield* modxReceipt(clients, folders, since, anchors, windows, directory);
});

const modxReceipt = (clients: readonly Client[], folders: readonly string[], since: number, anchors: readonly Anchor[][], windows: readonly Window[], directory: string) => Effect.gen(function*() {
  const measured = yield* Effect.try({
    try: () => clients.map((client, slot) => {
      const load = newestLoad(folders[slot] ?? "", since);
      const offset = Math.min(...(anchors[slot] ?? []).map(({ wall, t }) => wall - t));
      return { client: client.name, load: load?.load, offset, anchors: anchors[slot] ?? [], rates: load === undefined || !Number.isFinite(offset) ? [] : segmentRates(loadSeconds(load), offset, windows) };
    }),
    catch: cause => new AcceptFailure({ operation: "modx rates", problem: String(cause) }),
  });
  const kept = measured.every(({ rates }) => modxKept(rates));
  const text = `SMASHCRAFT GATE modx segments=${windows.length} clients=${measured.filter(({ rates }) => rates.length > 0).length} kept=${kept ? 1 : 0} pass=${kept ? 1 : 0}`;
  const table = [text, ...measured.flatMap(({ client, rates }) => rateTable(client, rates))].join("\n");
  yield* Effect.try({
    try: () => {
      writeFileSync(join(directory, "modx.json"), `${JSON.stringify({ text, windows, measured }, null, 2)}\n`, { mode: 0o600 });
      writeFileSync(join(directory, "modx.txt"), `${table}\n`, { mode: 0o600 });
    },
    catch: cause => new AcceptFailure({ operation: "modx evidence", problem: String(cause) }),
  });
  const modified = yield* Clock.currentTimeMillis;
  return { name: "modx-gate", text, modified } satisfies ReceiptFile;
});
