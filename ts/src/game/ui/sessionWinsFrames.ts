import { f32 } from "wisp/src/sim/f32";
import { createBackdrop, createText, placeTopLeft, setMenuText, sizeText } from "./frames";
import { Frame, setFrameEnabled, setFrameSize, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";
import { formatInt } from "wisp/game/text";

export interface SessionWinsFrames {
  readonly coin: Frame;
  readonly count: Frame;
  shownCount: number | undefined;
  shown: boolean | undefined;
}

export function createSessionWinsFrames(parent: Frame, name: string, x: number, y: number, size: number): SessionWinsFrames {
  const coin = createBackdrop(`MeleeWinCoin${name}`, parent, 0);
  setFrameTexture(coin, "UI\\Feedback\\Resources\\ResourceGold.blp", 0, true);
  placeTopLeft(coin, x, y);
  setFrameSize(coin, size, size);
  setFrameEnabled(coin, false);
  const count = createText(`MeleeWinCount${name}`, parent, 0);
  placeTopLeft(count, f32(f32(x + size) + f32(0.003)), y);
  sizeText(count, size, f32(size * 4), f32(f32(size * 4) / 3));
  setFrameTextAlignment(count, TextAlignment.middle, TextAlignment.left);
  setFrameEnabled(count, false);
  setFrameVisible(coin, false);
  setFrameVisible(count, false);
  return { coin, count, shownCount: undefined, shown: false };
}

export function presentSessionWinsFrames(frames: SessionWinsFrames, count: number, visible: boolean): void {
  const shown = visible && count > 0;
  if (frames.shown !== shown) {
    setFrameVisible(frames.coin, shown);
    setFrameVisible(frames.count, shown);
    frames.shown = shown;
  }
  if (shown && frames.shownCount !== count) {
    setMenuText(frames.count, `x${formatInt(count)}`);
    frames.shownCount = count;
  }
}
