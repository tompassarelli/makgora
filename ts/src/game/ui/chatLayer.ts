export const SELECT_LEVELS = { cardChip: 10, ruleHelp: 20, tutorial: 20, hand: 30, stagePool: 30, cpuSettings: 100 } as const;
export const CHAT_LEVELS = { select: 110, match: 0 } as const;

let shownLevel: number | undefined;

export function chatLevel(selecting: boolean): number {
  return selecting ? CHAT_LEVELS.select : CHAT_LEVELS.match;
}

export function layerChat(selecting: boolean): void {
  const level = chatLevel(selecting);
  if (shownLevel === level) return;
  shownLevel = level;
  BlzFrameSetLevel(BlzGetOriginFrame(ORIGIN_FRAME_CHAT_MSG, 0), level);
}
