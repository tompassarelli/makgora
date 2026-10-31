


import { f32 } from "wisp/src/sim/f32";
import { ESCAPE_METER_BORDER, ESCAPE_METER_HEIGHT, ESCAPE_METER_SEGMENTS, type EscapeMeterView, escapeMeterFill } from "../presentation/escapeMeter";
import { createBackdrop, consoleUi } from "./frames";
import { PANEL_TEXTURE } from "./hudLayout";
import { destroyFrame, setFrameAbsPoint, setFrameEnabled, setFrameLevel, setFrameSize, setFrameTexture, setFrameVisible } from "wisp/game/frames";

const WIDTH = f32(0.07);
const HEIGHT = f32(ESCAPE_METER_HEIGHT);
const BORDER = f32(ESCAPE_METER_BORDER);
const LINE_WIDTH = f32(0.0006);
const MARK_WIDTH = f32(0.0016);
const MARK_HEIGHT = f32(0.014);
const SEGMENTS = ESCAPE_METER_SEGMENTS;
const FILL = "ReplaceableTextures\\TeamColor\\TeamColor04.blp";
const MARK = "ReplaceableTextures\\TeamColor\\TeamColor00.blp";

export class EscapeMeter {
  private readonly back: framehandle;
  private readonly fill: framehandle;
  private readonly lines: readonly framehandle[];
  private readonly mark: framehandle;
  private visible = false;
  private markVisible = false;

  constructor(slot: number) {

    const parent = consoleUi();
    const context = 1100 + slot * 20;
    this.back = createBackdrop(`EscapeMeterBack${I2S(slot)}`, parent, context);
    this.fill = createBackdrop(`EscapeMeterFill${I2S(slot)}`, parent, context + 1);
    const lines: framehandle[] = [];
    for (let line = 1; line < SEGMENTS; line++) lines.push(createBackdrop(`EscapeMeterLine${I2S(slot)}`, parent, context + 1 + line));
    this.lines = lines;
    this.mark = createBackdrop(`EscapeMeterMark${I2S(slot)}`, parent, context + 1 + SEGMENTS);
    setFrameTexture(this.back, PANEL_TEXTURE, 0, true);
    setFrameTexture(this.fill, FILL, 0, true);
    for (const line of lines) setFrameTexture(line, PANEL_TEXTURE, 0, true);
    setFrameTexture(this.mark, MARK, 0, true);
    setFrameSize(this.back, WIDTH + 2 * BORDER, HEIGHT + 2 * BORDER);
    for (const line of lines) setFrameSize(line, LINE_WIDTH, HEIGHT);
    setFrameSize(this.mark, MARK_WIDTH, MARK_HEIGHT);
    for (const [index, frame] of [this.back, this.fill, ...lines, this.mark].entries()) {
      setFrameEnabled(frame, false);
      setFrameVisible(frame, false);
      setFrameLevel(frame, 8 + (index === 0 ? 0 : index === 1 ? 1 : 2));
    }
  }


  update(view: Readonly<EscapeMeterView>, column: number, row: number, aspect: number): void {
    const shown = view.shown && column >= 0.0 && column <= 1.0 && row >= 0.0 && row <= 1.0;
    if (shown !== this.visible) {
      this.visible = shown;
      setFrameVisible(this.back, shown);
      setFrameVisible(this.fill, shown);
      for (const line of this.lines) setFrameVisible(line, shown);
    }
    const markShown = shown && view.pummel >= 0;
    if (markShown !== this.markVisible) {
      this.markVisible = markShown;
      setFrameVisible(this.mark, markShown);
    }
    if (!shown) return;
    const centerX = f32(0.4) + (column - 0.5) * aspect * f32(0.6);
    const centerY = (1.0 - row) * f32(0.6);
    const left = centerX - WIDTH / 2.0;
    setFrameAbsPoint(this.back, FRAMEPOINT_CENTER, centerX, centerY);
    setFrameSize(this.fill, Math.max(LINE_WIDTH, WIDTH * escapeMeterFill(view)), HEIGHT);
    setFrameAbsPoint(this.fill, FRAMEPOINT_LEFT, left, centerY);
    this.lines.forEach((line, index) => {
      setFrameAbsPoint(line, FRAMEPOINT_CENTER, left + (WIDTH * (index + 1)) / SEGMENTS, centerY);
    });
    if (markShown) setFrameAbsPoint(this.mark, FRAMEPOINT_CENTER, left + WIDTH * Math.min(1.0, view.pummel / view.full), centerY);
  }

  destroy(): void {
    for (const frame of [this.back, this.fill, ...this.lines, this.mark]) destroyFrame(frame);
  }
}
