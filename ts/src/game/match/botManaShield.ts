import type { Fighter } from "../sim/fighter";
import { ultimatePercent } from "../sim/meter";
import type { AuthoredSpecial } from "../sim/specials/schema";

const MANA_SHIELD_GAP = 200.0;

const MANA_SHIELD_RAISE = ultimatePercent(25);

const MANA_SHIELD_KEEP = ultimatePercent(5);

export function togglesManaShield(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>, gap: number): boolean {
  if (move.manaShield === undefined || gap < MANA_SHIELD_GAP) return false;
  const shielded = f.status.manaShield;
  return shielded !== f.meter.ultimate >= (shielded ? MANA_SHIELD_KEEP : MANA_SHIELD_RAISE);
}
