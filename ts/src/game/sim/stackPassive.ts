import { f32 } from "wisp/src/sim/f32";
import { min } from "../core/numbers";
import type { Fighter } from "./fighter";
import { type Roster, fighterAt, isActive } from "./roster";

export function gainStack(f: Fighter): void {
  const stacks = f.tuning.moves?.stacks;
  if (stacks !== undefined && !f.status.out) f.status.stacks = min(stacks.cap, f.status.stacks + 1);
}

/** The fighter who last struck a falling one wins a stack for the KO. */
export function creditKo(world: Roster, slot: number): void {
  const scorer = fighterAt(world, slot).status.struckBy;
  if (scorer !== undefined && scorer !== slot && isActive(world, scorer)) gainStack(fighterAt(world, scorer));
}

export function stackedArmor(f: Readonly<Fighter>, maxDamage = 0.0, perStack?: number): number {
  return perStack === undefined ? maxDamage : f32(maxDamage + f32(f.status.stacks * perStack));
}
