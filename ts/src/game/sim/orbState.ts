export interface MatchOrbs {
  on: boolean;
  live: boolean;
  held: boolean;
  spawnSerial: number;
  pickupSerial: number;
  lastTaker: number;
  lastWasted: boolean;
}

export function createMatchOrbs(): MatchOrbs {
  return { on: false, live: false, held: false, spawnSerial: 0, pickupSerial: 0, lastTaker: -1, lastWasted: false };
}

export function copyMatchOrbs(target: MatchOrbs, source: Readonly<MatchOrbs>): void {
  target.on = source.on;
  target.live = source.live;
  target.held = source.held;
  target.spawnSerial = source.spawnSerial;
  target.pickupSerial = source.pickupSerial;
  target.lastTaker = source.lastTaker;
  target.lastWasted = source.lastWasted;
}

export function resetMatchOrbs(orbs: MatchOrbs): void {
  orbs.live = false;
  orbs.held = false;
  orbs.spawnSerial = 0;
  orbs.pickupSerial = 0;
  orbs.lastTaker = -1;
  orbs.lastWasted = false;
}

export function firstOrbsDifference(e: Readonly<MatchOrbs>, a: Readonly<MatchOrbs>): string | undefined {
  if (e.on !== a.on) return "match.orbs.on";
  if (e.live !== a.live) return "match.orbs.live";
  if (e.held !== a.held) return "match.orbs.held";
  if (e.spawnSerial !== a.spawnSerial) return "match.orbs.spawnSerial";
  if (e.pickupSerial !== a.pickupSerial) return "match.orbs.pickupSerial";
  if (e.lastTaker !== a.lastTaker) return "match.orbs.lastTaker";
  if (e.lastWasted !== a.lastWasted) return "match.orbs.lastWasted";
  return undefined;
}

export function writeMatchOrbs(orbs: Readonly<MatchOrbs>, int: (name: string, value: number) => void, bool: (name: string, value: boolean) => void): void {
  if (orbs.on) bool("match.orbs.on", true);
  if (orbs.spawnSerial === 0 && !orbs.held && !orbs.live) return;
  bool("match.orbs.live", orbs.live);
  bool("match.orbs.held", orbs.held);
  int("match.orbs.spawnSerial", orbs.spawnSerial);
  int("match.orbs.pickupSerial", orbs.pickupSerial);
  int("match.orbs.lastTaker", orbs.lastTaker);
  bool("match.orbs.lastWasted", orbs.lastWasted);
}
