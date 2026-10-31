import { at } from "wisp/src/runtime/lookup";
import { idiv, imod } from "wisp/src/sim/intMath";

export const STICK_HISTORY_FRAMES = 14;
export const FRAMES_PER_WORD = 7;
export const OLDEST_WEIGHT = 16777216;
const NIBBLE_WEIGHTS = [1, 16, 256, 4096, 65536, 1048576, OLDEST_WEIGHT] as const;

export interface StickStep {
  readonly x: -1 | 0 | 1;
  readonly z: -1 | 0 | 1;
}

export interface StickMotion {
  readonly window: number;
  readonly steps: readonly StickStep[];
}

const sectorCode = (sector: number): number => (sector < 0 ? 2 : sector > 0 ? 1 : 0);

export const zoneCode = (x: number, z: number): number => sectorCode(x) + sectorCode(z) * 4;

export function zoneAgo(recent: number, older: number, age: number): number {
  const inRecent = age < FRAMES_PER_WORD;
  return imod(idiv(inRecent ? recent : older, at(NIBBLE_WEIGHTS, inRecent ? age : age - FRAMES_PER_WORD)), 16);
}

export function motionCompleted(recent: number, older: number, side: number, motion: Readonly<StickMotion>): boolean {
  const steps = motion.steps;
  let next = 0;
  for (let age = Math.min(motion.window, STICK_HISTORY_FRAMES) - 1; age >= 0 && next < steps.length; age--) {
    const step = steps[next];
    if (step !== undefined && zoneAgo(recent, older, age) === zoneCode(step.x * side, step.z)) next++;
  }
  return next === steps.length;
}
