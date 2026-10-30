import { Character, DuoOrder, DuoRole } from "./codes";
import { type Roster, fighterAt, isActive } from "./roster";
import { RESTING_DUO } from "./fighter";

export const DuoPipState = { synced: 0, holding: 1, separated: 2, down: 3, reviveReady: 4, noRoom: 5 } as const;
export type DuoPipState = (typeof DuoPipState)[keyof typeof DuoPipState];

export interface DuoPip {
  state: DuoPipState;
  percent: number;
}

const SCRATCH: readonly DuoPip[] = [0, 1, 2, 3].map(() => ({ state: DuoPipState.synced, percent: 0 }));

function read(world: Roster, slot: number, out: DuoPip): boolean {
  const leader = fighterAt(world, slot);
  const duo = leader.duo ?? RESTING_DUO;
  if (leader.character !== Character.murloc || duo.role === DuoRole.partner) return false;
  out.percent = 0;
  if (duo.role === DuoRole.solo) {
    out.state = DuoPipState.noRoom;
    return true;
  }
  const link = duo.link;
  const partner = isActive(world, link) ? fighterAt(world, link) : undefined;
  if (partner?.duo === undefined || partner.duo.role !== DuoRole.partner) {
    out.state = duo.reviveSpent ? DuoPipState.down : DuoPipState.reviveReady;
    return true;
  }
  out.percent = partner.status.damage;
  out.state = partner.status.out ? DuoPipState.down
    : partner.duo.order === DuoOrder.separated ? DuoPipState.separated
    : partner.duo.order === DuoOrder.hold ? DuoPipState.holding
    : DuoPipState.synced;
  return true;
}

export function duoPipFor(world: Roster, slot: number): Readonly<DuoPip> | undefined {
  const out = SCRATCH[slot];
  return out !== undefined && read(world, slot, out) ? out : undefined;
}
