import { f32 } from "wisp/src/sim/f32";
import { assertTrue, test } from "wisp/src/runtime/testing";
import { SELECT_BAR } from "../core/selectBarLayout";
import { BAR_STRIP, CARD_HEIGHT, CARD_TOP, CARD_WIDTH, CHAT_SLOT, SELECT_EDGE_LEFT, SELECT_EDGE_RIGHT } from "../core/selectScreenLayout";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { cardX } from "./selectionDrag";
import { cellRect, rosterGrid } from "./selectionGrid";
import { ROSTER_TILES } from "../ui/selectionFrames";

const near = (a: number, b: number): boolean => Math.abs(a - b) < f32(0.0005);

test("character select reads as one frame: the grid is centred under the bar, and the bottom row is the chat box then the four cards packed edge to edge, all inside the 4:3 area [k2 property]", () => {
  const grid = rosterGrid(ROSTER_TILES);
  const gridRight = f32(grid.left + f32(grid.columns * grid.cellWidth));
  const gridBottom = f32(grid.top - f32(grid.rows * grid.cellHeight));
  assertTrue(near(f32(grid.left + gridRight) / 2, f32(0.4)));
  assertTrue(grid.left >= SELECT_EDGE_LEFT && gridRight <= SELECT_EDGE_RIGHT);
  assertTrue(grid.top <= f32(BAR_STRIP.y - BAR_STRIP.height) && gridBottom >= CARD_TOP);
  for (let tile = 0; tile < ROSTER_TILES; tile++) assertTrue(cellRect(grid, tile).bottom >= CARD_TOP);
  assertTrue(near(SELECT_BAR.back.x, CHAT_SLOT.left) && near(f32(SELECT_BAR.start.x + SELECT_BAR.start.width), f32(cardX(PARTICIPANT_CAPACITY - 1) + CARD_WIDTH)));
  assertTrue(near(f32(CHAT_SLOT.bottom + CHAT_SLOT.height), CARD_TOP) && near(CHAT_SLOT.height, CARD_HEIGHT) && CHAT_SLOT.bottom >= 0.0);
  let left = f32(CHAT_SLOT.left + CHAT_SLOT.width);
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    const gap = f32(cardX(slot) - left);
    assertTrue(gap > 0.0 && gap <= f32(0.01));
    left = f32(cardX(slot) + CARD_WIDTH);
  }
  assertTrue(f32(CARD_TOP - CARD_HEIGHT) >= 0.0);
});
