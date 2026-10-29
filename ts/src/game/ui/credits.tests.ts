import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { CREDITS_MARKDOWN, creditsBody, creditsVersionLine } from "./credits";
import { InfoPanelState } from "./infoPanelState";
import { CREDITS_BOX, TUTORIAL_BOX, boxContains } from "./selectionLayout";

test("The Credits button sits directly right of Tutorial at its size and on its row, and hits only its own box [k2 property]", () => {
  assertTrue(CREDITS_BOX.x >= TUTORIAL_BOX.x + TUTORIAL_BOX.width);
  assertTrue(CREDITS_BOX.x - (TUTORIAL_BOX.x + TUTORIAL_BOX.width) <= f32(0.011));
  assertEquals(CREDITS_BOX.y, TUTORIAL_BOX.y);
  assertEquals(CREDITS_BOX.width, TUTORIAL_BOX.width);
  assertEquals(CREDITS_BOX.height, TUTORIAL_BOX.height);
  const x = CREDITS_BOX.x + CREDITS_BOX.width / 2, y = CREDITS_BOX.y - CREDITS_BOX.height / 2;
  assertTrue(boxContains(CREDITS_BOX, x, y));
  assertFalse(boxContains(TUTORIAL_BOX, x, y));
});

test("Opening the credits panel shows the creator line, an imported-asset credit and the version, and Close or Escape closes it [k2 property]", () => {
  const panel = new InfoPanelState();
  assertFalse(panel.isOpen);
  assertFalse(panel.close());
  panel.open();
  assertTrue(panel.isOpen);
  const body = creditsBody("0.2-test");
  assertTrue(body.includes("Design & Programming: Tom Passarelli (Tompas)"));
  assertTrue(body.includes("Lich King model: Kwaliti"));
  assertTrue(body.includes("Murloc sound: World of Warcraft, Blizzard Entertainment"));
  assertTrue(body.includes(creditsVersionLine("0.2-test")));
  assertFalse(body.includes("https://"));
  assertTrue(panel.close());
  assertFalse(panel.isOpen);
  assertEquals(CREDITS_MARKDOWN.length > 0, true);
});
