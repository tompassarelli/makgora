import { f32 } from "wisp/src/sim/f32";
import type { ChatBox, ChatSlot, ChatStyle } from "wisp/src/ui/chatPanel";
import { FRIZ_QUADRATA_WIDTHS, lighten } from "wisp/src/ui/chatLog";
import { Phase } from "../lobby/lobbyState";
import { MENU_FONT, PANEL_TEXTURE } from "./hudLayout";
import { slotColor } from "./slotColors";
import { barTexture } from "../core/selectBarLayout";
import { CHAT_SLOT } from "../core/selectScreenLayout";
import { BAR_COLOURS, BAR_SMALL_TEXT } from "./barFrames";

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
  frame: {
    panelTexture: barTexture("Panel", CHAT_SLOT),
    title: `${BAR_COLOURS.cream}Chat|r`,
    titleFontSize: BAR_SMALL_TEXT,
    titleTexture: "ReplaceableTextures\\TeamColor\\TeamColor03.blp",
    titleAlpha: 120,
    barTexture: "ReplaceableTextures\\TeamColor\\TeamColor08.blp",
    fieldTexture: PANEL_TEXTURE,
    placeholder: "Type your chat here",
    placeholderColour: 0x8c95a3,
  },
};

/** The select screens' framed chat box fills the chat slot at the bottom left, beside the fighter cards, on character and stage select alike. */
export const SELECT_CHAT_SLOT: ChatSlot = CHAT_SLOT;

export const MATCH_CHAT_BOX: ChatBox = { left: f32(0.02), bottom: f32(0.152), width: f32(0.3), rows: 4 };

/** Where the chat shows; a match starts with it hidden, so lines from the select screens stay out of the fight until someone writes again or opens the history. */
export function chatBox(phase: Phase, matchLines = true): ChatBox | ChatSlot | undefined {
  if (phase === Phase.characterMenu || phase === Phase.stageMenu) return SELECT_CHAT_SLOT;
  return matchLines ? MATCH_CHAT_BOX : undefined;
}
