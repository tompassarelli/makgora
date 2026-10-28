export const SELECT_LEVELS = { cardChip: 10, ruleHelp: 20, tutorial: 20, credits: 20, hand: 30, stagePool: 30, cpuSettings: 100 } as const;
export const CHAT_LEVELS = { select: 110, match: 0 } as const;

// Keyed by each client's own view object, so clients sharing one process each make their own native pair.
const shownLevels = new WeakMap<object, number>();

export function chatLevel(selecting: boolean): number {
  return selecting ? CHAT_LEVELS.select : CHAT_LEVELS.match;
}

// Engine: showing a ConsoleUIBackdrop child draws it over chat until chat's level is set again, so select sets it every frame.
export function chatLevelToSet(shown: number | undefined, selecting: boolean): number | undefined {
  const level = chatLevel(selecting);
  return selecting || shown !== level ? level : undefined;
}

export function layerChat(view: object, selecting: boolean): void {
  const level = chatLevelToSet(shownLevels.get(view), selecting);
  if (level === undefined) return;
  shownLevels.set(view, level);
  BlzFrameSetLevel(BlzGetOriginFrame(ORIGIN_FRAME_CHAT_MSG, 0), level);
}
