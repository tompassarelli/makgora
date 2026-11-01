import { f32 } from "wisp/src/sim/f32";
import { type BarArtStyle, type BarBox, barTexture } from "../core/selectBarLayout";
import { placeTopLeft, setMenuText } from "./frames";
import { art, label } from "./selectionFrames";
import { createFrameByType, Frame, setFrameEnabled, setFrameSize, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";

export const BAR_TEXT = f32(0.0105);
export const BAR_SMALL_TEXT = f32(0.0085);
export const BAR_COLOURS = { gold: "|cffffcc00", cream: "|cffeee4cc", dim: "|cff8c95a3", sky: "|cff8fd3ff", red: "|cffff4040" } as const;

/** One framed box: its art, its text and, when it can be pressed, an invisible button over both. */
export interface BarControl {
  readonly box: BarBox;
  readonly frame: Frame;
  readonly text: Frame;
  readonly button: Frame | undefined;
  readonly rest: BarArtStyle;
  style: BarArtStyle;
  shown: string;
}

export function barText(parent: Frame, name: string, b: BarBox, size: number, align: TextAlignment = TextAlignment.center): Frame {
  const frame = label(parent, name, b.x, b.y, b.width, b.height, size);
  setFrameTextAlignment(frame, TextAlignment.middle, align);
  return frame;
}

export function clickArea(parent: Frame, name: string, b: BarBox): Frame {
  const button = createFrameByType("BUTTON", name, parent, "", 0);
  placeTopLeft(button, b.x, b.y);
  setFrameSize(button, b.width, b.height);
  return button;
}

export function barControl(parent: Frame, name: string, b: BarBox, rest: BarArtStyle, size = BAR_TEXT, pressable = true, align: TextAlignment = TextAlignment.center): BarControl {
  const frame = art(parent, `${name}Art`, barTexture(rest, b), b.x, b.y, b.width, b.height);
  const inset = align === TextAlignment.center ? 0 : f32(0.008);
  const text = barText(parent, `${name}Text`, { x: f32(b.x + inset), y: b.y, width: f32(b.width - f32(2 * inset)), height: b.height }, size, align);
  return { box: b, frame, text, button: pressable ? clickArea(parent, `${name}Button`, b) : undefined, rest, style: rest, shown: "" };
}

export function styleControl(control: BarControl, style: BarArtStyle): void {
  if (style === control.style) return;
  control.style = style;
  setFrameTexture(control.frame, barTexture(style, control.box), 0, true);
}

export function litControl(control: BarControl, lit: boolean): void {
  styleControl(control, lit ? "Lit" : control.rest);
}

export function labelControl(control: BarControl, text: string): void {
  if (text === control.shown) return;
  control.shown = text;
  setMenuText(control.text, text);
}

export function showControl(control: BarControl, shown: boolean): void {
  setFrameVisible(control.frame, shown);
  setFrameVisible(control.text, shown);
  if (control.button !== undefined) setFrameVisible(control.button, shown);
}

export function enableControl(control: BarControl, enabled: boolean): void {
  if (control.button !== undefined) setFrameEnabled(control.button, enabled);
}
