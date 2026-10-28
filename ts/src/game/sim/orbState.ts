export const OrbKind = { none: 0, ex: 1, ultimate: 2 } as const;
export type OrbKind = (typeof OrbKind)[keyof typeof OrbKind];

export interface MatchOrbs {
  on: boolean;
  live: OrbKind;
  held: OrbKind;
  spawnSerial: number;
  pickupSerial: number;
  lastTaker: number;
  lastKind: OrbKind;
  lastWasted: boolean;
}

export function createMatchOrbs(): MatchOrbs {
  return { on: true, live: OrbKind.none, held: OrbKind.none, spawnSerial: 0, pickupSerial: 0, lastTaker: -1, lastKind: OrbKind.none, lastWasted: false };
}

export function copyMatchOrbs(target: MatchOrbs, source: Readonly<MatchOrbs>): void {
  target.on = source.on;
  target.live = source.live;
  target.held = source.held;
  target.spawnSerial = source.spawnSerial;
  target.pickupSerial = source.pickupSerial;
  target.lastTaker = source.lastTaker;
  target.lastKind = source.lastKind;
  target.lastWasted = source.lastWasted;
}

export function resetMatchOrbs(orbs: MatchOrbs): void {
  orbs.live = OrbKind.none;
  orbs.held = OrbKind.none;
  orbs.spawnSerial = 0;
  orbs.pickupSerial = 0;
  orbs.lastTaker = -1;
  orbs.lastKind = OrbKind.none;
  orbs.lastWasted = false;
}

export function firstOrbsDifference(e: Readonly<MatchOrbs>, a: Readonly<MatchOrbs>): string | undefined {
  if (e.on !== a.on) return "match.orbs.on";
  if (e.live !== a.live) return "match.orbs.live";
  if (e.held !== a.held) return "match.orbs.held";
  if (e.spawnSerial !== a.spawnSerial) return "match.orbs.spawnSerial";
  if (e.pickupSerial !== a.pickupSerial) return "match.orbs.pickupSerial";
  if (e.lastTaker !== a.lastTaker) return "match.orbs.lastTaker";
  if (e.lastKind !== a.lastKind) return "match.orbs.lastKind";
  if (e.lastWasted !== a.lastWasted) return "match.orbs.lastWasted";
  return undefined;
}

export function writeMatchOrbs(orbs: Readonly<MatchOrbs>, int: (name: string, value: number) => void, bool: (name: string, value: boolean) => void): void {
  if (!orbs.on) bool("match.orbs.on", false);
  if (orbs.spawnSerial === 0 && orbs.held === OrbKind.none) return;
  int("match.orbs.live", orbs.live);
  int("match.orbs.held", orbs.held);
  int("match.orbs.spawnSerial", orbs.spawnSerial);
  int("match.orbs.pickupSerial", orbs.pickupSerial);
  int("match.orbs.lastTaker", orbs.lastTaker);
  int("match.orbs.lastKind", orbs.lastKind);
  bool("match.orbs.lastWasted", orbs.lastWasted);
}
