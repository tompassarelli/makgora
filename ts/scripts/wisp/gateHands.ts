import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import { InputInjection } from "wisp/scripts/platform/services";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { encodePpm, type Frame } from "wisp/scripts/wisp/frameProbe";
import { batch, capture, type Client, focus, loadClients, type Region } from "wisp/scripts/warcraft/desktop";
import { HAND_STATES, type HandState, carriedChipLeft, carriedChipTop, readyChipSize, handLeft, handSize, handTop } from "../../src/game/menu/selectionDrag";
import { cellRect, rosterGrid } from "../../src/game/menu/selectionGrid";
import { CHAT_SLOT } from "../../src/game/core/selectScreenLayout";
import { ROSTER_TILES } from "../../src/game/ui/selectionFrames";
import { handBadgeBox } from "../../src/game/ui/selectionHandFrames";
import { slotColor } from "../../src/game/ui/slotColors";
import { readTga, type Rgba } from "../blp";
import { reachFighterSelect } from "./gateIntro";
import { movePointer } from "./gatePointer";
import { projectRoot } from "./project";
import { edgeRoom, pixelPoint, texturePixels, type UiRect } from "./uiTexture";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });

const MATCH_ERROR = 24;
const HAND_MATCH_ERROR = 30;
const BADGE_COLOUR_DISTANCE = 120;
const SETTLE = "900 millis";
const CLEAR_SPOT = { x: 0.03, y: 0.3 };
const EDGE_SPOT = { x: 0.005, y: 0.3 };
const CHAT_SPOT = { x: CHAT_SLOT.left + 0.05, y: CHAT_SLOT.bottom + CHAT_SLOT.height * 0.6 };
const CHAT_FLOOR_SPOT = { x: CHAT_SLOT.left + 0.05, y: CHAT_SLOT.bottom + 0.02 };
const HOVER_TILE = 3;
const COVER_PAD = 0.004;

interface Participant {
  readonly client: Client;
  readonly region: Region;
  readonly slot: number;
}

interface Sample {
  readonly file: string;
  readonly sha256: string;
  readonly phase: string;
  readonly viewer: number;
  readonly hand: number;
  readonly state: HandState;
  readonly error: number | undefined;
  readonly badgeDistance: number | undefined;
  readonly chipError: number | undefined;
}

const nearestColour = (frame: Frame, box: UiRect, rgb: number): number | undefined => {
  const origin = pixelPoint(frame, box.left, box.top);
  const width = Math.round(box.width * frame.height / 0.6);
  const height = Math.round(box.height * frame.height / 0.6);
  const channels = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
  let nearest: number | undefined;
  for (let y = Math.max(0, origin.y); y < Math.min(frame.height, origin.y + height); y++) for (let x = Math.max(0, origin.x); x < Math.min(frame.width, origin.x + width); x++) {
    const at = (y * frame.width + x) * 3;
    const distance = channels.reduce((sum, channel, index) => sum + Math.abs((frame.rgb[at + index] ?? 0) - channel), 0);
    if (nearest === undefined || distance < nearest) nearest = distance;
  }
  return nearest;
};

