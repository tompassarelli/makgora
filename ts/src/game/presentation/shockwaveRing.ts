import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import type { Fighter } from "../sim/fighter";
import { heroRegionOrigin, runningHeroSpecial } from "../sim/specials/engine";

export const SHOCKWAVE_FADE_FRAMES = 8;

export interface ShockwaveRing {
  x: number;
  z: number;
  radius: number;
  alpha: number;
}

export function shockwaveRing(out: ShockwaveRing, fighter: Readonly<Fighter>): ShockwaveRing | undefined {
  const move = runningHeroSpecial(fighter);
  if (move?.radial !== true || fighter.status.out) return undefined;
  const frame = fighter.special.frame - 1;
  let last = -1;
  for (const region of move.regions ?? []) {
    const strike = region.hit.strike;
    if (strike === undefined || frame < region.firstFrame) continue;
    const age = frame - region.lastFrame;
    if (age > SHOCKWAVE_FADE_FRAMES) continue;
    last = region.lastFrame;
    const origin = heroRegionOrigin(fighter);
    out.x = f32(origin.x + f32(strike.x1 * fighter.facing));
    out.z = f32(origin.z + strike.z1);
    out.radius = strike.radius;
    out.alpha = age <= 0 ? 255 : floorDiv(255 * (SHOCKWAVE_FADE_FRAMES + 1 - age), SHOCKWAVE_FADE_FRAMES + 1);
  }
  return last < 0 ? undefined : out;
}
