




import { f32 } from "wisp/src/sim/f32";
import { HeroStatusGroup, HeroStatusKind } from "./codes";
import type { Fighter } from "./fighter";
import type { AppliedStatus } from "./appliedStatus";


export const CHILL_SPEED_SCALE = f32(0.6);


function slowedSpeed(f: Readonly<Fighter>, speed: number): number {
  return f.motion.grounded && f.status.slowFrames > 0 ? f32(speed * f.status.slowScale) : speed;
}

export function chillScaled(f: Readonly<Fighter>, speed: number): number {
  if (f.motion.grounded && f.status.condition === HeroStatusKind.root) return 0.0;
  const slowed = slowedSpeed(f, speed);
  return f.status.condition === HeroStatusKind.chill ? f32(slowed * CHILL_SPEED_SCALE) : slowed;
}


export const CHILL: AppliedStatus = { kind: HeroStatusKind.chill, frames: 75, group: HeroStatusGroup.chill, immunityFrames: 120 };
