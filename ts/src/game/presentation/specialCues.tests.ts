import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { WARDEN_SPECIALS } from "../fighters/warden/specials";
import { ILLUSION_LAST_TRAVEL_FRAME } from "../sim/specials/illusionDash";
import { ACTIVE_CUE_FRAMES, heroCueWindows } from "./cueWindows";

test("A special's cue windows are measured once and handed back unchanged on every later frame [k2 property]", () => {
  const lunge = WARDEN_SPECIALS.side.ground;
  const first = heroCueWindows(lunge);
  assertTrue(heroCueWindows(lunge) === first);
  assertTrue(heroCueWindows(lunge, ACTIVE_CUE_FRAMES) === first);
  const single = heroCueWindows(lunge, 1);
  assertTrue(heroCueWindows(lunge, 1) === single);
  assertTrue(single !== first);
  assertEquals(single.active.first, first.active.first);
  assertEquals(single.active.last, ILLUSION_LAST_TRAVEL_FRAME);
  assertEquals(first.active.first, (lunge.regions?.[0]?.firstFrame ?? 0) + 1);
});
