import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { InputInjection } from "wisp/scripts/platform/services";
import { type Client, batch, capture, click, focus, frameWords, loadClients } from "wisp/scripts/warcraft/desktop";
import { journalMenuFile } from "../../src/game/core/gameFiles";
import { cardX } from "../../src/game/menu/selectionDrag";
import { cellRect, rosterGrid } from "../../src/game/menu/selectionGrid";
import { PLAYABLE_BUILD } from "../../src/game/session/currentBuild";
import { Character } from "../../src/game/sim/codes";
import { PLAYABLE_CHARACTERS, fighterName } from "../../src/game/sim/heroes/registry";
import { RULE_BUTTONS } from "../../src/game/ui/ruleButtons";
import { pollUntil } from "../hostPoll";
import { runProcess } from "../hostProcess";
import { JournalMenu } from "./boundary";
import { readReplay } from "./replayFiles";
import { type SmokeVerdict, judgeSmoke, mergeVerdicts, smokeLines, smokeReceipt } from "./smokeJudge";
import { smokeApproaches } from "./smokeRehearsal";
import { smokeSchedule, xdotoolArgs } from "./smokeTape";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });
const REPLAY = /^smashcraft-replay-(\d+)\.txt$/;
const SEGMENT_GAP = "1 second";
const MATCH_SETTLE = "6 seconds";
const PAUSE_SETTLE = "1500 millis";

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
  const tap = (client: Client, key: string) => xdotool(client, ["keydown", key, "sleep", "0.12", "keyup", key]);
  const save = (file: string, text: string) => Effect.try({ try: () => writeFileSync(join(directory, file), text, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "moves gate evidence", problem: String(cause) }) });

  const initial = yield* menu();
  if (initial.phase !== "CHARACTER") return yield* new AcceptFailure({ operation: "moves gate setup", problem: `expected CHARACTER, got ${initial.phase}` });
  for (const client of clients) {
    yield* focus(client).pipe(Effect.mapError(fail("moves gate setup")));
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
  for (const [index, pair] of smokePairs().entries()) {
    const characters = pair.map(choice => PLAYABLE_CHARACTERS[choice] ?? Character.rifleman);
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
    for (const segment of schedule) {
      yield* Effect.forEach(segment, ({ slot, steps }) => {
        const client = clients[slot];
        return client === undefined ? Effect.void : focus(client).pipe(Effect.mapError(fail("moves gate focus")), Effect.andThen(xdotool(client, xdotoolArgs(steps))));
      }, { concurrency: "unbounded", discard: true });
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
    const manifest = yield* pollUntil(Effect.try({
      try: () => readdirSync(data).filter(file => REPLAY.test(file) && statSync(join(data, file)).mtimeMs >= ended).sort((a, b) => Number(REPLAY.exec(b)?.[1]) - Number(REPLAY.exec(a)?.[1]))[0],
      catch: cause => new AcceptFailure({ operation: "moves gate replay", problem: String(cause) }),
    }), { every: "200 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "moves gate replay", problem: `no replay written after match ${index + 1}` })) });
    const lines = readReplay(join(data, manifest));
    if (typeof lines === "string") return yield* new AcceptFailure({ operation: "moves gate replay", problem: lines });
    const judged = judgeSmoke(lines, schedule.flat());
    const fighters = characters.map(fighterName);
    const seen = [0, 1].map(slot => judged.results.find(result => result.slot === slot)?.fighter ?? "none");
    const verdict: SmokeVerdict = { ...judged, results: [{ slot: 0, fighter: seen.join(" vs "), step: "fighter selection", kind: "setup", pass: seen.join() === fighters.join(), reason: `wanted ${fighters.join(" vs ")}` }, ...judged.results] };
    verdicts.push({ fighters, verdict });
    yield* save(`match-${String(index + 1).padStart(2, "0")}.txt`, `${[`replay ${manifest}`, `fighters ${fighters.join(" vs ")}`, smokeReceipt(verdict, 2), ...smokeLines(verdict)].join("\n")}\n`);
  }
  const all = mergeVerdicts(verdicts.map(({ verdict }) => verdict));
  const text = smokeReceipt(all, new Set(verdicts.flatMap(({ fighters }) => fighters)).size);
  yield* save("report.txt", `${[text, ...smokeLines(all)].join("\n")}\n`);
  return { name: "moves-gate", text, modified: yield* Clock.currentTimeMillis } satisfies ReceiptFile;
});
