import { f32 } from "wisp/src/sim/f32";
import { createBackdrop, createText, placeTopLeft, setFrameText, sizeText } from "./frames";

export interface SessionWinsFrames {
  readonly coin: framehandle;
  readonly count: framehandle;
  shownCount: number | undefined;
  shown: boolean | undefined;
}

export function createSessionWinsFrames(parent: framehandle, name: string, x: number, y: number): SessionWinsFrames {
  const coin = createBackdrop(`MeleeWinCoin${name}`, parent, 0);
  BlzFrameSetTexture(coin, "UI\\Feedback\\Resources\\ResourceGold.blp", 0, true);
  placeTopLeft(coin, x, y);
  BlzFrameSetSize(coin, f32(0.014), f32(0.014));
  BlzFrameSetEnable(coin, false);
  const count = createText(`MeleeWinCount${name}`, parent, 0);
  placeTopLeft(count, f32(x + f32(0.017)), y);
  sizeText(count, f32(0.009), f32(0.036), f32(0.012));
  BlzFrameSetTextAlignment(count, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
  BlzFrameSetEnable(count, false);
  BlzFrameSetVisible(coin, false);
  BlzFrameSetVisible(count, false);
  return { coin, count, shownCount: undefined, shown: false };
}

export function presentSessionWinsFrames(frames: SessionWinsFrames, count: number, visible: boolean): void {
  const shown = visible && count > 0;
  if (frames.shown !== shown) {
    BlzFrameSetVisible(frames.coin, shown);
    BlzFrameSetVisible(frames.count, shown);
    frames.shown = shown;
  }
  if (shown && frames.shownCount !== count) {
    setFrameText(frames.count, `x${I2S(count)}`);
    frames.shownCount = count;
  }
}
