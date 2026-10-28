import type { Fighter } from "./fighter";
import type { Controls } from "./roster";
import { SpecialAction } from "./codes";
import { max } from "../core/numbers";
import { exCharged, spendEx } from "./meter";

export function exSpecialPressed(input: Readonly<Controls>): boolean {
  return input.specialPressed && input.exPressed;
}

export function enterExSpecial(f: Fighter, input: Readonly<Controls>): void {
  f.special.ex = exSpecialPressed(input) && exCharged(f);
  if (f.special.ex) spendEx(f);
}

export function exRecoveryFrames(f: Readonly<Fighter>): number {
  return f.special.action === SpecialAction.none ? 0 : max(0, f.special.duration - f.special.frame);
}
