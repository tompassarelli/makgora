import { MENU_FONT } from "./hudLayout";
import { createText, placeTopLeft } from "./frames";
import { createFrame, Frame, setFrameEnabled, setFrameFont, setFrameSize, setFrameText, setFrameTextAlignment, TextAlignment } from "wisp/game/frames";

export function panelText(parent: Frame, name: string, x: number, y: number, width: number, height: number, size: number, vertical: TextAlignment, horizontal: TextAlignment): Frame {
  const frame = createText(name, parent, 0);
  placeTopLeft(frame, x, y);
  setFrameSize(frame, width, height);
  setFrameFont(frame, MENU_FONT, size, 0);
  setFrameTextAlignment(frame, vertical, horizontal);
  setFrameEnabled(frame, false);
  return frame;
}

export function panelButton(parent: Frame, x: number, y: number, width: number, height: number, label: string): Frame {
  const frame = createFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(frame, x, y);
  setFrameSize(frame, width, height);
  setFrameText(frame, label);
  return frame;
}
