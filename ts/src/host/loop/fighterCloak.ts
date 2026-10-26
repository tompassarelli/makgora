import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../../game/input/participants";
import { isActive } from "../../game/sim/roster";
import type { ShellState } from "./state";

export interface HiddenFighter {
  unitShown: boolean;
  body: boolean;
  bare: boolean;
}

const drawn: effect[] = [];

function fighterEffects(s: ShellState, slot: ParticipantSlot): effect[] {
  drawn.length = 0;
  const renderers = s.ui?.fighters[slot];
  const dizzy = s.participants[slot].body?.dizzy;
  if (dizzy !== undefined) drawn.push(dizzy);
  if (renderers === undefined) return drawn;
  renderers.pool?.drawnEffects(drawn);
  renderers.flash.drawnEffects(drawn);
  renderers.glow.drawnEffects(drawn);
  renderers.agency.drawnEffects(drawn);
  renderers.shield.drawnEffects(drawn);
  renderers.candle?.drawnEffects(drawn);
  renderers.spheres?.drawnEffects(drawn);
  renderers.flight?.drawnEffects(drawn);
  renderers.cues?.weaponEffects(drawn);
  return drawn;
}

export function concealFighter(s: ShellState, slot: ParticipantSlot): void {
  const hidden = s.hiddenFighters[slot];
  if (hidden === undefined) return;
  const body = s.participants[slot].body;
  if (body !== undefined && hidden.body) ShowUnit(body.unit, false);
  if (body !== undefined && hidden.bare) BlzShowUnitTeamGlow(body.unit, false);
  if (hidden.body) for (const model of fighterEffects(s, slot)) BlzSetSpecialEffectScale(model, 0.0);
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
    s.hiddenFighters[slot] = { unitShown: was?.body === true ? was.unitShown : !IsUnitHidden(body.unit), body: true, bare: was?.bare === true };
    concealFighter(s, slot);
    return true;
  }
  if (was === undefined || !was.body) return true;
  s.hiddenFighters[slot] = was.bare ? { unitShown: was.unitShown, body: false, bare: true } : undefined;
  ShowUnit(body.unit, was.unitShown);
  if (body.dizzy !== undefined) BlzSetSpecialEffectScale(body.dizzy, 1.0);
  s.ui?.fighters[slot]?.pool?.redraw();
  return true;
}

export function bareFighter(s: ShellState, slot: ParticipantSlot, bare: boolean): void {
  const body = s.participants[slot].body;
  const was = s.hiddenFighters[slot];
  if (bare) {
    if (was?.bare !== true) s.hiddenFighters[slot] = { unitShown: was?.unitShown ?? true, body: was?.body === true, bare: true };
    concealFighter(s, slot);
    return;
  }
  if (was === undefined || !was.bare) return;
  s.hiddenFighters[slot] = was.body ? { unitShown: was.unitShown, body: true, bare: false } : undefined;
  if (body !== undefined) BlzShowUnitTeamGlow(body.unit, true);
}
