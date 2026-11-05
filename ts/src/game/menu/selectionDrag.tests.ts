import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { GAME_MENU_WAKE_UPDATES, gameMenuWake, menuCursor } from "./selectionDrag";

test("An F10 wake keeps Warcraft's cursor shown on select or in a match until the Game Menu's frames are seen, then hands the cursor back once they close, and lapses after its updates if no menu opens [k2 property]", () => {
  for (const allowed of [false, true]) {
    for (const stage of [false, true]) {
      let wake = GAME_MENU_WAKE_UPDATES;
      for (let update = 1; update < GAME_MENU_WAKE_UPDATES; update++) {
        wake = gameMenuWake(wake, false);
        assertTrue(menuCursor(allowed, allowed, false, undefined, false, stage, wake > 0).stock);
      }
      wake = gameMenuWake(wake, false);
      assertEquals(wake, 0);
      assertEquals(menuCursor(allowed, allowed, false, undefined, false, stage, wake > 0).stock, false);

      wake = gameMenuWake(GAME_MENU_WAKE_UPDATES, true);
      assertEquals(wake, 0);
      assertTrue(menuCursor(allowed, allowed, false, undefined, false, stage, true).stock);
      wake = gameMenuWake(wake, false);
      assertEquals(menuCursor(allowed, allowed, false, undefined, false, stage, wake > 0).stock, false);
    }
  }
});
