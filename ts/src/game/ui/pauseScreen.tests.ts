import { assertEquals, test } from "wisp/src/runtime/testing";
import { holdBarLabel, pauseKeyLines } from "./pauseScreen";

test("the pause screen's hold bar says holding the pause key leaves and a tap unpauses [k2 property]", () => {
  assertEquals(holdBarLabel("Esc"), "Hold Esc to leave, tap to unpause");
});

test("the pause screen lists one key per line: F2 shows the controls' state when the player can toggle them, F10 opens Warcraft's menu [k2 property]", () => {
  const text = (keyboard: boolean | undefined) => pauseKeyLines(keyboard).map(([key, label]) => `${key} ${label}`).join("|");
  assertEquals(text(false), "F2 Show controls: Off|F10 Warcraft menu");
  assertEquals(text(true), "F2 Show controls: On|F10 Warcraft menu");
  assertEquals(text(undefined), "F10 Warcraft menu");
});
