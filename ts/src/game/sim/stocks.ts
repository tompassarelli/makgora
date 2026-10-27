import { blastFighterFields, respawnFighterFields } from "../../generated/state/fighterState";
import { restCannon, restFreezeTrap, restWater } from "./fighterRest";
import { resetCandle } from "../fighters/kobold/candle";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "./knockback";
import { setWorldMotionValue } from "./motion";
import { type Roster, fighterAt } from "./roster";
import { clearGrabLinks, clearOwnedFreezeTrap, clearSpecialOnStock } from "./transitions";
import { curseOnStockLoss } from "./curses";

import { stageBounds } from "./stageBounds";


export function checkBlastZone(world: Roster, slot: number, stage: number = 0): void {
  const f = fighterAt(world, slot);
  const { motion, launch, status } = f;
  const topEligible = motion.grounded || status.frozenFrames > 0 || launch.knockbackZ > TOP_KO_MINIMUM_UPWARD_KNOCKBACK;
  const { blast } = stageBounds(stage);
  if (!(motion.x < blast.left || motion.x > blast.right || motion.z < blast.bottom || (motion.z > blast.top && topEligible))) return;
  curseOnStockLoss(world, slot);
  clearGrabLinks(world, slot);
  clearSpecialOnStock(f);
  clearOwnedFreezeTrap(f);
  resetCandle(f);
  blastFighterFields(f);
}


export function respawnFighter(world: Roster, slot: number, startX: number): void {
  const f = fighterAt(world, slot);
  clearGrabLinks(world, slot);
  clearSpecialOnStock(f);
  resetCandle(f);
  restCannon(f);
  restWater(f);
  restFreezeTrap(f);
  respawnFighterFields(f, startX);
  setWorldMotionValue(f.motion.meleeX, f.motion.x);
  setWorldMotionValue(f.motion.meleeZ, f.motion.z);
}
