import { f32 } from "wisp/src/sim/f32";
import { assertTrue, test } from "wisp/src/runtime/testing";
import { SELECT_BAR, STAGE_BAR } from "../core/selectBarLayout";
import { CARD_TOP, SELECT_BODY, STAGE_LIST_BOX, STAGE_PREVIEW_BOX } from "../core/selectScreenLayout";
import { STAGE_CHOICES } from "./stageCatalog";
import { STAGE_LIST_HEADING, STAGE_TILE, stageTileAt, stageTileLeft, stageTileTop } from "./stageSelection";

const near = (a: number, b: number): boolean => Math.abs(a - b) < f32(0.0005);
const right = (b: { readonly x: number; readonly width: number }): number => f32(b.x + b.width);
const bottom = (b: { readonly y: number; readonly height: number }): number => f32(b.y - b.height);

test("stage select shares character select's frame: its bar uses the same boxes, the preview and the stage list are two equal boxes side by side across the body, centred, above the bottom row [k2 property]", () => {
  assertTrue(near(STAGE_BAR.back.x, SELECT_BAR.back.x) && near(right(STAGE_BAR.start), right(SELECT_BAR.start)) && near(STAGE_BAR.rules.x, SELECT_BAR.rules.x));
  assertTrue(near(STAGE_PREVIEW_BOX.width, STAGE_LIST_BOX.width) && near(STAGE_PREVIEW_BOX.height, STAGE_LIST_BOX.height) && near(STAGE_PREVIEW_BOX.y, STAGE_LIST_BOX.y));
  assertTrue(near(STAGE_PREVIEW_BOX.x, SELECT_BODY.x) && near(right(STAGE_LIST_BOX), right(SELECT_BODY)) && right(STAGE_PREVIEW_BOX) < STAGE_LIST_BOX.x);
  assertTrue(near(f32(f32(STAGE_PREVIEW_BOX.x + right(STAGE_LIST_BOX)) / 2), f32(0.4)));
  assertTrue(bottom(STAGE_LIST_BOX) > CARD_TOP && STAGE_LIST_BOX.y < bottom(STAGE_BAR.start));
});

test("every stage tile lies inside the stage list under its heading without overlapping another, and a click on its centre picks it [k2 property]", () => {
  for (const stage of STAGE_CHOICES) {
    const left = stageTileLeft(stage.id);
    const top = stageTileTop(stage.id);
    assertTrue(left >= STAGE_LIST_BOX.x && f32(left + STAGE_TILE.width) <= right(STAGE_LIST_BOX));
    assertTrue(top <= bottom(STAGE_LIST_HEADING) && f32(top - STAGE_TILE.height) >= bottom(STAGE_LIST_BOX));
    assertTrue(stageTileAt(f32(left + f32(STAGE_TILE.width / 2)), f32(top - f32(STAGE_TILE.height / 2))) === stage.id);
  }
});
