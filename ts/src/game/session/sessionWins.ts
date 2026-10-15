import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";

export interface SessionWins {
  readonly counts: Slots<number>;
  completed: boolean;
}

export const createSessionWins = (): SessionWins => ({ counts: [0, 0, 0, 0], completed: true });

export function beginSessionMatch(wins: SessionWins): void {
  wins.completed = false;
}

export function recordSessionWins(wins: SessionWins, winningMask: number): void {
  if (wins.completed) return;
  wins.completed = true;
  for (const slot of PARTICIPANT_SLOTS) if ((winningMask & (1 << slot)) !== 0) wins.counts[slot] += 1;
}
