import { f32 } from "wisp/src/sim/f32";
import type { ChatBox, ChatStyle } from "wisp/src/ui/chatPanel";
import { Phase } from "../lobby/lobbyState";
import { MENU_FONT, MENU_STYLE } from "./hudLayout";
import { slotColor } from "./slotColors";

export const CHAT_STYLE: ChatStyle = {
  name: "SmashcraftChat",
  font: MENU_FONT,
  fontSize: f32(0.0095),
  rowHeight: f32(0.0125),
  glyphWidth: f32(0.5),
  margin: f32(0.004),
  panelTexture: MENU_STYLE.panelTexture,
  panelAlpha: 200,
  level: 400,
  capacity: 100,
  historyRows: 16,
  recentSeconds: f32(14.0),
  fadeSeconds: f32(3.0),
  colour: slot => slotColor(slot).rgb,
  ignore: text => text.startsWith("-"),
};

export const CHARACTER_SELECT_CHAT_BOX: ChatBox = { left: f32(0.02), bottom: f32(0.22), width: f32(0.22), rows: 8 };
export const STAGE_SELECT_CHAT_BOX: ChatBox = { left: f32(0.02), bottom: f32(0.22), width: f32(0.3), rows: 8 };
export const MATCH_CHAT_BOX: ChatBox = { left: f32(0.02), bottom: f32(0.13), width: f32(0.3), rows: 4 };

export function chatBox(phase: Phase): ChatBox {
  if (phase === Phase.characterMenu) return CHARACTER_SELECT_CHAT_BOX;
  if (phase === Phase.stageMenu) return STAGE_SELECT_CHAT_BOX;
  return MATCH_CHAT_BOX;
}
