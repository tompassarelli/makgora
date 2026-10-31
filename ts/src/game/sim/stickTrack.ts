import type { Fighter } from "./fighter";
import type { Controls } from "./roster";
import { chargedAimX, chargedAimZ } from "./specials/aimZone";
import { readsStickMotion, recordStick } from "./stickHistory";

export function trackStick(f: Fighter, input: Readonly<Controls>): void {
  if (f.tuning.specials === undefined || !readsStickMotion(f.tuning.specials)) return;
  recordStick(f, chargedAimX(input), chargedAimZ(input));
}
