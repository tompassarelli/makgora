import { MATCH_TICKS_PER_SECOND } from "../lobby/lobbyState";
import type { ParticipantSlot, Slots } from "../input/participants";

export const LEAVE_HOLD_FRAMES = MATCH_TICKS_PER_SECOND;

export interface LeaveHold {
  slot: ParticipantSlot | undefined;
  frames: number;
  readonly held: Slots<boolean>;
}

export const leaveHold = (): LeaveHold => ({ slot: undefined, frames: 0, held: [false, false, false, false] });

// A press while Esc is still held (the press that paused, or its key repeat) never starts the hold; only a fresh press does.
export function pressEscape(hold: LeaveHold, slot: ParticipantSlot, pauser: ParticipantSlot | undefined): boolean {
  const fresh = !hold.held[slot];
  hold.held[slot] = true;
  if (slot !== pauser) return false;
  if (fresh && hold.slot === undefined) {
    hold.slot = slot;
    hold.frames = 0;
  }
  return true;
}

export function releaseEscape(hold: LeaveHold, slot: ParticipantSlot): boolean {
  hold.held[slot] = false;
  if (hold.slot !== slot) return false;
  clearLeaveHold(hold);
  return true;
}

export function tickLeaveHold(hold: LeaveHold): boolean {
  if (hold.slot === undefined) return false;
  hold.frames++;
  if (hold.frames < LEAVE_HOLD_FRAMES) return false;
  clearLeaveHold(hold);
  return true;
}

export function clearLeaveHold(hold: LeaveHold): void {
  hold.slot = undefined;
  hold.frames = 0;
}

export const leaveHoldFill = (hold: Readonly<LeaveHold> | undefined): number =>
  hold?.slot === undefined ? 0 : Math.min(1, hold.frames / LEAVE_HOLD_FRAMES);
