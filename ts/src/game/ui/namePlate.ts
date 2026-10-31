import { f32 } from "wisp/src/sim/f32";
import { FRIZ_QUADRATA_WIDTHS, textWidth, wrapChat } from "wisp/src/ui/chatLog";
import { Frame, setFrameFont, setFrameSize } from "wisp/game/frames";
import { cardRight, cardDown, cardSize } from "../menu/selectionDrag";
import { MENU_STYLE, NATIVE_TEXT_BASE } from "./hudLayout";
import { placeTopLeft } from "./frames";

/** Room for the name on a selection card, in font sizes of Friz Quadrata: Anub'arak (5.9) fits on one line and Mrgl & Grgl (6.5) wraps, in Tom's native screenshots (2026-11-01). */
export const NAME_PLATE_EMS = f32(6.2);
export const NAME_SHRINK_STEP = f32(0.05);
export const NAME_STEPS = 6;
export const NAME_ONE_LINE_STEPS = 3;

export const NAME_SIZE = cardSize(f32(0.011));
export const NAME_WIDTH = cardSize(f32(0.144));
export const NAME_HEIGHT = cardSize(f32(0.019));
export const NAME_TWO_LINE_HEIGHT = f32(NAME_HEIGHT * f32(1.6));

export interface FittedName {
  readonly text: string;
  readonly shrink: number;
  readonly lines: number;
}

function rowsAt(name: string, shrink: number): string[] {
  const room = f32(NAME_PLATE_EMS / shrink);
  return wrapChat(name, room, room, FRIZ_QUADRATA_WIDTHS);
}

export const shrinkAt = (step: number): number => f32(1.0 - f32(step * NAME_SHRINK_STEP));

/** The name as the plate shows it: one line at the card's font, else one line shrunk to at most 15% smaller, else two lines at the largest font that holds them, the font never below 70%. */
export function fitName(name: string): FittedName {
  for (let step = 0; step <= NAME_ONE_LINE_STEPS; step++) {
    const rows = rowsAt(name, shrinkAt(step));
    if (rows.length === 1) return { text: name, shrink: shrinkAt(step), lines: 1 };
  }
  for (let step = 0; step <= NAME_STEPS; step++) {
    const rows = rowsAt(name, shrinkAt(step));
    if (rows.length <= 2) return { text: rows.join("\n"), shrink: shrinkAt(step), lines: rows.length };
  }
  const floor = shrinkAt(NAME_STEPS);
  return { text: rowsAt(name, floor).slice(0, 2).join("\n"), shrink: floor, lines: 2 };
}

/** The widest row of the fitted name, in font sizes at the fitted font. */
export function fittedWidth(fitted: FittedName): number {
  let widest = 0.0;
  for (const row of fitted.text.split("\n")) widest = Math.max(widest, textWidth(row, FRIZ_QUADRATA_WIDTHS));
  return f32(widest * fitted.shrink);
}

/** Lays the card's name label out for a fitted name: the font shrinks, and a two-line name takes a taller box about the same centre. */
export function placeName(frame: Frame, slot: number, fitted: FittedName): void {
  const scale = f32(NAME_SIZE / NATIVE_TEXT_BASE);
  const height = fitted.lines > 1 ? NAME_TWO_LINE_HEIGHT : NAME_HEIGHT;
  placeTopLeft(frame, cardRight(slot, f32(0.008)), f32(cardDown(f32(0.173)) + f32(f32(height - NAME_HEIGHT) / 2)));
  setFrameSize(frame, f32(NAME_WIDTH / scale), f32(height / scale));
  setFrameFont(frame, MENU_STYLE.font, f32(NAME_SIZE * fitted.shrink), 0);
}
