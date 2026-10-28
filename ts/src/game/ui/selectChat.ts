import { f32 } from "wisp/src/sim/f32";
import { CHAT_LEVELS } from "./chatLayer";
import { MENU_STYLE } from "./hudLayout";
import { consoleUi, createText, placeTopLeft, sizeText } from "./frames";

export const SELECT_CHAT_LINES = 5;
const BOX = { left: f32(0.01), top: f32(0.46), width: f32(0.32), height: f32(0.08) } as const;
const SIZE = f32(0.011);

export function appendChatLine(lines: readonly string[], sender: string, message: string): string[] {
  const line = `${MENU_STYLE.gold}${sender}:|r ${message.split("|").join("||")}`;
  return [...lines, line].slice(-SELECT_CHAT_LINES);
}

// The engine's own chat text is not drawn while select frames are open, so select draws the last lines itself.
export class SelectChat {
  private lines: string[] = [];
  private frame: framehandle | undefined;
  private shownText: string | undefined;
  private shownVisible = false;

  push(sender: string, message: string): void {
    this.lines = appendChatLine(this.lines, sender, message);
  }

  update(selecting: boolean): void {
    if (!selecting && this.frame === undefined) return;
    const frame = this.frame ?? this.create();
    const text = this.lines.join("\n");
    if (this.shownText !== text) {
      this.shownText = text;
      BlzFrameSetText(frame, text);
    }
    const visible = selecting && this.lines.length > 0;
    if (this.shownVisible !== visible) {
      this.shownVisible = visible;
      BlzFrameSetVisible(frame, visible);
    }
  }

  private create(): framehandle {
    const frame = createText("SelectChatLines", consoleUi(), 900);
    sizeText(frame, SIZE, BOX.width, BOX.height);
    placeTopLeft(frame, BOX.left, BOX.top);
    BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
    BlzFrameSetLevel(frame, CHAT_LEVELS.select);
    BlzFrameSetVisible(frame, false);
    this.frame = frame;
    return frame;
  }
}
