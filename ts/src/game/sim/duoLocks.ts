import { PARTICIPANT_CAPACITY } from "../input/participants";
import { DuoRole } from "./codes";
import { max } from "../core/numbers";
import { canBeGrabbed, canStartAttack } from "./conditions";
import { type Roster, fighterAt, isActive } from "./roster";
import { RESTING_VICTIM, duoRole, mutableVictim } from "./fighter";

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
    if (victim.grabImmuneDuo > 0) victim.grabImmuneDuo--;
    if (victim.handoffWindow > 0) victim.handoffWindow--;
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

export const HANDOFF_THROWS_PER_CHAIN = 2;
export const HANDOFF_IMMUNE_FRAMES = 90;
export const HANDOFF_REPEAT_IMMUNE_FRAMES = 180;
export const HANDOFF_REPEAT_WINDOW_FRAMES = 300;

/** A pair body may grab the foe its linked body just threw, while that foe is still in throw hitstun and the chain has a handoff left. */
export function canBeGrabbedBy(world: Roster, grabberSlot: number, targetSlot: number): boolean {
  const target = fighterAt(world, targetSlot);
  if (!inLivePair(world, grabberSlot)) return canBeGrabbed(target);
  const { launch } = target;
  const victim = target.victim ?? RESTING_VICTIM;
  if (victim.grabImmuneDuo > 0) return false;
  if (victim.handoffs > 0 && victim.handoffs < HANDOFF_THROWS_PER_CHAIN && launch.throwHitstun && launch.hitstun > 0) return target.status.frozenFrames <= 0;
  return canBeGrabbed(target);
}

/** The pummel count a new grab starts from: a handoff carries the thrower's count to the regrabbing body. */
export function handoffPummels(world: Roster, grabberSlot: number, targetSlot: number): number {
  if (!inLivePair(world, grabberSlot) || (fighterAt(world, targetSlot).victim?.handoffs ?? 0) <= 0) return 0;
  return max(fighterAt(world, grabberSlot).grab.pummels, fighterAt(world, world.linked[grabberSlot] ?? -1).grab.pummels);
}

/** Counts a pair body's throw in the foe's chain; the second throw ends the chain and shuts both bodies out of grabbing the foe, for twice as long on a repeat inside the window. */
export function recordPairThrow(world: Roster, throwerSlot: number, targetSlot: number): void {
  if (!inLivePair(world, throwerSlot)) return;
  const victim = mutableVictim(fighterAt(world, targetSlot));
  if (++victim.handoffs < HANDOFF_THROWS_PER_CHAIN) return;
  victim.grabImmuneDuo = victim.handoffWindow > 0 ? HANDOFF_REPEAT_IMMUNE_FRAMES : HANDOFF_IMMUNE_FRAMES;
  victim.handoffWindow = HANDOFF_REPEAT_WINDOW_FRAMES;
  victim.handoffs = 0;
}
