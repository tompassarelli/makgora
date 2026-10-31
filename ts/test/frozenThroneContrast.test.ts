import { expect, test } from "bun:test";
import { placedPieces } from "../src/game/presentation/stageScenery";
import { platformParts } from "../src/game/presentation/stockPlatforms";
import { FROZEN_THRONE_STAGE, surfaceCount, surfaceLeft, surfaceRight } from "../src/game/sim/stage";

const DECK_END = 1300;
const FIGHTER_DIM = 150;
const PEDESTAL = "IceCrownPillar";

test("no Frozen Throne tower or near glacier stands within reach of the deck's ends [k2 property]", () => {
  const towers = placedPieces(FROZEN_THRONE_STAGE).filter(piece => /IceCrown(Pillar|Obelisk)|Glacier/.test(piece.model) && Math.abs(piece.x) > 600);
  expect(towers.length).toBeGreaterThanOrEqual(8);
  expect(towers.every(piece => Math.abs(piece.x) >= DECK_END + 800)).toBe(true);
});

test("the Frozen Throne's crystals, stair and side ledges are tinted below the fighters' brightness [k2 property]", () => {
  const tinted = placedPieces(FROZEN_THRONE_STAGE).filter(piece => /Crystal3|IceFloe3/.test(piece.model) && piece.y < 3000);
  expect(tinted.length).toBeGreaterThanOrEqual(18);
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
