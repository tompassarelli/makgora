import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import { InputInjection } from "wisp/scripts/platform/services";
import { AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { encodePpm, type Frame } from "wisp/scripts/wisp/frameProbe";
import { batch, capture, type Client, focus, loadClients, type Region } from "wisp/scripts/warcraft/desktop";
import { HAND_STATES, type HandState, carriedChipLeft, carriedChipTop, handLeft, handSize, handTop, readyChipSize } from "../../src/game/menu/selectionDrag";
import { cellRect, rosterGrid } from "../../src/game/menu/selectionGrid";
import { ROSTER_TILES } from "../../src/game/ui/selectionFrames";
import { handBadgeBox } from "../../src/game/ui/selectionHandFrames";
import { slotColor } from "../../src/game/ui/slotColors";
import { readTga, type Rgba } from "../blp";
import { reachFighterSelect } from "./gateIntro";
import { movePointer } from "./gatePointer";
import { projectRoot } from "./project";
import { pixelPoint, texturePixels } from "./uiTexture";

const fail = (operation: string) => (cause: { readonly message: string }) => new AcceptFailure({ operation, problem: cause.message });

const MATCH_ERROR = 24;
const HAND_MATCH_ERROR = 30;
const BADGE_COLOUR_DISTANCE = 120;
const SETTLE = "900 millis";
const CLEAR_SPOT = { x: 0.03, y: 0.3 };
const EDGE_SPOT = { x: 0.005, y: 0.3 };
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

const colourDistance = (frame: Frame, x: number, y: number, rgb: number): number | undefined => {
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return undefined;
  const at = (y * frame.width + x) * 3;
  const channels = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
  return channels.reduce((sum, channel, index) => sum + Math.abs((frame.rgb[at + index] ?? 0) - channel), 0);
};

export const measureHandsGate = (clientsFile: string, directory: string) => Effect.gen(function*() {
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
        const box = handBadgeBox(left, top, extent);
        const badge = { left: box.left - COVER_PAD, top: box.top + COVER_PAD, width: box.width + 2 * COVER_PAD, height: box.height + 2 * COVER_PAD };
        const chipBox = owner.slot === 0 ? [{ left: carriedChipLeft(at.x, chip) - COVER_PAD, top: carriedChipTop(at.y, chip) + COVER_PAD, width: chip + 2 * COVER_PAD, height: chip + 2 * COVER_PAD }] : [];
        const hand = texturePixels(frame, textures[at.state], left, top, extent, extent, [badge, ...chipBox]);
        const corner = pixelPoint(frame, box.left + box.width * 0.08, box.top - box.height / 2);
        const badgeDistance = colourDistance(frame, corner.x, corner.y, slotColor(owner.slot).rgb);
        const chipError = carried ? texturePixels(frame, textures.chip, carriedChipLeft(at.x, chip), carriedChipTop(at.y, chip), chip, chip)?.error : undefined;
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
  yield* move(second, EDGE_SPOT);
  yield* observe("edge", [{ ...hover, state: "fan" }, { ...EDGE_SPOT, state: "point" }], false);
  const shown = (sample: Sample) => sample.error !== undefined && sample.error <= HAND_MATCH_ERROR;
  const badged = (sample: Sample) => sample.badgeDistance === undefined ? sample.phase === "edge" && sample.hand === 1 : sample.badgeDistance <= BADGE_COLOUR_DISTANCE;
  const own = samples.filter(sample => sample.viewer === sample.hand);
  const remote = samples.filter(sample => sample.viewer !== sample.hand);
  const chips = samples.filter(sample => sample.chipError !== undefined);
  const pass = samples.length === 12 && samples.every(shown) && samples.every(badged) && chips.length === 2 && chips.every(sample => (sample.chipError ?? Infinity) <= MATCH_ERROR);
  const modified = yield* Clock.currentTimeMillis;
  const text = `SMASHCRAFT GATE hands samples=${samples.length} own=${own.filter(shown).length} remote=${remote.filter(shown).length} badges=${samples.filter(badged).length} chips=${chips.filter(sample => (sample.chipError ?? Infinity) <= MATCH_ERROR).length} pass=${pass ? 1 : 0}`;
  yield* Effect.try({ try: () => writeFileSync(join(directory, "measurements.json"), `${JSON.stringify({ text, threshold: MATCH_ERROR, badgeDistance: BADGE_COLOUR_DISTANCE, handStates: HAND_STATES, samples }, undefined, 2)}\n`, { mode: 0o600 }), catch: cause => new AcceptFailure({ operation: "hands gate evidence", problem: String(cause) }) });
  return { name: "hands-gate", text, modified } satisfies ReceiptFile;
}).pipe(Effect.scoped);
