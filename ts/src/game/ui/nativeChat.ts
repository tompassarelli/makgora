import { f32 } from "wisp/src/sim/f32";
import type { ChatBox, ChatStyle } from "wisp/src/ui/chatPanel";
import { FRIZ_QUADRATA_WIDTHS, lighten } from "wisp/src/ui/chatLog";
import { Phase } from "../lobby/lobbyState";
import { MENU_FONT, PANEL_TEXTURE } from "./hudLayout";
import { slotColor } from "./slotColors";

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
  recentSeconds: f32(14.0),
  fadeSeconds: f32(3.0),
  colour: slot => lighten(slotColor(slot).rgb, 45),
  ignore: text => text.startsWith("-"),
};

export const CHARACTER_SELECT_CHAT_BOX: ChatBox = { left: f32(0.02), bottom: f32(0.22), width: f32(0.22), rows: 8 };
export const STAGE_SELECT_CHAT_BOX: ChatBox = { left: f32(0.02), bottom: f32(0.22), width: f32(0.3), rows: 8 };
export const MATCH_CHAT_BOX: ChatBox = { left: f32(0.02), bottom: f32(0.152), width: f32(0.3), rows: 4 };

export function chatBox(phase: Phase): ChatBox {
  if (phase === Phase.characterMenu) return CHARACTER_SELECT_CHAT_BOX;
  if (phase === Phase.stageMenu) return STAGE_SELECT_CHAT_BOX;
  return MATCH_CHAT_BOX;
}
