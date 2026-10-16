import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { InputInjection, encodePpm } from "wisp/scripts/platform/services";
import type { Frame } from "wisp/scripts/wisp/frameProbe";
import { type Client, batch, capture, captureTimed, click, focus, frameWords, loadClients } from "wisp/scripts/warcraft/desktop";
import { journalMenuFile } from "../../src/game/core/gameFiles";
import { cardX } from "../../src/game/menu/selectionDrag";
import { cellRect, rosterGrid } from "../../src/game/menu/selectionGrid";
import { PLAYABLE_BUILD } from "../../src/game/session/currentBuild";
import { Character } from "../../src/game/sim/codes";
import { PLAYABLE_CHARACTERS, fighterName } from "../../src/game/sim/heroes/registry";
import { RULE_BUTTONS } from "../../src/game/ui/ruleButtons";
import { HAZARDS_BUTTON } from "../../src/game/ui/stageUi";
import { pollUntil } from "../hostPoll";
import { runProcess } from "../hostProcess";
import { JournalMenu } from "./boundary";
import { readReplay } from "./replayFiles";
import { type MapStall, readMapStalls } from "./mapStalls";
import { type SmokeVerdict, disturbedSteps, judgeSmoke, mergeVerdicts, smokeLines, smokePace, smokeReceipt } from "./smokeJudge";
import { smokeApproaches } from "./smokeRehearsal";
import { FRAME_MILLIS, RESET_LEAD, SETTLE_AT, type SettlePoint, settlePoints, smokeSchedule, xdotoolArgs } from "./smokeTape";
import { type Settle, type SpotResult, brightCount, playArea, specialsReceipt, specialsSpot } from "./specialsSpot";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });
const REPLAY = /^smashcraft-replay-(\d+)\.txt$/;
const SEGMENT_GAP = "1 second";
const MATCH_SETTLE = "6 seconds";
const PAUSE_SETTLE = "1500 millis";
const MATCH_ATTEMPTS = 3;
const HAZARD_TRIES = 3;

// A fresh private desktop's Xwayland drops the first XTEST motion.
const POINTER_PRIME_ATTEMPTS = 3;

export const isReplayFromMatch = (file: string, modified: number, started: number): boolean =>
  REPLAY.test(file) && modified >= started;

const spotLines = (fighters: readonly string[], results: readonly SpotResult[]) => results.map(({ step, pass, reason }) => `${pass ? "PASS" : "FAIL"} ${fighters.join(" vs ")} ${step}: ${reason}`);

export const smokePairs = (roster: readonly number[] = PLAYABLE_CHARACTERS): (readonly [number, number])[] =>
  Array.from({ length: Math.ceil(roster.length / 2) }, (_, index) => [2 * index, (2 * index + 1) % roster.length] as const);

interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const point = (viewport: Viewport, x: number, y: number) => ({
  x: Math.round(viewport.x + (viewport.width - viewport.height * 4 / 3) / 2 + x * viewport.height / 0.6),
  y: Math.round(viewport.y + viewport.height - y * viewport.height / 0.6),
});

