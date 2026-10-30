import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import type { Fighter } from "../sim/fighter";
import { type HitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { cosineTurns, sineTurns } from "../sim/mathTables";
import { heroLook } from "../roster/looks";
import { type HitAreaPose, normalAreaPose } from "./disjointCues";
import { flightFormShown } from "./flightLook";
import { fighterModelScale } from "./fighterScale";
import type { OrbitLook } from "./model/look";

export interface SpherePose {
  visible: boolean;
  x: number;
  depth: number;
  z: number;
  scale: number;
}

export const emptySpherePose = (): SpherePose => ({ visible: false, x: 0.0, depth: 0.0, z: 0.0, scale: 0.0 });

export function fighterOrbit(character: number): OrbitLook | undefined {
  return heroLook(character)?.orbit;
}

const region: HitRegion = emptyHitRegion();
const area: HitAreaPose = { visible: false, x: 0.0, z: 0.0, scale: 0.0 };


export function thrownSphere(fighter: Readonly<Fighter>): Readonly<HitAreaPose> | undefined {
  const { style } = fighter.attack;
  if (style === undefined || fighter.status.out) return undefined;
  const count = authoredHitRegionCount(style, fighter.tuning.moves);
  for (let index = 0; index < count; index++) {
    normalAreaPose(fighter, style, index, region, area);
    if (area.visible) return area;
  }
  return undefined;
}


export function spherePose(fighter: Readonly<Fighter>, orbit: Readonly<OrbitLook>, index: number, frame: number, out: SpherePose): SpherePose {
  out.visible = !fighter.status.out && !flightFormShown(fighter);
  if (!out.visible) return out;
  const scale = fighterModelScale(fighter);
  out.scale = f32(orbit.scale * scale);
  const thrown = index === 0 ? thrownSphere(fighter) : undefined;
  if (thrown !== undefined) {
    out.x = thrown.x;
    out.z = thrown.z;
    out.depth = 0.0;
    return out;
  }
  const turns = f32(f32(imod(frame, orbit.periodFrames) / orbit.periodFrames) + f32(index / orbit.count));
  out.x = f32(fighter.motion.x + f32(f32(orbit.radius * cosineTurns(turns)) * scale));
  out.depth = f32(f32(orbit.radius * sineTurns(turns)) * scale);
  out.z = f32(fighter.motion.z + f32(f32(orbit.z + f32(8.0 * sineTurns(f32(turns * 2.0)))) * scale));
  return out;
}
