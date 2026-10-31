import type { ParticipantSlot } from "../../game/input/participants";
import { duoRole } from "../../game/sim/fighter";
import { type Roster, fighterAt, isActive } from "../../game/sim/roster";
import type { ShellState } from "./state";
import { type UiObjects, beginFighterRenderers } from "./ui";

export function followFormChange(s: ShellState, ui: UiObjects, slot: ParticipantSlot, world: Readonly<Roster>): void {
  const renderers = ui.fighters[slot];
  if (renderers === undefined || !isActive(world, slot)) return;
  const fighter = fighterAt(world, slot);
  if (renderers.character === fighter.character) return;
  const participant = s.participants[slot];
  participant.pooled = beginFighterRenderers(s, slot, fighter.character, duoRole(fighter), participant.pooled);
}
