import { DOWN_WAIT_FRAMES } from "../../sim/down";
import { DownState, DuoOrder, LedgeState } from "../../sim/codes";
import { inGrabContext } from "../../sim/conditions";
import { partnerDeparts, partnerReturns } from "../../sim/duoPartner";
import { type Roster, fighterAt, isActive } from "../../sim/roster";
import { beginDownState } from "../../sim/transitions";
import { MURLOC_DUO } from "./duo";
import { mutableDuo } from "../../sim/fighter";

export const PARTNER_FAINT = { damage: 70.0, frames: 30 } as const;

function faintsNow(world: Roster, slot: number): boolean {
  const f = fighterAt(world, slot);
  return f.status.damage >= PARTNER_FAINT.damage && f.motion.grounded && f.ledge.state === LedgeState.none && f.status.frozenFrames === 0 && !inGrabContext(f);
}

function faint(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  const duo = mutableDuo(f);
  duo.order = DuoOrder.fainted;
  duo.orderFrame = 0;
  f.launch.hitstun = 0;
  f.launch.throwHitstun = false;
  beginDownState(f, DownState.wait, 0);
  f.down.waitRemaining = DOWN_WAIT_FRAMES;
}

export function advanceDuoStocks(world: Roster, leaderSlot: number, leaderWasOut: boolean): void {
  const leader = fighterAt(world, leaderSlot);
  const slot = leader.duo?.link ?? -1;
  if (slot < 0 || !isActive(world, slot)) return;
  const partner = fighterAt(world, slot);
  if (leader.status.out) {
    if (!leaderWasOut) partnerDeparts(world, slot);
    return;
  }
  if (partner.status.out) {
    if (leaderWasOut) partnerReturns(world, slot, leader.motion.x - leader.facing * MURLOC_DUO.partnerOffset);
    return;
  }
  const { duo } = partner;
  if (duo?.order === DuoOrder.fainted) {
    duo.orderFrame++;
    if (duo.orderFrame >= PARTNER_FAINT.frames) partnerDeparts(world, slot);
  } else if (faintsNow(world, slot)) faint(world, slot);
}
