


import { multiplyFloat32 } from "wisp/src/sim/binary32";
import { type Capsule, attackCapsule, emptyCapsule, placeCapsule } from "../sim/geometry/contactGeometry";
import { fighterPoseFacing } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { HurtState, fighterHurtParts } from "../sim/hurtboxes";
import { shieldSizeMultiplier } from "../sim/shield";
import { shieldCenterX, shieldCenterZ } from "../sim/shieldTilt";


export const HitAreaKind = { body: 0, protected: 1, strike: 2, shield: 3 } as const;
export type HitAreaKind = (typeof HitAreaKind)[keyof typeof HitAreaKind];

export interface HitArea {
  readonly capsule: Capsule;
  kind: HitAreaKind;
}


export interface HitAreaList {
  count: number;
  readonly areas: HitArea[];
}

export function createHitAreaList(): HitAreaList {
  return { count: 0, areas: [] };
}

function next(list: HitAreaList, kind: HitAreaKind): Capsule {
  let area = list.areas[list.count];
  if (area === undefined) {
    area = { capsule: emptyCapsule(), kind };
    list.areas.push(area);
  }
  area.kind = kind;
  list.count++;
  return area.capsule;
}


const region = emptyHitRegion();
const local = emptyCapsule();


export function collectHitAreas(f: Readonly<Fighter>, list: HitAreaList): void {
  list.count = 0;
  if (f.status.out) return;
  const facing = fighterPoseFacing(f);
  for (const part of fighterHurtParts(f)) {
    const state = part.state ?? HurtState.normal;
    placeCapsule(next(list, state === HurtState.normal ? HitAreaKind.body : HitAreaKind.protected), part, f.motion.x, f.motion.z, facing);
  }
  if (f.shield.raised) {
    const shield = next(list, HitAreaKind.shield);
    shield.x1 = shield.x2 = shieldCenterX(f);
    shield.z1 = shield.z2 = shieldCenterZ(f);
    shield.radius = multiplyFloat32(f.tuning.shield.radius, shieldSizeMultiplier(f.shield.energy, f.shield.strength));
  }
  const { attack } = f;
  if (attack.style === undefined || attack.dashGrab || f.launch.hitlag > 0) return;
  for (let index = 0; index < authoredHitRegionCount(attack.style, f.tuning.moves); index++) {
    authoredHitRegion(region, f.character, attack.style, attack.frame, attack.smashChargeFrames, index, f.tuning.moves);
    if (region.window <= 0) continue;
    attackCapsule(local, attack.style, region);
    placeCapsule(next(list, HitAreaKind.strike), local, f.motion.x, f.motion.z, f.facing);
  }
}
