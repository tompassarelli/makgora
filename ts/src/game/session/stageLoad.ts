





import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../input/participants";
import { type MatchState, humanPresent } from "../lobby/lobbyState";


export const STAGE_READY_PREFIX = "SC_STAGE";

export const STAGE_SETTLE_FRAMES = 30;

export const STAGE_LOAD_TIMEOUT_FRAMES = 600;

/** A load shorter than this shows no loading card: a local start finishes in about half a second and the card would only flash. */
export const STAGE_CARD_DELAY_FRAMES = 60;

export interface StageLoad {

  readonly starter: ParticipantSlot;
  readonly stage: number;

  readonly waiting: number;
  ready: number;
  frames: number;
  reported: boolean;
  carded: boolean;
}

export function beginStageLoad(game: Readonly<MatchState>, starter: ParticipantSlot): StageLoad {
  let waiting = 0;
  for (const slot of PARTICIPANT_SLOTS) if (humanPresent(game, slot)) waiting += 1 << slot;
  return { starter, stage: game.stageChoice, waiting, ready: 0, frames: 0, reported: false, carded: false };
}


export function stageReported(load: StageLoad, sender: number, data: string): boolean {
  if (data === `${load.stage}` && sender >= 0 && sender < 4) load.ready |= (1 << sender) & load.waiting;
  return load.ready === load.waiting;
}

export const StageLoadStep = { wait: 0, report: 1, start: 2 } as const;
export type StageLoadStep = (typeof StageLoadStep)[keyof typeof StageLoadStep];


export function tickStageLoad(load: StageLoad): StageLoadStep {
  load.frames++;
  if (load.frames >= STAGE_LOAD_TIMEOUT_FRAMES) return StageLoadStep.start;
  if (!load.reported && load.frames >= STAGE_SETTLE_FRAMES) {
    load.reported = true;
    return StageLoadStep.report;
  }
  return StageLoadStep.wait;
}

/** True once, on the tick the load has run long enough that its loading card should replace the select screen. */
export function stageCardDue(load: StageLoad): boolean {
  if (load.carded || load.frames < STAGE_CARD_DELAY_FRAMES) return false;
  load.carded = true;
  return true;
}
