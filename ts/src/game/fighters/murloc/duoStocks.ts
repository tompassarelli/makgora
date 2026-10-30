import { blastFighterFields } from "../../../generated/state/fighterState";
import { DOWN_WAIT_FRAMES } from "../../sim/down";
import { DownState, DuoOrder, LedgeState } from "../../sim/codes";
import { inGrabContext } from "../../sim/conditions";
import { respawnFighter } from "../../sim/stocks";
import { type Roster, fighterAt, isActive } from "../../sim/roster";
import { beginDownState, clearGrabLinks, clearOwnedFreezeTrap, clearSpecialOnStock } from "../../sim/transitions";
import { MURLOC_DUO } from "./duo";

export const PARTNER_FAINT = { damage: 70.0, frames: 30 } as const;

export function partnerDeparts(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  if (f.status.out) return;
  clearGrabLinks(world, slot);
  clearSpecialOnStock(f);
  clearOwnedFreezeTrap(f);
  blastFighterFields(f);
  f.status.stocks = 0;
  f.status.respawn = 0;
}

export function partnerReturns(world: Roster, slot: number, x: number): void {
  respawnFighter(world, slot, x);
  fighterAt(world, slot).status.stocks = 1;
}

function faintsNow(world: Roster, slot: number): boolean {
  const f = fighterAt(world, slot);
  return f.status.damage >= PARTNER_FAINT.damage && f.motion.grounded && f.ledge.state === LedgeState.none && f.status.frozenFrames === 0 && !inGrabContext(f);
}

function faint(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  f.duo.order = DuoOrder.fainted;
  f.duo.orderFrame = 0;
  f.launch.hitstun = 0;
  f.launch.throwHitstun = false;
  beginDownState(f, DownState.wait, 0);
  f.down.waitRemaining = DOWN_WAIT_FRAMES;
}

export function advanceDuoStocks(world: Roster, leaderSlot: number, leaderWasOut: boolean): void {
  const leader = fighterAt(world, leaderSlot);
  const slot = leader.duo.link;
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
  if (partner.duo.order === DuoOrder.fainted) {
    partner.duo.orderFrame++;
    if (partner.duo.orderFrame >= PARTNER_FAINT.frames) partnerDeparts(world, slot);
  } else if (faintsNow(world, slot)) faint(world, slot);
}
