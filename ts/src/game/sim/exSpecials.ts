import type { Fighter } from "./fighter";
import type { Controls } from "./roster";
import { SpecialAction } from "./codes";
import { max } from "../core/numbers";
import { ROSTER_MANA, spendMana } from "./mana";

export function exSpecialPressed(input: Readonly<Controls>): boolean {
  return input.specialPressed && input.exPressed;
}

export function exSpecialAffordable(f: Readonly<Fighter>): boolean {
  return f.mana.points >= ROSTER_MANA.exCost;
}


export function enterExSpecial(f: Fighter, input: Readonly<Controls>): void {
  f.special.ex = exSpecialPressed(input) && exSpecialAffordable(f);
  if (f.special.ex) spendMana(f, ROSTER_MANA.exCost);
}

export function exRecoveryFrames(f: Readonly<Fighter>): number {
  return f.special.action === SpecialAction.none ? 0 : max(0, f.special.duration - f.special.frame);
}
