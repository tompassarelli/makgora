import { Character, DuoRole } from "./codes";
import { type Roster, fighterAt } from "./roster";

/** Whether the slot's plate stands for a Murlocs pair: a Murloc leader with a partner seated, in the match or out of it. */
export function leadsDuo(world: Roster, slot: number): boolean {
  const leader = fighterAt(world, slot);
  return leader.character === Character.murloc && leader.duo?.role === DuoRole.leader;
}
