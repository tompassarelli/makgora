import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { ORB_WARNING_FRAMES } from "../sim/orbs";
import type { MatchOrbs } from "../sim/orbState";

export interface OrbCueObservation {
  warned: boolean;
  spawnSerial: number;
  pickupSerial: number;
}

export const createOrbCueObservation = (): OrbCueObservation => ({ warned: false, spawnSerial: 0, pickupSerial: 0 });

export const OrbCue = { warning: 1, spawn: 2, pickup: 4 } as const;

export function observeOrbCues(before: OrbCueObservation, orbs: Readonly<MatchOrbs>, warned: boolean): void {
  before.warned = warned;
  before.spawnSerial = orbs.spawnSerial;
  before.pickupSerial = orbs.pickupSerial;
}

export function confirmedOrbCues(before: Readonly<OrbCueObservation>, orbs: Readonly<MatchOrbs>, warned: boolean): number {
  let cues = 0;
  if (warned && !before.warned) cues |= OrbCue.warning;
  if (before.spawnSerial !== orbs.spawnSerial) cues |= OrbCue.spawn;
  if (before.pickupSerial !== orbs.pickupSerial && !orbs.lastWasted) cues |= OrbCue.pickup;
  return cues;
}

export const ORB_MARKER_SCALE_START = f32(0.2);
export const ORB_MARKER_SCALE_END = f32(0.45);
export const ORB_SCALE = f32(1.1);
export const ORB_PULSE_FRAMES = 30;

export function orbMarkerScale(left: number): number {
  const progress = f32(f32(ORB_WARNING_FRAMES - left) / ORB_WARNING_FRAMES);
  return f32(ORB_MARKER_SCALE_START + f32(f32(ORB_MARKER_SCALE_END - ORB_MARKER_SCALE_START) * progress));
}

export function orbMarkerAlpha(left: number): number {
  const phase = floorMod(left, ORB_PULSE_FRAMES);
  return phase < ORB_PULSE_FRAMES / 2 ? 255 : 140;
}

export const ORB_BURST_FRAMES = 30;

export interface OrbSighting {
  shown: boolean;
  bursting: boolean;
  pickupSerial: number;
  burstEnd: number;
}

export const createOrbSighting = (): OrbSighting => ({ shown: false, bursting: false, pickupSerial: 0, burstEnd: 0 });

export function sightOrb(seen: OrbSighting, orbs: Readonly<MatchOrbs>, frame: number): void {
  if (orbs.pickupSerial !== seen.pickupSerial) {
    seen.pickupSerial = orbs.pickupSerial;
    seen.burstEnd = orbs.pickupSerial > 0 ? frame + ORB_BURST_FRAMES : 0;
  }
  const bursting = !orbs.live && frame < seen.burstEnd && frame >= seen.burstEnd - ORB_BURST_FRAMES;
  seen.shown = orbs.live || bursting;
  seen.bursting = bursting;
}
