import { addFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";
import { DuoRole } from "./codes";
import { duoRole } from "./fighter";
import { capPercent } from "./percent";
import { type Roster, fighterAt, isActive } from "./roster";

const held: Slots<boolean> = [false, false, false, false];
const partnerIn: Slots<boolean> = [false, false, false, false];
const base: Slots<number> = [0.0, 0.0, 0.0, 0.0];

/** Notes each linked pair's percent before the frame changes either body's. */
export function holdPairPercents(world: Roster): void {
  for (const slot of PARTICIPANT_SLOTS) {
    const link = world.linked[slot] ?? -1;
    held[slot] = link >= 0 && isActive(world, slot) && isActive(world, link) && duoRole(fighterAt(world, slot)) === DuoRole.leader;
    if (!held[slot]) continue;
    base[slot] = fighterAt(world, slot).status.damage;
    partnerIn[slot] = !fighterAt(world, link).status.out;
  }
}

/** Gives both bodies of each held pair the pair's one percent: what it was plus what each body took since; a partner back in the match takes the leader's. */
export function sharePairPercents(world: Roster): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!held[slot]) continue;
    const leader = fighterAt(world, slot).status;
    const partner = fighterAt(world, world.linked[slot] ?? -1).status;
    const together = !leader.out && !partner.out;
    if (together && partnerIn[slot]) {
      const shared = capPercent(addFloat32(leader.damage, subtractFloat32(partner.damage, base[slot])));
      leader.damage = shared;
      partner.damage = shared;
    } else if (together) partner.damage = leader.damage;
    base[slot] = leader.damage;
    partnerIn[slot] = !partner.out;
  }
}
