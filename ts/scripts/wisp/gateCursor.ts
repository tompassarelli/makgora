import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Clock, Effect, Fiber, Schedule } from "effect";
import { ChildProcess } from "effect/process";
import { InputInjection } from "wisp/scripts/platform/services";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { encodePpm, type Frame } from "wisp/scripts/wisp/frameProbe";
import { batch, capture, focus, loadClients } from "wisp/scripts/warcraft/desktop";
import { carriedChipLeft, carriedChipTop, chipX, chipY, parkedChipCentre, parkedChipLeft, parkedChipTop, readyChipSize, handSize, HAND_STATES, type HandState, handLeft, handTop } from "../../src/game/menu/selectionDrag";
import { cellRect, rosterGrid } from "../../src/game/menu/selectionGrid";
import { PLAYABLE_CHARACTERS } from "../../src/game/roster/kits";
import { ROSTER_TILES } from "../../src/game/ui/selectionFrames";
import { readTga, type Rgba } from "../blp";
import { runProcess } from "../hostProcess";
import { handBadgeBox } from "../../src/game/ui/selectionHandFrames";
import { reachFighterSelect } from "./gateIntro";
import { movePointer } from "./gatePointer";
import { projectRoot } from "./project";
import { type UiRect, pixelPoint, texturePixels } from "./uiTexture";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });


const textureError = (frame: Frame, texture: Rgba, x: number, y: number, uiWidth: number, uiHeight: number, covered?: UiRect) => texturePixels(frame, texture, x, y, uiWidth, uiHeight, covered)?.error;

const COVER_MARGIN = 0.004;

// Warcraft draws the cursor and the hand a frame or more after a move or click.
const CURSOR_DRAW_ATTEMPTS = 6;

// The carried chip is drawn over the hand, so the hand match skips the chip while it can be carried.
const CHIP_OVER_HAND: ReadonlySet<string> = new Set(["pick", "after-pick", "carrying", "drop"]);

const EXPECTED_STATE: Readonly<Record<string, HandState>> = { "positive-control": "point", edge: "point", "before-pick": "point", carrying: "pinch", "after-drop": "fan", sweep: "fan" };

// The hand is larger than the chips it lifts, so the chip checks that cannot be seen past it sample the pointer clear of the chip.
const CLEAR_SPOT = { x: 0.03, y: 0.3 };
const EDGE_SPOT = { x: 0.005, y: 0.3 };
const AFTER_DROP_RISE = 0.01;
const margined = (left: number, top: number, width: number, height: number): UiRect => ({ left: left - COVER_MARGIN, top: top + COVER_MARGIN, width: width + 2 * COVER_MARGIN, height: height + 2 * COVER_MARGIN });

