import { assertTrue, test } from "wisp/src/runtime/testing";
import { FRIZ_QUADRATA_WIDTHS, textWidth } from "wisp/src/ui/chatLog";
import { CHAT_STYLE } from "./nativeChat";
import { creditsLayout } from "./creditsMenu";
import { communityLayout } from "./communityMenu";
import { creditsParagraphs } from "./credits";
import { communityParagraphs } from "./community";
import { SELECT_LEVELS } from "./selectLevels";
import type { InfoPopupLayout } from "./infoPopupLayout";

const CHAT_TOP_LEVEL = CHAT_STYLE.level + 2;

function assertInside(layout: InfoPopupLayout, paragraphs: readonly string[]): void {
  assertTrue(layout.title.y - layout.title.height > layout.headerRule);
  assertTrue(layout.close.y < layout.footerRule);
  assertTrue(layout.close.y - layout.close.height > layout.panel.y - layout.panel.height);
  for (const row of layout.rows) {
    assertTrue(row.y < layout.headerRule);
    assertTrue(row.y - row.height > layout.footerRule);
    assertTrue(textWidth(row.text, FRIZ_QUADRATA_WIDTHS) * layout.size <= row.width);
    assertTrue(row.x >= layout.panel.x && row.x + row.width <= layout.panel.x + layout.panel.width);
  }
  assertTrue(layout.rows.map(row => row.text).join(" ").split(" ").join("") === paragraphs.join(" ").split(" ").join(""));
}

test("Credits and Community lay every body row below the header divider and above the footer divider, inside the frame at the default UI scale, and draw at the modal level above the select screen's chat box [k2 property]", () => {
  assertInside(creditsLayout("0.2-dev.9999 (0123456789ab)"), creditsParagraphs("0.2-dev.9999 (0123456789ab)"));
  assertInside(communityLayout(), communityParagraphs());
  assertTrue(SELECT_LEVELS.modal > CHAT_TOP_LEVEL);
});
