import { PARTICIPANT_SLOTS } from "../input/participants";
import { gainMana, trickleDue } from "../sim/mana";
import { type Roster, fighterAt, isActive } from "../sim/roster";

export function advanceManaTrickle(world: Roster, playedFrames: number): void {
  if (!trickleDue(playedFrames)) return;
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) gainMana(fighterAt(world, slot), 1);
}
