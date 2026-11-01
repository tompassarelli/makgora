import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { HAND_ART_COLUMNS, HAND_ART_ROWS, HAND_TEXELS } from "../core/handArt";
import { bullseyeLeft, bullseyeSize, bullseyeTop, GAME_MENU_WAKE_UPDATES, gameMenuWake, carriedChipLeft, carriedChipTop, chipBox, CARRIED_CHIP_OFFSET, HAND_STATES, handLeft, handSize, handTop, menuCursor, readyChipSize } from "./selectionDrag";
import { rosterGrid } from "./selectionGrid";

// The chip texture's disc is 232 of its 256 texels.
const DISC_RADIUS = f32(0.453);

test("The cursor is the pointing hand over a control, the open hand over a tile and resting in a menu panel, the pointing hand resting on the select screen, the pinch with a chip, and the stock cursor shows only where no hand is drawn [k2 property]", () => {
  for (const allowed of [false, true]) {
    for (const drawn of [false, true]) {
      for (const holding of [false, true]) {
        for (const kind of ["none", "tile", "control"] as const) {
          const hover = kind === "none" ? undefined : kind;
          for (const panel of [false, true]) {
          const cursor = menuCursor(allowed, drawn, holding, hover, panel, false, false);
          assertFalse(cursor.bullseye);
          assertEquals(cursor.stock, allowed && !drawn);
          if (!drawn) assertEquals(cursor.hand, undefined);
          else assertEquals(cursor.hand, holding ? "pinch" : hover === "control" ? "point" : hover === "tile" || panel ? "fan" : "point");
          assertFalse(cursor.stock && cursor.hand !== undefined);
          }
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
          const hover = holding ? "tile" : undefined;
          const open = menuCursor(allowed, drawn, holding, hover, false, stage, true);
          assertEquals(open.hand, undefined);
          assertFalse(open.bullseye);
          assertTrue(open.stock);
          assertEquals(menuCursor(allowed, drawn, holding, hover, false, stage, false).stock, allowed && !drawn);
        }
      }
    }
  }
});

test("An F10 wake keeps Warcraft's cursor shown until the Game Menu's frames are seen, then hands the cursor back once they close, and lapses after its updates if no menu opens [k2 property]", () => {
  for (const stage of [false, true]) {
    let wake = GAME_MENU_WAKE_UPDATES;
    for (let update = 1; update < GAME_MENU_WAKE_UPDATES; update++) {
      wake = gameMenuWake(wake, false);
      assertTrue(menuCursor(true, true, false, undefined, false, stage, wake > 0).stock);
    }
    wake = gameMenuWake(wake, false);
    assertEquals(wake, 0);
    assertEquals(menuCursor(true, true, false, undefined, false, stage, wake > 0).stock, false);

    wake = gameMenuWake(GAME_MENU_WAKE_UPDATES, true);
    assertEquals(wake, 0);
    assertTrue(menuCursor(true, true, false, undefined, false, stage, true).stock);
    wake = gameMenuWake(wake, false);
    assertEquals(menuCursor(true, true, false, undefined, false, stage, wake > 0).stock, false);
  }
});

test("Stage select draws the bullseye instead of any hand wherever a cursor is drawn, hides the stock cursor with it, and character select never draws it [k2 property]", () => {
  for (const allowed of [false, true]) {
    for (const drawn of [false, true]) {
      for (const holding of [false, true]) {
        for (const hovering of [false, true]) {
          const hover = hovering ? "tile" : undefined;
          const stage = menuCursor(allowed, drawn, holding, hover, false, true, false);
          assertEquals(stage.bullseye, drawn);
          assertEquals(stage.hand, undefined);
          assertEquals(stage.stock, allowed && !drawn);
          assertEquals(menuCursor(allowed, drawn, holding, hover, false, false, false).bullseye, false);
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
    assertTrue(Math.abs(HAND_ART_COLUMNS / HAND_ART_ROWS - 828 / 848) < f32(0.002));
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

test("A carried chip hangs left of the pinch point with its right rim between the thumb and index tips, level with it, and narrower than the gauntlet [k2 property]", () => {
  for (let count = 1; count <= 60; count++) {
    const grid = rosterGrid(count);
    const size = handSize(grid);
    const chip = readyChipSize(grid);
    const x = f32(0.4);
    const y = f32(0.3);
    assertTrue(Math.abs(carriedChipLeft(x, chip) + chip / 2 - (x + chip * CARRIED_CHIP_OFFSET.x)) < f32(0.00001));
    assertTrue(carriedChipLeft(x, chip) + chip * (f32(0.5) + DISC_RADIUS) > x);
    assertTrue(carriedChipLeft(x, chip) + chip * (f32(0.5) - DISC_RADIUS) < x);
    assertTrue(Math.abs(carriedChipTop(y, chip) - chip / 2 - y) < chip * f32(0.15));
    assertTrue(chip < size * HAND_ART_COLUMNS / HAND_TEXELS);
  }
});

test("A chip is drawn at one size parked on its card, carried by the hand and placed on a tile [k2 property]", () => {
  for (let count = 1; count <= 60; count++) {
    const grid = rosterGrid(count);
    for (let slot = 0; slot < 4; slot++) {
      const hand = { x: f32(0.4), y: f32(0.3) };
      const parked = chipBox(grid, slot, "parked", 0, hand).size;
      const carried = chipBox(grid, slot, "carried", 0, hand).size;
      const placed = chipBox(grid, slot, "placed", 0, hand).size;
      assertEquals(carried, readyChipSize(grid));
      assertEquals(placed, carried);
      assertEquals(parked, carried);
    }
  }
});
