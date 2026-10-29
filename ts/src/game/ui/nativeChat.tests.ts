import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase } from "../lobby/lobbyState";
import { cellRect, rosterGrid } from "../menu/selectionGrid";
import { PLAYABLE_CHARACTERS } from "../roster/kits";
import { NET_INDICATOR_TOP } from "./hudLayout";
import { CHAT_STYLE, MATCH_CHAT_BOX, STAGE_SELECT_CHAT_BOX, CHARACTER_SELECT_CHAT_BOX, chatBox } from "./nativeChat";
import type { ChatBox } from "wisp/src/ui/chatPanel";

const SCREEN_WIDTH = f32(0.8);
const SCREEN_HEIGHT = f32(0.6);
const CARD_STRIP_TOP = f32(0.2);
const HUD_PLATE_TOP = f32(0.09);
const STAGE_TILES_LEFT = f32(0.49);

const extent = (box: ChatBox, rows: number) => ({
  left: f32(box.left - CHAT_STYLE.margin),
  right: f32(box.left + box.width + CHAT_STYLE.margin),
  bottom: f32(box.bottom - CHAT_STYLE.margin),
  top: f32(box.bottom + f32(CHAT_STYLE.rowHeight * rows) + CHAT_STYLE.margin),
});

test("the chat panel stays inside the 4:3 screen area on every screen, recent or history, so 3:2 and 4:3 windows show it in the same place [k1 scenario]", () => {
  for (const box of [CHARACTER_SELECT_CHAT_BOX, STAGE_SELECT_CHAT_BOX, MATCH_CHAT_BOX]) {
    for (const rows of [box.rows, CHAT_STYLE.historyRows]) {
      const area = extent(box, rows);
      assertTrue(area.left >= 0.0 && area.right <= SCREEN_WIDTH && area.bottom >= 0.0 && area.top <= SCREEN_HEIGHT);
    }
  }
});

test("on character select the chat panel clears every roster tile and the fighter cards, in the recent and history views [k1 scenario]", () => {
  for (const count of [PLAYABLE_CHARACTERS.length, PLAYABLE_CHARACTERS.length + 4]) {
    const grid = rosterGrid(count);
    for (let tile = 0; tile < count; tile++) {
      const rect = cellRect(grid, tile);
      for (const rows of [CHARACTER_SELECT_CHAT_BOX.rows, CHAT_STYLE.historyRows]) {
        const area = extent(CHARACTER_SELECT_CHAT_BOX, rows);
        assertTrue(area.right <= rect.left || area.left >= rect.right || area.top <= rect.bottom || area.bottom >= rect.top);
      }
    }
  }
  assertTrue(extent(CHARACTER_SELECT_CHAT_BOX, 1).bottom >= CARD_STRIP_TOP);
});

test("on stage select the chat panel sits left of the stage tiles and above the stage preview, in the recent and history views [k1 scenario]", () => {
  for (const rows of [STAGE_SELECT_CHAT_BOX.rows, CHAT_STYLE.historyRows]) assertTrue(extent(STAGE_SELECT_CHAT_BOX, rows).right <= STAGE_TILES_LEFT);
  assertTrue(extent(STAGE_SELECT_CHAT_BOX, 1).bottom >= CARD_STRIP_TOP);
});

test("in a match the chat panel sits above the fighter plates and the netplay warning, and results, pause and menus use the match box [k1 scenario]", () => {
  assertTrue(extent(MATCH_CHAT_BOX, 1).bottom >= HUD_PLATE_TOP);
  assertTrue(extent(MATCH_CHAT_BOX, 1).bottom >= NET_INDICATOR_TOP);
  assertEquals(chatBox(Phase.characterMenu), CHARACTER_SELECT_CHAT_BOX);
  assertEquals(chatBox(Phase.stageMenu), STAGE_SELECT_CHAT_BOX);
  assertEquals(chatBox(Phase.match), MATCH_CHAT_BOX);
  assertEquals(chatBox(Phase.result), MATCH_CHAT_BOX);
});

test("the chat panel leaves out commands, whose lines never show in it [k2 property]", () => {
  assertTrue(CHAT_STYLE.ignore("-dev quick"));
  assertTrue(CHAT_STYLE.ignore("-help"));
  assertEquals(CHAT_STYLE.ignore("gg"), false);
});
