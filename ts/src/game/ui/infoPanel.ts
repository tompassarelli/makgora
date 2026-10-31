import { MENU_FONT } from "./hudLayout";
import { createText, placeTopLeft } from "./frames";
import { createFrame, setFrameEnabled, setFrameFont, setFrameSize, setFrameText, setFrameTextAlignment } from "wisp/game/frames";

export function panelText(parent: framehandle, name: string, x: number, y: number, width: number, height: number, size: number, vertical: textaligntype, horizontal: textaligntype): framehandle {
  const frame = createText(name, parent, 0);
  placeTopLeft(frame, x, y);
  setFrameSize(frame, width, height);
  setFrameFont(frame, MENU_FONT, size, 0);
  setFrameTextAlignment(frame, vertical, horizontal);
  setFrameEnabled(frame, false);
  return frame;
}

export function panelButton(parent: framehandle, x: number, y: number, width: number, height: number, label: string): framehandle {
  const frame = createFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(frame, x, y);
  setFrameSize(frame, width, height);
  setFrameText(frame, label);
  return frame;
}
