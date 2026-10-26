import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { InputInjection } from "wisp/scripts/platform/services";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { encodePpm, type Frame } from "wisp/scripts/wisp/frameProbe";
import { batch, capture, focus, loadClients, type Region } from "wisp/scripts/warcraft/desktop";
import { START_BUTTON } from "../../src/game/ui/selectionLayout";
import { pollUntil } from "../hostPoll";
import { runProcess } from "../hostProcess";
import { pickFighters, stageSelectFrame } from "./gateStart";
import { locateStockCursor, type StockCursor, loadStockCursor, stockCursorAt } from "./stockCursor";
import { pixelPoint } from "./uiTexture";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });

const REST_FRAMES = 60;
const CURSOR_ERROR = 24;
const BLINK_SPREAD = 4;
const SAME_SPOT_PIXELS = 3;

// A fresh private desktop's Xwayland drops the first XTEST motion.
const POINTER_MOVE_ATTEMPTS = 3;

const startCentre = { x: START_BUTTON.x + START_BUTTON.width / 2, y: START_BUTTON.y - START_BUTTON.height / 2 };

const insideStart = (x: number, y: number) => x >= START_BUTTON.x && x <= START_BUTTON.x + START_BUTTON.width && y <= START_BUTTON.y && y >= START_BUTTON.y - START_BUTTON.height;

const ART_MARGIN = 0.004;

const startPixels = (frame: Frame, cursor: StockCursor, x: number, y: number, margin: number, visit: (px: number, py: number, index: number) => void) => {
  const origin = pixelPoint(frame, START_BUTTON.x - margin, START_BUTTON.y + margin);
  const end = pixelPoint(frame, START_BUTTON.x + START_BUTTON.width + margin, START_BUTTON.y - START_BUTTON.height - margin);
  const hand = pixelPoint(frame, x + cursor.left, y + cursor.top);
  const handWidth = Math.round(cursor.width * frame.height / 0.6) + 4;
  const handHeight = Math.round(cursor.height * frame.height / 0.6) + 4;
  for (let py = origin.y; py < end.y; py++) for (let px = origin.x; px < end.x; px++) {
    if (px >= hand.x - 2 && px < hand.x - 2 + handWidth && py >= hand.y - 2 && py < hand.y - 2 + handHeight) continue;
    visit(px, py, (py * frame.width + px) * 3);
  }
};

const startLuminance = (frame: Frame, cursor: StockCursor, x: number, y: number) => {
  let sum = 0;
  let pixels = 0;
  startPixels(frame, cursor, x, y, 0, (_px, _py, index) => {
    sum += 0.299 * (frame.rgb[index] ?? 0) + 0.587 * (frame.rgb[index + 1] ?? 0) + 0.114 * (frame.rgb[index + 2] ?? 0);
    pixels++;
  });
  return pixels === 0 ? 0 : sum / pixels;
};

const startArt = (frame: Frame, cursor: StockCursor, x: number, y: number) => {
  let box: { left: number; top: number; right: number; bottom: number } | undefined;
  startPixels(frame, cursor, x, y, ART_MARGIN, (px, py, index) => {
    const red = frame.rgb[index] ?? 0, green = frame.rgb[index + 1] ?? 0, blue = frame.rgb[index + 2] ?? 0;
    if (red <= 150 || green <= 100 || blue >= 90 || red <= blue + 80) return;
    box = box === undefined ? { left: px, top: py, right: px, bottom: py } : { left: Math.min(box.left, px), top: Math.min(box.top, py), right: Math.max(box.right, px), bottom: Math.max(box.bottom, py) };
  });
  return box === undefined ? undefined : { ...box, centreX: (box.left + box.right) / 2 };
};

