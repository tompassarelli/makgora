import { writeFileSync } from "node:fs";
import { fighterSlug } from "../src/game/roster/kits";
import { gatedFighters } from "../src/game/roster/forge";
import { currentKit } from "./balanceKit";
import { currentFeel } from "./balanceFeel";
import type { Baseline } from "./balanceOptimizer";

export const BASELINE_FILE = `${import.meta.dir}/balanceBaseline.json`;

export function rosterBaseline(): Baseline {
  return Object.fromEntries(gatedFighters().map(character => [fighterSlug(character), { ...currentKit(character), feel: currentFeel(character) }]));
}

export const baselineText = (baseline: Baseline): string => `${JSON.stringify(baseline, null, 1)}\n`;

if (import.meta.main) {
  writeFileSync(BASELINE_FILE, baselineText(rosterBaseline()));
  console.log(`froze ${gatedFighters().length} fighters into ${BASELINE_FILE}`);
}
