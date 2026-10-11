import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import {
  BUST_BOX, PLATE_WIDTH_PX, SHAKE_FRAMES, SHAKE_MAX_PX, damageColour, plateLeft, shakeStrength, shakeX, shakeY,
} from "./plateLayout";
import { TILE_TEXTURE_PX, unitsForPixels } from "./portraitFrames";

test("the HUD bust draws its tile render 1:1 and four plates fit side by side [k3 measure #149]", () => {
  assertEquals(BUST_BOX.width, TILE_TEXTURE_PX);
  assertEquals(BUST_BOX.height, BUST_BOX.width);
  for (const count of [2, 3, 4]) {
    for (let position = 0; position + 1 < count; position++) {
      assertTrue(plateLeft(position, count) + unitsForPixels(PLATE_WIDTH_PX) < plateLeft(position + 1, count));
    }
    assertTrue(plateLeft(0, count) >= 0.0 && plateLeft(count - 1, count) + unitsForPixels(PLATE_WIDTH_PX) <= f32(0.8));
  }
});

test("the damage readout darkens in every channel from white at 0% to a dark red held from 200%: every tenth from 0 to 999.9 [k2 property]", () => {
  const channels = (colour: number): [number, number, number] => [idiv(colour, 0x10000), imod(idiv(colour, 0x100), 0x100), imod(colour, 0x100)];
  const darkest = damageColour(200.0);
  const [red, green, blue] = channels(darkest);
  assertEquals(red > 2 * green && red > 2 * blue && red < 0xff, true, `darkest ${darkest} is not a dark red`);
  let previous = channels(0xffffff);
  for (let tenth = 0; tenth < 10000; tenth++) {
    const damage = tenth / 10;
    const colour = damageColour(damage);
    if (damage < 1.0) assertEquals(colour, 0xffffff);
    if (damage >= 200.0) assertEquals(colour, darkest);
    const current = channels(colour);
    for (let index = 0; index < 3; index++) {
      assertEquals((current[index] ?? 0) <= (previous[index] ?? 0), true, `channel ${index} brightens at ${damage}%`);
    }
    previous = current;
  }
});

test("a hit's shake stays within its bound and settles to zero [k2 property]", () => {
  assertEquals(shakeStrength(999.0), SHAKE_MAX_PX);
  for (let frame = 0; frame < SHAKE_FRAMES; frame++) {
    assertTrue(Math.abs(shakeX(SHAKE_MAX_PX, frame)) <= SHAKE_MAX_PX && Math.abs(shakeY(SHAKE_MAX_PX, frame)) <= SHAKE_MAX_PX);
  }
  assertEquals(shakeX(SHAKE_MAX_PX, SHAKE_FRAMES), 0.0);
  assertEquals(shakeY(SHAKE_MAX_PX, SHAKE_FRAMES), 0.0);
});
