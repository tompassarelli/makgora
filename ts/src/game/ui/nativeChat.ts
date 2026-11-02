import { f32 } from "wisp/src/sim/f32";
import type { ChatBox, ChatSlot, ChatStyle } from "wisp/src/ui/chatPanel";
import { FRIZ_QUADRATA_WIDTHS, lighten } from "wisp/src/ui/chatLog";
import { Phase } from "../lobby/lobbyState";
import { PLATE_BOTTOM, type PlateRow, plateBandTop, plateLeft } from "./plateLayout";
import { MENU_FONT, PANEL_TEXTURE } from "./hudLayout";
import { slotColor } from "./slotColors";
import { barTexture } from "../core/selectBarLayout";
import { CHAT_SLOT } from "../core/selectScreenLayout";

export const CHAT_STYLE: ChatStyle = {
  name: "SmashcraftChat",
  font: MENU_FONT,
  fontSize: f32(0.008),
  rowHeight: f32(0.0112),
  glyphWidths: FRIZ_QUADRATA_WIDTHS,
  margin: f32(0.005),
  panelTexture: PANEL_TEXTURE,
  panelAlpha: 210,
  level: 400,
  capacity: 100,
  historyRows: 16,
  recentSeconds: f32(6.0),
  fadeSeconds: f32(1.0),
  colour: slot => lighten(slotColor(slot).rgb, 45),
  ignore: text => text.startsWith("-"),
  frame: {
    panelTexture: barTexture("Panel", CHAT_SLOT),
    barTexture: "ReplaceableTextures\\TeamColor\\TeamColor08.blp",
    fieldTexture: PANEL_TEXTURE,
    placeholder: "Type your chat here",
    placeholderColour: 0x8c95a3,
  },
};

/** The select screens' framed chat box fills the chat slot at the bottom left, beside the fighter cards, on character and stage select alike. */
export const SELECT_CHAT_SLOT: ChatSlot = CHAT_SLOT;

export const MATCH_CHAT_LEFT = f32(0.01);
export const MATCH_CHAT_WIDTH = f32(0.2);
export const MATCH_CHAT_ROWS = 4;
const MATCH_CHAT_CLEAR = f32(0.004);

/** The match chat in the bottom-left corner, a quarter of the 4:3 screen wide: on the screen's floor where no plate reaches it, else resting on the tallest plate. */
export function matchChatBox(row: PlateRow): ChatBox {
  const reach = f32(MATCH_CHAT_LEFT + MATCH_CHAT_WIDTH + CHAT_STYLE.margin);
  const corner = row.count < 1 || plateLeft(0, row) >= reach;
  const floor = corner ? PLATE_BOTTOM : f32(plateBandTop(row) + MATCH_CHAT_CLEAR);
  return { left: MATCH_CHAT_LEFT, bottom: f32(floor + CHAT_STYLE.margin), width: MATCH_CHAT_WIDTH, rows: MATCH_CHAT_ROWS };
}

/** Where the chat shows; a match starts with it hidden, so lines from the select screens stay out of the fight until someone writes again, opens the history or starts typing. */
export function chatBox(phase: Phase, row: PlateRow, matchLines = true): ChatBox | ChatSlot | undefined {
  if (phase === Phase.characterMenu || phase === Phase.stageMenu) return SELECT_CHAT_SLOT;
  return matchLines ? matchChatBox(row) : undefined;
}
