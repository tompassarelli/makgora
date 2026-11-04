import { f32 } from "wisp/src/sim/f32";
import { FRIZ_QUADRATA_WIDTHS, wrapChat } from "wisp/src/ui/chatLog";
import { MENU_FRAME_BAND } from "../core/menuFrame";

export interface PopupBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PopupRow extends PopupBox {
  readonly text: string;
}

/** One info popup laid out on the settings popup's frame: title above the header rail, wrapped body rows between the rails, Close under the footer rail. */
export interface InfoPopupLayout {
  readonly panel: PopupBox;
  readonly title: PopupBox;
  readonly headerRule: number;
  readonly footerRule: number;
  readonly size: number;
  readonly rows: readonly PopupRow[];
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
const SIZE_STEP = f32(0.0005);
const MIN_SIZE = f32(0.007);
const CLOSE_WIDTH = f32(0.16);
const CLOSE_HEIGHT = f32(0.028);
const TITLE_HEIGHT = f32(0.03);

const lineHeight = (size: number): number => f32(size * LINE_SPACING);

function wrapRows(paragraphs: readonly string[], size: number, width: number): readonly (readonly string[])[] {
  const room = f32(width / size);
  return paragraphs.map(paragraph => wrapChat(paragraph, room, room, FRIZ_QUADRATA_WIDTHS));
}

function bodyHeight(wrapped: readonly (readonly string[])[], size: number): number {
  let rows = 0;
  for (const paragraph of wrapped) rows += paragraph.length;
  return f32(f32(rows * lineHeight(size)) + f32(Math.max(0, wrapped.length - 1) * f32(PARAGRAPH_GAP * lineHeight(size))));
}

/** Lays `paragraphs` out inside `panel`, at `size` or the largest smaller font size whose rows all fit between the rails. */
export function infoPopupLayout(panel: PopupBox, paragraphs: readonly string[], size: number, centred: boolean): InfoPopupLayout {
  const inner = f32(panel.height - f32(2 * MENU_FRAME_BAND));
  const backingTop = f32(panel.y - MENU_FRAME_BAND);
  const railY = (fraction: number): number => f32(backingTop - f32(inner * fraction));
  const headerRule = railY(HEADER_RAIL_BOTTOM);
  const footerRule = railY(FOOTER_RAIL_TOP);
  const left = f32(panel.x + SIDE_MARGIN);
  const width = f32(panel.width - f32(2 * SIDE_MARGIN));
  const top = f32(headerRule - RAIL_GAP);
  const room = f32(f32(top - footerRule) - RAIL_GAP);
  let fitted = size;
  let wrapped = wrapRows(paragraphs, fitted, width);
  while (bodyHeight(wrapped, fitted) > room && fitted > MIN_SIZE) {
    fitted = f32(fitted - SIZE_STEP);
    wrapped = wrapRows(paragraphs, fitted, width);
  }
  const line = lineHeight(fitted);
  const rows: PopupRow[] = [];
  let y = centred ? f32(top - f32(f32(room - bodyHeight(wrapped, fitted)) / 2)) : top;
  wrapped.forEach((paragraph, index) => {
    if (index > 0) y = f32(y - f32(PARAGRAPH_GAP * line));
    for (const text of paragraph) {
      rows.push({ ...box(left, y, width, line), text });
      y = f32(y - line);
    }
  });
  const headerTop = railY(HEADER_RAIL_TOP);
  const footerBottom = railY(FOOTER_RAIL_BOTTOM);
  const panelBottom = f32(panel.y - panel.height);
  return {
    panel,
    title: box(left, f32(backingTop - f32(f32(f32(backingTop - headerTop) - TITLE_HEIGHT) / 2)), width, TITLE_HEIGHT),
    headerRule,
    footerRule,
    size: fitted,
    rows,
    close: box(f32(f32(panel.x + f32(panel.width / 2)) - f32(CLOSE_WIDTH / 2)), f32(footerBottom - f32(f32(f32(f32(footerBottom - panelBottom) - MENU_FRAME_BAND) - CLOSE_HEIGHT) / 2)), CLOSE_WIDTH, CLOSE_HEIGHT),
  };
}

export const CREDITS_PANEL = box(f32(0.02), f32(0.59), f32(0.76), f32(0.58));
export const COMMUNITY_PANEL = box(f32(0.18), f32(0.48), f32(0.44), f32(0.36));
