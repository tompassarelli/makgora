import { f32 } from "wisp/src/sim/f32";
import type { ChatBox, ChatStyle } from "wisp/src/ui/chatPanel";
import { FRIZ_QUADRATA_WIDTHS, lighten } from "wisp/src/ui/chatLog";
import { Phase } from "../lobby/lobbyState";
import { MENU_FONT, PANEL_TEXTURE } from "./hudLayout";
import { slotColor } from "./slotColors";
import { barTexture } from "../core/selectBarLayout";
import { CHAT_SLOT } from "../core/selectScreenLayout";
import { BAR_COLOURS, BAR_SMALL_TEXT, barText } from "./barFrames";
import { setMenuText } from "./frames";
import { art } from "./selectionFrames";
import { type Frame, TextAlignment } from "wisp/game/frames";

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

const CHAT_PAD = f32(0.008);
const CHAT_HEADING = { x: f32(CHAT_SLOT.left + CHAT_PAD), y: f32(f32(CHAT_SLOT.bottom + CHAT_SLOT.height) - f32(0.006)), width: f32(CHAT_SLOT.width - f32(2 * CHAT_PAD)), height: f32(0.016) } as const;

/** The select screens' chat lines, inside the chat box under its heading. */
export const SELECT_CHAT_BOX: ChatBox = { left: CHAT_HEADING.x, bottom: f32(CHAT_SLOT.bottom + CHAT_PAD), width: CHAT_HEADING.width, rows: 13 };

export const MATCH_CHAT_BOX: ChatBox = { left: f32(0.02), bottom: f32(0.152), width: f32(0.3), rows: 4 };

/** The chat box at the bottom left of the select screens, drawn even before anyone has written. */
export function createChatBox(parent: Frame, name: string): void {
  art(parent, `${name}Panel`, barTexture("Panel", CHAT_SLOT), CHAT_SLOT.left, f32(CHAT_SLOT.bottom + CHAT_SLOT.height), CHAT_SLOT.width, CHAT_SLOT.height);
  setMenuText(barText(parent, `${name}Heading`, CHAT_HEADING, BAR_SMALL_TEXT, TextAlignment.left), `${BAR_COLOURS.dim}Chat|r`);
}

/** Where the chat shows; a match starts with it hidden, so lines from the select screens stay out of the fight until someone writes again or opens the history. */
export function chatBox(phase: Phase, matchLines = true): ChatBox | undefined {
  if (phase === Phase.characterMenu || phase === Phase.stageMenu) return SELECT_CHAT_BOX;
  return matchLines ? MATCH_CHAT_BOX : undefined;
}
