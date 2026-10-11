import { BACKGROUND_SWEEPS } from "./backgroundSweeps";
import { test } from "wisp/src/runtime/testing";

export const SWEEP_PREFIX = "(sweep) ";

let seedOffset = 0;

export function setSweepSeedOffset(offset: number): void {
  seedOffset = offset;
}

export const sweepSeed = (seed: number): number => seed + seedOffset;

export function sweep(name: string, run: () => void): void {
  test(`${SWEEP_PREFIX}${name}`, run);
}

export const isSweep = (name: string): boolean => name.startsWith(SWEEP_PREFIX);

export function selectSweep(name: string, sweeps: boolean, placement = "all"): boolean {
  if (isSweep(name) !== sweeps) return false;
  if (!sweeps || placement === "all") return true;
  const background = BACKGROUND_SWEEPS.includes(name);
  return placement === "background" ? background : !background;
}
