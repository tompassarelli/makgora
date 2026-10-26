import { HeroStatusKind } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { eggShown } from "./flightLook";
import { specialCueState } from "./specialCues";

export function fighterModelReplaced(fighter: Readonly<Fighter>): boolean {
  if (fighter.status.out) return false;
  if (eggShown(fighter) || fighter.status.condition === HeroStatusKind.hex) return true;
  const transformation = specialCueState(fighter);
  return transformation.phase === "active" && transformation.cues?.active.replacesBody === true;
}
