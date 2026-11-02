import { MATCH_TICKS_PER_SECOND } from "../lobby/lobbyState";
import type { ParticipantSlot } from "../input/participants";

export const LEAVE_HOLD_FRAMES = MATCH_TICKS_PER_SECOND;

export interface LeaveHold {
  slot: ParticipantSlot | undefined;
  frames: number;
}

export const leaveHold = (): LeaveHold => ({ slot: undefined, frames: 0 });

export function pressLeaveHold(hold: LeaveHold, slot: ParticipantSlot, pausedBy: ParticipantSlot | undefined): boolean {
  if (slot !== pausedBy || hold.slot !== undefined) return hold.slot === slot;
  hold.slot = slot;
  hold.frames = 0;
  return true;
}

export function releaseLeaveHold(hold: LeaveHold, slot: ParticipantSlot): boolean {
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