const newestReplay = (data: string, started: number, match: number) => pollUntil(Effect.try({
  try: () => readdirSync(data).filter(file => isReplayFromMatch(file, statSync(join(data, file)).mtimeMs, started)).sort((a, b) => Number(REPLAY.exec(b)?.[1]) - Number(REPLAY.exec(a)?.[1]))[0],
  catch: cause => new AcceptFailure({ operation: "moves gate replay", problem: String(cause) }),
}), { every: "200 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "moves gate replay", problem: `no replay written after match ${match}` })) });

const matchStalls = (clients: readonly Client[], manifests: readonly string[], since: number) => Effect.try({
  try: () => clients.map((client, slot) => readMapStalls(join(client.documents, "CustomMapData"), since, Number(REPLAY.exec(manifests[slot] ?? "")?.[1]))),
  catch: cause => new AcceptFailure({ operation: "moves gate stalls", problem: String(cause) }),
});

const stallLines = (stalls: readonly (readonly MapStall[])[]) => stalls.flatMap((list, slot) => list.map(({ from, through, millis }) => `stall P${slot + 1} ${Math.round(millis)} ms over frames ${from}-${through}`));

export const readHazards = (words: readonly string[]) => /\bhaz[a-z]*:?\s+(on|off)\b/i.exec(words.join(" "))?.[1]?.toLowerCase();

const hazardsLabel = (host: Client, view: Viewport) => capture(host, view).pipe(
  Effect.flatMap(frame => frameWords(host, frame, "light")),
  Effect.map(words => readHazards(words.map(word => word.text))),
  Effect.mapError(fail("moves gate hazards")),
);

const turnHazardsOff = (host: Client, view: Viewport) => Effect.gen(function*() {
  const toggle = point(view, HAZARDS_BUTTON.x + HAZARDS_BUTTON.width / 2, HAZARDS_BUTTON.y - HAZARDS_BUTTON.height / 2);
  for (let attempt = 0; attempt < HAZARD_TRIES; attempt++) {
    const label = yield* hazardsLabel(host, view);
    if (label === "off") return;
    if (label === "on") yield* click(host, toggle.x, toggle.y).pipe(Effect.mapError(fail("moves gate hazards")));
    yield* Effect.sleep("400 millis");
  }
  return yield* new AcceptFailure({ operation: "moves gate hazards", problem: `the stage screen does not read "Hazards: Off" after ${HAZARD_TRIES} tries` });
});

export interface MovesGateReceipts {
  readonly moves: ReceiptFile;
  readonly specials: ReceiptFile;
}

const nowNs = () => performance.now() * 1_000_000;

interface SettleShot {
  readonly settle: Settle;
  readonly frame: Frame | undefined;
}

const spotFrameFiles = (stem: string, runs: readonly (readonly SettleShot[])[], failed: readonly string[]): [string, Uint8Array][] => runs.flatMap(run => run.flatMap(({ settle: { step }, frame }, index): [string, Uint8Array][] => {
  const after = run[index + 1]?.frame;
  if (!failed.includes(step) || frame === undefined || after === undefined) return [];
  const slug = step.toLowerCase().replaceAll(" ", "-");
  return [[`${stem}-${slug}-before.ppm`, encodePpm(frame)], [`${stem}-${slug}-after.ppm`, encodePpm(after)]];
}));

function withSelection(judged: SmokeVerdict, fighters: readonly string[]): SmokeVerdict {
  const seen = [0, 1].map(slot => judged.results.find(result => result.slot === slot && result.kind !== "setup")?.fighter ?? "none");
  return { ...judged, results: [{ slot: 0, fighter: seen.join(" vs "), step: "fighter selection", kind: "setup", pass: seen.join() === fighters.join(), reason: `wanted ${fighters.join(" vs ")}` }, ...judged.results] };
}

const matchRecord =(header: readonly string[], verdict: SmokeVerdict, results: readonly SpotResult[], fighters: readonly string[], settles: readonly Settle[]) => `${[
  ...header, smokeReceipt(verdict, 2), ...smokeLines(verdict), specialsReceipt(2, results), ...spotLines(fighters, results),
  ...verdict.frozen.map(({ slot, step, lost }) => `freeze P${slot + 1} ${step}: the client lost ${lost} frames`),
  ...settles.map(({ step, count, onTime }) => `settle ${step} bright=${count}${onTime ? "" : " late"}`),
].join("\n")}\n`;

export const measureMovesGate = (clientsFile: string, directory: string) => Effect.gen(function*() {
  const clients = yield* loadClients(clientsFile).pipe(Effect.mapError(fail("moves gate clients")));
  const [host, guest] = clients;
  if (host === undefined || guest === undefined || clients.length !== 2) return yield* new AcceptFailure({ operation: "moves gate", problem: "requires the selected offline pair" });
  yield* Effect.try({ try: () => mkdirSync(directory, { recursive: true, mode: 0o700 }), catch: cause => new AcceptFailure({ operation: "moves gate evidence", problem: String(cause) }) });
  const input = yield* InputInjection;
  const data = join(host.documents, "CustomMapData");
  const menu = () => Effect.try({
    try: () => {
      const file = journalMenuFile(PLAYABLE_BUILD.id, 0);
      return { file, text: readFileSync(join(data, file), "latin1"), modified: statSync(join(data, file)).mtimeMs };
    },
    catch: cause => new AcceptFailure({ operation: "moves gate menu", problem: String(cause) }),
  }).pipe(Effect.flatMap(latest => JournalMenu.decode(latest.file, latest.text).pipe(Effect.map(value => ({ ...value, modified: latest.modified })), Effect.mapError(fail("moves gate menu")))));
  const phase = (wanted: string, after: number, seconds: number) => pollUntil(menu().pipe(Effect.map(value => value.phase === wanted && value.modified >= after ? value : undefined)), {
    every: "100 millis", within: `${seconds} seconds`, orElse: () => Effect.fail(new AcceptFailure({ operation: "moves gate menu", problem: `no ${wanted} journal phase within ${seconds} s` })),
  });
  const xdotool = (client: Client, args: readonly string[]) => runProcess(ChildProcess.make(client.tools.xdotool, args, { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.mapError(fail(`moves gate input ${client.name}`)));
  const pointerX = (client: Client) => runProcess(ChildProcess.make(client.tools.xdotool, ["getmouselocation", "--shell"], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.map(text => Number(/^X=(\d+)$/m.exec(text)?.[1])), Effect.mapError(fail(`moves gate pointer ${client.name}`)));
  const prime = (client: Client) => Effect.gen(function*() {
    for (let attempt = 0; attempt < POINTER_PRIME_ATTEMPTS; attempt++) {
      const before = yield* pointerX(client);
      yield* xdotool(client, ["mousemove_relative", "--", before > 0 ? "-1" : "1", "0"]);
      if ((yield* pointerX(client)) !== before) return;
      yield* Effect.sleep("100 millis");
    }
    return yield* new AcceptFailure({ operation: "moves gate pointer", problem: `no pointer motion reached ${client.name} in ${POINTER_PRIME_ATTEMPTS} tries` });
  });
  const tap = (client: Client, key: string) => xdotool(client, ["keydown", key, "sleep", "0.12", "keyup", key]);
  const save = (file: string, text: string | Uint8Array) => Effect.try({ try: () => writeFileSync(join(directory, file), text, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "moves gate evidence", problem: String(cause) }) });

  const initial = yield* menu();
  if (initial.phase !== "CHARACTER") return yield* new AcceptFailure({ operation: "moves gate setup", problem: `expected CHARACTER, got ${initial.phase}` });
  for (const client of clients) {
    yield* focus(client).pipe(Effect.mapError(fail("moves gate setup")));
    yield* prime(client);
    const viewport = yield* input.windowRegion(client).pipe(Effect.mapError(fail("moves gate setup")));
    const words = yield* frameWords(client, yield* capture(client, viewport).pipe(Effect.mapError(fail("moves gate setup"))), "light").pipe(Effect.mapError(fail("moves gate tutorial")));
    const notNow = words.find(word => word.text === "Not");
    if (notNow !== undefined) yield* click(client, viewport.x + notNow.x, viewport.y + notNow.y).pipe(Effect.mapError(fail("moves gate tutorial")));
  }
  const hostView = yield* input.windowRegion(host).pipe(Effect.mapError(fail("moves gate viewport")));
  const { training } = RULE_BUTTONS;
  const toggle = point(hostView, training.x + training.width / 2, training.y - training.height / 2);
  yield* focus(host).pipe(Effect.mapError(fail("moves gate training")));
  yield* click(host, toggle.x, toggle.y).pipe(Effect.mapError(fail("moves gate training")));

  const grid = rosterGrid(PLAYABLE_CHARACTERS.length);
  const verdicts: { readonly fighters: readonly string[]; readonly verdict: SmokeVerdict }[] = [];
  const spots: { readonly fighters: readonly string[]; readonly results: readonly SpotResult[] }[] = [];
  let area = 0;
  let pace = 1;
  const settle = (points: readonly SettlePoint[], startNs: number) => Effect.forEach(points, (point, index) => Effect.gen(function*() {
    const targetNs = startNs + point.frame * FRAME_MILLIS * 1_000_000 / pace;
    const waitMillis = (targetNs - nowNs()) / 1_000_000;
    if (waitMillis > 0) yield* Effect.sleep(`${Math.round(waitMillis)} millis`);
    const { frame, afterNs } = yield* captureTimed(host, nowNs, hostView).pipe(Effect.mapError(fail("moves gate settle frame")));
    area = playArea(frame);
    const kept = point.special || points[index - 1]?.special === true ? frame : undefined;
    return { settle: { step: point.step, special: point.special, count: brightCount(frame), onTime: afterNs - targetNs < (RESET_LEAD - SETTLE_AT) * FRAME_MILLIS * 1_000_000 / pace } satisfies Settle, frame: kept };
  }));
  const playMatch = (index: number, pair: readonly [number, number], characters: readonly Character[]) => Effect.gen(function*() {
    for (const [slot, client] of clients.entries()) {
      const viewport = yield* input.windowRegion(client).pipe(Effect.mapError(fail("moves gate viewport")));
      const cell = cellRect(grid, pair[slot] ?? 0);
      const pin = point(viewport, cardX(slot) + 0.126, 0.17);
      const drop = point(viewport, (cell.left + cell.right) / 2, (cell.top + cell.bottom) / 2);
      yield* focus(client).pipe(Effect.mapError(fail("moves gate pick")));
      yield* batch(client, [{ kind: "click", ...pin, holdMillis: 200 }, { kind: "wait", millis: 150 }, { kind: "click", ...drop, holdMillis: 200 }, { kind: "wait", millis: 300 }]).pipe(Effect.mapError(fail("moves gate pick")));
    }
    const picked = yield* Clock.currentTimeMillis;
    yield* focus(host).pipe(Effect.mapError(fail("moves gate stage")));
    yield* tap(host, "y");
    yield* phase("STAGE", picked, 15);
    yield* turnHazardsOff(host, hostView);
    const staged = yield* Clock.currentTimeMillis;
    yield* tap(host, "y");
    yield* phase("BLOCKED", staged, 30);
    yield* pollUntil(capture(host, hostView).pipe(
      Effect.flatMap(frame => frameWords(host, frame, "light").pipe(Effect.map(words => words.filter(word => word.y < frame.height * 0.12).map(word => word.text.toUpperCase())))),
      Effect.map(title => title.includes("STAGE") && title.includes("SELECT") ? undefined : true),
      Effect.mapError(fail("moves gate match pixels")),
    ), { every: "200 millis", within: "30 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "moves gate match", problem: "STAGE SELECT stays drawn after the start" })) });
    yield* Effect.sleep(MATCH_SETTLE);
    const schedule = smokeSchedule(smokeApproaches(characters[0] ?? Character.rifleman, characters[1] ?? Character.rifleman));
    const runs: SettleShot[][] = [];
    for (const segment of schedule) {
      yield* Effect.forEach(segment.flatMap(({ slot }) => clients[slot] ?? []), client => focus(client).pipe(Effect.mapError(fail("moves gate focus"))), { discard: true });
      const points = settlePoints(segment[0]?.steps ?? []);
      const [, settles] = yield* Effect.all([
        Effect.forEach(segment, ({ slot, steps }) => {
          const client = clients[slot];
          return client === undefined ? Effect.void : xdotool(client, xdotoolArgs(steps, pace));
        }, { concurrency: "unbounded", discard: true }),
        settle(points, nowNs()),
      ], { concurrency: "unbounded" });
      if (settles.length > 0) runs.push(settles);
      yield* Effect.sleep(SEGMENT_GAP);
    }
    const ended = yield* Clock.currentTimeMillis;
    yield* focus(host).pipe(Effect.mapError(fail("moves gate exit")));
    yield* tap(host, "y");
    yield* Effect.sleep(PAUSE_SETTLE);
    yield* tap(host, "e");
    yield* Effect.sleep("300 millis");
    yield* tap(host, "n");
    yield* phase("CHARACTER", ended, 20);
    const manifest = yield* newestReplay(data, picked, index + 1);
    const lines = readReplay(join(data, manifest));
    if (typeof lines === "string") return yield* new AcceptFailure({ operation: "moves gate replay", problem: lines });
    const stalls = yield* matchStalls(clients, [manifest, yield* newestReplay(join(guest.documents, "CustomMapData"), picked, index + 1)], picked);
    return { manifest, lines, schedule, runs, stalls };
  });
  for (const [index, pair] of smokePairs().entries()) {
    const characters = pair.map(choice => PLAYABLE_CHARACTERS[choice] ?? Character.rifleman);
    const fighters = characters.map(fighterName);
    const name = `match-${String(index + 1).padStart(2, "0")}`;
    const invalid: string[] = [];
    for (let attempt = 1; ; attempt++) {
      const { manifest, lines, schedule, runs, stalls } = yield* playMatch(index, pair, characters);
      const judged = judgeSmoke(lines, schedule.flat(), stalls);
      const measured = smokePace(lines, judged);
      const played = pace;
      if (measured !== undefined) pace = measured * played;
      const verdict = withSelection(judged, fighters);
      const settles = runs.map(run => run.map(({ settle }) => settle));
      const results = specialsSpot(settles, area);
      const failedSpots = results.filter(({ pass }) => !pass).map(({ step }) => step);
      const frozen = disturbedSteps(verdict, failedSpots);
      const final = frozen.length === 0 || attempt === MATCH_ATTEMPTS;
      const stem = final ? name : `${name}-invalid-${attempt}`;
      yield* Effect.forEach(spotFrameFiles(stem, runs, failedSpots), ([file, bytes]) => save(file, bytes), { discard: true });
      yield* save(`${stem}.txt`, matchRecord([`replay ${manifest}`, `fighters ${fighters.join(" vs ")}`, `attempt ${attempt}`, `pace played ${played.toFixed(4)} next ${pace.toFixed(4)}`, ...stallLines(stalls), ...invalid], verdict, results, fighters, settles.flat()));
      if (final) {
        verdicts.push({ fighters, verdict });
        spots.push({ fighters, results });
        break;
      }
      invalid.push(`attempt ${attempt} invalid, a failure fell in a client freeze or map stall: ${frozen.join("; ")}`);
    }
  }
  const all = mergeVerdicts(verdicts.map(({ verdict }) => verdict));
  const roster = new Set(verdicts.flatMap(({ fighters }) => fighters)).size;
  const text = smokeReceipt(all, roster);
  const specials = specialsReceipt(roster, spots.flatMap(({ results }) => results));
  yield* save("report.txt", `${[text, ...smokeLines(all), specials, ...spots.flatMap(({ fighters, results }) => spotLines(fighters, results))].join("\n")}\n`);
  const modified = yield* Clock.currentTimeMillis;
  return { moves: { name: "moves-gate", text, modified }, specials: { name: "specials-gate", text: specials, modified } } satisfies MovesGateReceipts;
});
