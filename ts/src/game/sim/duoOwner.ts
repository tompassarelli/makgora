import { type ParticipantSlot, isParticipantSlot } from "../input/participants";
import { DuoRole } from "./codes";
import type { Fighter } from "./fighter";

export function partnerOwner(fighter: Readonly<Fighter> | undefined, slot: ParticipantSlot): ParticipantSlot {
  return fighter !== undefined && fighter.duo?.role === DuoRole.partner && isParticipantSlot(fighter.duo.link) ? fighter.duo.link : slot;
}
