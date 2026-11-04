import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { FRIZ_QUADRATA_WIDTHS, textWidth } from "wisp/src/ui/chatLog";
import { CHAT_STYLE } from "./nativeChat";
import { creditsLayout } from "./creditsMenu";
import { communityLayout } from "./communityMenu";
import { creditsParagraphs } from "./credits";
import { communityParagraphs } from "./community";
import { InfoPanelState } from "./infoPanelState";
import { INFO_POPUP_SIZE, type InfoPopupLayout, windowCount, windowY } from "./infoPopupLayout";
import { SELECT_LEVELS } from "./selectLevels";

const CHAT_TOP_LEVEL = CHAT_STYLE.level + 2;
const VERSION = "0.2-dev.9999 (0123456789ab)";

function assertWindow(layout: InfoPopupLayout, first: number): void {
  const count = windowCount(layout, first);
  assertTrue(count >= 1 && count <= layout.slots);
  for (let index = first; index < first + count; index++) {
    const top = windowY(layout, first, index);
    assertTrue(top < layout.headerRule);
    assertTrue(top - layout.lineHeight > layout.footerRule);
  }
}

function assertInside(layout: InfoPopupLayout, paragraphs: readonly string[]): void {
  assertTrue(layout.title.y - layout.title.height > layout.headerRule);
  assertTrue(layout.close.y < layout.footerRule);
  assertTrue(layout.close.y - layout.close.height > layout.panel.y - layout.panel.height);
  assertEquals(layout.size, INFO_POPUP_SIZE);
  for (const line of layout.lines) {
    assertTrue(textWidth(line.text, FRIZ_QUADRATA_WIDTHS) * layout.size <= layout.width);
  }
  assertTrue(layout.left >= layout.panel.x && layout.left + layout.width <= layout.panel.x + layout.panel.width);
  for (let first = 0; first <= layout.maxFirst; first++) assertWindow(layout, first);
  assertTrue(layout.lines.map(line => line.text).join(" ").split(" ").join("") === paragraphs.join(" ").split(" ").join(""));
}

test("Credits and Community lay every shown body line below the header divider and above the footer divider at the popup font size, at every scroll position, and draw at the modal level above the select screen's chat box [k2 property]", () => {
  assertInside(creditsLayout(VERSION), creditsParagraphs(VERSION));
  assertInside(communityLayout(), communityParagraphs());
  assertEquals(communityLayout().maxFirst, 0);
  assertTrue(SELECT_LEVELS.modal > CHAT_TOP_LEVEL);
});

test("Scrolling the Credits list reaches its last line, stops there and at the top, and never needs more frames than the slots made once [k2 property]", () => {
  const layout = creditsLayout(VERSION);
  assertTrue(layout.maxFirst > 0);
  const state = new InfoPanelState(layout.maxFirst);
  state.open();
  assertEquals(state.first, 0);
  assertEquals(state.scroll(-1), false);
  let steps = 0;
  while (steps <= layout.maxFirst && state.scroll(1)) steps++;
  assertEquals(steps, layout.maxFirst);
  assertEquals(state.first + windowCount(layout, state.first), layout.lines.length);
  assertEquals(state.scroll(1), false);
  assertTrue(state.scroll(-3));
  assertEquals(state.first, layout.maxFirst - 3);
  state.open();
  assertEquals(state.first, 0);
});
