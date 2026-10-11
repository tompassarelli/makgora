import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Clock, Effect, Fiber, Schedule } from "effect";
import { ChildProcess } from "effect/process";
import { InputInjection } from "wisp/scripts/platform/services";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { encodePpm, type Frame } from "wisp/scripts/wisp/frameProbe";
import { batch, capture, click, focus, loadClients, frameWords } from "wisp/scripts/warcraft/desktop";
import { cardX, carriedChipLeft, carriedChipTop, chipX, chipY, readyChipSize, HAND_HEIGHT, HAND_WIDTH, handLeft, handTop } from "../../src/game/menu/selectionDrag";
import { cellRect, rosterGrid } from "../../src/game/menu/selectionGrid";
import { PLAYABLE_CHARACTERS } from "../../src/game/sim/heroes/registry";
import { readTga, type Rgba } from "../blp";
import { runProcess } from "../hostProcess";
import { projectRoot } from "./project";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });

const pixelPoint = (frame: Frame, x: number, y: number) => ({
  x: Math.round((frame.width - frame.height * 4 / 3) / 2 + x * frame.height / 0.6),
  y: Math.round(frame.height - y * frame.height / 0.6),
});

function texturePixels(frame: Frame, texture: Rgba, x: number, y: number, uiWidth: number, uiHeight: number): { error: number; pixels: number; matchedPixels: number } | undefined {
  const origin = pixelPoint(frame, x, y);
  const width = Math.round(uiWidth * frame.height / 0.6);
  const height = Math.round(uiHeight * frame.height / 0.6);
  let best = Infinity;
  let bestPixels = 0;
  let bestMatchedPixels = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    let error = 0;
    let pixels = 0;
    let matchedPixels = 0;
    for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
      const source = (Math.min(texture.height - 1, Math.floor(py * texture.height / height)) * texture.width + Math.min(texture.width - 1, Math.floor(px * texture.width / width))) * 4;
      if ((texture.data[source + 3] ?? 0) < 240) continue;
      const sx = origin.x + px + dx;
      const sy = origin.y + py + dy;
      if (sx < 0 || sy < 0 || sx >= frame.width || sy >= frame.height) continue;
      const target = (sy * frame.width + sx) * 3;
      let pixelError = 0;
      for (let channel = 0; channel < 3; channel++) pixelError += Math.abs((frame.rgb[target + channel] ?? 0) - (texture.data[source + channel] ?? 0));
      error += pixelError;
      if (pixelError / 3 <= 24) matchedPixels++;
      pixels++;
    }
    if (pixels >= 32 && error / (pixels * 3) < best) {
      best = error / (pixels * 3);
      bestPixels = pixels;
      bestMatchedPixels = matchedPixels;
    }
  }
  return Number.isFinite(best) ? { error: best, pixels: bestPixels, matchedPixels: bestMatchedPixels } : undefined;
}

const textureError = (frame: Frame, texture: Rgba, x: number, y: number, uiWidth: number, uiHeight: number) => texturePixels(frame, texture, x, y, uiWidth, uiHeight)?.error;

export const cursorPixels = (frame: Frame, texture: Rgba, x: number, y: number) => texturePixels(frame, texture, handLeft(x, false), handTop(y, false), HAND_WIDTH, HAND_HEIGHT);

const cursorError = (frame: Frame, texture: Rgba, x: number, y: number) => cursorPixels(frame, texture, x, y)?.error;

