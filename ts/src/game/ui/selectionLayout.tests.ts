import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { RULE_BUTTONS } from "./ruleButtons";
import { COMMUNITY_BOX, CREDITS_BOX, MOVES_BOX, SELECT_GAP, SETTINGS_BOX, START_BUTTON, TUTORIAL_BOX, boxContains } from "./selectionLayout";

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

test("The character select header and rule rows share one gap, one height and aligned outer edges [k2 property]", () => {
  const header = [START_BUTTON, SETTINGS_BOX, MOVES_BOX, TUTORIAL_BOX, CREDITS_BOX, COMMUNITY_BOX];
  const right = (box: { readonly x: number; readonly width: number }) => f32(box.x + box.width);
  const near = (actual: number, expected: number) => assertTrue(Math.abs(actual - expected) < f32(0.00001));
  for (let index = 1; index < header.length; index++) {
    const previous = header[index - 1], next = header[index];
    if (previous === undefined || next === undefined) continue;
    near(f32(next.x - right(previous)), SELECT_GAP);
    assertEquals(next.height, previous.height);
  }
  const { teamBattle, training, items, ultimates, inputDelay, moreTime, automaticRematch, endless } = RULE_BUTTONS;
  assertEquals(training.x, teamBattle.x);
  assertEquals(training.x, START_BUTTON.x);
  for (const box of [moreTime, automaticRematch, inputDelay]) near(right(box), right(COMMUNITY_BOX));
  near(f32(ultimates.x - right(items)), SELECT_GAP);
  near(f32(inputDelay.x - right(ultimates)), SELECT_GAP);
  near(f32(automaticRematch.x - right(endless)), SELECT_GAP);
  for (const box of [teamBattle, training, items, ultimates, inputDelay]) assertEquals(box.height, START_BUTTON.height);
});
