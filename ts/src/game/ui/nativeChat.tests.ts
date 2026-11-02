import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase } from "../lobby/lobbyState";
import { cellRect, rosterGrid } from "../menu/selectionGrid";
import { PLAYABLE_CHARACTERS } from "../roster/kits";
import { NET_INDICATOR_TOP } from "./hudLayout";
import { PLATE_BOTTOM, type PlateRow, plateBandTop, plateLeft, plateRow } from "./plateLayout";
import { unitsForPixels } from "./portraitFrames";
import { STAGE_LIST_BOX, STAGE_PREVIEW_BOX } from "../core/selectScreenLayout";
import { cardX } from "../menu/selectionDrag";
import { CHAT_STYLE, MATCH_CHAT_ROWS, MATCH_CHAT_WIDTH, SELECT_CHAT_SLOT, chatBox, matchChatBox } from "./nativeChat";
import type { ChatBox, ChatSlot } from "wisp/src/ui/chatPanel";

const SCREEN_WIDTH = f32(0.8);
const SCREEN_HEIGHT = f32(0.6);

const extent = (box: ChatBox, rows: number) => ({
  left: f32(box.left - CHAT_STYLE.margin),
  right: f32(box.left + box.width + CHAT_STYLE.margin),
  bottom: f32(box.bottom - CHAT_STYLE.margin),
  top: f32(box.bottom + f32(CHAT_STYLE.rowHeight * rows) + CHAT_STYLE.margin),
});

const slot = { left: SELECT_CHAT_SLOT.left, right: f32(SELECT_CHAT_SLOT.left + SELECT_CHAT_SLOT.width), bottom: SELECT_CHAT_SLOT.bottom, top: f32(SELECT_CHAT_SLOT.bottom + SELECT_CHAT_SLOT.height) };

const ROWS: readonly PlateRow[] = [1, 2, 3, 4].flatMap(count => [false, true].map(preview => plateRow(count, preview)));

test("the chat panel stays inside the 4:3 screen area on every screen, the select screens' framed box and the match's recent or history view for one to four plates with the preview on or off, so 3:2 and 4:3 windows show it in the same place [k1 scenario]", () => {
  assertTrue(slot.left >= 0.0 && slot.right <= SCREEN_WIDTH && slot.bottom >= 0.0 && slot.top <= SCREEN_HEIGHT);
  for (const row of ROWS) for (const rows of [MATCH_CHAT_ROWS, CHAT_STYLE.historyRows]) {
    const area = extent(matchChatBox(row), rows);
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
  assertEquals(chatBox(Phase.stageMenu, plateRow(2)), SELECT_CHAT_SLOT);
  for (const panel of [STAGE_PREVIEW_BOX, STAGE_LIST_BOX]) assertTrue(slot.top <= f32(panel.y - panel.height));
});

test("in a match the chat is a narrow box in the bottom-left corner, on the screen's floor where no plate reaches it and else resting on the tallest plate, clear of every plate and under the netplay warning; character select uses the framed box, and results, pause and menus use the match box, hidden until a line arrives after the match starts or the player types [k1 scenario]", () => {
  for (const row of ROWS) {
    const box = matchChatBox(row);
    const area = extent(box, MATCH_CHAT_ROWS + 2);
    const where = `${row.count} plates, preview ${row.preview ? "on" : "off"}`;
    assertEquals(box.left <= f32(0.02) && box.width <= f32(MATCH_CHAT_WIDTH + f32(0.0001)) && MATCH_CHAT_WIDTH <= SCREEN_WIDTH / 4 + f32(0.0001), true, `${where}: narrow and at the left`);
    assertEquals(area.top + f32(0.016) <= NET_INDICATOR_TOP, true, `${where}: under the netplay warning`);
    for (let position = 0; position < row.count; position++) {
      const left = plateLeft(position, row);
      const right = left + unitsForPixels(544) * row.scale;
      assertEquals(area.right <= left || area.left >= right || area.bottom >= plateBandTop(row), true, `${where}: plate ${position} clear of the chat`);
    }
  }
  assertEquals(matchChatBox(plateRow(1)).bottom < f32(PLATE_BOTTOM + f32(0.02)), true, "alone and centred it takes the corner");
  assertEquals(extent(matchChatBox(plateRow(2)), 1).bottom >= plateBandTop(plateRow(2)), true, "beside a plate in the corner it rests on the plate");
  const row = plateRow(2);
  assertEquals(chatBox(Phase.characterMenu, row), SELECT_CHAT_SLOT);
  const same = (box: ChatBox | ChatSlot | undefined): string => box === undefined ? "none" : `${box.left} ${box.bottom} ${box.width}`;
  assertEquals(same(chatBox(Phase.match, row)), same(matchChatBox(row)));
  assertEquals(same(chatBox(Phase.result, row)), same(matchChatBox(row)));
  assertEquals(chatBox(Phase.match, row, false), undefined);
  assertEquals(chatBox(Phase.characterMenu, row, false), SELECT_CHAT_SLOT);
});

test("a chat line stays about 5 seconds, then fades over 1 second, so it is gone 6 seconds after it arrives [k2 property]", () => {
  assertEquals(CHAT_STYLE.recentSeconds, f32(6.0));
  assertEquals(CHAT_STYLE.fadeSeconds, f32(1.0));
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
