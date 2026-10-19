import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { createBackdrop, createText, gameUi } from "./frames";
import { MENU_FONT, PANEL_TEXTURE, type TextBox } from "./hudLayout";
import { slotColor } from "./slotColors";

export const CHAT_LINES = 4;
export const CHAT_SECONDS = 30.0;
export const SELECT_CHAT_BOX: TextBox = { left: f32(0.558), top: f32(0.05), width: f32(0.232), height: f32(0.042) };
export const MATCH_CHAT_BOX: TextBox = { left: f32(0.02), top: f32(0.17), width: f32(0.28), height: f32(0.042) };
const CHAT_FONT = f32(0.0095);
const PANEL_MARGIN = f32(0.003);

interface ChatLine {
  readonly text: string;
  seconds: number;
}

export interface ChatLog {
  readonly lines: ChatLine[];
  revision: number;
}

export const createChatLog = (): ChatLog => ({ lines: [], revision: 0 });

const HEX = "0123456789abcdef";
const hexByte = (value: number) => `${HEX.charAt(idiv(value, 16))}${HEX.charAt(imod(value, 16))}`;

export function chatName(name: string): string {
  const tag = name.indexOf("#");
  return tag > 0 ? name.substring(0, tag) : name;
}

export function addChat(log: ChatLog, slot: number, name: string, message: string): void {
  const rgb = slotColor(slot).rgb;
  const colour = `|cff${hexByte(idiv(rgb, 65536))}${hexByte(imod(idiv(rgb, 256), 256))}${hexByte(imod(rgb, 256))}`;
  log.lines.push({ text: `${colour}${chatName(name)}|r: ${message}`, seconds: CHAT_SECONDS });
  while (log.lines.length > CHAT_LINES) log.lines.shift();
  log.revision++;
}

export function ageChat(log: ChatLog, seconds: number): void {
  for (const line of log.lines) line.seconds = f32(line.seconds - seconds);
  const before = log.lines.length;
  while (log.lines.length > 0 && (log.lines[0]?.seconds ?? 0.0) <= 0.0) log.lines.shift();
  if (log.lines.length !== before) log.revision++;
}

export const chatText = (log: Readonly<ChatLog>): string => log.lines.map(line => line.text).join("\n");

export class ChatPanel {
  private readonly panel: framehandle;
  private readonly label: framehandle;
  private revision = -1;
  private shown = false;
  private box: TextBox | undefined;

  constructor() {
    this.panel = createBackdrop("MeleeChatPanel", gameUi(), 0);
    BlzFrameSetTexture(this.panel, PANEL_TEXTURE, 0, true);
    BlzFrameSetAlpha(this.panel, 204);
    BlzFrameSetLevel(this.panel, 25);
    BlzFrameSetEnable(this.panel, false);
    BlzFrameSetVisible(this.panel, false);
    this.label = createText("MeleeChat", this.panel, 0);
    BlzFrameSetFont(this.label, MENU_FONT, CHAT_FONT, 0);
    BlzFrameSetTextAlignment(this.label, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.label, false);
    BlzFrameSetPoint(this.panel, FRAMEPOINT_TOPLEFT, this.label, FRAMEPOINT_TOPLEFT, f32(-PANEL_MARGIN), PANEL_MARGIN);
    BlzFrameSetPoint(this.panel, FRAMEPOINT_BOTTOMRIGHT, this.label, FRAMEPOINT_BOTTOMRIGHT, PANEL_MARGIN, f32(-PANEL_MARGIN));
  }

  update(visible: boolean, box: TextBox, log: Readonly<ChatLog>): void {
    if (this.box !== box) {
      this.box = box;
      BlzFrameClearAllPoints(this.label);
      BlzFrameSetAbsPoint(this.label, FRAMEPOINT_BOTTOMLEFT, box.left, f32(box.top - box.height));
      BlzFrameSetSize(this.label, box.width, 0.0);
    }
    if (this.revision !== log.revision) {
      this.revision = log.revision;
      BlzFrameSetText(this.label, chatText(log));
    }
    const shown = visible && log.lines.length > 0;
    if (shown === this.shown) return;
    this.shown = shown;
    BlzFrameSetVisible(this.panel, shown);
  }
}
