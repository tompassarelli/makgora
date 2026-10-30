import { partnerDeparts, partnerReturns } from "../../sim/duoPartner";
import { type Roster, fighterAt, isActive } from "../../sim/roster";
import { MURLOC_DUO } from "./duo";

export function advanceDuoStocks(world: Roster, leaderSlot: number, leaderWasOut: boolean): void {
  const leader = fighterAt(world, leaderSlot);
  const slot = leader.duo?.link ?? -1;
  if (slot < 0 || !isActive(world, slot)) return;
  const partner = fighterAt(world, slot);
  if (leader.status.out) {
    if (!leaderWasOut) partnerDeparts(world, slot);
  } else if (partner.status.out && leaderWasOut) partnerReturns(world, slot, leader.motion.x - leader.facing * MURLOC_DUO.partnerOffset);
}
