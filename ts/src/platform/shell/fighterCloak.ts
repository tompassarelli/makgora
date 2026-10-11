import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../../game/input/participants";
import { isActive } from "../../game/sim/roster";
import type { ShellState } from "./state";


// `-dev hide fighter SLOT` draws nothing of one fighter while the sim runs on, so a held native frame
// captured shown and then hidden yields that fighter's silhouette (wisp#125). Local presentation only.
export interface HiddenFighter {
  /** Whether the body unit would be shown now, so show restores it. */
  unitShown: boolean;
}

const drawn: effect[] = [];


function fighterEffects(s: ShellState, slot: ParticipantSlot): effect[] {
  drawn.length = 0;
  const dizzy = s.participants[slot].body?.dizzy;
  if (dizzy !== undefined) drawn.push(dizzy);
  const renderers = s.ui?.fighters[slot];
  if (renderers === undefined) return drawn;
  renderers.pool?.drawnEffects(drawn);
  renderers.flash.drawnEffects(drawn);
  renderers.agency.drawnEffects(drawn);
  renderers.shield.drawnEffects(drawn);
  renderers.cues?.weaponEffects(drawn);
  return drawn;
}


export function concealFighter(s: ShellState, slot: ParticipantSlot): void {
  if (s.hiddenFighters[slot] === undefined) return;
  const body = s.participants[slot].body;
  if (body !== undefined) ShowUnit(body.unit, false);
  for (const model of fighterEffects(s, slot)) BlzSetSpecialEffectScale(model, 0.0);
}


export function concealFighters(s: ShellState): void {
  for (const slot of PARTICIPANT_SLOTS) concealFighter(s, slot);
}


export function fighterHideCommand(message: string): { readonly slot: ParticipantSlot; readonly hidden: boolean } | undefined {
  const hidden = message.startsWith("-dev hide fighter ");
  if (!hidden && !message.startsWith("-dev show fighter ")) return undefined;
  const word = message.substring(18);
  for (const slot of PARTICIPANT_SLOTS) if (word === I2S(slot)) return { slot, hidden };
  return undefined;
}


export function hideFighter(s: ShellState, slot: ParticipantSlot, hidden: boolean): boolean {
  const body = s.participants[slot].body;
  if (body === undefined || !isActive(s.world, slot)) return false;
  const was = s.hiddenFighters[slot];
  if (hidden) {
    s.hiddenFighters[slot] = was ?? { unitShown: !IsUnitHidden(body.unit) };
    concealFighter(s, slot);
    return true;
  }
  if (was === undefined) return true;
  s.hiddenFighters[slot] = undefined;
  ShowUnit(body.unit, was.unitShown);
  if (body.dizzy !== undefined) BlzSetSpecialEffectScale(body.dizzy, 1.0);
  s.ui?.fighters[slot]?.pool?.redraw();
  return true;
}
