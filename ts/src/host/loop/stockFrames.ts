import { type OriginFrame as OriginFrameKind, OriginFrame, originFrame, setFrameEnabled, setFrameVisible } from "wisp/game/frames";

// Engine: only these named stock frames are hidden; hiding the game UI, the world frame, the simple UI parent or the chat box as a group takes down frames of ours and the world view (docs/stock-frames.md).
export const STOCK_FRAME_COUNTS = {
  command: 12,
  item: 6,
  heroBar: 1,
  heroButton: 7,
  heroHealthBar: 7,
  heroManaBar: 7,
  heroButtonIndicator: 7,
  minimap: 1,
  minimapButton: 5,
} as const;

export type StockFrameGroup = keyof typeof STOCK_FRAME_COUNTS;

function origin(group: StockFrameGroup): OriginFrameKind {
  switch (group) {
    case "command": return OriginFrame.commandButton;
    case "item": return OriginFrame.itemButton;
    case "heroBar": return OriginFrame.heroBar;
    case "heroButton": return OriginFrame.heroButton;
    case "heroHealthBar": return OriginFrame.heroHpBar;
    case "heroManaBar": return OriginFrame.heroManaBar;
    case "heroButtonIndicator": return OriginFrame.heroButtonIndicator;
    case "minimap": return OriginFrame.minimap;
    case "minimapButton": return OriginFrame.minimapButton;
  }
}

// Engine: BlzHideOriginFrames(true) leaves the stock command buttons in place and they take clicks over a panel button even when not drawn, so each is hidden and disabled by name.
export function hideStockOriginFrames(): void {
  for (const group of Object.keys(STOCK_FRAME_COUNTS) as StockFrameGroup[]) {
    const kind = origin(group);
    for (let index = 0; index < STOCK_FRAME_COUNTS[group]; index++) {
      const frame = originFrame(kind, index);
      setFrameVisible(frame, false);
      setFrameEnabled(frame, false);
    }
  }
}
