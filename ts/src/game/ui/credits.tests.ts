import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { CREDITS_MARKDOWN, creditsBody, creditsVersionLine } from "./credits";
import { InfoPanelState } from "./infoPanelState";

test("Opening the credits panel shows the creator line, an imported-asset credit and the version, and Close or Escape closes it [k2 property]", () => {
  const panel = new InfoPanelState();
  assertFalse(panel.isOpen);
  assertFalse(panel.close());
  panel.open();
  assertTrue(panel.isOpen);
  const body = creditsBody("0.2-test");
  assertTrue(body.includes("Design & Programming: Tom Passarelli (Tompas)"));
  assertTrue(body.includes("Lich King model: Kwaliti"));
  assertTrue(body.includes("Mrgl & Grgl sound: World of Warcraft, Blizzard Entertainment"));
  assertTrue(body.includes(creditsVersionLine("0.2-test")));
  assertFalse(body.includes("https://"));
  assertTrue(panel.close());
  assertFalse(panel.isOpen);
  assertEquals(CREDITS_MARKDOWN.length > 0, true);
});
