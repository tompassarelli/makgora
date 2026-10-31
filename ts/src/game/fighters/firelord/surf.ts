import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../../sim/codes";
import { groundHit } from "../../sim/heroes/groundNormals";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { surfRide } from "../../sim/specials/surfRide";
import type { SpecialKit } from "../../sim/specials/schema";

export const SURF_RIDE_FRAMES = { first: 6, last: 25 } as const;
export const SURF_HITS = [{ first: 6, last: 9 }, { first: 12, last: 15 }, { first: 18, last: 21 }];
export const SURF_RISE = 8.0;
export const SURF_LIFT = 9.0;
export const SURF_DRIFT = 5.0;

const FLAME_JET_HEIGHT = f32(2.0 * HERO_REFERENCE_HEIGHT);
export const SURF_RIDE_LENGTH = SURF_RIDE_FRAMES.last - SURF_RIDE_FRAMES.first + 1;
export const SURF_CLIMB = f32(f32(SURF_RISE + SURF_LIFT) * SURF_RIDE_LENGTH);
export const SURF_CLIMB_IN_HEIGHTS = f32(SURF_CLIMB / HERO_REFERENCE_HEIGHT);
export const SURF_FLAME_JET_RATIO = f32(SURF_CLIMB / FLAME_JET_HEIGHT);

const flame = (damage: number, angle: 80 | 90, growth: number, base: number) => groundHit(damage, angle, growth, base, HitElement.fire);
const surfHit = (last: boolean) => last ? flame(4.0, 80, 63.15253829956055, 30.0) : flame(2.0, 90, 0.0, 14.0);

const LAVA_SURF = surfRide({
  endFrame: 34, windUp: 5, rideFrames: SURF_RIDE_FRAMES, rise: SURF_RISE, lift: SURF_LIFT, drift: SURF_DRIFT,
  hits: SURF_HITS, hitEffect: surfHit, region: { x1: 0.0, z1: 0.0, x2: 0.0, z2: 70.0, radius: 32.0 },
});

export const LAVA_SURF_KIT: SpecialKit = {
  name: "Lava Surf",
  description: "Ride a flow of lava, steered by the stick in any direction, burning foes along the way, then fall helpless.",
  ground: LAVA_SURF,
};
