

import { test } from "bun:test";
import { selectSweep, SWEEP_PREFIX } from "../src/runtime/sweep";

export const SWEEPS = process.env.SWEEPS === "1";

const [part = 0, parts = 1] = (process.env.SWEEP_PART ?? "0/1").split("/").map(Number);
export const FIRST_SWEEP_PART = part === 0;
let registered = 0;

export function sweep(name: string, run: () => void | Promise<void>, timeout?: number): void {
  if (registered++ % parts !== part) return;
  (SWEEPS && selectSweep(`${SWEEP_PREFIX}${name}`, true, process.env.SWEEP_PLACEMENT) ? test : test.skip)(`${SWEEP_PREFIX}${name}`, run, timeout);
}
