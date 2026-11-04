import { f32 } from "wisp/src/sim/f32";
import { createText, frameMenuPanel, placeTopLeft, sizeText } from "./frames";
import { type InfoPopupLayout, type PopupBox, windowCount, windowY } from "./infoPopupLayout";
import { SELECT_LEVELS } from "./selectLevels";
import { createFrame, createFrameByType, Frame, setFrameEnabled, setFrameLevel, setFrameSize, setFrameText, setFrameTextAlignment, TextAlignment } from "wisp/game/frames";
import { formatInt } from "wisp/game/text";

export function panelText(parent: Frame, name: string, x: number, y: number, width: number, height: number, size: number, vertical: TextAlignment, horizontal: TextAlignment): Frame {
  const frame = createText(name, parent, 0);
  placeTopLeft(frame, x, y);
  sizeText(frame, size, width, height);
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

/** The body rows of an info popup, made once: `showFrom` moves them and sets their text so line `first` leads. */
export class InfoPopupBody {
  constructor(private readonly layout: InfoPopupLayout, private readonly rows: readonly Frame[]) {}

  showFrom(first: number): void {
    const { layout } = this;
    const count = windowCount(layout, first);
    this.rows.forEach((row, slot) => {
      const line = layout.lines[first + slot];
      if (slot >= count || line === undefined) {
        setFrameText(row, "");
        return;
      }
      placeTopLeft(row, layout.left, windowY(layout, first, first + slot));
      setFrameText(row, line.text);
    });
  }
}

export interface InfoPopupFrames {
  readonly root: Frame;
  readonly close: Frame;
  readonly wheel: Frame;
  readonly body: InfoPopupBody;
}

const TITLE_SIZE = f32(0.022);

const boxText = (parent: Frame, name: string, b: PopupBox, size: number, horizontal: TextAlignment, text: string, level: number): Frame => {
  const frame = panelText(parent, name, b.x, b.y, b.width, b.height, size, TextAlignment.middle, horizontal);
  setFrameLevel(frame, level);
  setFrameText(frame, text);
  return frame;
};

// Engine: Warcraft routes a mouse wheel only to a mouse-enabled frame type under the cursor, never to a plain FRAME or a BACKDROP, so an invisible BUTTON covers the panel to carry the wheel registration.
function wheelCatcher(parent: Frame, name: string, panel: PopupBox, level: number): Frame {
  const frame = createFrameByType("BUTTON", `${name}Wheel`, parent, "", 0);
  placeTopLeft(frame, panel.x, panel.y);
  setFrameSize(frame, panel.width, panel.height);
  setFrameLevel(frame, level);
  return frame;
}

/** An info popup on the settings popup's frame, at the modal level above the select screen and its chat box. Its body rows are made once. */
export function infoPopup(owner: Frame, name: string, layout: InfoPopupLayout, title: string, centred: boolean): InfoPopupFrames {
  const level = SELECT_LEVELS.modal;
  const root = createFrameByType("FRAME", name, owner, "", 0);
  frameMenuPanel(root, name, 0, level);
  placeTopLeft(root, layout.panel.x, layout.panel.y);
  setFrameSize(root, layout.panel.width, layout.panel.height);
  setFrameLevel(root, level);
  boxText(root, `${name}Title`, layout.title, TITLE_SIZE, TextAlignment.center, title, level + 1);
  const rows: Frame[] = [];
  for (let slot = 0; slot < layout.slots; slot++) rows.push(boxText(root, `${name}Row${formatInt(slot)}`, { x: layout.left, y: layout.bodyTop, width: layout.width, height: layout.lineHeight }, layout.size, centred ? TextAlignment.center : TextAlignment.left, "", level + 1));
  const body = new InfoPopupBody(layout, rows);
  const wheel = wheelCatcher(root, name, layout.panel, level + 1);
  body.showFrom(0);
  const { close } = layout;
  const button = panelButton(root, close.x, close.y, close.width, close.height, "Close");
  setFrameLevel(button, level + 2);
  return { root, close: button, wheel, body };
}
