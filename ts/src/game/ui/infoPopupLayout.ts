import { f32 } from "wisp/src/sim/f32";
import { FRIZ_QUADRATA_WIDTHS, wrapChat } from "wisp/src/ui/chatLog";
import { MENU_FRAME_BAND } from "../core/menuFrame";

export interface PopupBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A wrapped body line: `drop` is how far its top lies below the first line's top, paragraph gaps included. */
export interface PopupLine {
  readonly text: string;
  readonly drop: number;
}

/** One info popup laid out on the settings popup's frame: title above the header rail, wrapped body lines between the rails (a window of them shows, scrolled by first line), Close under the footer rail. */
export interface InfoPopupLayout {
  readonly panel: PopupBox;
  readonly title: PopupBox;
  readonly headerRule: number;
  readonly footerRule: number;
  readonly size: number;
  readonly left: number;
  readonly width: number;
  readonly lineHeight: number;
  readonly lines: readonly PopupLine[];
  readonly slots: number;
  readonly maxFirst: number;
  readonly bodyTop: number;
  readonly room: number;
  readonly inset: number;
  readonly close: PopupBox;
}

const box = (x: number, y: number, width: number, height: number): PopupBox => ({ x: f32(x), y: f32(y), width: f32(width), height: f32(height) });

// MENU_STYLE.panelTexture draws a silver rail at 18-20% and 92-93% of its height (see settingsUi.ts).
const HEADER_RAIL_TOP = f32(0.18);
const HEADER_RAIL_BOTTOM = f32(0.2);
const FOOTER_RAIL_TOP = f32(0.92);
const FOOTER_RAIL_BOTTOM = f32(0.93);
const SIDE_MARGIN = f32(0.025);
const RAIL_GAP = f32(0.008);
const LINE_SPACING = f32(1.4);
const PARAGRAPH_GAP = f32(0.5);
const CLOSE_WIDTH = f32(0.16);
const CLOSE_HEIGHT = f32(0.028);
const TITLE_HEIGHT = f32(0.03);

const lineHeight = (size: number): number => f32(size * LINE_SPACING);

function wrapLines(paragraphs: readonly string[], size: number, width: number): PopupLine[] {
  const room = f32(width / size);
  const step = lineHeight(size);
  const lines: PopupLine[] = [];
  let drop = 0;
  paragraphs.forEach((paragraph, index) => {
    if (index > 0) drop = f32(drop + f32(PARAGRAPH_GAP * step));
    for (const text of wrapChat(paragraph, room, room, FRIZ_QUADRATA_WIDTHS)) {
      lines.push({ text, drop });
      drop = f32(drop + step);
    }
  });
  return lines;
}

/** How many lines show from line `first` down: those that end within `room` of the first line's top. */
export function windowCount(layout: Pick<InfoPopupLayout, "lines" | "lineHeight" | "room">, first: number): number {
  const { lines } = layout;
  const origin = lines[first]?.drop ?? 0;
  let count = 0;
  for (let index = first; index < lines.length; index++) {
    const line = lines[index];
    if (line === undefined || f32(f32(line.drop - origin) + layout.lineHeight) > layout.room) break;
    count++;
  }
  return count;
}

/** The top edge of line `index` while line `first` leads the window. */
export const windowY = (layout: InfoPopupLayout, first: number, index: number): number =>
  f32(f32(layout.bodyTop - layout.inset) - f32((layout.lines[index]?.drop ?? 0) - (layout.lines[first]?.drop ?? 0)));

/** Lays `paragraphs` out inside `panel` at `size`; a body taller than the space between the rails scrolls, one that fits is centred when `centred`. */
export function infoPopupLayout(panel: PopupBox, paragraphs: readonly string[], size: number, centred: boolean): InfoPopupLayout {
  const inner = f32(panel.height - f32(2 * MENU_FRAME_BAND));
  const backingTop = f32(panel.y - MENU_FRAME_BAND);
  const railY = (fraction: number): number => f32(backingTop - f32(inner * fraction));
  const headerRule = railY(HEADER_RAIL_BOTTOM);
  const footerRule = railY(FOOTER_RAIL_TOP);
  const left = f32(panel.x + SIDE_MARGIN);
  const width = f32(panel.width - f32(2 * SIDE_MARGIN));
  const bodyTop = f32(headerRule - RAIL_GAP);
  const room = f32(f32(bodyTop - footerRule) - RAIL_GAP);
  const line = lineHeight(size);
  const lines = wrapLines(paragraphs, size, width);
  const last = lines[lines.length - 1];
  const height = last === undefined ? 0 : f32(last.drop + line);
  const base = { panel, headerRule, footerRule, size, left, width, lineHeight: line, lines, bodyTop, room } as const;
  let slots = 0;
  let maxFirst = 0;
  for (let first = 0; first < lines.length; first++) {
    const count = windowCount(base, first);
    slots = Math.max(slots, count);
    if (first + count >= lines.length) {
      maxFirst = first;
      break;
    }
  }
  const headerTop = railY(HEADER_RAIL_TOP);
  const footerBottom = railY(FOOTER_RAIL_BOTTOM);
  const panelBottom = f32(panel.y - panel.height);
  return {
    ...base,
    slots,
    maxFirst,
    inset: centred && maxFirst === 0 ? f32(f32(room - height) / 2) : 0,
    title: box(left, f32(backingTop - f32(f32(f32(backingTop - headerTop) - TITLE_HEIGHT) / 2)), width, TITLE_HEIGHT),
    close: box(f32(f32(panel.x + f32(panel.width / 2)) - f32(CLOSE_WIDTH / 2)), f32(footerBottom - f32(f32(f32(f32(footerBottom - panelBottom) - MENU_FRAME_BAND) - CLOSE_HEIGHT) / 2)), CLOSE_WIDTH, CLOSE_HEIGHT),
  };
}

export const INFO_POPUP_SIZE = f32(0.0135);
export const CREDITS_PANEL = box(f32(0.02), f32(0.59), f32(0.76), f32(0.58));
export const COMMUNITY_PANEL = box(f32(0.18), f32(0.48), f32(0.44), f32(0.36));
