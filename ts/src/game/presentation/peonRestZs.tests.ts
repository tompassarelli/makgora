import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { REST_END_FRAME, REST_HEAD_X, REST_LYING_FRAME, PEON_SPECIALS } from "../fighters/peon/specials";
import { PEON_REST_CUES } from "./specialCues";

test("Rest's sleep Z's float over the lying Peon's head, the far end of his lying hurtbox ahead of him, so they follow his facing [k2 property]", () => {
  const lying = PEON_SPECIALS.down.ground.hurt?.[0]?.parts[0];
  assertEquals(lying?.x2, REST_HEAD_X);
  assertTrue(REST_HEAD_X > 0.0);
  for (let frame = REST_LYING_FRAME; frame <= REST_END_FRAME; frame++) assertEquals(PEON_REST_CUES.active.anchorFrames?.[frame - 1]?.x, REST_HEAD_X);
});
