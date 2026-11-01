import { pairedWithin } from "../duoLocks";
import { callVariant } from "../duoPartner";
import type { Fighter } from "../fighter";
import type { Roster } from "../roster";
import type { AuthoredSpecial } from "./schema";
import { motionVariant } from "../stickHistory";

export function readyEmpowered(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number): void {
  const empowers = move.empowers;
  if (empowers?.frame !== frame) return;
  f.special.empoweredShots = empowers.shots;
  f.special.empoweredFrames = empowers.frames;
}

export function tickEmpowered(f: Fighter): void {
  const { special } = f;
  if (special.empoweredFrames <= 0) return;
  special.empoweredFrames--;
  if (special.empoweredFrames === 0) special.empoweredShots = 0;
}

export function empoweredVariant(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): number {
  return move.spendsEmpowered === true && f.special.empoweredShots > 0 && (move.variants?.length ?? 0) > 0 ? 1 : 0;
}

export function castVariant(world: Roster | undefined, f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): number {
  const paired = move.pairedVariant;
  const called = callVariant(world, f, move);
  if (called !== undefined) return called;
  const moved = motionVariant(f, move);
  if (moved !== undefined) return moved;
  return paired !== undefined && world !== undefined && pairedWithin(world, f, paired.within, paired.heldWithin) ? paired.variant : empoweredVariant(f, move);
}

export function spendEmpowered(f: Fighter, base: Readonly<AuthoredSpecial>, variant: number): void {
  if (base.spendsEmpowered !== true || variant !== 1) return;
  const { special } = f;
  special.empoweredShots--;
  if (special.empoweredShots === 0) special.empoweredFrames = 0;
}
