import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase } from "../lobby/lobbyState";
import { cellRect, rosterGrid } from "../menu/selectionGrid";
import { PLAYABLE_CHARACTERS } from "../roster/kits";
import { NET_INDICATOR_TOP } from "./hudLayout";
import { PLATE_TOP } from "./plateLayout";
import { CHAT_SLOT, STAGE_LIST_BOX, STAGE_PREVIEW_BOX } from "../core/selectScreenLayout";
import { cardX } from "../menu/selectionDrag";
import { CHAT_STYLE, MATCH_CHAT_BOX, SELECT_CHAT_BOX, chatBox } from "./nativeChat";
import type { ChatBox } from "wisp/src/ui/chatPanel";

const SCREEN_WIDTH = f32(0.8);
const SCREEN_HEIGHT = f32(0.6);

const extent = (box: ChatBox, rows: number) => ({
  left: f32(box.left - CHAT_STYLE.margin),
  right: f32(box.left + box.width + CHAT_STYLE.margin),
  bottom: f32(box.bottom - CHAT_STYLE.margin),
  top: f32(box.bottom + f32(CHAT_STYLE.rowHeight * rows) + CHAT_STYLE.margin),
});

test("the chat panel stays inside the 4:3 screen area on every screen, recent or history, so 3:2 and 4:3 windows show it in the same place [k1 scenario]", () => {
  for (const box of [SELECT_CHAT_BOX, MATCH_CHAT_BOX]) {
    for (const rows of [box.rows, CHAT_STYLE.historyRows]) {
      const area = extent(box, rows);
      assertTrue(area.left >= 0.0 && area.right <= SCREEN_WIDTH && area.bottom >= 0.0 && area.top <= SCREEN_HEIGHT);
    }
  }
});

test("on character select the chat lines sit inside the chat box left of the fighter cards and clear every roster tile, in the recent and history views [k1 scenario]", () => {
  for (const count of [PLAYABLE_CHARACTERS.length, PLAYABLE_CHARACTERS.length + 4]) {
    const grid = rosterGrid(count);
    for (let tile = 0; tile < count; tile++) {
      const rect = cellRect(grid, tile);
      for (const rows of [SELECT_CHAT_BOX.rows, CHAT_STYLE.historyRows]) {
        const area = extent(SELECT_CHAT_BOX, rows);
        assertTrue(area.right <= rect.left || area.left >= rect.right || area.top <= rect.bottom || area.bottom >= rect.top);
      }
    }
  }
  const recent = extent(SELECT_CHAT_BOX, SELECT_CHAT_BOX.rows);
  assertTrue(recent.left >= CHAT_SLOT.left && recent.right <= f32(CHAT_SLOT.left + CHAT_SLOT.width));
  assertTrue(recent.bottom >= CHAT_SLOT.bottom && recent.top <= f32(f32(CHAT_SLOT.bottom + CHAT_SLOT.height) - f32(0.02)));
  assertTrue(extent(SELECT_CHAT_BOX, CHAT_STYLE.historyRows).right <= cardX(0));
});

test("on stage select the chat lines use character select's chat box, under the stage preview and the stage list, in the recent and history views [k1 scenario]", () => {
  assertEquals(chatBox(Phase.stageMenu), SELECT_CHAT_BOX);
  for (const rows of [SELECT_CHAT_BOX.rows, CHAT_STYLE.historyRows]) {
    for (const panel of [STAGE_PREVIEW_BOX, STAGE_LIST_BOX]) assertTrue(extent(SELECT_CHAT_BOX, rows).top <= f32(panel.y - panel.height));
  }
});

test("in a match the chat panel sits above the fighter plates and the netplay warning, and results, pause and menus use the match box, hidden until a line arrives after the match starts [k1 scenario]", () => {
  assertTrue(extent(MATCH_CHAT_BOX, 1).bottom >= PLATE_TOP);
  assertTrue(extent(MATCH_CHAT_BOX, 1).bottom >= NET_INDICATOR_TOP);
  assertEquals(chatBox(Phase.characterMenu), SELECT_CHAT_BOX);
  assertEquals(chatBox(Phase.match), MATCH_CHAT_BOX);
  assertEquals(chatBox(Phase.result), MATCH_CHAT_BOX);
  assertEquals(chatBox(Phase.match, false), undefined);
  assertEquals(chatBox(Phase.characterMenu, false), SELECT_CHAT_BOX);
});

test("the chat panel leaves out commands, whose lines never show in it [k2 property]", () => {
  assertTrue(CHAT_STYLE.ignore("-dev quick"));
  assertTrue(CHAT_STYLE.ignore("-help"));
  assertEquals(CHAT_STYLE.ignore("gg"), false);
});
