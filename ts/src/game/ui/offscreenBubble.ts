

import { f32 } from "wisp/src/sim/f32";
import { createBackdrop, createText, consoleUi } from "./frames";
import { MENU_FONT } from "./hudLayout";
import { Character } from "../sim/codes";
import { fighterPortrait } from "../roster/looks";
import { OFFSCREEN_PORTRAIT } from "./portraitFrames";

function bubblePosition(column: number, row: number): { readonly column: number; readonly row: number; readonly arrow: string } {
  const dx = column - 0.5;
  const dy = row - 0.5;

  const extent = Math.max(Math.abs(dx) / f32(252.6999969482422 / 640.0), Math.abs(dy) / f32(162.6999969482422 / 480.0));
  const scale = 1.0 / Math.max(1.0, extent);
  const arrow = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? ">" : "<" : dy > 0 ? "v" : "^";
  return { column: 0.5 + dx * scale, row: Math.min(f32(0.69), 0.5 + dy * scale), arrow };
}

import { Frame, FramePoint, setFrameAbsPoint, setFrameEnabled, setFrameFont, setFrameLevel, setFrameSize, setFrameText, setFrameTexture, setFrameVisible } from "wisp/game/frames";
import { formatInt } from "wisp/game/text";

const PARTNER_BUBBLE_SCALE = f32(0.75);

export class OffscreenBubble {
  private readonly portrait: Frame;
  private readonly arrow: Frame;
  private visible = false;
  private character: Character | undefined;
  private color: number | undefined;
  private costume = 0;
  private partner: boolean | undefined;

  constructor(slot: number) {

    const parent = consoleUi();
    this.portrait = createBackdrop(`OffscreenPortrait${formatInt(slot)}`, parent, 920 + slot * 2);
    this.arrow = createText(`OffscreenArrow${formatInt(slot)}`, parent, 921 + slot * 2);
    setFrameSize(this.portrait, OFFSCREEN_PORTRAIT, OFFSCREEN_PORTRAIT);
    setFrameSize(this.arrow, f32(0.027), f32(0.027));
    setFrameFont(this.arrow, MENU_FONT, f32(0.021), 0);
    for (const frame of [this.portrait, this.arrow]) {
      setFrameEnabled(frame, false);
      setFrameVisible(frame, false);
      setFrameLevel(frame, 10);
    }
  }

  update(visible: boolean, character: Character, color: number, column: number, row: number, aspect: number, costume = 0, partner = false): void {
    if (visible !== this.visible) {
      this.visible = visible;
      setFrameVisible(this.portrait, visible);
      setFrameVisible(this.arrow, visible);
    }
    if (!visible) return;
    if (this.partner !== partner) {
      this.partner = partner;
      const scale = partner ? PARTNER_BUBBLE_SCALE : 1.0;
      setFrameSize(this.portrait, OFFSCREEN_PORTRAIT * scale, OFFSCREEN_PORTRAIT * scale);
      setFrameSize(this.arrow, f32(0.027) * scale, f32(0.027) * scale);
      setFrameFont(this.arrow, MENU_FONT, f32(0.021) * scale, 0);
    }
    if (this.character !== character || this.color !== color) {
      this.character = character;
      this.color = color;
      setFrameTexture(this.portrait, fighterPortrait(character, "Tile", color, costume), 0, true);
    }
    const position = bubblePosition(column, row);
    const x = f32(0.4) + (position.column - 0.5) * aspect * f32(0.6);
    const y = (1.0 - position.row) * f32(0.6);
    setFrameAbsPoint(this.portrait, FramePoint.center, x, y);
    const reach = partner ? f32(0.032) * PARTNER_BUBBLE_SCALE : f32(0.032);
    const arrowX = Math.abs(column - 0.5) > Math.abs(row - 0.5) ? (column > 0.5 ? reach : -reach) : 0.0;
    const arrowY = arrowX === 0 ? (row > 0.5 ? -reach : reach) : 0.0;
    setFrameAbsPoint(this.arrow, FramePoint.center, x + arrowX, y + arrowY);
    setFrameText(this.arrow, position.arrow);
  }
}
