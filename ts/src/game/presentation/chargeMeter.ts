import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import type { SpecialCharge, SpecialKit } from "../sim/specials/schema";

const metered = (kit: Readonly<SpecialKit>): Readonly<SpecialCharge> | undefined => kit.ground.charge?.meter === true ? kit.ground.charge : undefined;

export function chargeMeterFill(fighter: Readonly<Fighter>): number {
  const specials = fighter.tuning.specials;
  if (specials === undefined) return -1.0;
  const charge = metered(specials.neutral) ?? metered(specials.side) ?? metered(specials.up) ?? metered(specials.down);
  if (charge === undefined) return -1.0;
  return f32(Math.min(fighter.special.charge, charge.full) / charge.full);
}