export const measureStartRestGate = (clientsFile: string, name: string, directory: string) => Effect.gen(function*() {
  yield* Effect.try({ try: () => mkdirSync(directory, { recursive: true, mode: 0o700 }), catch: cause => new AcceptFailure({ operation: "start rest gate evidence", problem: String(cause) }) });
  const clients = yield* loadClients(clientsFile).pipe(Effect.mapError(fail("start rest gate clients")));
  const client = clients.find(client => client.name === name);
  if (client === undefined || clients.length !== 2) return yield* new AcceptFailure({ operation: "start rest gate", problem: "requires the selected offline pair" });
  const cursor = yield* loadStockCursor(client.documents, directory, "start rest gate cursor assets");
  yield* pickFighters(clients);
  yield* focus(client).pipe(Effect.mapError(fail("start rest gate focus")));
  const input = yield* InputInjection;
  const region: Region = yield* input.windowRegion(client).pipe(Effect.mapError(fail("start rest gate viewport")));
  const pointer = () => runProcess(ChildProcess.make(client.tools.xdotool, ["getmouselocation", "--shell"], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.map(output => ({
    x: Number(/^X=(\d+)$/m.exec(output)?.[1]), y: Number(/^Y=(\d+)$/m.exec(output)?.[1]),
  })), Effect.mapError(fail("start rest gate pointer")));
  const move = (frame: Frame, x: number, y: number) => Effect.gen(function*() {
    const point = pixelPoint(frame, x, y);
    const target = { x: region.x + point.x, y: region.y + point.y };
    let at = yield* pointer();
    for (let attempt = 0; attempt < POINTER_MOVE_ATTEMPTS && (at.x !== target.x || at.y !== target.y); attempt++) {
      if (attempt > 0) yield* Effect.sleep("100 millis");
      yield* runProcess(ChildProcess.make(client.tools.xdotool, ["mousemove_relative", "--", String(target.x - at.x), String(target.y - at.y)], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.mapError(fail("start rest gate pointer")));
      at = yield* pointer();
    }
    if (at.x !== target.x || at.y !== target.y) return yield* new AcceptFailure({ operation: "start rest gate pointer", problem: `pointer at ${at.x},${at.y}; wanted ${target.x},${target.y}` });
  });
  const save = (file: string, frame: Frame) => Effect.try({
    try: () => { const bytes = encodePpm(frame); writeFileSync(join(directory, file), bytes, { mode: 0o600 }); return { file, sha256: createHash("sha256").update(bytes).digest("hex") }; },
    catch: cause => new AcceptFailure({ operation: "start rest gate evidence", problem: String(cause) }),
  });
  const rest = (screen: string, x: number, y: number) => Effect.gen(function*() {
    yield* Effect.sleep("300 millis");
    const started = yield* Clock.currentTimeMillis;
    const frames: { readonly elapsedMs: number; readonly error: number | undefined; readonly visible: boolean; readonly luminance: number; readonly saved?: { readonly file: string; readonly sha256: string } }[] = [];
    let first: Frame | undefined;
    for (let index = 0; index < REST_FRAMES; index++) {
      const frame = yield* capture(client, region).pipe(Effect.mapError(fail("start rest gate capture")));
      first ??= frame;
      const error = stockCursorAt(cursor, frame, x, y)?.error;
      const visible = error !== undefined && error <= CURSOR_ERROR;
      const luminance = startLuminance(frame, cursor, x, y);
      const saved = index === 0 || index === REST_FRAMES - 1 || (!visible && frames.filter(frame => frame.saved !== undefined).length < 12) ? yield* save(`${screen}-${String(index).padStart(3, "0")}.ppm`, frame) : undefined;
      frames.push({ elapsedMs: (yield* Clock.currentTimeMillis) - started, error, visible, luminance, ...(saved === undefined ? {} : { saved }) });
      yield* Effect.sleep("30 millis");
    }
    const art = first === undefined ? undefined : startArt(first, cursor, x, y);
    const luminances = frames.map(frame => frame.luminance);
    return { screen, x, y, art, visible: frames.filter(frame => frame.visible).length, spread: Math.max(...luminances) - Math.min(...luminances), restMs: frames.at(-1)?.elapsedMs ?? 0, frames };
  });
  const characterFrame = yield* capture(client, region).pipe(Effect.mapError(fail("start rest gate capture")));
  yield* move(characterFrame, startCentre.x, startCentre.y);
  const character = yield* rest("character", startCentre.x, startCentre.y);
  const start = pixelPoint(characterFrame, startCentre.x, startCentre.y);
  yield* batch(client, [{ kind: "click", x: region.x + start.x, y: region.y + start.y, holdMillis: 150 }]).pipe(Effect.mapError(fail("start rest gate stage select")));
  const entered = yield* pollUntil(stageSelectFrame(client, region).pipe(Effect.map(value => value.stage ? value : undefined)), { every: "100 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "start rest gate stage pixels", problem: "no drawn CHOOSE A STAGE title" })) });
  const entry = yield* save("stage-entry.ppm", entered.frame);
  const placed = locateStockCursor(cursor, entered.frame);
  const autoPlaced = placed !== undefined && insideStart(placed.x, placed.y);
  if (!autoPlaced) yield* move(entered.frame, startCentre.x, startCentre.y);
  const stage = yield* rest("stage", autoPlaced ? placed.x : startCentre.x, autoPlaced ? placed.y : startCentre.y);
  const dx = character.art === undefined || stage.art === undefined ? Infinity : Math.abs(character.art.centreX - stage.art.centreX);
  const dy = character.art === undefined || stage.art === undefined ? Infinity : Math.abs(character.art.top - stage.art.top);
  const sameSpot = dx <= SAME_SPOT_PIXELS && dy <= SAME_SPOT_PIXELS;
  const steady = (screen: typeof character) => screen.visible === REST_FRAMES && screen.spread <= BLINK_SPREAD;
  const text = `SMASHCRAFT GATE start-rest frames=${REST_FRAMES} character=${character.visible} stage=${stage.visible} characterSpread=${character.spread.toFixed(1)} stageSpread=${stage.spread.toFixed(1)} autoPlaced=${autoPlaced ? 1 : 0} startDx=${dx} startDy=${dy} pass=${steady(character) && steady(stage) && sameSpot ? 1 : 0}`;
  const modified = yield* Clock.currentTimeMillis;
  yield* Effect.try({ try: () => writeFileSync(join(directory, "measurements.json"), `${JSON.stringify({ text, cursorError: CURSOR_ERROR, blinkSpread: BLINK_SPREAD, sameSpotPixels: SAME_SPOT_PIXELS, region, startButton: START_BUTTON, cursor: { modelSha256: cursor.modelSha256, textureSha256: cursor.textureSha256 }, entry, placed, character, stage }, null, 2)}\n`, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "start rest gate evidence", problem: String(cause) }) });
  return { name: "start-rest-gate", text, modified } satisfies ReceiptFile;
}).pipe(Effect.scoped);
