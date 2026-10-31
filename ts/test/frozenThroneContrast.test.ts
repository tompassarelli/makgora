import { expect, test } from "bun:test";
import { STAGE_SNOW_MODEL } from "../src/generated/stages/stageAssetInfo";
import { placedPieces, stageScenery, type SceneryPiece } from "../src/game/presentation/stageScenery";
import { platformParts } from "../src/game/presentation/stockPlatforms";
import { FROZEN_THRONE_STAGE, surfaceCount, surfaceLeft, surfaceRight } from "../src/game/sim/stage";
import { MAIN_DECK_HALF_DEPTH } from "../scripts/stageDeck";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";

const FLOE = "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx";
const NEAR_BAND_BACK = 2500;
const DECK_END = 1300;
const FIGHTER_DIM = 150;
const PEDESTAL = "IceCrownPillar";

test("no Frozen Throne tower or near glacier stands within reach of the deck's ends [k2 property]", () => {
  const towers = placedPieces(FROZEN_THRONE_STAGE).filter(piece => /IceCrown(Pillar|Obelisk)|Glacier/.test(piece.model) && Math.abs(piece.x) > 600);
  expect(towers.length).toBeGreaterThanOrEqual(8);
  expect(towers.every(piece => Math.abs(piece.x) >= DECK_END + 800)).toBe(true);
});

test("every Frozen Throne prop near the deck stands on the deck or on an ice floe's top, so none hangs over the void behind it [k2 property]", () => {
  const pieces = stageScenery(FROZEN_THRONE_STAGE).pieces;
  const floes = pieces.filter(piece => piece.model === FLOE);
  const box = (piece: SceneryPiece) => {
    const bounds = MODEL_FACTS[piece.model]?.bounds;
    if (bounds === undefined) throw new Error(`no bounds for ${piece.model}`);
    const [mx, my, mz] = piece.matrixScale ?? [1, 1, 1];
    const turn = (piece.yaw * Math.PI) / 180;
    const corners = [bounds.min[0] * mx, bounds.max[0] * mx].flatMap(x => [bounds.min[1] * my, bounds.max[1] * my].map(y => [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)] as const));
    const xs = corners.map(([x]) => x * piece.scale + piece.x), ys = corners.map(([, y]) => y * piece.scale + piece.y);
    return { left: Math.min(...xs), right: Math.max(...xs), front: Math.min(...ys), back: Math.max(...ys), top: bounds.max[2] * mz * piece.scale + piece.z };
  };
  const props = pieces.filter(piece => piece.model !== FLOE && piece.model !== STAGE_SNOW_MODEL && piece.y < NEAR_BAND_BACK);
  expect(props.length).toBeGreaterThanOrEqual(6);
  const stranded = props.filter(piece => {
    const onDeck = piece.z === 0 && Math.abs(piece.y) <= MAIN_DECK_HALF_DEPTH;
    const onFloe = floes.map(box).some(floe => piece.x >= floe.left && piece.x <= floe.right && piece.y >= floe.front && piece.y <= floe.back && Math.abs(piece.z - floe.top) <= 12);
    return !onDeck && !onFloe;
  });
  expect(stranded.map(piece => `${piece.model} at ${piece.x}, ${piece.y}, ${piece.z}`)).toEqual([]);
});

test("the Frozen Throne's ice floes and side ledges are tinted below the fighters' brightness [k2 property]", () => {
  const tinted = placedPieces(FROZEN_THRONE_STAGE).filter(piece => piece.model === FLOE && piece.y < 3000);
  expect(tinted.length).toBeGreaterThanOrEqual(15);
  expect(tinted.every(piece => piece.color !== undefined && Math.max(...piece.color) <= FIGHTER_DIM)).toBe(true);
  for (const index of [1, 2, 3]) {
    const parts = platformParts(FROZEN_THRONE_STAGE, index);
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.every(part => Math.max(...part.color) <= FIGHTER_DIM)).toBe(true);
  }
});

test("every raised Frozen Throne platform stands on a pedestal under its middle [k2 property]", () => {
  const pedestals = placedPieces(FROZEN_THRONE_STAGE).filter(piece => piece.model.includes(PEDESTAL) && piece.y < 200);
  for (let index = 1; index < surfaceCount(FROZEN_THRONE_STAGE); index++) {
    const middle = (surfaceLeft(FROZEN_THRONE_STAGE, index, 0) + surfaceRight(FROZEN_THRONE_STAGE, index, 0)) / 2;
    expect(pedestals.some(piece => Math.abs(piece.x - middle) <= 20)).toBe(true);
  }
});

test("the Frozen Throne's top stair tier ends on a landing at its own height that runs under the dais [k2 property]", () => {
  const floes = placedPieces(FROZEN_THRONE_STAGE).filter(piece => piece.model === FLOE && piece.x === 0 && piece.y >= 1300 && piece.y < 2000 && piece.matrixScale?.[1] === 2.5);
  const top = floes.filter(piece => piece.y < 1700).sort((a, b) => b.z - a.z)[0];
  const landing = floes.find(piece => piece.y > 1800);
  expect(top).toBeDefined();
  expect(landing).toBeDefined();
  expect(landing?.z).toBe(top?.z);
  expect(landing?.matrixScale?.[2]).toBe(top?.matrixScale?.[2]);
  const dais = placedPieces(FROZEN_THRONE_STAGE).find(piece => piece.model === FLOE && piece.x === 0 && piece.y === 2020);
  expect(landing?.y ?? 0).toBeLessThan(dais?.y ?? 0);
});
