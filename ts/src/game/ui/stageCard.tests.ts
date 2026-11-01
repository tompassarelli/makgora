import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { STAGE_PREVIEW_BOX } from "../core/selectScreenLayout";
import { STAGE_TILE } from "../menu/stageSelection";
import { stagePictureBox } from "./stageCard";
import { PREVIEW_HEIGHT } from "./stageUi";

const near = (a: number, b: number): boolean => Math.abs(a - b) < f32(0.0001);

test("a preview's picture is a square, as large as its card allows and centred in it, so it keeps its shape and leaves no coal beside it [k2 property]", () => {
  const left = f32(0.05);
  const top = f32(0.5);
  for (const [width, height] of [[f32(0.35), f32(0.23)], [f32(0.2), f32(0.2)], [f32(0.2), f32(0.3)]] as const) {
    const picture = stagePictureBox(left, top, width, height, false);
    assertTrue(near(picture.width, picture.height));
    assertTrue(near(picture.width, Math.min(width, height)));
    assertTrue(near(f32(picture.left - left), f32(f32(left + width) - f32(picture.left + picture.width))));
    assertTrue(near(f32(top - picture.top), f32(f32(picture.top - picture.height) - f32(top - height))));
  }
});

test("a banner tile's picture fills its whole box [k2 property]", () => {
  const picture = stagePictureBox(f32(0.05), f32(0.5), STAGE_TILE.width, STAGE_TILE.height, true);
  assertEquals(picture.left, f32(0.05));
  assertEquals(picture.top, f32(0.5));
  assertEquals(picture.width, STAGE_TILE.width);
  assertEquals(picture.height, STAGE_TILE.height);
});

test("the stage preview's picture takes the box's height left under its heading and above its description, and its width fits the box [k2 property]", () => {
  assertTrue(PREVIEW_HEIGHT > f32(0.2) && PREVIEW_HEIGHT < STAGE_PREVIEW_BOX.height);
  assertTrue(PREVIEW_HEIGHT <= f32(STAGE_PREVIEW_BOX.width - f32(0.024)));
});
