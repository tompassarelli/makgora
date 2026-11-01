import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Clock, Effect } from "effect";
import { ChildProcess } from "effect/process";
import { InputInjection } from "wisp/scripts/platform/services";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { encodePpm, type Frame } from "wisp/scripts/wisp/frameProbe";
import { batch, capture, type Client, focus, frameWords, loadClients, type Region } from "wisp/scripts/warcraft/desktop";
import { parkedChipCentre } from "../../src/game/menu/selectionDrag";
import { cellRect, rosterGrid } from "../../src/game/menu/selectionGrid";
import { PLAYABLE_CHARACTERS } from "../../src/game/roster/kits";
import { ROSTER_TILES, tileOfCharacter } from "../../src/game/ui/selectionFrames";
import { gameProcess } from "../integrity/capture";
import { pollUntil } from "../hostPoll";
import { runProcess, startInputProcess } from "../hostProcess";
import { JournalMenu } from "./boundary";
import { currentHelper } from "./currentPlaytest";
import { reachFighterSelect } from "./gateIntro";
import { loadStockCursor, locateStockCursor } from "./stockCursor";
import { STAGE_START_BUTTON } from "../../src/game/ui/selectionLayout";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });

export const pickFighters = (clients: readonly Client[]) => Effect.gen(function*() {
  const input = yield* InputInjection;
  for (const [slot, selected] of clients.entries()) {
    yield* focus(selected).pipe(Effect.mapError(fail("start gate focus")));
    const region = yield* input.windowRegion(selected).pipe(Effect.mapError(fail("start gate viewport")));
    yield* reachFighterSelect(selected, region);
    const point = (x: number, y: number) => ({ x: region.x + Math.round((region.width - region.height * 4 / 3) / 2 + x * region.height / 0.6), y: region.y + Math.round(region.height - y * region.height / 0.6) });
    const pin = point(parkedChipCentre(slot).x, parkedChipCentre(slot).y);
    const tile = cellRect(rosterGrid(ROSTER_TILES), tileOfCharacter(PLAYABLE_CHARACTERS[slot] ?? 0));
    const drop = point((tile.left + tile.right) / 2, (tile.top + tile.bottom) / 2);
    yield* batch(selected, [{ kind: "click", ...pin, holdMillis: 200 }, { kind: "wait", millis: 100 }, { kind: "click", ...drop, holdMillis: 200 }]).pipe(Effect.mapError(fail("start gate fighters")));
  }
});

export const stageSelectFrame = (client: Client, region: Region) => Effect.gen(function*() {
  const frame = yield* capture(client, region).pipe(Effect.mapError(fail("start gate capture")));
  const words = yield* frameWords(client, frame, "light").pipe(Effect.mapError(fail("start gate stage pixels")));
  const texts = words.map(word => word.text);
  return { frame, words, stage: texts.includes("CHOOSE") && texts.includes("STAGE") };
});

