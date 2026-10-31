import { keyDown, osKey, OsKey } from "wisp/game/input";
const types: OsKey[] = [];

export function osKeyType(key: number): OsKey {
  const known = types[key];
  if (known !== undefined) return known;
  const type = osKey(key);
  types[key] = type;
  return type;
}

export const osKeyDown = (key: number): boolean => keyDown(osKeyType(key));

const MATCH_POLLS = 240;

interface KeyTrack {
  polledAt: number;
  down: boolean;
  reported: boolean;
  rises: number;
  roseAt: number;
  owed: number;
  owedAt: number;
  eventHeld: boolean;
}

export interface KeyTracker {
  readonly keys: KeyTrack[];
  polls: number;
  readonly read: (this: void, key: number) => boolean;
}

export const keyTracker = (read: (this: void, key: number) => boolean = osKeyDown): KeyTracker => ({ keys: [], polls: 0, read });

function track(tracker: KeyTracker, key: number): KeyTrack {
  const known = tracker.keys[key];
  if (known !== undefined) return known;
  const created: KeyTrack = { polledAt: 0, down: false, reported: false, rises: 0, roseAt: 0, owed: 0, owedAt: 0, eventHeld: false };
  tracker.keys[key] = created;
  return created;
}

export function beginKeyPoll(tracker: KeyTracker): void {
  tracker.polls++;
}

export function polledKeyDown(tracker: KeyTracker, key: number): boolean {
  const known = track(tracker, key);
  const { polls } = tracker;
  if (known.polledAt === polls) return known.reported;
  if (polls - known.owedAt > MATCH_POLLS) known.owed = 0;
  const down = tracker.read(key);
  let reported = down;
  if (down && !known.down) {
    if (known.owed > 0) known.owed--;
    else {
      known.rises = polls - known.roseAt > MATCH_POLLS ? 1 : known.rises + 1;
      known.roseAt = polls;
    }
  } else if (!down && known.owed > 0 && !known.reported) {
    known.owed--;
    reported = true;
  }
  known.polledAt = polls;
  known.down = down;
  known.reported = reported;
  return reported;
}

export function noteKeyDownEvent(tracker: KeyTracker, key: number, pressable: boolean): void {
  const known = track(tracker, key);
  if (known.eventHeld) return;
  known.eventHeld = true;
  if (known.rises > 0 && tracker.polls - known.roseAt <= MATCH_POLLS) {
    known.rises--;
    return;
  }
  known.rises = 0;
  if (!pressable) return;
  known.owed++;
  known.owedAt = tracker.polls;
}

export function noteKeyUpEvent(tracker: KeyTracker, key: number): void {
  track(tracker, key).eventHeld = false;
}
