import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import { heroLook } from "../roster/looks";
import type { EmpoweredAuraLook } from "./model/look";

export function fighterEmpoweredAura(character: number): EmpoweredAuraLook | undefined {
  return heroLook(character)?.empoweredAura;
}

export function empoweredAuraScale(fighter: Readonly<Fighter>, look: Readonly<EmpoweredAuraLook>): number {
  const left = fighter.special.empoweredShots;
  if (left <= 0 || fighter.status.out) return 0.0;
  const held = Math.min(left, look.shots);
  return f32(look.scale * f32(look.floor + f32(f32(1.0 - look.floor) * f32(held / look.shots))));
}
