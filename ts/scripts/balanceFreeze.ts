import { writeFileSync } from "node:fs";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/roster/kits";
import { currentKit } from "./balanceKit";
import { currentFeel } from "./balanceFeel";
import type { Baseline } from "./balanceOptimizer";

export const BASELINE_FILE = `${import.meta.dir}/balanceBaseline.json`;

export function rosterBaseline(): Baseline {
  return Object.fromEntries(SELECTABLE_CHARACTERS.map(character => [fighterSlug(character), { ...currentKit(character), feel: currentFeel(character) }]));
}

export const baselineText = (baseline: Baseline): string => `${JSON.stringify(baseline, null, 1)}\n`;

if (import.meta.main) {
  writeFileSync(BASELINE_FILE, baselineText(rosterBaseline()));
  console.log(`froze ${SELECTABLE_CHARACTERS.length} fighters into ${BASELINE_FILE}`);
}
