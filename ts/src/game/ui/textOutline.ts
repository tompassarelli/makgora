import { f32 } from "wisp/src/sim/f32";
import { unitsForPixels } from "./portraitFrames";
import { createText } from "./frames";

const OFFSETS = [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const;


export function createOutline(name: string, owner: framehandle, context: number, font: string, size: number, level: number): readonly framehandle[] {
  return OFFSETS.map((_, index) => {
    const copy = createText(`${name}Outline${I2S(index)}`, owner, context);
    BlzFrameSetFont(copy, font, size, 0);
    BlzFrameSetEnable(copy, false);
    BlzFrameSetLevel(copy, level);
    return copy;
  });
}


export function createTemplateOutline(template: string, owner: framehandle, context: number, level: number, scale: number): readonly framehandle[] {
  return OFFSETS.map(() => {
    const copy = BlzCreateFrame(template, owner, 0, context);
    BlzFrameSetScale(copy, scale);
    BlzFrameSetEnable(copy, false);
    BlzFrameSetLevel(copy, level);
    return copy;
  });
}


export function attachOutline(outline: readonly framehandle[], source: framehandle, pixels: number, vertical: textaligntype, horizontal: textaligntype): void {
  const step = unitsForPixels(pixels);
  outline.forEach((copy, index) => {
    const [x, y] = OFFSETS[index] ?? [0, 0];
    BlzFrameClearAllPoints(copy);
    BlzFrameSetPoint(copy, FRAMEPOINT_TOPLEFT, source, FRAMEPOINT_TOPLEFT, f32(x * step), f32(y * step));
    BlzFrameSetPoint(copy, FRAMEPOINT_BOTTOMRIGHT, source, FRAMEPOINT_BOTTOMRIGHT, f32(x * step), f32(y * step));
    BlzFrameSetTextAlignment(copy, vertical, horizontal);
  });
}

export function setOutlineText(outline: readonly framehandle[], text: string): void {
  for (const copy of outline) BlzFrameSetText(copy, text);
}

export function showOutline(outline: readonly framehandle[], visible: boolean): void {
  for (const copy of outline) BlzFrameSetVisible(copy, visible);
}

export function destroyOutline(outline: readonly framehandle[]): void {
  for (const copy of outline) BlzDestroyFrame(copy);
}
