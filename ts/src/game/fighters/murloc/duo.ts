import { PARTICIPANT_SLOTS } from "../../input/participants";
import { Character, DuoRole } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { type Roster, fighterAt, isActive, setRosterMask } from "../../sim/roster";

export const MURLOC_DUO = {
  delayFrames: 5,
  partnerOffset: 60.0,
  separateDistance: 260.0,
  resyncDistance: 60.0,
  hopHeight: 110.0,
  hopReach: 300.0,
} as const;

function lowestFreeSlot(world: Readonly<Roster>): number {
  for (const slot of PARTICIPANT_SLOTS) if (!isActive(world, slot)) return slot;
  return -1;
}

function seatPartner(world: Roster, leaderSlot: number, partnerSlot: number): void {
  const leader = fighterAt(world, leaderSlot);
  const partner = createFighter(Character.murloc, leader.motion.x - leader.facing * MURLOC_DUO.partnerOffset, leader.facing);
  partner.status.stocks = leader.status.stocks > 0 ? 1 : 0;
  partner.status.out = leader.status.out;
  partner.motion.grounded = leader.motion.grounded;
  partner.motion.surface = leader.motion.surface;
  partner.motion.z = leader.motion.z;
  setWorldMotionValue(partner.motion.meleeZ, partner.motion.z);
  partner.duo.role = DuoRole.partner;
  partner.duo.link = leaderSlot;
  leader.duo.role = DuoRole.leader;
  leader.duo.link = partnerSlot;
  world.fighters[partnerSlot] = partner;
  world.teamChoices[partnerSlot] = world.teamChoices[leaderSlot] ?? 0;
  world.linked[partnerSlot] = leaderSlot;
  world.linked[leaderSlot] = partnerSlot;
  setRosterMask(world, world.mask | (1 << partnerSlot));
}

export function seatMurlocPartners(world: Roster): void {
  const participants = world.mask;
  for (const slot of PARTICIPANT_SLOTS) {
    if ((participants & (1 << slot)) === 0) continue;
    const leader = fighterAt(world, slot);
    if (leader.character !== Character.murloc || leader.duo.role !== DuoRole.solo) continue;
    const partnerSlot = lowestFreeSlot(world);
    if (partnerSlot >= 0) seatPartner(world, slot, partnerSlot);
  }
}
