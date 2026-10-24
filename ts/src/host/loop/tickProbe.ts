import type { ShellState } from "./state";

export type SoundPlayed = (sound: string, volume: number, pitch: number, cls: number, slot: number, live: number) => void;

export interface TickProbe {
  readonly before: (this: void, s: ShellState) => void;
  readonly after: (this: void, s: ShellState) => void;
  readonly soundPlayed: (this: void, frame: number, fighter: number) => SoundPlayed | undefined;
}

declare global { var __smashcraftTickProbe: TickProbe | undefined; }

export function installTickProbe(probe: TickProbe): void {
  globalThis.__smashcraftTickProbe = probe;
}

export const beforeProbedTick = (s: ShellState): void => globalThis.__smashcraftTickProbe?.before(s);

export const afterProbedTick = (s: ShellState): void => globalThis.__smashcraftTickProbe?.after(s);

export const probedSound = (frame: number, fighter: number): SoundPlayed | undefined => globalThis.__smashcraftTickProbe?.soundPlayed(frame, fighter);
