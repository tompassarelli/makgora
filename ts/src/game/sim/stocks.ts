import { blastFighterFields } from "../../generated/state/fighterState";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "./knockback";
import { type Roster, fighterAt } from "./roster";
import { clearGrabLinks, clearOwnedFreezeTrap, clearSpecialOnStock } from "./transitions";
import { curseOnStockLoss } from "./curses";
import { creditKo } from "./stackPassive";

import { stageBounds } from "./stageBounds";


export function checkBlastZone(world: Roster, slot: number, stage: number = 0): void {
  const f = fighterAt(world, slot);
  const { motion, launch, status } = f;
  const topEligible = motion.grounded || status.frozenFrames > 0 || launch.knockbackZ > TOP_KO_MINIMUM_UPWARD_KNOCKBACK;
  const { blast } = stageBounds(stage);
  if (!(motion.x < blast.left || motion.x > blast.right || motion.z < blast.bottom || (motion.z > blast.top && topEligible))) return;
  creditKo(world, slot);
  curseOnStockLoss(world, slot);
  clearGrabLinks(world, slot);
  clearSpecialOnStock(f);
  clearOwnedFreezeTrap(f);
  blastFighterFields(f);
}
