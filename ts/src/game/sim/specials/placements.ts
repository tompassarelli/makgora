import type { AuthoredSpecial, SpecialPlacement } from "./schema";

/** Every object a special places: its placement, then its summons. */
export function specialPlacements(move: Readonly<AuthoredSpecial>): readonly SpecialPlacement[] {
  return [...(move.placement === undefined ? [] : [move.placement]), ...(move.summons ?? [])];
}
