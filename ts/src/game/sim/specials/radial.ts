import type { Fighter } from "../fighter";
import { heroRegionOrigin } from "./heroContact";
import { runningHeroSpecial } from "./runningMove";

export function heroContactFacing(owner: Readonly<Fighter>, target: Readonly<Fighter>, facing: number): number {
  if (runningHeroSpecial(owner)?.radial !== true) return facing;
  return target.motion.x >= heroRegionOrigin(owner).x ? 1 : -1;
}
