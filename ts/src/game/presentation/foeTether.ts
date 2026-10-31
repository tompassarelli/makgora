import type { Fighter } from "../sim/fighter";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { FOLLOW_UP_FORM } from "../sim/specials/schema";

export function tetheredFoe(fighter: Readonly<Fighter>): number {
  const charge = runningHeroSpecial(fighter)?.charge;
  const { special } = fighter;
  if (fighter.status.out || charge?.tether !== true || special.form >= FOLLOW_UP_FORM || special.frame !== charge.hold || special.charge >= charge.full) return -1;
  return special.seekTarget - 1;
}
