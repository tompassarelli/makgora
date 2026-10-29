import { f32 } from "wisp/src/sim/f32";
import { max, min } from "../../core/numbers";
import type { Fighter } from "../fighter";
import { currentTraits } from "../identityTraits";
import type { SelfHeal } from "./schema";

export function applySelfHeal(f: Fighter, selfHeal: Readonly<SelfHeal> | undefined, frame: number): void {
  if (selfHeal?.frame !== frame || currentTraits(f).heal !== true) return;
  f.status.damage = f32(f.status.damage - min(selfHeal.heal, max(0.0, f.status.damage)));
}

export function writeSelfHeal(int: (field: string, value: number) => void, real: (field: string, value: number) => void, selfHeal: Readonly<SelfHeal> | undefined): void {
  if (selfHeal === undefined) return;
  int("selfHeal.frame", selfHeal.frame);
  real("selfHeal.heal", selfHeal.heal);
}
