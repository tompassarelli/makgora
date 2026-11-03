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

// Engine: the origin constants are natives the engine defines at map load, so they are read when the groups are hidden; Wisp's OriginFrame names only the game UI and the chat box.
function origin(group: StockFrameGroup): originframetype {
  switch (group) {
    case "command": return ORIGIN_FRAME_COMMAND_BUTTON;
    case "item": return ORIGIN_FRAME_ITEM_BUTTON;
    case "heroBar": return ORIGIN_FRAME_HERO_BAR;
    case "heroButton": return ORIGIN_FRAME_HERO_BUTTON;
    case "heroHealthBar": return ORIGIN_FRAME_HERO_HP_BAR;
    case "heroManaBar": return ORIGIN_FRAME_HERO_MANA_BAR;
    case "heroButtonIndicator": return ORIGIN_FRAME_HERO_BUTTON_INDICATOR;
    case "minimap": return ORIGIN_FRAME_MINIMAP;
    case "minimapButton": return ORIGIN_FRAME_MINIMAP_BUTTON;
  }
}

// Engine: BlzHideOriginFrames(true) leaves the stock command buttons in place and they take clicks over a panel button even when not drawn, so each is hidden and disabled by name.
export function hideStockOriginFrames(): void {
  for (const group of Object.keys(STOCK_FRAME_COUNTS) as StockFrameGroup[]) {
    const kind = origin(group);
    for (let index = 0; index < STOCK_FRAME_COUNTS[group]; index++) {
      const frame = BlzGetOriginFrame(kind, index);
      BlzFrameSetVisible(frame, false);
      BlzFrameSetEnable(frame, false);
    }
  }
}
