import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../../game/input/participants";
import { isActive } from "../../game/sim/roster";
import type { ShellState } from "./state";

export interface HiddenFighter {
  unitShown: boolean;
  body: boolean;
  bare: boolean;
  cues: boolean;
}

export type CloakPart = "fighter" | "cues";

const drawn: effect[] = [];
const concealedCues: { readonly models: effect[]; readonly scales: number[] }[] = PARTICIPANT_SLOTS.map(() => ({ models: [], scales: [] }));

function fighterEffects(s: ShellState, slot: ParticipantSlot, everything: boolean): effect[] {
  drawn.length = 0;
  const renderers = s.ui?.fighters[slot];
  if (!everything) {
    renderers?.cues?.weaponEffects(drawn);
    return drawn;
  }
  const dizzy = s.participants[slot].body?.dizzy;
  if (dizzy !== undefined) drawn.push(dizzy);
  if (renderers === undefined) return drawn;
  renderers.pool?.drawnEffects(drawn);
  renderers.flash.drawnEffects(drawn);
  renderers.agency.drawnEffects(drawn);
  renderers.shield.drawnEffects(drawn);
  renderers.cues?.weaponEffects(drawn);
  return drawn;
}

function cueEffects(s: ShellState, slot: ParticipantSlot): effect[] {
  drawn.length = 0;
  const renderers = s.ui?.fighters[slot];
  if (renderers === undefined) return drawn;
  renderers.cues?.drawnEffects(drawn);
  renderers.projectiles.drawnEffects(drawn);
  s.ui?.special.slotEffects(slot, drawn);
  s.ui?.placed.slotEffects(slot, drawn);
  return drawn;
}

function concealCues(s: ShellState, slot: ParticipantSlot): void {
  const concealed = concealedCues[slot];
  if (concealed === undefined) return;
  for (const model of cueEffects(s, slot)) {
    const scale = BlzGetSpecialEffectScale(model);
    if (scale === 0.0) continue;
    const index = concealed.models.indexOf(model);
    if (index < 0) {
      concealed.models.push(model);
      concealed.scales.push(scale);
    } else concealed.scales[index] = scale;
    BlzSetSpecialEffectScale(model, 0.0);
  }
}

function revealCues(s: ShellState, slot: ParticipantSlot): void {
  const concealed = concealedCues[slot];
  if (concealed === undefined) return;
  for (const model of cueEffects(s, slot)) {
    const index = concealed.models.indexOf(model);
    if (index >= 0) BlzSetSpecialEffectScale(model, concealed.scales[index] ?? 1.0);
  }
  concealed.models.length = 0;
  concealed.scales.length = 0;
}

export function concealFighter(s: ShellState, slot: ParticipantSlot): void {
  const hidden = s.hiddenFighters[slot];
  if (hidden === undefined) return;
  const body = s.participants[slot].body;
  if (body !== undefined && hidden.body) ShowUnit(body.unit, false);
  if (body !== undefined && hidden.bare) BlzShowUnitTeamGlow(body.unit, false);
  if (hidden.body || hidden.bare) for (const model of fighterEffects(s, slot, hidden.body)) BlzSetSpecialEffectScale(model, 0.0);
  if (hidden.cues) concealCues(s, slot);
}

export function concealFighters(s: ShellState): void {
  for (const slot of PARTICIPANT_SLOTS) concealFighter(s, slot);
}

export function fighterHideCommand(message: string): { readonly slot: ParticipantSlot; readonly hidden: boolean; readonly part: CloakPart } | undefined {
  const hidden = message.startsWith("-dev hide ");
  if (!hidden && !message.startsWith("-dev show ")) return undefined;
  const rest = message.substring(10);
  const part: CloakPart | undefined = rest.startsWith("fighter ") ? "fighter" : rest.startsWith("cues ") ? "cues" : undefined;
  if (part === undefined) return undefined;
  const word = rest.substring(part.length + 1);
  for (const slot of PARTICIPANT_SLOTS) if (word === I2S(slot)) return { slot, hidden, part };
  return undefined;
}

function cloaked(was: HiddenFighter | undefined, change: Partial<HiddenFighter>, unitShown: boolean): HiddenFighter | undefined {
  const next = { unitShown, body: was?.body === true, bare: was?.bare === true, cues: was?.cues === true, ...change };
  return next.body || next.bare || next.cues ? next : undefined;
}

export function hideCues(s: ShellState, slot: ParticipantSlot, hidden: boolean): boolean {
  const body = s.participants[slot].body;
  if (body === undefined || !isActive(s.world, slot)) return false;
  const was = s.hiddenFighters[slot];
  s.hiddenFighters[slot] = cloaked(was, { cues: hidden }, was?.unitShown ?? !IsUnitHidden(body.unit));
  if (hidden) concealFighter(s, slot);
  else revealCues(s, slot);
  return true;
}

export function hideFighter(s: ShellState, slot: ParticipantSlot, hidden: boolean): boolean {
  const body = s.participants[slot].body;
  if (body === undefined || !isActive(s.world, slot)) return false;
  const was = s.hiddenFighters[slot];
  if (hidden) {
    s.hiddenFighters[slot] = cloaked(was, { body: true }, was?.body === true ? was.unitShown : !IsUnitHidden(body.unit));
    concealFighter(s, slot);
    return true;
  }
  if (was === undefined || !was.body) return true;
  s.hiddenFighters[slot] = cloaked(was, { body: false }, was.unitShown);
  ShowUnit(body.unit, was.unitShown);
  if (body.dizzy !== undefined) BlzSetSpecialEffectScale(body.dizzy, 1.0);
  s.ui?.fighters[slot]?.pool?.redraw();
  return true;
}

export function bareFighter(s: ShellState, slot: ParticipantSlot, bare: boolean): void {
  const body = s.participants[slot].body;
  const was = s.hiddenFighters[slot];
  if (bare) {
    if (was?.bare !== true) s.hiddenFighters[slot] = cloaked(was, { bare: true }, was?.unitShown ?? true);
    concealFighter(s, slot);
    return;
  }
  if (was === undefined || !was.bare) return;
  s.hiddenFighters[slot] = cloaked(was, { bare: false }, was.unitShown);
  if (body !== undefined) BlzShowUnitTeamGlow(body.unit, true);
}

export function clearCloaks(s: ShellState): void {
  for (const slot of PARTICIPANT_SLOTS) {
    s.hiddenFighters[slot] = undefined;
    revealCues(s, slot);
  }
}
