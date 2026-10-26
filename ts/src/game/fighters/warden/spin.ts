import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";

/**
 * Warden's neutral-air spin (#440): her body and blade turn one full circle in
 * the screen plane over the active frames, the tip leading from her facing,
 * over her head, behind her and under her. The hit regions and the animation
 * tool both read this path.
 */
export const WARDEN_SPIN_PIVOT_Z = 52.0;
export const WARDEN_SPIN_SECTORS = 8;

/** The tip's angle about the pivot, degrees counterclockwise from her facing with z up, `progress` frames into `active` active frames. */
export function wardenSpinTipDegrees(progress: number, active: number): number {
  return 360.0 * progress / active;
}

/** The first and last 45-degree sectors (counted from her facing, possibly past 7) the tip passes through on active frame `frame`. */
export function wardenSpinSectors(frame: number, active: number): readonly [number, number] {
  return [floorDiv(WARDEN_SPIN_SECTORS * frame, active), floorDiv(WARDEN_SPIN_SECTORS * (frame + 1) - 1, active)];
}

/** Each sector's bisector, as literals so every runtime reads the same floats. */
const BISECTORS: readonly { readonly x: number; readonly z: number }[] = [
  { x: f32(0.923879533), z: f32(0.382683432) },
  { x: f32(0.382683432), z: f32(0.923879533) },
  { x: f32(-0.382683432), z: f32(0.923879533) },
  { x: f32(-0.923879533), z: f32(0.382683432) },
  { x: f32(-0.923879533), z: f32(-0.382683432) },
  { x: f32(-0.382683432), z: f32(-0.923879533) },
  { x: f32(0.382683432), z: f32(-0.923879533) },
  { x: f32(0.923879533), z: f32(-0.382683432) },
];

/** A blade segment along `sector`'s bisector from `inner` to `outer` units from the pivot. */
export function wardenSpinBlade(sector: number, inner: number, outer: number): { readonly x1: number; readonly z1: number; readonly x2: number; readonly z2: number } {
  const direction = BISECTORS[floorMod(sector, WARDEN_SPIN_SECTORS)];
  if (direction === undefined) throw new Error(`Warden spin sector ${sector} is missing`);
  return {
    x1: f32(inner * direction.x), z1: f32(WARDEN_SPIN_PIVOT_Z + f32(inner * direction.z)),
    x2: f32(outer * direction.x), z2: f32(WARDEN_SPIN_PIVOT_Z + f32(outer * direction.z)),
  };
}
