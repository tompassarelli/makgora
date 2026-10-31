import { type StrikeCapsule, heroRegion } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { type AuthoredSpecial, type SpecialMotion, frames } from "./schema";

export interface SurfRide {
  readonly endFrame: number;
  readonly windUp: number;
  readonly rideFrames: { readonly first: number; readonly last: number };
  readonly rise: number;
  readonly drift: number;
  readonly lift?: number | undefined;
  readonly carry?: SpecialMotion["ride"] | undefined;
  readonly hits: readonly { readonly first: number; readonly last: number }[];
  readonly hitEffect: (this: void, last: boolean) => Readonly<HitEffect>;
  readonly region: StrikeCapsule;
}

/** A once-per-airtime rise steered by the stick that strikes in rehit windows along the way and ends helpless. */
export function surfRide(surf: Readonly<SurfRide>): AuthoredSpecial {
  const ride: SpecialMotion = { ...frames(surf.rideFrames.first, surf.rideFrames.last), velocityX: 0.0, velocityZ: surf.rise, driftSpeed: surf.drift, liftSpeed: surf.lift, ride: surf.carry };
  return {
    endFrame: surf.endFrame, oncePerAirtime: true, helpless: true, facesStick: true,
    rehits: surf.hits.slice(1).map(({ first }) => first + 1),
    motion: [{ ...frames(1, surf.windUp), velocityX: 0.0, velocityZ: 0.0 }, ride],
    regions: surf.hits.map(({ first, last }, index) => heroRegion(first, last, surf.region, surf.hitEffect(index === surf.hits.length - 1))),
  };
}
