import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { InputInjection } from "wisp/scripts/platform/services";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { encodePpm, type Frame } from "wisp/scripts/wisp/frameProbe";
import { batch, capture, click, focus, frameWords, loadClients } from "wisp/scripts/warcraft/desktop";
import { parkedChipCentre } from "../../src/game/menu/selectionDrag";
import { cellRect, rosterGrid } from "../../src/game/menu/selectionGrid";
import { PLAYABLE_CHARACTERS } from "../../src/game/sim/heroes/registry";
import { gameProcess } from "../integrity/capture";
import { pollUntil } from "../hostPoll";
import { runProcess, startInputProcess } from "../hostProcess";
import { JournalMenu } from "./boundary";
import { loadStockCursor, locateStockCursor } from "./stockCursor";
import { START_BUTTON } from "../../src/game/ui/selectionLayout";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });

export const measureStartGate = (clientsFile: string, name: string, directory: string, restart: Effect.Effect<void, AcceptFailure>) => Effect.gen(function*() {
  const helperPath = process.env["SMASHCRAFT_GATE_HELPER"] ?? join(homedir(), ".local/bin/padbridge");
  const helperSha256 = yield* Effect.try({
    try: () => { mkdirSync(directory, { recursive: true, mode: 0o700 }); return createHash("sha256").update(readFileSync(helperPath)).digest("hex"); },
    catch: cause => new AcceptFailure({ operation: "start gate helper", problem: String(cause) }),
  });
  const qualified = helperSha256 === "54765117e1cae071c0aad6ded1f06af6b227287ed4a237c31cfcd2e6dbe3159d";
  const assetClient = (yield* loadClients(clientsFile).pipe(Effect.mapError(fail("start gate clients")))).find(client => client.name === name);
  if (assetClient === undefined) return yield* new AcceptFailure({ operation: "start gate cursor assets", problem: `no selected client ${name}` });
  const cursor = yield* loadStockCursor(assetClient.documents, directory, "start gate cursor assets");
  const locate = (frame: Frame) => locateStockCursor(cursor, frame);
  let negativeControl: { readonly file: string; readonly sha256: string } | undefined;
  const positions = [{ x: 0.03, y: 0.30 }, { x: 0.40, y: 0.56 }, { x: 0.75, y: 0.50 }];
  const samples: { readonly trial: number; readonly observed: { readonly x: number; readonly y: number; readonly pixelX: number; readonly pixelY: number }; readonly offButton: boolean; readonly started: boolean }[] = [];
  for (const [trial, position] of positions.entries()) {
    if (trial > 0) yield* restart;
    const since = yield* Clock.currentTimeMillis;
    const clients = yield* loadClients(clientsFile).pipe(Effect.mapError(fail("start gate clients")));
    const client = clients.find(client => client.name === name);
    if (client === undefined || clients.length !== 2) return yield* new AcceptFailure({ operation: "start gate", problem: "requires the selected offline pair" });
    const input = yield* InputInjection;
    for (const [slot, selected] of clients.entries()) {
      yield* focus(selected).pipe(Effect.mapError(fail("start gate focus")));
      const region = yield* input.windowRegion(selected).pipe(Effect.mapError(fail("start gate viewport")));
      const frame = yield* capture(selected, region).pipe(Effect.mapError(fail("start gate capture")));
      const words = yield* frameWords(selected, frame, "light").pipe(Effect.mapError(fail("start gate tutorial")));
      const notNow = words.find(word => word.text === "Not");
      if (notNow !== undefined) yield* click(selected, region.x + notNow.x, region.y + notNow.y).pipe(Effect.mapError(fail("start gate tutorial")));
      const point = (x: number, y: number) => ({ x: region.x + Math.round((region.width - region.height * 4 / 3) / 2 + x * region.height / 0.6), y: region.y + Math.round(region.height - y * region.height / 0.6) });
      const pin = point(parkedChipCentre(slot).x, parkedChipCentre(slot).y);
      const tile = cellRect(rosterGrid(PLAYABLE_CHARACTERS.length), slot);
      const drop = point((tile.left + tile.right) / 2, (tile.top + tile.bottom) / 2);
      yield* batch(selected, [{ kind: "click", ...pin, holdMillis: 200 }, { kind: "wait", millis: 100 }, { kind: "click", ...drop, holdMillis: 200 }]).pipe(Effect.mapError(fail("start gate fighters")));
    }
    yield* focus(client).pipe(Effect.mapError(fail("start gate focus")));
    yield* batch(client, [{ kind: "keys", keys: ["y"] }]).pipe(Effect.mapError(fail("start gate stage select")));
    const menu = () => Effect.gen(function*() {
      const file = yield* Effect.try({
        try: () => readdirSync(join(client.documents, "CustomMapData")).filter(file => /^smashcraft-journal-menu-.*\.txt$/.test(file)).map(name => ({ name, path: join(client.documents, "CustomMapData", name) })).filter(file => statSync(file.path).mtimeMs >= since).sort((a, b) => statSync(b.path).mtimeMs - statSync(a.path).mtimeMs)[0],
        catch: cause => new AcceptFailure({ operation: "start gate menu", problem: String(cause) }),
      });
      if (file === undefined) return undefined;
      const text = yield* Effect.try({ try: () => readFileSync(file.path, "utf8"), catch: cause => new AcceptFailure({ operation: "start gate menu", problem: String(cause) }) });
      return yield* JournalMenu.decode(file.name, text).pipe(Effect.mapError(fail("start gate menu")));
    });
    const beforeMenu = yield* pollUntil(menu().pipe(Effect.map(value => value?.phase === "STAGE" ? value : undefined)), { every: "100 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "start gate stage select", problem: "no fresh STAGE receipt after readying both fighters" })) });
    if (beforeMenu === undefined) return yield* new AcceptFailure({ operation: "start gate stage select", problem: "missing STAGE receipt" });
    const region = yield* input.windowRegion(client).pipe(Effect.mapError(fail("start gate viewport")));
    const stageFrame = () => Effect.gen(function*() {
      const frame = yield* capture(client, region).pipe(Effect.mapError(fail("start gate capture")));
      const words = yield* frameWords(client, frame, "light").pipe(Effect.mapError(fail("start gate stage pixels")));
      const title = words.filter(word => word.y < frame.height * 0.12).map(word => word.text.toUpperCase());
      return { frame, words, stage: title.includes("STAGE") && title.includes("SELECT") };
    });
    yield* pollUntil(stageFrame().pipe(Effect.map(value => value.stage ? value : undefined)), { every: "100 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "start gate stage pixels", problem: "no drawn STAGE SELECT title" })) });
    const target = { x: region.x + Math.round((region.width - region.height * 4 / 3) / 2 + position.x * region.height / 0.6), y: region.y + Math.round(region.height - position.y * region.height / 0.6) };
    const pointer = () => runProcess(ChildProcess.make(client.tools.xdotool, ["getmouselocation", "--shell"], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.map(text => ({ x: Number(/^X=(\d+)$/m.exec(text)?.[1]), y: Number(/^Y=(\d+)$/m.exec(text)?.[1]) })), Effect.mapError(fail("start gate pointer")));
    const from = yield* pointer();
    yield* runProcess(ChildProcess.make(client.tools.xdotool, ["mousemove_relative", "--", String(target.x - from.x), String(target.y - from.y)], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.mapError(fail("start gate pointer")));
    const xPointer = yield* pointer();
    if (xPointer.x !== target.x || xPointer.y !== target.y) return yield* new AcceptFailure({ operation: "start gate pointer", problem: `wanted ${target.x},${target.y}; observed ${xPointer.x},${xPointer.y}` });
    const save = (phase: string, retained?: Frame) => Effect.gen(function*() {
      const frame = retained ?? (yield* capture(client, region).pipe(Effect.mapError(fail("start gate capture"))));
      const bytes = encodePpm(frame);
      const file = `${trial}-${phase}.ppm`;
      yield* Effect.try({ try: () => writeFileSync(join(directory, file), bytes, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "start gate evidence", problem: String(cause) }) });
      return { file, sha256: createHash("sha256").update(bytes).digest("hex") };
    });
    const observedFrame = yield* pollUntil(Effect.gen(function*() {
      const stage = yield* stageFrame();
      if (!stage.stage) return undefined;
      yield* save("cursor", stage.frame);
      const cursor = locate(stage.frame);
      return cursor === undefined ? undefined : { ...stage, cursor };
    }), { every: "100 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "start gate cursor", problem: "no matched drawn hand on STAGE SELECT" })) });
    const parked = yield* save("parked", observedFrame.frame);
    const pid = yield* gameProcess(client, true).pipe(Effect.mapError(fail("start gate process")));
    const appId = yield* Effect.try({
      try: () => {
        const value = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").find(value => /^SteamGameId=\d+$/.test(value))?.slice("SteamGameId=".length);
        if (value === undefined) throw new Error(`no SteamGameId on selected Warcraft process ${pid}`);
        return value;
      },
      catch: cause => new AcceptFailure({ operation: "start gate app id", problem: String(cause) }),
    });
    const args = [helperPath, "--preset", "tom", "--virtual-pad", "--emit", "--watch-seconds", "30", "--display", client.x11.DISPLAY ?? "", "--x11-window", client.window, "--pid", String(pid), "--private-wlr-app-id", `steam_app_${appId}`];
    let prePress = observedFrame;
    let before = parked;
    const afterMenu = yield* Effect.scoped(Effect.gen(function*() {
      const helper = yield* startInputProcess(args, { env: { ...Bun.env, ...client.x11, ...client.wayland }, stdout: join(directory, `${trial}-helper.out`), stderr: join(directory, `${trial}-helper.err`) }).pipe(Effect.mapError(fail("start gate helper")));
      yield* Effect.sleep("800 millis");
      yield* helper.write("button start 0").pipe(Effect.mapError(fail("start gate input")));
      yield* Effect.sleep("200 millis");
      const stage = yield* stageFrame();
      const cursor = stage.stage ? locate(stage.frame) : undefined;
      if (!stage.stage || cursor === undefined) return yield* new AcceptFailure({ operation: "start gate pre-press", problem: "missing drawn STAGE SELECT cursor immediately before Start" });
      prePress = { ...stage, cursor };
      before = yield* save("stage", stage.frame);
      yield* helper.write("button start 1").pipe(Effect.mapError(fail("start gate input")));
      yield* Effect.sleep("150 millis");
      yield* helper.write("button start 0").pipe(Effect.mapError(fail("start gate input")));
      return yield* pollUntil(menu().pipe(Effect.map(value => value?.phase === "BLOCKED" && value.epoch > beforeMenu.epoch ? value : undefined)), { every: "100 millis", within: "5 seconds", orElse: menu });
    }));
    const started = afterMenu?.phase === "BLOCKED" && afterMenu.epoch > beforeMenu.epoch;
    const afterFrame = started ? yield* pollUntil(stageFrame().pipe(Effect.map(value => value.stage ? undefined : value.frame)), { every: "100 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "start gate gameplay pixels", problem: "STAGE SELECT remains drawn after match transition" })) }) : yield* capture(client, region).pipe(Effect.mapError(fail("start gate capture")));
    const after = yield* save("after-start", afterFrame);
    const observed = prePress.cursor;
    const offButton = observed.x < START_BUTTON.x || observed.x > START_BUTTON.x + START_BUTTON.width || observed.y > START_BUTTON.y || observed.y < START_BUTTON.y - START_BUTTON.height;
    if (started && negativeControl === undefined) {
      if (locate(afterFrame) !== undefined) return yield* new AcceptFailure({ operation: "start gate calibration", problem: "drawn gameplay negative control matches the stock cursor" });
      negativeControl = after;
    }
    const sample = { trial, position, target, xPointer, observed, parkedCursor: observedFrame.cursor, words: prePress.words, parked, beforeMenu, afterMenu, before, after, args, pid, offButton, started };
    samples.push(sample);
    if (!started) break;
  }
  const started = samples.filter(sample => sample.started).length;
  const distinct = new Set(samples.map(sample => `${sample.observed.pixelX},${sample.observed.pixelY}`)).size;
  const offButton = samples.filter(sample => sample.offButton).length;
  const text = `SMASHCRAFT GATE start trials=${samples.length} started=${started} distinct=${distinct} offButton=${offButton} pass=${qualified && negativeControl !== undefined && samples.length === 3 && started === 3 && distinct === 3 && offButton === 3 ? 1 : 0}`;
  const modified = yield* Clock.currentTimeMillis;
  yield* Effect.try({ try: () => writeFileSync(join(directory, "measurements.json"), `${JSON.stringify({ text, helperPath, helperSha256, qualified, cursor: { modelSha256: cursor.modelSha256, textureSha256: cursor.textureSha256, left: cursor.left, top: cursor.top, width: cursor.width, height: cursor.height, u: cursor.u, v: cursor.v, uWidth: cursor.uWidth, vHeight: cursor.vHeight }, negativeControl, samples }, null, 2)}\n`, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "start gate evidence", problem: String(cause) }) });
  return { name: "start-gate", text, modified } satisfies ReceiptFile;
}).pipe(Effect.scoped);
