import { type Fighter, placedObject } from "../fighter";
import { projectilesFit } from "./heroProjectiles";
import type { AuthoredSpecial, SpecialPlacement } from "./schema";

/** Every object a special places: its placement, then its summons. */
export function specialPlacements(move: Readonly<AuthoredSpecial>): readonly SpecialPlacement[] {
  return [...(move.placement === undefined ? [] : [move.placement]), ...(move.summons ?? [])];
}

function placementStillOut(f: Readonly<Fighter>, spec: Readonly<SpecialPlacement> | undefined): boolean {
  if (spec?.refusedWhileOut !== true) return false;
  return placedObject(f, spec.slot).life > 0 || (spec.splits !== undefined && placedObject(f, spec.splits.into).life > 0);
}

/** A cast starts only when its projectiles fit under the caps and it does not place an object that is still out. */
export function castFits(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): boolean {
  return projectilesFit(f, move) && !placementStillOut(f, move.placement);
}