const cursorPixels = (frame: Frame, texture: Rgba, x: number, y: number, state: HandState, size: number, covered?: UiRect) => {
  const left = handLeft(x, state, size);
  const top = handTop(y, state, size);
  const badge = handBadgeBox(left, top, size);
  return texturePixels(frame, texture, left, top, size, size, covered === undefined ? [margined(badge.left, badge.top, badge.width, badge.height)] : [margined(badge.left, badge.top, badge.width, badge.height), covered]);
};

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
      return { point: readTga(readFileSync(join(assetDirectory, "SelectionHandPoint.tga"))), fan: readTga(readFileSync(join(assetDirectory, "SelectionHandFan.tga"))), pinch: readTga(readFileSync(join(assetDirectory, "SelectionHandPinch.tga"))), chip: readTga(readFileSync(join(assetDirectory, "SelectionChipP1.tga"))) };
    },
    catch: cause => new AcceptFailure({ operation: "cursor gate texture", problem: String(cause) }),
  });
  yield* reachFighterSelect(client, region);
  const frame = yield* capture(client, region).pipe(Effect.mapError(fail("cursor gate capture")));
  const grid = rosterGrid(ROSTER_TILES);
  const handExtent = handSize(grid);
  const samples: { file: string; sha256: string; elapsedMs: number; attempts: number; phase: string; x: number; y: number; error: number | undefined; state: HandState; pinched: boolean; handPixels: number; matchedHandPixels: number; chipError: number | undefined; visible: boolean }[] = [];
  const started = yield* Clock.currentTimeMillis;
  const move = (x: number, y: number) => {
    const point = pixelPoint(frame, x, y);
    return movePointer(client, { x: region.x + point.x, y: region.y + point.y }, "cursor gate pointer");
  };
  const drawnHand = (pixels: Frame, x: number, y: number, covered?: UiRect) => {
    const drawn = HAND_STATES.map(state => ({ state, hand: cursorPixels(pixels, texture[state], x, y, state, handExtent, covered) }));
    const best = drawn.reduce((nearest, next) => (next.hand?.error ?? Infinity) < (nearest.hand?.error ?? Infinity) ? next : nearest);
    return { state: best.state, pinched: best.state === "pinch", hand: best.hand };
  };
  const sample = (phase: string, x: number, y: number) => Effect.gen(function*() {
    yield* move(x, y);
    let attempts = 0;
    let pixels: Frame;
    let drawn: ReturnType<typeof drawnHand>;
    do {
      yield* Effect.sleep("50 millis");
      pixels = yield* capture(client, region).pipe(Effect.mapError(fail("cursor gate capture")));
      drawn = drawnHand(pixels, x, y, CHIP_OVER_HAND.has(phase) ? margined(carriedChipLeft(x, readyChipSize(grid)), carriedChipTop(y, readyChipSize(grid)), readyChipSize(grid), readyChipSize(grid)) : undefined);
      attempts++;
    } while (((drawn.hand?.error ?? Infinity) > 24 || (phase !== "pick" && phase !== "drop" && drawn.pinched !== (phase === "carrying"))) && attempts < CURSOR_DRAW_ATTEMPTS);
    const elapsedMs = (yield* Clock.currentTimeMillis) - started;
    const { state, pinched, hand } = drawn;
    const error = hand?.error;
    const size = readyChipSize(grid);
    const pointerCover = margined(handLeft(x, state, handExtent), handTop(y, state, handExtent), handExtent, handExtent);
    const chipError = phase === "carrying" ? textureError(pixels, texture.chip, carriedChipLeft(x, size), carriedChipTop(y, size), size, size)
      : phase === "after-drop" ? textureError(pixels, texture.chip, chipX(grid, 0, 0), chipY(grid, 0, 0), size, size, pointerCover)
      : phase === "before-pick" ? textureError(pixels, texture.chip, parkedChipLeft(0, size), parkedChipTop(size), size, size, pointerCover) : undefined;
    const bytes = encodePpm(pixels);
    const file = `${String(samples.length).padStart(3, "0")}-${phase}.ppm`;
    yield* Effect.try({ try: () => writeFileSync(join(directory, file), bytes, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "cursor gate evidence", problem: String(cause) }) });
    const result = { file, sha256: createHash("sha256").update(bytes).digest("hex"), elapsedMs, attempts, phase, x, y, error, state, pinched, handPixels: hand?.pixels ?? 0, matchedHandPixels: hand?.matchedPixels ?? 0, chipError, visible: error !== undefined && error <= 24 };
    samples.push(result);
    return result;
  });
  const clickThrough = (phase: string, x: number, y: number) => Effect.gen(function*() {
    const point = pixelPoint(frame, x, y);
    const pressed = yield* Effect.forkScoped(batch(client, [{ kind: "click", x: region.x + point.x, y: region.y + point.y, holdMillis: 200 }]).pipe(Effect.mapError(fail(`cursor gate ${phase}`))));
    for (let index = 0; index < 4; index++) yield* sample(phase, x, y);
    yield* Fiber.join(pressed);
  });
  const pin = { x: parkedChipLeft(0, readyChipSize(grid)) + readyChipSize(grid) / 2, y: parkedChipCentre(0).y };
  const control = yield* sample("positive-control", CLEAR_SPOT.x, CLEAR_SPOT.y);
  const controlFrame = yield* capture(client, region).pipe(Effect.mapError(fail("cursor gate control")));
  const negativeControlError = cursorPixels(controlFrame, texture.point, 0.4, 0.56, "point", handExtent)?.error;
  if (!control.visible || negativeControlError === undefined || negativeControlError <= 24) return yield* new AcceptFailure({ operation: "cursor gate calibration", problem: `positive error=${control.error}; negative error=${negativeControlError}` });
  yield* sample("before-pick", CLEAR_SPOT.x, CLEAR_SPOT.y);
  yield* sample("edge", EDGE_SPOT.x, EDGE_SPOT.y);
  yield* clickThrough("pick", pin.x, pin.y);
  yield* sample("after-pick", pin.x, pin.y);
  const first = cellRect(grid, 0);
  const drop = { x: (first.left + first.right) / 2, y: (first.top + first.bottom) / 2 };
  yield* sample("carrying", drop.x, drop.y);
  yield* clickThrough("drop", drop.x, drop.y);
  yield* sample("after-drop", drop.x, first.bottom + AFTER_DROP_RISE).pipe(Effect.repeat({ schedule: Schedule.recurs(39), until: sample => sample.chipError !== undefined && sample.chipError <= 24 }));
  const sweepStarted = yield* Clock.currentTimeMillis;
  for (let index = 0; index < 100; index++) {
    const cell = cellRect(grid, index % PLAYABLE_CHARACTERS.length);
    yield* sample("sweep", (cell.left + cell.right) / 2, (cell.top + cell.bottom) / 2);
  }
  const sweepMs = (yield* Clock.currentTimeMillis) - sweepStarted;
  const visible = samples.filter(sample => sample.visible).length;
  const picked = samples.some(sample => sample.phase === "carrying" && sample.chipError !== undefined && sample.chipError <= 24);
  const dropped = samples.some(sample => sample.phase === "after-drop" && sample.chipError !== undefined && sample.chipError <= 24);
  const parked = samples.some(sample => sample.phase === "before-pick" && sample.chipError !== undefined && sample.chipError <= 24);
  const states = samples.every(sample => EXPECTED_STATE[sample.phase] === undefined || !sample.visible || sample.state === EXPECTED_STATE[sample.phase]);
  const pinch = samples.every(sample => !sample.visible || sample.pinched === (sample.phase === "carrying") || sample.phase === "pick" || sample.phase === "drop");
  const modified = yield* Clock.currentTimeMillis;
  const text = `SMASHCRAFT GATE cursor frames=${samples.length} visible=${visible} sweepMs=${sweepMs} picked=${picked ? 1 : 0} dropped=${dropped ? 1 : 0} parked=${parked ? 1 : 0} pinch=${pinch ? 1 : 0} states=${states ? 1 : 0} pass=${visible === samples.length && picked && dropped && parked && pinch && states && sweepMs >= 5000 ? 1 : 0}`;
  yield* Effect.try({ try: () => writeFileSync(join(directory, "measurements.json"), `${JSON.stringify({ text, threshold: 24, positiveControl: control.file, negativeControlError, missingFrameIds: samples.flatMap((sample, index) => sample.visible ? [] : [index]), region, handSize: handExtent, samples }, null, 2)}\n`, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "cursor gate evidence", problem: String(cause) }) });
  return { name: "cursor-gate", text, modified } satisfies ReceiptFile;
}).pipe(Effect.scoped);
