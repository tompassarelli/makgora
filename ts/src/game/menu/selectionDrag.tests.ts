import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { HAND_SIZE, HAND_STATES, handLeft, handTop, menuCursor } from "./selectionDrag";

test("The select cursor is the default hand off the tiles, the fanned hand over a tile with no chip, and the pinch with a chip, and the stock cursor shows only where no hand is drawn [k2 property]", () => {
  for (const allowed of [false, true]) {
    for (const drawn of [false, true]) {
      for (const holding of [false, true]) {
        for (const hovering of [false, true]) {
          const hover = hovering ? 0 : undefined;
          const cursor = menuCursor(allowed, drawn, holding, hover);
          assertEquals(cursor.stock, allowed && !drawn);
          if (!drawn) assertEquals(cursor.hand, undefined);
          else assertEquals(cursor.hand, holding ? "pinch" : hover === undefined ? "point" : "fan");
          assertFalse(cursor.stock && cursor.hand !== undefined);
        }
      }
    }
  }
});

test("Every hand state keeps its hotspot inside the hand frame and moves the frame one for one with the mouse [k2 property]", () => {
  for (const state of HAND_STATES) {
    const left = handLeft(f32(0.4), state);
    const top = handTop(f32(0.3), state);
    assertTrue(left < f32(0.4) && left + HAND_SIZE > f32(0.4));
    assertTrue(top > f32(0.3) && top - HAND_SIZE < f32(0.3));
    const slid = handLeft(f32(0.5), state);
    assertTrue(Math.abs(slid - left - f32(0.1)) < f32(0.00001));
  }
});
