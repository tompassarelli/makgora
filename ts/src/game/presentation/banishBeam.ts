import { f32 } from "wisp/src/sim/f32";
import { SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { BANISH_SWIRL_COUNT } from "../fighters/kaelthas/look";
import { specialAreaRegion } from "./disjointCues";

export interface BanishSwirl { x: number; z: number; }

/** Where swirl `index` stands in the world while Banish's beam is live, spread evenly from Kael's hand to the beam's far end; false on every other frame. */
export function banishSwirl(fighter: Readonly<Fighter>, index: number, out: BanishSwirl): boolean {
  if (fighter.special.action !== SpecialAction.heroDown || fighter.status.out) return false;
  const strike = specialAreaRegion(fighter, 0).strike;
  if (strike === undefined) return false;
  const along = f32(index / (BANISH_SWIRL_COUNT - 1));
  out.x = f32(fighter.motion.x + f32(fighter.facing * f32(strike.x1 + f32(f32(strike.x2 - strike.x1) * along))));
  out.z = f32(fighter.motion.z + f32(strike.z1 + f32(f32(strike.z2 - strike.z1) * along)));
  return true;
}
