import { PARTICIPANT_CAPACITY } from "../input/participants";
import { f32 } from "wisp/src/sim/f32";
import { DuoOrder, DuoRole } from "./codes";
import { max } from "../core/numbers";
import { canStartAttack } from "./conditions";
import type { Fighter } from "./fighter";
import { type Roster, fighterAt, isActive } from "./roster";
import { duoRole, mutableVictim } from "./fighter";

export const DUO_CHAIN_CAP = 12;
export const DUO_CHAIN_FREE_FRAMES = 20;
export const DUO_SHIELD_STUN_CAP = 30;
export const DUO_SHIELD_FREE_FRAMES = 10;

/** Whether the slot is a body of a live linked pair, with its other body in the match. */
export function inLivePair(world: Roster, slot: number): boolean {
  const link = world.linked[slot] ?? -1;
  return link >= 0 && isActive(world, link);
}

export function pairedWithin(world: Roster, fighter: Readonly<Fighter>, distance: number, heldDistance: number): boolean {
  const slot = world.fighters.indexOf(fighter);
  if (slot < 0 || !inLivePair(world, slot)) return false;
  const other = fighterAt(world, world.linked[slot] ?? -1);
  const duo = fighter.duo;
  const otherDuo = other.duo;
  if (duo === undefined || otherDuo === undefined) return false;
  const order = duo.role === DuoRole.partner ? duo.order : otherDuo.order;
  const apart = Math.abs(f32(fighter.motion.x - other.motion.x));
  return !other.status.out && (order === DuoOrder.copy ? apart <= distance : order === DuoOrder.hold && apart <= heldDistance);
}

export function isPartnerBody(world: Roster, slot: number): boolean {
  return duoRole(fighterAt(world, slot)) === DuoRole.partner;
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
    if (victim === undefined) continue;
    if (victim.handoffs > 0 && fighter.launch.hitstun <= 0 && fighter.grab.owner === undefined) victim.handoffs = 0;
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

/** The pummel count a new grab starts from: a handoff carries the thrower's count to the regrabbing body. */
export function handoffPummels(world: Roster, grabberSlot: number, targetSlot: number): number {
  if (!inLivePair(world, grabberSlot) || (fighterAt(world, targetSlot).victim?.handoffs ?? 0) <= 0) return 0;
  return max(fighterAt(world, grabberSlot).grab.pummels, fighterAt(world, world.linked[grabberSlot] ?? -1).grab.pummels);
}

/** Counts a pair body's throw in the foe's chain, so the regrabbing body carries the pummel count. */
export function recordPairThrow(world: Roster, throwerSlot: number, targetSlot: number): void {
  if (!inLivePair(world, throwerSlot)) return;
  mutableVictim(fighterAt(world, targetSlot)).handoffs++;
}
