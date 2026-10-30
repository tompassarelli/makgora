import { f32 } from "wisp/src/sim/f32";
import { min } from "../core/numbers";
import type { Fighter } from "../sim/fighter";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { characterModelScale } from "./modelScale";
import { specialCueState } from "./specialCues";

export const SPECIAL_TRAIL_FRAMES = 8;
const TRAIL_BODY_HEIGHT = 50.0;

export interface TrailLine {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export const emptyTrailLine = (): TrailLine => ({ x1: 0.0, z1: 0.0, x2: 0.0, z2: 0.0 });

export function specialTrail(fighter: Readonly<Fighter>, out: TrailLine): boolean {
  if (fighter.status.out || specialCueState(fighter).cues?.trail !== true) return false;
  const frame = fighter.special.frame;
  const motion = runningHeroSpecial(fighter)?.motion ?? [];
  for (const segment of motion) {
    if (frame < segment.first || frame > segment.last || (segment.velocityX === 0.0 && segment.velocityZ === 0.0)) continue;
    const velocityX = segment.freeAim === true ? fighter.motion.vx : f32(fighter.facing * segment.velocityX);
    const velocityZ = segment.freeAim === true ? fighter.motion.vz : segment.velocityZ;
    const frames = min(SPECIAL_TRAIL_FRAMES, frame - segment.first + 1);
    out.x1 = fighter.motion.x;
    out.z1 = f32(fighter.motion.z + f32(TRAIL_BODY_HEIGHT * characterModelScale(fighter.character)));
    out.x2 = f32(out.x1 - f32(velocityX * frames));
    out.z2 = f32(out.z1 - f32(velocityZ * frames));
    return true;
  }
  return false;
}
