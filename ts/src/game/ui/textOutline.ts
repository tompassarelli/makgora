import { f32 } from "wisp/src/sim/f32";
import { unitsForPixels } from "./portraitFrames";
import { createText } from "./frames";
import { clearFramePoints, createFrame, destroyFrame, Frame, FramePoint, setFrameEnabled, setFrameFont, setFrameLevel, setFramePoint, setFrameScale, setFrameText, setFrameTextAlignment, setFrameVisible, TextAlignment } from "wisp/game/frames";
import { formatInt } from "wisp/game/text";

const OFFSETS = [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const;


export function createOutline(name: string, owner: Frame, context: number, font: string, size: number, level: number): readonly Frame[] {
  return OFFSETS.map((_, index) => {
    const copy = createText(`${name}Outline${formatInt(index)}`, owner, context);
    setFrameFont(copy, font, size, 0);
    setFrameEnabled(copy, false);
    setFrameLevel(copy, level);
    return copy;
  });
}


export function createTemplateOutline(template: string, owner: Frame, context: number, level: number, scale: number): readonly Frame[] {
  return OFFSETS.map(() => {
    const copy = createFrame(template, owner, 0, context);
    setFrameScale(copy, scale);
    setFrameEnabled(copy, false);
    setFrameLevel(copy, level);
    return copy;
  });
}


export function attachOutline(outline: readonly Frame[], source: Frame, pixels: number, vertical: TextAlignment, horizontal: TextAlignment): void {
  const step = unitsForPixels(pixels);
  outline.forEach((copy, index) => {
    const [x, y] = OFFSETS[index] ?? [0, 0];
    clearFramePoints(copy);
    setFramePoint(copy, FramePoint.topLeft, source, FramePoint.topLeft, f32(x * step), f32(y * step));
    setFramePoint(copy, FramePoint.bottomRight, source, FramePoint.bottomRight, f32(x * step), f32(y * step));
    setFrameTextAlignment(copy, vertical, horizontal);
  });
}

export function setOutlineText(outline: readonly Frame[], text: string): void {
  for (const copy of outline) setFrameText(copy, text);
}

export function showOutline(outline: readonly Frame[], visible: boolean): void {
  for (const copy of outline) setFrameVisible(copy, visible);
}

export function destroyOutline(outline: readonly Frame[]): void {
  for (const copy of outline) destroyFrame(copy);
}
