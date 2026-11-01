import type { Fighter } from "../sim/fighter";
import { runningHeroSpecial } from "../sim/specials/runningMove";

export const ManaShieldChange = { none: 0, on: 1, off: 2, broken: 3 } as const;
export type ManaShieldChange = (typeof ManaShieldChange)[keyof typeof ManaShieldChange];

/** How the shield changed since the last drawn frame: the toggle move flips it on its own frame, any other drop is a break. */
export function manaShieldChange(was: boolean, fighter: Readonly<Fighter>): ManaShieldChange {
  const on = fighter.status.manaShield;
  if (on === was) return ManaShieldChange.none;
  if (on) return ManaShieldChange.on;
  return runningHeroSpecial(fighter)?.manaShield?.frame === fighter.special.frame ? ManaShieldChange.off : ManaShieldChange.broken;
}
