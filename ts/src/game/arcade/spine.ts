export const StageKind = { hallway: 0, elite: 1, bonus: 2, rival: 3 } as const;
export type StageKind = (typeof StageKind)[keyof typeof StageKind];

export interface SpineStage {
  readonly kind: StageKind;
  readonly playerStocks: number;
  readonly opponentStocks: number;
  readonly clockSeconds: number;
  readonly reactionLead: number;
  readonly playable: boolean;
}

const stage = (kind: StageKind, playerStocks: number, opponentStocks: number, clockSeconds: number, reactionLead: number, playable = true): SpineStage =>
  ({ kind, playerStocks, opponentStocks, clockSeconds, reactionLead, playable });

/** The fixed run of docs/design/arcade-mode.md, "Run structure"; the bonus stage waits for its own box. */
export const ARCADE_SPINE: readonly SpineStage[] = [
  stage(StageKind.hallway, 2, 1, 120, 0),
  stage(StageKind.hallway, 2, 1, 120, 0),
  stage(StageKind.elite, 2, 1, 240, 1),
  stage(StageKind.hallway, 2, 1, 120, 1),
  stage(StageKind.hallway, 2, 1, 120, 2),
  stage(StageKind.elite, 2, 2, 240, 2),
  stage(StageKind.bonus, 1, 0, 30, 0, false),
  stage(StageKind.rival, 2, 2, 240, 3),
];

export const ARCADE_STAGES = ARCADE_SPINE.length;
export const FINAL_STAGE = ARCADE_STAGES - 1;

export function nextPlayableStage(after: number): number {
  for (let index = after + 1; index < ARCADE_STAGES; index++) if (ARCADE_SPINE[index]?.playable === true) return index;
  return ARCADE_STAGES;
}
