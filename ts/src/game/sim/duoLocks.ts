import { PARTICIPANT_CAPACITY } from "../input/participants";
import { DuoRole } from "./codes";
import { canStartAttack } from "./conditions";
import { type Roster, fighterAt, isActive } from "./roster";

export const DUO_CHAIN_CAP = 12;
export const DUO_CHAIN_FREE_FRAMES = 20;
export const DUO_SHIELD_STUN_CAP = 30;
export const DUO_SHIELD_FREE_FRAMES = 10;

/** Whether the slot is a body of a live linked pair, with its other body in the match. */
export function inLivePair(world: Roster, slot: number): boolean {
  const link = world.linked[slot] ?? -1;
  return link >= 0 && isActive(world, link);
}

export function isPartnerBody(world: Roster, slot: number): boolean {
  return fighterAt(world, slot).duo.role === DuoRole.partner;
}

/** A body's strikes skip a foe its other body holds. */
export function pairHoldsFoe(world: Roster, sourceSlot: number, targetSlot: number): boolean {
  if (!inLivePair(world, sourceSlot)) return false;
  return fighterAt(world, world.linked[sourceSlot] ?? -1).grab.target === targetSlot;
}

export function sameOrLinked(world: Roster, slot: number, other: number | undefined): boolean {
  return other !== undefined && (other === slot || world.linked[slot] === other);
}

export function advanceDuoLocks(world: Roster): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    const { victim } = fighter;
    if (victim.duoChain > 0) {
      if (!canStartAttack(fighter)) victim.duoFree = 0;
      else if (++victim.duoFree >= DUO_CHAIN_FREE_FRAMES) {
        victim.duoChain = 0;
        victim.duoFree = 0;
      }
    }
    if (victim.shieldRun > 0 || victim.shieldFree > 0) {
      if (fighter.shield.stun > 0) {
        victim.shieldRun++;
        victim.shieldFree = 0;
      } else if (++victim.shieldFree >= DUO_SHIELD_FREE_FRAMES) {
        victim.shieldRun = 0;
        victim.shieldFree = 0;
      }
    }
  }
}
