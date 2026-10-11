

import { test } from "bun:test";
import { selectSweep, SWEEP_PREFIX } from "../src/runtime/sweep";

export const SWEEPS = process.env.SWEEPS === "1";

export function sweep(name: string, run: () => void | Promise<void>, timeout?: number): void {
  (SWEEPS && selectSweep(`${SWEEP_PREFIX}${name}`, true, process.env.SWEEP_PLACEMENT) ? test : test.skip)(`${SWEEP_PREFIX}${name}`, run, timeout);
}
