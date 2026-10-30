import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { HAND_ART_COLUMNS, HAND_ART_ROWS, HAND_TEXELS } from "../core/handArt";
import { bullseyeLeft, bullseyeSize, bullseyeTop, carriedChipLeft, carriedChipSize, carriedChipTop, HAND_STATES, handLeft, handSize, handTop, menuCursor } from "./selectionDrag";
import { rosterGrid } from "./selectionGrid";

test("The select cursor is the default hand off the tiles, the fanned hand over a tile with no chip, and the pinch with a chip, and the stock cursor shows only where no hand is drawn [k2 property]", () => {
  for (const allowed of [false, true]) {
    for (const drawn of [false, true]) {
      for (const holding of [false, true]) {
        for (const hovering of [false, true]) {
          const hover = hovering ? 0 : undefined;
          const cursor = menuCursor(allowed, drawn, holding, hover, false, false);
          assertFalse(cursor.bullseye);
          assertEquals(cursor.stock, allowed && !drawn);
          if (!drawn) assertEquals(cursor.hand, undefined);
          else assertEquals(cursor.hand, holding ? "pinch" : hover === undefined ? "point" : "fan");
          assertFalse(cursor.stock && cursor.hand !== undefined);
        }
      }
    }
  }
});

test("A Warcraft menu open over select hides every drawn cursor and shows Warcraft's cursor whatever else holds, and closing it restores the hand [k2 property]", () => {
  for (const allowed of [false, true]) {
    for (const drawn of [false, true]) {
      for (const holding of [false, true]) {
        for (const stage of [false, true]) {
          const hover = holding ? 0 : undefined;
          const open = menuCursor(allowed, drawn, holding, hover, stage, true);
          assertEquals(open.hand, undefined);
          assertFalse(open.bullseye);
          assertTrue(open.stock);
          assertEquals(menuCursor(allowed, drawn, holding, hover, stage, false).stock, allowed && !drawn);
        }
      }
    }
  }
});

test("Stage select draws the bullseye instead of any hand wherever a cursor is drawn, hides the stock cursor with it, and character select never draws it [k2 property]", () => {
  for (const allowed of [false, true]) {
    for (const drawn of [false, true]) {
      for (const holding of [false, true]) {
        for (const hovering of [false, true]) {
          const hover = hovering ? 0 : undefined;
          const stage = menuCursor(allowed, drawn, holding, hover, true, false);
          assertEquals(stage.bullseye, drawn);
          assertEquals(stage.hand, undefined);
          assertEquals(stage.stock, allowed && !drawn);
          assertEquals(menuCursor(allowed, drawn, holding, hover, false, false).bullseye, false);
        }
      }
    }
  }
});

test("The bullseye is centred on the mouse and moves one for one with it at every grid size, its ring inside the frame and under a roster tile [k2 property]", () => {
  for (let count = 1; count <= 60; count++) {
    const grid = rosterGrid(count);
    const size = bullseyeSize(grid);
    assertTrue(size > 0 && size < grid.cellHeight);
    for (const [x, y] of [[f32(0.2), f32(0.5)], [f32(0.7), f32(0.1)]] as const) {
      assertTrue(Math.abs(bullseyeLeft(x, size) + size / 2 - x) < f32(0.00001));
      assertTrue(Math.abs(bullseyeTop(y, size) - size / 2 - y) < f32(0.00001));
    }
  }
});

test("The gauntlet is drawn at 0.67 to 0.77 of a roster tile's height at every grid size, one size for all three states, never squashed [k2 property]", () => {
  for (let count = 1; count <= 60; count++) {
    const grid = rosterGrid(count);
    const size = handSize(grid);
    const height = size * HAND_ART_ROWS / HAND_TEXELS;
    const width = size * HAND_ART_COLUMNS / HAND_TEXELS;
    assertTrue(height >= f32(0.67) * grid.cellHeight && height <= f32(0.77) * grid.cellHeight);
    assertTrue(Math.abs(width / height - HAND_ART_COLUMNS / HAND_ART_ROWS) < f32(1e-6));
    assertTrue(Math.abs(HAND_ART_COLUMNS / HAND_ART_ROWS - 732 / 900) < f32(0.002));
  }
});

test("Every hand state keeps its hotspot inside the hand frame and moves the frame one for one with the mouse [k2 property]", () => {
  const size = handSize(rosterGrid(24));
  for (const state of HAND_STATES) {
    const left = handLeft(f32(0.4), state, size);
    const top = handTop(f32(0.3), state, size);
    assertTrue(left < f32(0.4) && left + size > f32(0.4));
    assertTrue(top > f32(0.3) && top - size < f32(0.3));
    const slid = handLeft(f32(0.5), state, size);
    assertTrue(Math.abs(slid - left - f32(0.1)) < f32(0.00001));
  }
});

test("A carried chip is centred on the pinch point and narrower than the gauntlet [k2 property]", () => {
  for (let count = 1; count <= 60; count++) {
    const grid = rosterGrid(count);
    const size = handSize(grid);
    const chip = carriedChipSize(grid);
    const x = f32(0.4);
    const y = f32(0.3);
    assertTrue(Math.abs(carriedChipLeft(x, chip) + chip / 2 - x) < f32(0.00001));
    assertTrue(Math.abs(carriedChipTop(y, chip) - chip / 2 - y) < f32(0.00001));
    assertTrue(chip < size * HAND_ART_COLUMNS / HAND_TEXELS);
  }
});
