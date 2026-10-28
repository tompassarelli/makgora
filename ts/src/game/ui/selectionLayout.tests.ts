import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { MOVES_BOX, SETTINGS_BOX, START_BUTTON, TUTORIAL_BOX, boxContains } from "./selectionLayout";

const centre = (box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): readonly [number, number] => [box.x + box.width / 2, box.y - box.height / 2];

test("The character select header runs Start, Controls, Moves, Tutorial from left to right, and each button hits only its own box [k2 property]", () => {
  const order = [START_BUTTON, SETTINGS_BOX, MOVES_BOX, TUTORIAL_BOX];
  for (let index = 1; index < order.length; index++) {
    const previous = order[index - 1], next = order[index];
    if (previous === undefined || next === undefined) continue;
    assertTrue(previous.x + previous.width <= next.x);
    assertEquals(previous.y, next.y);
  }
  const [controlsX, controlsY] = centre(SETTINGS_BOX), [movesX, movesY] = centre(MOVES_BOX);
  assertTrue(boxContains(SETTINGS_BOX, controlsX, controlsY));
  assertFalse(boxContains(MOVES_BOX, controlsX, controlsY));
  assertTrue(boxContains(MOVES_BOX, movesX, movesY));
  assertFalse(boxContains(SETTINGS_BOX, movesX, movesY));
});
