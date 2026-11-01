import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase } from "../lobby/lobbyState";
import { cellRect, rosterGrid } from "../menu/selectionGrid";
import { PLAYABLE_CHARACTERS } from "../roster/kits";
import { NET_INDICATOR_TOP } from "./hudLayout";
import { PLATE_TOP } from "./plateLayout";
import { STAGE_LIST_BOX, STAGE_PREVIEW_BOX } from "../core/selectScreenLayout";
import { cardX } from "../menu/selectionDrag";
import { CHAT_STYLE, MATCH_CHAT_BOX, SELECT_CHAT_SLOT, chatBox } from "./nativeChat";
import type { ChatBox } from "wisp/src/ui/chatPanel";

const SCREEN_WIDTH = f32(0.8);
const SCREEN_HEIGHT = f32(0.6);

const extent = (box: ChatBox, rows: number) => ({
  left: f32(box.left - CHAT_STYLE.margin),
  right: f32(box.left + box.width + CHAT_STYLE.margin),
  bottom: f32(box.bottom - CHAT_STYLE.margin),
  top: f32(box.bottom + f32(CHAT_STYLE.rowHeight * rows) + CHAT_STYLE.margin),
});

const slot = { left: SELECT_CHAT_SLOT.left, right: f32(SELECT_CHAT_SLOT.left + SELECT_CHAT_SLOT.width), bottom: SELECT_CHAT_SLOT.bottom, top: f32(SELECT_CHAT_SLOT.bottom + SELECT_CHAT_SLOT.height) };

test("the chat panel stays inside the 4:3 screen area on every screen, the select screens' framed box and the match's recent or history view, so 3:2 and 4:3 windows show it in the same place [k1 scenario]", () => {
  assertTrue(slot.left >= 0.0 && slot.right <= SCREEN_WIDTH && slot.bottom >= 0.0 && slot.top <= SCREEN_HEIGHT);
  for (const rows of [MATCH_CHAT_BOX.rows, CHAT_STYLE.historyRows]) {
    const area = extent(MATCH_CHAT_BOX, rows);
    assertTrue(area.left >= 0.0 && area.right <= SCREEN_WIDTH && area.bottom >= 0.0 && area.top <= SCREEN_HEIGHT);
  }
});

test("on character select the framed chat box is the chat slot, left of the fighter cards and clear of every roster tile [k1 scenario]", () => {
  for (const count of [PLAYABLE_CHARACTERS.length, PLAYABLE_CHARACTERS.length + 4]) {
    const grid = rosterGrid(count);
    for (let tile = 0; tile < count; tile++) {
      const rect = cellRect(grid, tile);
      assertTrue(slot.right <= rect.left || slot.left >= rect.right || slot.top <= rect.bottom || slot.bottom >= rect.top);
    }
  }
  assertTrue(slot.right <= cardX(0));
});

test("on stage select the chat uses character select's framed box, under the stage preview and the stage list [k1 scenario]", () => {
  assertEquals(chatBox(Phase.stageMenu), SELECT_CHAT_SLOT);
  for (const panel of [STAGE_PREVIEW_BOX, STAGE_LIST_BOX]) assertTrue(slot.top <= f32(panel.y - panel.height));
});

test("in a match the chat panel sits above the fighter plates and the netplay warning, character select uses the framed box, and results, pause and menus use the match box, hidden until a line arrives after the match starts [k1 scenario]", () => {
  assertTrue(extent(MATCH_CHAT_BOX, 1).bottom >= PLATE_TOP);
  assertTrue(extent(MATCH_CHAT_BOX, 1).bottom >= NET_INDICATOR_TOP);
  assertEquals(chatBox(Phase.characterMenu), SELECT_CHAT_SLOT);
  assertEquals(chatBox(Phase.match), MATCH_CHAT_BOX);
  assertEquals(chatBox(Phase.result), MATCH_CHAT_BOX);
  assertEquals(chatBox(Phase.match, false), undefined);
  assertEquals(chatBox(Phase.characterMenu, false), SELECT_CHAT_SLOT);
});

test("the chat panel leaves out commands, whose lines never show in it [k2 property]", () => {
  assertTrue(CHAT_STYLE.ignore("-dev quick"));
  assertTrue(CHAT_STYLE.ignore("-help"));
  assertEquals(CHAT_STYLE.ignore("gg"), false);
});

test("the select screens' framed chat box has no title bar, so the lines use the space a header would take [k1 scenario]", () => {
  assertTrue(CHAT_STYLE.frame !== undefined);
  assertEquals(CHAT_STYLE.frame?.title, undefined);
});