export const measureHandsGate = (clientsFile: string, directory: string, teams: readonly number[] | undefined) => Effect.gen(function*() {
  const clients = yield* loadClients(clientsFile).pipe(Effect.mapError(fail("hands gate clients")));
  const input = yield* InputInjection;
  const people: Participant[] = [];
  for (const [slot, name] of ["a", "b"].entries()) {
    const client = clients.find(candidate => candidate.name === name);
    if (client === undefined) return yield* new AcceptFailure({ operation: "hands gate", problem: `no selected client ${name}` });
    yield* focus(client).pipe(Effect.mapError(fail("hands gate focus")));
    const region = yield* input.windowRegion(client).pipe(Effect.mapError(fail("hands gate viewport")));
    yield* reachFighterSelect(client, region);
    people.push({ client, region, slot });
  }
  const textures = yield* Effect.try({
    try: () => {
      const pin = readFileSync(join(projectRoot, "build-inputs/selection-assets"), "utf8").trim();
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const assets = join(homedir(), ".local/share/smashcraft-build-inputs/store/selection-assets", pin);
      const read = (name: string) => readTga(readFileSync(join(assets, `${name}.tga`)));
      return { point: read("SelectionHandPoint"), fan: read("SelectionHandFan"), pinch: read("SelectionHandPinch"), chip: read("SelectionChipP1") } as Record<HandState | "chip", Rgba>;
    },
    catch: cause => new AcceptFailure({ operation: "hands gate texture", problem: String(cause) }),
  });
  const [first, second] = people;
  if (first === undefined || second === undefined) return yield* new AcceptFailure({ operation: "hands gate", problem: "two clients are required" });
  const reference = yield* capture(first.client, first.region).pipe(Effect.mapError(fail("hands gate capture")));
  const grid = rosterGrid(ROSTER_TILES);
  const extent = handSize(grid);
  const chip = readyChipSize(grid);
  const tile = cellRect(grid, HOVER_TILE);
  const hover = { x: (tile.left + tile.right) / 2, y: (tile.top + tile.bottom) / 2 };
  const move = (person: Participant, at: { x: number; y: number }) => {
    const point = pixelPoint(reference, at.x, at.y);
    return movePointer(person.client, { x: person.region.x + point.x, y: person.region.y + point.y }, "hands gate pointer");
  };
  const samples: Sample[] = [];
  const observe = (phase: string, positions: readonly { x: number; y: number; state: HandState }[], carrying: boolean) => Effect.gen(function*() {
    yield* Effect.sleep(SETTLE);
    for (const viewer of people) {
      const frame = yield* capture(viewer.client, viewer.region).pipe(Effect.mapError(fail("hands gate capture")));
      const bytes = encodePpm(frame);
      const file = `${String(samples.length).padStart(3, "0")}-${phase}-viewer${viewer.slot + 1}.ppm`;
      yield* Effect.try({ try: () => writeFileSync(join(directory, file), bytes, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "hands gate evidence", problem: String(cause) }) });
      for (const owner of people) {
        const at = positions[owner.slot];
        if (at === undefined) continue;
        const carried = carrying && owner.slot === 0;
        const left = handLeft(at.x, at.state, extent);
        const top = handTop(at.y, at.state, extent);
        const box = handBadgeBox(left, top, extent, chip);
        const badge = { left: box.left - COVER_PAD, top: box.top + COVER_PAD, width: box.width + 2 * COVER_PAD, height: box.height + 2 * COVER_PAD };
        const handBox = { left: left - COVER_PAD, top: top + COVER_PAD, width: extent + 2 * COVER_PAD, height: extent + 2 * COVER_PAD };
        const hand = texturePixels(frame, textures[at.state], left, top, extent, extent, badge);
        const badgeDistance = nearestColour(frame, box, slotColor(teams?.[owner.slot] ?? owner.slot).rgb);
        const chipError = carried ? texturePixels(frame, textures.chip, carriedChipLeft(at.x, chip), carriedChipTop(at.y, chip), chip, chip, handBox)?.error : undefined;
        samples.push({ file, sha256: createHash("sha256").update(bytes).digest("hex"), phase, viewer: viewer.slot, hand: owner.slot, state: at.state, error: hand?.error, badgeDistance, chipError });
      }
    }
  });
  yield* move(first, hover);
  yield* move(second, CLEAR_SPOT);
  yield* observe("carry", [{ ...hover, state: "pinch" }, { ...CLEAR_SPOT, state: "point" }], true);
  const hoverPoint = pixelPoint(reference, hover.x, hover.y);
  yield* batch(first.client, [{ kind: "click", x: first.region.x + hoverPoint.x, y: first.region.y + hoverPoint.y, holdMillis: 200 }]).pipe(Effect.mapError(fail("hands gate drop")));
  yield* observe("hover", [{ ...hover, state: "fan" }, { ...CLEAR_SPOT, state: "point" }], false);
  if (edgeRoom(reference, handLeft(EDGE_SPOT.x, "point", extent))) {
    yield* move(second, EDGE_SPOT);
    yield* observe("edge", [{ ...hover, state: "fan" }, { ...EDGE_SPOT, state: "point" }], false);
  }
  yield* move(second, CHAT_SPOT);
  yield* observe("chat", [{ ...hover, state: "fan" }, { ...CHAT_SPOT, state: "point" }], false);
  yield* move(second, CHAT_FLOOR_SPOT);
  yield* observe("chat-floor", [{ ...hover, state: "fan" }, { ...CHAT_FLOOR_SPOT, state: "point" }], false);
  const shown = (sample: Sample) => sample.error !== undefined && sample.error <= HAND_MATCH_ERROR;
  const badged = (sample: Sample) => sample.badgeDistance === undefined ? sample.phase === "edge" && sample.hand === 1 : sample.badgeDistance <= BADGE_COLOUR_DISTANCE;
  const own = samples.filter(sample => sample.viewer === sample.hand);
  const remote = samples.filter(sample => sample.viewer !== sample.hand);
  const chips = samples.filter(sample => sample.chipError !== undefined);
  const pass = samples.length === (edgeRoom(reference, handLeft(EDGE_SPOT.x, "point", extent)) ? 20 : 16) && samples.every(shown) && samples.every(badged) && chips.length === 2 && chips.every(sample => (sample.chipError ?? Infinity) <= MATCH_ERROR);
  const modified = yield* Clock.currentTimeMillis;
  const text = `SMASHCRAFT GATE hands samples=${samples.length} own=${own.filter(shown).length} remote=${remote.filter(shown).length} badges=${samples.filter(badged).length} chips=${chips.filter(sample => (sample.chipError ?? Infinity) <= MATCH_ERROR).length} pass=${pass ? 1 : 0}`;
  yield* Effect.try({ try: () => writeFileSync(join(directory, "measurements.json"), `${JSON.stringify({ text, threshold: MATCH_ERROR, badgeDistance: BADGE_COLOUR_DISTANCE, handStates: HAND_STATES, samples }, undefined, 2)}\n`, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "hands gate evidence", problem: String(cause) }) });
  return { name: "hands-gate", text, modified } satisfies ReceiptFile;
}).pipe(Effect.scoped);