export const measureCursorGate = (clientsFile: string, name: string, directory: string) => Effect.gen(function*() {
  const clients = yield* loadClients(clientsFile).pipe(Effect.mapError(fail("cursor gate clients")));
  const client = clients.find(client => client.name === name);
  if (client === undefined) return yield* new AcceptFailure({ operation: "cursor gate", problem: `no selected client ${name}` });
  yield* focus(client).pipe(Effect.mapError(fail("cursor gate focus")));
  const input = yield* InputInjection;
  const region = yield* input.windowRegion(client).pipe(Effect.mapError(fail("cursor gate viewport")));
  const texture = yield* Effect.try({
    try: () => {
      const pin = readFileSync(join(projectRoot, "build-inputs/selection-assets"), "utf8").trim();
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const assetDirectory = join(homedir(), ".local/share/smashcraft-build-inputs/store/selection-assets", pin);
      return { hand: readTga(readFileSync(join(assetDirectory, "SelectionHandPinch.tga"))), chip: readTga(readFileSync(join(assetDirectory, "SelectionChipP1.tga"))) };
    },
    catch: cause => new AcceptFailure({ operation: "cursor gate texture", problem: String(cause) }),
  });
  const frame = yield* capture(client, region).pipe(Effect.mapError(fail("cursor gate capture")));
  const words = yield* frameWords(client, frame, "light").pipe(Effect.mapError(fail("cursor gate tutorial")));
  const notNow = words.find(word => word.text === "Not");
  if (notNow !== undefined) yield* click(client, region.x + notNow.x, region.y + notNow.y).pipe(Effect.mapError(fail("cursor gate tutorial")));
  const grid = rosterGrid(PLAYABLE_CHARACTERS.length);
  const samples: { file: string; sha256: string; elapsedMs: number; phase: string; x: number; y: number; error: number | undefined; handPixels: number; matchedHandPixels: number; chipError: number | undefined; visible: boolean }[] = [];
  const started = yield* Clock.currentTimeMillis;
  const pointer = () => runProcess(ChildProcess.make(client.tools.xdotool, ["getmouselocation", "--shell"], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.map(output => ({
    x: Number(/^X=(\d+)$/m.exec(output)?.[1]), y: Number(/^Y=(\d+)$/m.exec(output)?.[1]),
  })), Effect.mapError(fail("cursor gate pointer")));
  const move = (x: number, y: number) => Effect.gen(function*() {
    const point = pixelPoint(frame, x, y);
    const from = yield* pointer();
    const target = { x: region.x + point.x, y: region.y + point.y };
    yield* runProcess(ChildProcess.make(client.tools.xdotool, ["mousemove_relative", "--", String(target.x - from.x), String(target.y - from.y)], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.mapError(fail("cursor gate pointer")));
    const at = yield* pointer();
    if (at.x !== target.x || at.y !== target.y) return yield* new AcceptFailure({ operation: "cursor gate pointer", problem: `pointer at ${at.x},${at.y}; wanted ${target.x},${target.y}` });
  });
  const sample = (phase: string, x: number, y: number) => Effect.gen(function*() {
    yield* move(x, y);
    yield* Effect.sleep("50 millis");
    const pixels = yield* capture(client, region).pipe(Effect.mapError(fail("cursor gate capture")));
    const elapsedMs = (yield* Clock.currentTimeMillis) - started;
    const hand = cursorPixels(pixels, texture.hand, x, y);
    const error = hand?.error;
    const chipError = phase === "carrying" ? textureError(pixels, texture.chip, carriedChipLeft(x, 0.06), carriedChipTop(y, 0.06), 0.06, 0.06)
      : phase === "after-drop" ? textureError(pixels, texture.chip, chipX(grid, 0, 0), chipY(grid, 0, 0), readyChipSize(grid), readyChipSize(grid)) : undefined;
    const bytes = encodePpm(pixels);
    const file = `${String(samples.length).padStart(3, "0")}-${phase}.ppm`;
    yield* Effect.try({ try: () => writeFileSync(join(directory, file), bytes, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "cursor gate evidence", problem: String(cause) }) });
    const result = { file, sha256: createHash("sha256").update(bytes).digest("hex"), elapsedMs, phase, x, y, error, handPixels: hand?.pixels ?? 0, matchedHandPixels: hand?.matchedPixels ?? 0, chipError, visible: error !== undefined && error <= 24 };
    samples.push(result);
    return result;
  });
  const clickThrough = (phase: string, x: number, y: number) => Effect.gen(function*() {
    const point = pixelPoint(frame, x, y);
    const pressed = yield* Effect.forkScoped(batch(client, [{ kind: "click", x: region.x + point.x, y: region.y + point.y, holdMillis: 200 }]).pipe(Effect.mapError(fail(`cursor gate ${phase}`))));
    for (let index = 0; index < 4; index++) yield* sample(phase, x, y);
    yield* Fiber.join(pressed);
  });
  const pin = { x: cardX(0) + 0.126, y: 0.17 };
  const control = yield* sample("positive-control", 0.03, 0.3);
  const controlFrame = yield* capture(client, region).pipe(Effect.mapError(fail("cursor gate control")));
  const negativeControlError = cursorError(controlFrame, texture.hand, 0.4, 0.56);
  if (!control.visible || negativeControlError === undefined || negativeControlError <= 24) return yield* new AcceptFailure({ operation: "cursor gate calibration", problem: `positive error=${control.error}; negative error=${negativeControlError}` });
  yield* sample("before-pick", pin.x, pin.y);
  yield* clickThrough("pick", pin.x, pin.y);
  yield* sample("after-pick", pin.x, pin.y);
  const first = cellRect(grid, 0);
  const drop = { x: (first.left + first.right) / 2, y: (first.top + first.bottom) / 2 };
  yield* sample("carrying", drop.x, drop.y);
  yield* clickThrough("drop", drop.x, drop.y);
  yield* sample("after-drop", drop.x, drop.y).pipe(Effect.repeat({ schedule: Schedule.recurs(39), until: sample => sample.chipError !== undefined && sample.chipError <= 24 }));
  const sweepStarted = yield* Clock.currentTimeMillis;
  for (let index = 0; index < 100; index++) {
    const cell = cellRect(grid, index % PLAYABLE_CHARACTERS.length);
    yield* sample("sweep", (cell.left + cell.right) / 2, (cell.top + cell.bottom) / 2);
  }
  const sweepMs = (yield* Clock.currentTimeMillis) - sweepStarted;
  const visible = samples.filter(sample => sample.visible).length;
  const picked = samples.some(sample => sample.phase === "carrying" && sample.chipError !== undefined && sample.chipError <= 24);
  const dropped = samples.some(sample => sample.phase === "after-drop" && sample.chipError !== undefined && sample.chipError <= 24);
  const modified = yield* Clock.currentTimeMillis;
  const text = `SMASHCRAFT GATE cursor frames=${samples.length} visible=${visible} sweepMs=${sweepMs} picked=${picked ? 1 : 0} dropped=${dropped ? 1 : 0} pass=${visible === samples.length && picked && dropped && sweepMs >= 5000 ? 1 : 0}`;
  yield* Effect.try({ try: () => writeFileSync(join(directory, "measurements.json"), `${JSON.stringify({ text, threshold: 24, positiveControl: control.file, negativeControlError, missingFrameIds: samples.flatMap((sample, index) => sample.visible ? [] : [index]), region, handWidth: HAND_WIDTH, handHeight: HAND_HEIGHT, samples }, null, 2)}\n`, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "cursor gate evidence", problem: String(cause) }) });
  return { name: "cursor-gate", text, modified } satisfies ReceiptFile;
}).pipe(Effect.scoped);