export const measureStartGate = (clientsFile: string, name: string, directory: string, restart: Effect.Effect<void, AcceptFailure>) => Effect.gen(function*() {
  const helperPath = join(dirname(yield* currentHelper.pipe(Effect.mapError(fail("start gate helper")))), "padbridge");
  const helperSha256 = yield* Effect.try({
    try: () => { mkdirSync(directory, { recursive: true, mode: 0o700 }); return createHash("sha256").update(readFileSync(helperPath)).digest("hex"); },
    catch: cause => new AcceptFailure({ operation: "start gate helper", problem: String(cause) }),
  });
  const assetClient = (yield* loadClients(clientsFile).pipe(Effect.mapError(fail("start gate clients")))).find(client => client.name === name);
  if (assetClient === undefined) return yield* new AcceptFailure({ operation: "start gate cursor assets", problem: `no selected client ${name}` });
  const cursor = yield* loadStockCursor(assetClient.documents, directory, "start gate cursor assets");
  const locate = (frame: Frame) => locateStockCursor(cursor, frame);
  const offButton = (observed: { readonly x: number; readonly y: number }) => observed.x < STAGE_START_BUTTON.x || observed.x > STAGE_START_BUTTON.x + STAGE_START_BUTTON.width || observed.y > STAGE_START_BUTTON.y || observed.y < STAGE_START_BUTTON.y - STAGE_START_BUTTON.height;
  let negativeControl: { readonly file: string; readonly sha256: string } | undefined;
  const positions = [{ x: 0.03, y: 0.30 }, { x: 0.40, y: 0.56 }, { x: 0.75, y: 0.50 }];
  const samples: { readonly trial: number; readonly selected: { readonly x: number; readonly y: number; readonly pixelX: number; readonly pixelY: number }; readonly offButton: boolean; readonly opened: boolean; readonly started: boolean }[] = [];
  for (const [trial, position] of positions.entries()) {
    if (trial > 0) yield* restart;
    const since = yield* Clock.currentTimeMillis;
    const clients = yield* loadClients(clientsFile).pipe(Effect.mapError(fail("start gate clients")));
    const client = clients.find(client => client.name === name);
    if (client === undefined || clients.length !== 2) return yield* new AcceptFailure({ operation: "start gate", problem: "requires the selected offline pair" });
    const input = yield* InputInjection;
    yield* pickFighters(clients);
    yield* focus(client).pipe(Effect.mapError(fail("start gate focus")));
    const menu = () => Effect.gen(function*() {
      const file = yield* Effect.try({
        try: () => readdirSync(join(client.documents, "CustomMapData")).filter(file => /^smashcraft-journal-menu-.*\.txt$/.test(file)).map(name => ({ name, path: join(client.documents, "CustomMapData", name) })).filter(file => statSync(file.path).mtimeMs >= since).sort((a, b) => statSync(b.path).mtimeMs - statSync(a.path).mtimeMs)[0],
        catch: cause => new AcceptFailure({ operation: "start gate menu", problem: String(cause) }),
      });
      if (file === undefined) return undefined;
      const text = yield* Effect.try({ try: () => readFileSync(file.path, "utf8"), catch: cause => new AcceptFailure({ operation: "start gate menu", problem: String(cause) }) });
      return yield* JournalMenu.decode(file.name, text).pipe(Effect.mapError(fail("start gate menu")));
    });
    const selectMenu = yield* pollUntil(menu().pipe(Effect.map(value => value?.phase === "CHARACTER" ? value : undefined)), { every: "100 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "start gate character select", problem: "no fresh CHARACTER receipt after readying both fighters" })) });
    if (selectMenu === undefined) return yield* new AcceptFailure({ operation: "start gate character select", problem: "missing CHARACTER receipt" });
    const region = yield* input.windowRegion(client).pipe(Effect.mapError(fail("start gate viewport")));
    const shot = () => stageSelectFrame(client, region);
    const target = { x: region.x + Math.round((region.width - region.height * 4 / 3) / 2 + position.x * region.height / 0.6), y: region.y + Math.round(region.height - position.y * region.height / 0.6) };
    const pointer = () => runProcess(ChildProcess.make(client.tools.xdotool, ["getmouselocation", "--shell"], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.map(text => ({ x: Number(/^X=(\d+)$/m.exec(text)?.[1]), y: Number(/^Y=(\d+)$/m.exec(text)?.[1]) })), Effect.mapError(fail("start gate pointer")));
    const park = () => Effect.gen(function*() {
      const from = yield* pointer();
      yield* runProcess(ChildProcess.make(client.tools.xdotool, ["mousemove_relative", "--", String(target.x - from.x), String(target.y - from.y)], { env: { ...Bun.env, ...client.x11 }, stdin: "ignore" })).pipe(Effect.mapError(fail("start gate pointer")));
      const parked = yield* pointer();
      if (parked.x !== target.x || parked.y !== target.y) return yield* new AcceptFailure({ operation: "start gate pointer", problem: `wanted ${target.x},${target.y}; observed ${parked.x},${parked.y}` });
      return parked;
    });
    const save = (phase: string, retained?: Frame) => Effect.gen(function*() {
      const frame = retained ?? (yield* capture(client, region).pipe(Effect.mapError(fail("start gate capture"))));
      const bytes = encodePpm(frame);
      const file = `${trial}-${phase}.ppm`;
      yield* Effect.try({ try: () => writeFileSync(join(directory, file), bytes, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "start gate evidence", problem: String(cause) }) });
      return { file, sha256: createHash("sha256").update(bytes).digest("hex") };
    });
    const cursorOn = (stage: boolean, phase: string) => pollUntil(Effect.gen(function*() {
      const drawn = yield* shot();
      if (drawn.stage !== stage) return undefined;
      const cursor = locate(drawn.frame);
      return cursor === undefined ? undefined : { ...drawn, cursor, evidence: yield* save(phase, drawn.frame) };
    }), { every: "100 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "start gate cursor", problem: `no matched drawn hand on ${stage ? "stage select" : "character select"}` })) });
    const pid = yield* gameProcess(client, true).pipe(Effect.mapError(fail("start gate process")));
    const appId = yield* Effect.try({
      try: () => {
        const value = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").find(value => /^SteamGameId=\d+$/.test(value))?.slice("SteamGameId=".length);
        if (value === undefined) throw new Error(`no SteamGameId on selected Warcraft process ${pid}`);
        return value;
      },
      catch: cause => new AcceptFailure({ operation: "start gate app id", problem: String(cause) }),
    });
    const args = [helperPath, "--preset", "tom", "--virtual-pad", "--emit", "--watch-seconds", "60", "--display", client.x11.DISPLAY ?? "", "--x11-window", client.window, "--pid", String(pid), "--private-wlr-app-id", `steam_app_${appId}`];
    const pressStart = <A, E, R>(phase: string, observe: Effect.Effect<A, E, R>) => Effect.scoped(Effect.gen(function*() {
      const helper = yield* startInputProcess(args, { env: { ...Bun.env, ...client.x11, ...client.wayland }, stdout: join(directory, `${trial}-${phase}-helper.out`), stderr: join(directory, `${trial}-${phase}-helper.err`) }).pipe(Effect.mapError(fail("start gate helper")));
      yield* Effect.sleep("800 millis");
      yield* helper.write("button start 0").pipe(Effect.mapError(fail("start gate input")));
      const before = yield* cursorOn(phase === "stage", `${phase}-before-start`);
      yield* helper.write("button start 1").pipe(Effect.mapError(fail("start gate input")));
      yield* Effect.sleep("150 millis");
      yield* helper.write("button start 0").pipe(Effect.mapError(fail("start gate input")));
      return { before, value: yield* observe };
    }));
    const run = yield* Effect.gen(function*() {
      const selectPointer = yield* park();
      const select = yield* cursorOn(false, "select");
      const opening = yield* pressStart("select", pollUntil(menu().pipe(Effect.map(value => value?.phase === "STAGE" ? value : undefined)), { every: "100 millis", within: "5 seconds", orElse: () => Effect.void }));
      const stageMenu = opening.value;
      if (stageMenu === undefined) return { selectPointer, parkedSelect: select, select: opening.before, stageMenu, after: yield* menu() };
      yield* pollUntil(shot().pipe(Effect.map(value => value.stage ? value : undefined)), { every: "100 millis", within: "15 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "start gate stage pixels", problem: "no drawn CHOOSE A STAGE title" })) });
      const stagePointer = yield* park();
      const stage = yield* cursorOn(true, "stage");
      const starting = yield* pressStart("stage", pollUntil(menu().pipe(Effect.map(value => value?.phase === "BLOCKED" ? value : undefined)), { every: "100 millis", within: "5 seconds", orElse: menu }));
      return { selectPointer, parkedSelect: select, select: opening.before, stageMenu, stagePointer, parkedStage: stage, stage: starting.before, after: starting.value };
    });
    const opened = run.stageMenu !== undefined;
    const started = run.stageMenu !== undefined && run.after?.phase === "BLOCKED";
    const afterFrame = started ? yield* pollUntil(shot().pipe(Effect.map(value => value.stage || locate(value.frame) !== undefined ? undefined : value.frame)), { every: "100 millis", within: "60 seconds", orElse: () => Effect.fail(new AcceptFailure({ operation: "start gate calibration", problem: "no drawn gameplay frame without the stock cursor within 60 s of the match transition" })) }) : yield* capture(client, region).pipe(Effect.mapError(fail("start gate capture")));
    const after = yield* save("after-start", afterFrame);
    if (started && negativeControl === undefined) negativeControl = after;
    const observed = "stage" in run ? run.stage.cursor : run.select.cursor;
    const withoutFrame = <T extends { readonly frame: Frame }>({ frame: _frame, ...rest }: T) => rest;
    const sample = { trial, position, target, selectMenu, parkedSelect: withoutFrame(run.parkedSelect), select: withoutFrame(run.select), selectPointer: run.selectPointer, stageMenu: run.stageMenu, parkedStage: "parkedStage" in run ? withoutFrame(run.parkedStage) : undefined, stage: "stage" in run ? withoutFrame(run.stage) : undefined, stagePointer: "stagePointer" in run ? run.stagePointer : undefined, afterMenu: run.after, after, args, pid, selected: run.select.cursor, observed, offButton: offButton(run.select.cursor) && offButton(observed), opened, started };
    samples.push(sample);
    if (!started) break;
  }
  const started = samples.filter(sample => sample.started).length;
  const distinct = new Set(samples.map(sample => `${sample.selected.pixelX},${sample.selected.pixelY}`)).size;
  const offButtons = samples.filter(sample => sample.offButton).length;
  const text = `SMASHCRAFT GATE start trials=${samples.length} started=${started} distinct=${distinct} offButton=${offButtons} pass=${negativeControl !== undefined && samples.length === 3 && started === 3 && distinct === 3 && offButtons === 3 ? 1 : 0}`;
  const modified = yield* Clock.currentTimeMillis;
  yield* Effect.try({ try: () => writeFileSync(join(directory, "measurements.json"), `${JSON.stringify({ text, helperPath, helperSha256, cursor: { modelSha256: cursor.modelSha256, textureSha256: cursor.textureSha256, left: cursor.left, top: cursor.top, width: cursor.width, height: cursor.height, u: cursor.u, v: cursor.v, uWidth: cursor.uWidth, vHeight: cursor.vHeight }, negativeControl, samples }, null, 2)}\n`, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "start gate evidence", problem: String(cause) }) });
  return { name: "start-gate", text, modified } satisfies ReceiptFile;
}).pipe(Effect.scoped);
