import { Frame, frameChild, frameChildCount, namedFrame, setFrameEnabled, setFrameVisible } from "wisp/game/frames";

export interface StockClickBlocker {
  readonly frame: string;
  readonly path: readonly number[];
}

export const STOCK_CLICK_BLOCKERS: readonly StockClickBlocker[] = [
  { frame: "ConsoleUI", path: [1] },
  { frame: "ConsoleUI", path: [5] },
  { frame: "ConsoleUI", path: [7] },
];

function subtree(frame: Frame, out: Frame[]): void {
  out.push(frame);
  const count = frameChildCount(frame);
  for (let index = 0; index < count; index++) subtree(frameChild(frame, index), out);
}

export function stockClickBlockers(): Frame[] {
  const frames: Frame[] = [];
  for (const blocker of STOCK_CLICK_BLOCKERS) {
    let frame = namedFrame(blocker.frame, 0);
    for (const index of blocker.path) frame = frameChild(frame, index);
    subtree(frame, frames);
  }
  return frames;
}

export function releaseStockClicks(): void {
  for (const frame of stockClickBlockers()) {
    setFrameVisible(frame, false);
    setFrameEnabled(frame, false);
  }
}
