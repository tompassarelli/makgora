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
  readonly linked?: LinkedSurf | undefined;
  readonly hits: readonly { readonly first: number; readonly last: number }[];
  readonly hitEffect: (this: void, last: boolean) => Readonly<HitEffect>;
  readonly region: StrikeCapsule;
}

export interface LinkedSurf {
  readonly reach: number;
  readonly endFrame: number;
  readonly rideLast: number;
  readonly rise: number;
  readonly board: NonNullable<SpecialMotion["board"]>;
  readonly backflip: { readonly velocityX: number; readonly velocityZ: number };
  readonly push: number;
}

const LINKED_VARIANT = 1;

function ride(surf: Readonly<SurfRide>, endFrame: number, rideLast: number, rise: number, board: SpecialMotion["board"], after: readonly SpecialMotion[]): AuthoredSpecial {
  const steered: SpecialMotion = { ...frames(surf.rideFrames.first, rideLast), velocityX: 0.0, velocityZ: rise, driftSpeed: surf.drift, liftSpeed: surf.lift, board };
  return {
    endFrame, oncePerAirtime: true, helpless: true, facesStick: true,
    rehits: surf.hits.slice(1).map(({ first }) => first + 1),
    motion: [{ ...frames(1, surf.windUp), velocityX: 0.0, velocityZ: 0.0 }, steered, ...after],
    regions: surf.hits.map(({ first, last }, index) => heroRegion(first, last, surf.region, surf.hitEffect(index === surf.hits.length - 1))),
  };
}

/** A once-per-airtime rise steered by the stick that strikes in rehit windows along the way and ends helpless; `linked` takes a partner within reach on the ride's first frame into the longer ride. */
export function surfRide(surf: Readonly<SurfRide>): AuthoredSpecial {
  const solo = ride(surf, surf.endFrame, surf.rideFrames.last, surf.rise, undefined, []);
  const linked = surf.linked;
  if (linked === undefined) return solo;
  const dismount: SpecialMotion = { ...frames(linked.rideLast + 1, linked.rideLast + 1), ...linked.backflip, dismount: { push: linked.push } };
  return {
    ...solo,
    link: { frame: surf.rideFrames.first, reach: linked.reach, variant: LINKED_VARIANT },
    variants: [ride(surf, linked.endFrame, linked.rideLast, linked.rise, linked.board, [dismount])],
  };
}
