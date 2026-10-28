import { MENU_FONT } from "./hudLayout";
import { createText, placeTopLeft } from "./frames";

export function panelText(parent: framehandle, name: string, x: number, y: number, width: number, height: number, size: number, vertical: textaligntype, horizontal: textaligntype): framehandle {
  const frame = createText(name, parent, 0);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetFont(frame, MENU_FONT, size, 0);
  BlzFrameSetTextAlignment(frame, vertical, horizontal);
  BlzFrameSetEnable(frame, false);
  return frame;
}

export function panelButton(parent: framehandle, x: number, y: number, width: number, height: number, label: string): framehandle {
  const frame = BlzCreateFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetText(frame, label);
  return frame;
}
